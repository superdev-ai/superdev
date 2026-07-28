#!/usr/bin/env node
/**
 * Provider detection and readiness engine.
 *
 * READ-ONLY. Bounded. Root-confined. Network-free. It installs, enables,
 * configures, and invokes nothing.
 *
 * Corrections that shape this file:
 *  - LIVE STATE FIRST. `claude plugin list --json` (and the Codex / skills
 *    equivalents) are the authority; filesystem inspection is a DOCUMENTED
 *    FALLBACK, used only when the live listing is unavailable.
 *  - FAIL CLOSED. A probe that fails, times out, or returns malformed policy
 *    state yields `unknown` / `policy-state-unavailable` - never "not blocked",
 *    never a silent ready. An explicit `enabled: false` is respected.
 *  - "CLI BINARY EXISTS" IS NEVER "CAPABILITY IS READY". A binary is one
 *    component; readiness is composed from every required component.
 *  - COMPOSITE PROVIDERS. Find Skills (skill + CLI) and envx (CLI + skill) are
 *    modelled component-by-component and report `partially-ready` honestly.
 *
 * Exit codes: 0 all providers ready, 1 one or more not ready, 2 usage.
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TalksError, isMain, resolveRoot, usageError, writeReport, redactSensitive } from "../../src/model/toolkit.mjs";
import { PROVIDERS, PROVIDER_IDS, getProvider, CAPABILITY_STATES, DELIVERY, VERSION_POLICY } from "./registry.mjs";

const USAGE = `Usage: node detect.mjs <detect|contract> --root <path> [options]
  detect   [--provider <id>] [--home <dir>]   capability state for each provider
  contract [--provider <id>]                  the adapter contract (no detection)
  --json / --out <file>`;

const PROBE_TIMEOUT_MS = 5000;
/** Extra state used alongside the documented capability states. */
export const PARTIALLY_READY = "partially-ready";
export const POLICY_STATE_UNAVAILABLE = "policy-state-unavailable";
export const EXTENDED_STATES = [...CAPABILITY_STATES, PARTIALLY_READY, POLICY_STATE_UNAVAILABLE];

export function defaultEnv() {
  return {
    home: os.homedir(),
    pathDirs: (process.env.PATH ?? "").split(path.delimiter).filter(Boolean),
    /** Bounded, non-interactive, network-free command probe. Returns stdout or throws. */
    run: (cmd, args) => execFileSync(cmd, args, {
      encoding: "utf8", timeout: PROBE_TIMEOUT_MS, stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 8 * 1024 * 1024,
    }),
  };
}

// ---- live harness listings (authority) -----------------------------------

/** `claude plugin list --json`. Returns { ok, entries } or { ok:false, reason }. */
export function liveClaudePlugins(env) {
  let raw;
  try { raw = env.run("claude", ["plugin", "list", "--json"]); }
  catch (e) { return { ok: false, reason: `claude plugin list unavailable (${e.code ?? "error"})` }; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { ok: false, reason: "claude plugin list returned unparseable JSON" }; }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.plugins) ? parsed.plugins : null;
  if (!list) return { ok: false, reason: "claude plugin list JSON had an unrecognized shape" };
  return { ok: true, entries: list };
}

export function liveCodexPlugins(env) {
  let raw;
  try { raw = env.run("codex", ["plugin", "list", "--json"]); }
  catch (e) { return { ok: false, reason: `codex plugin list unavailable (${e.code ?? "error"})` }; }
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.plugins) ? parsed.plugins : null;
    return list ? { ok: true, entries: list } : { ok: false, reason: "codex plugin list JSON had an unrecognized shape" };
  } catch { return { ok: false, reason: "codex plugin list returned unparseable JSON" }; }
}

export function liveSkillsList(env) {
  let raw;
  try { raw = env.run("skills", ["ls", "--json"]); }
  catch (e) { return { ok: false, reason: `skills ls unavailable (${e.code ?? "error"})` }; }
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.skills) ? parsed.skills : null;
    return list ? { ok: true, entries: list } : { ok: false, reason: "skills ls JSON had an unrecognized shape" };
  } catch { return { ok: false, reason: "skills ls returned unparseable JSON" }; }
}

/** Find a plugin in a live listing by its `name@marketplace` key.
 *  Verified shape (claude 2.1.220): entries carry a single `id` of the form
 *  "name@marketplace" plus `enabled`. Separate name/marketplace fields are also
 *  accepted so a listing-shape change degrades to no-match, never a false match. */
function findLiveEntry(entries, key) {
  const [name, marketplace] = key.split("@");
  const matches = entries.filter((e) => {
    if (typeof e?.id === "string" && e.id === key) return true;          // exact qualified id
    const n = e?.name ?? e?.plugin;
    if (n === undefined) return false;
    if (n === key) return true;                                          // name already qualified
    if (n !== name) return false;
    const m = e?.marketplace ?? e?.source ?? e?.marketplaceName;
    return marketplace ? (m === undefined || m === marketplace) : true;
  });
  // Duplicate/conflicting records must not be resolved by picking one.
  if (matches.length > 1) return { conflict: true, matches };
  return { conflict: false, entry: matches[0] ?? null };
}

// ---- filesystem fallback -------------------------------------------------

function readInstalledPlugins(env) {
  const file = path.join(env.home, ".claude", "plugins", "installed_plugins.json");
  if (!fs.existsSync(file)) return { ok: false, reason: "no plugin store on this machine" };
  try { return { ok: true, store: JSON.parse(fs.readFileSync(file, "utf8")) }; }
  catch { return { ok: false, reason: "the plugin store is unreadable" }; }
}

/** Blocklist read that FAILS CLOSED: an unreadable policy file is not "empty". */
function readBlocklist(env) {
  const file = path.join(env.home, ".claude", "plugins", "blocklist.json");
  if (!fs.existsSync(file)) return { ok: true, blocked: [] };
  let text;
  try { text = fs.readFileSync(file, "utf8"); }
  catch { return { ok: false, reason: "the plugin policy file is unreadable" }; }
  try {
    const j = JSON.parse(text);
    const blocked = Array.isArray(j) ? j : Array.isArray(j.blocked) ? j.blocked : (j && typeof j === "object") ? Object.keys(j) : null;
    if (!blocked) return { ok: false, reason: "the plugin policy file has an unrecognized shape" };
    return { ok: true, blocked };
  } catch {
    // A parse failure is NEVER "not blocked".
    return { ok: false, reason: "the plugin policy file is malformed" };
  }
}

/** Resolve a CLI on PATH the way the shell does.
 *
 *  A candidate must be an executable REGULAR FILE, or a symlink that resolves to
 *  one. The obvious-looking check - "exists and has an execute bit" - is wrong,
 *  because directories carry execute bits too: a directory named `skills` on
 *  PATH would resolve as the skills CLI, and Superdev would report a provider
 *  ready that cannot be invoked. Reported-ready-but-unusable is worse than
 *  missing, because the user never learns to install it.
 *
 *  statSync follows symlinks, so a valid symlink to an executable file passes
 *  (npm, pnpm and Homebrew all install CLIs that way) while a broken symlink or
 *  a symlink to a directory throws or fails the file check.
 */
export function whichCli(env, cli) {
  for (const dir of env.pathDirs ?? []) {
    const p = path.join(dir, cli);
    try {
      const st = fs.statSync(p);              // follows symlinks; throws if broken
      if (st.isFile() && (st.mode & 0o111)) return p;
    } catch {
      /* absent, broken symlink, or unreadable directory - not a CLI */
    }
  }
  return null;
}

/** Canonical + agent-specific + project-level skill locations, symlink-safe. */
export function skillLocations(env, rootReal, name) {
  const bases = [
    path.join(env.home, ".agents", "skills"),      // canonical agentskills location
    path.join(env.home, ".claude", "skills"),      // Claude-specific
    ...(rootReal ? [path.join(rootReal, ".agents", "skills"), path.join(rootReal, ".claude", "skills")] : []),
  ];
  const found = [];
  const seenReal = new Set();
  for (const base of bases) {
    const dir = path.join(base, name);
    let st;
    try { st = fs.lstatSync(dir); } catch { continue; }
    let real = dir;
    if (st.isSymbolicLink()) {
      // Follow ONE level to deduplicate, but never read outside a real directory.
      try { real = fs.realpathSync(dir); } catch { continue; }
    }
    try { if (!fs.statSync(real).isDirectory()) continue; } catch { continue; }
    if (seenReal.has(real)) continue; // equivalent installation, already counted
    seenReal.add(real);
    found.push({ dir, real, viaSymlink: st.isSymbolicLink() });
  }
  return found;
}

/** A skill is ready only when SKILL.md is readable AND its frontmatter names it. */
export function inspectSkill(env, rootReal, name) {
  const locations = skillLocations(env, rootReal, name);
  if (!locations.length) return { state: "missing", detail: `no ${name} skill directory found`, evidence: "skill search paths" };
  for (const loc of locations) {
    const manifest = path.join(loc.real, "SKILL.md");
    if (!fs.existsSync(manifest)) continue;
    let text;
    try { text = fs.readFileSync(manifest, "utf8"); }
    catch { return { state: "installed-but-unhealthy", detail: "SKILL.md is unreadable", evidence: manifest }; }
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!fm) return { state: "installed-but-unhealthy", detail: "SKILL.md has no frontmatter block", evidence: manifest };
    const declared = /^name:\s*(.+)$/m.exec(fm[1])?.[1]?.trim();
    if (!declared) return { state: "installed-but-unhealthy", detail: "SKILL.md frontmatter declares no name", evidence: manifest };
    if (declared !== name) return { state: "installed-but-unhealthy", detail: `SKILL.md declares a different identity than its directory (${declared})`, evidence: manifest };
    if (!/^description:\s*\S/m.test(fm[1]) && !/^description:\s*[>|]/m.test(fm[1]))
      return { state: "installed-but-unhealthy", detail: "SKILL.md frontmatter has no description", evidence: manifest };
    return { state: "available-and-ready", detail: "skill installed and well-formed", evidence: manifest, viaSymlink: loc.viaSymlink };
  }
  return { state: "installed-but-unhealthy", detail: "skill directory exists but no readable SKILL.md was found", evidence: locations[0].dir };
}

export function inspectCli(env, cli, versionArgs = ["--version"], minVersion = null) {
  const found = whichCli(env, cli);
  if (!found) return { state: "missing", detail: `${cli} is not on PATH`, evidence: "PATH" };
  let version = null;
  try { version = String(env.run(cli, versionArgs)).trim().split("\n")[0]; }
  catch { return { state: "installed-but-unhealthy", detail: `${cli} is present but its version probe failed`, evidence: found }; }
  if (!version) return { state: "installed-but-unhealthy", detail: `${cli} version probe returned nothing`, evidence: found };
  if (minVersion && !satisfiesMin(version, minVersion))
    return { state: "installed-but-incompatible", version, detail: `installed ${version} is below the required ${minVersion}`, evidence: found };
  return { state: "available-and-ready", version, detail: "cli available", evidence: found, versionResolved: true };
}

export function satisfiesMin(version, min) {
  if (!min) return true;
  const nums = (v) => String(v).trim().replace(/^[^\d]*/, "").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [a, b, c] = nums(version), [x, y, z] = nums(min);
  return a !== x ? a > x : b !== y ? b > y : c >= z;
}

// ---- Claude plugin detection (live first, fallback documented) ------------

function detectClaudePlugin(provider, env) {
  const key = provider.detection.key;
  const live = liveClaudePlugins(env);
  if (live.ok) {
    const hit = findLiveEntry(live.entries, key);
    if (hit.conflict)
      return { state: "unknown", source: "live", detail: "the live listing contains conflicting records for this plugin", evidence: "claude plugin list --json" };
    const e = hit.entry;
    if (!e) return { state: "missing", source: "live", detail: `${key} is not installed`, evidence: "claude plugin list --json" };
    // An explicit disable is authoritative.
    if (e.enabled === false) return { state: "installed-but-disabled", source: "live", version: e.version ?? null, detail: `${key} is installed but disabled`, evidence: "claude plugin list --json" };
    if (e.blocked === true || e.status === "blocked") return { state: "policy-blocked", source: "live", version: e.version ?? null, detail: `${key} is blocked by policy`, evidence: "claude plugin list --json" };
    if (e.status === "authentication-required" || e.authRequired === true) return { state: "authentication-required", source: "live", detail: `${key} requires authentication`, evidence: "claude plugin list --json" };
    const version = e.version ?? null;
    if (provider.minVersion && version && version !== "unknown" && !satisfiesMin(version, provider.minVersion))
      return { state: "installed-but-incompatible", source: "live", version, detail: `installed ${version} is below the required ${provider.minVersion}`, evidence: "claude plugin list --json" };
    return {
      state: "available-and-ready", source: "live", version,
      detail: version && version !== "unknown" ? "installed and enabled" : "installed and enabled; version not reported",
      versionResolved: Boolean(version && version !== "unknown"), evidence: "claude plugin list --json",
    };
  }

  // FALLBACK (documented): filesystem inspection when the live listing is absent.
  const store = readInstalledPlugins(env);
  if (!store.ok) return { state: "unknown", source: "fallback", detail: `${live.reason}; ${store.reason}`, evidence: "plugin store" };
  const entries = store.store.plugins?.[key];
  if (!Array.isArray(entries) || entries.length === 0)
    return { state: "missing", source: "fallback", detail: `no install record for ${key}`, evidence: "installed_plugins.json" };
  if (entries.length > 1 && new Set(entries.map((r) => r.installPath)).size > 1)
    return { state: "unknown", source: "fallback", detail: "duplicate install records disagree; capability cannot be determined", evidence: "installed_plugins.json" };
  const rec = entries[0];
  // Policy state must be READABLE to conclude "not blocked".
  const policy = readBlocklist(env);
  if (!policy.ok) return { state: POLICY_STATE_UNAVAILABLE, source: "fallback", version: rec.version, detail: `${policy.reason}; refusing to assume the plugin is permitted`, evidence: "plugin policy" };
  if (policy.blocked.includes(key))
    return { state: "installed-but-disabled", source: "fallback", version: rec.version, detail: `${key} is disabled by policy`, evidence: "plugin policy" };
  if (rec.enabled === false)
    return { state: "installed-but-disabled", source: "fallback", version: rec.version, detail: `${key} is recorded as disabled`, evidence: "installed_plugins.json" };
  if (rec.installPath && !fs.existsSync(rec.installPath))
    return { state: "installed-but-unhealthy", source: "fallback", version: rec.version, detail: "install record points at a path that no longer exists", evidence: "installed_plugins.json" };
  if (provider.minVersion && rec.version && rec.version !== "unknown" && !satisfiesMin(rec.version, provider.minVersion))
    return { state: "installed-but-incompatible", source: "fallback", version: rec.version, detail: `installed ${rec.version} is below the required ${provider.minVersion}`, evidence: "installed_plugins.json" };
  return {
    state: "available-and-ready", source: "fallback", version: rec.version ?? null,
    detail: rec.version === "unknown" ? "installed; version not recorded by the plugin store" : "installed",
    versionResolved: Boolean(rec.version && rec.version !== "unknown"), evidence: "installed_plugins.json",
  };
}

// ---- composite detection -------------------------------------------------

function detectComponent(component, env, rootReal) {
  if (component.kind === "cli") return { id: component.id, kind: "cli", required: component.required !== false, ...inspectCli(env, component.cli, component.versionArgs) };
  if (component.kind === "agent-skill") return { id: component.id, kind: "agent-skill", required: component.required !== false, ...inspectSkill(env, rootReal, component.skill) };
  return { id: component.id, kind: component.kind, required: component.required !== false, state: "unknown", detail: "unrecognized component kind" };
}

function detectComposite(provider, env, rootReal) {
  const components = provider.components.map((c) => detectComponent(c, env, rootReal));
  const required = components.filter((c) => c.required);
  const readyRequired = required.filter((c) => c.state === "available-and-ready");
  if (readyRequired.length === required.length)
    return { state: "available-and-ready", components, detail: "every required component is ready", evidence: components.map((c) => c.evidence).filter(Boolean).join(", ") };
  if (readyRequired.length === 0)
    return { state: "missing", components, detail: `none of the required components are ready (${required.map((c) => `${c.id}: ${c.state}`).join("; ")})`, evidence: "components" };
  // Some but not all - the provider is NOT ready and must never be reported so.
  const missingIds = required.filter((c) => c.state !== "available-and-ready").map((c) => `${c.id} (${c.state})`);
  return { state: PARTIALLY_READY, components, detail: `only some required components are ready; missing: ${missingIds.join(", ")}`, evidence: "components" };
}

/* ------------------------------------------------------------------ *
 * Harness scoping
 *
 * "Installed" and "invocable from where you are standing" are different
 * questions, and conflating them is how a readiness report lies. A Claude
 * plugin listed by `claude plugin list` is invocable from Claude Code and
 * NOWHERE else - reporting Superpowers ready inside a Codex session because
 * Claude has it installed would send specialist work down a route that does not
 * exist on that surface.
 * ------------------------------------------------------------------ */

export const HARNESSES = ["claude-code", "codex", "skills.sh"];

/** Evidence about which harness we are in, strongest first.
 *
 *  Tiering matters because these variables are not equally trustworthy. A user
 *  can export CODEX_HOME in a shell profile and never leave Claude Code, while
 *  CLAUDECODE and CODEX_SESSION_ID are injected by a live session and cannot be
 *  set by accident. A flat first-match-wins check reported `claude-code` inside
 *  a Codex-configured shell purely because Claude's variables were listed first
 * - which is exactly how a Claude plugin would get credited on Codex.
 */
const HARNESS_EVIDENCE = [
  // tier 1 - proves a live session of that harness
  { "claude-code": ["CLAUDECODE"], codex: ["CODEX_SESSION_ID"], "skills.sh": [] },
  // tier 2 - injected by the runtime when it loads a plugin
  { "claude-code": ["CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR"], codex: ["CODEX_PLUGIN_ROOT"], "skills.sh": ["AGENT_SKILLS_ROOT"] },
  // tier 3 - configuration only; a user may export these anywhere
  { "claude-code": ["CLAUDE_CONFIG_DIR"], codex: ["CODEX_HOME"], "skills.sh": ["SKILLS_HOME"] },
];

/** Which harness is this process actually running under?
 *
 *  An explicit override wins. Otherwise the strongest tier that names exactly
 *  one harness decides. Evidence for two harnesses in the same tier is
 *  AMBIGUOUS, and ambiguity resolves to `unknown` - which grants no provider
 *  credit anywhere - rather than to whichever name was checked first.
 */
export function currentHarness(env = {}) {
  const e = env.vars ?? process.env;
  const override = e.SUPERDEV_HARNESS;
  if (override && HARNESSES.includes(override)) return override;

  for (const tier of HARNESS_EVIDENCE) {
    const hits = HARNESSES.filter((h) => (tier[h] ?? []).some((v) => e[v]));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return "unknown";   // ambiguous: prove nothing
  }
  return "unknown";
}

/** Where a delivery form can actually be reached from, per harness. */
const REACHABLE = {
  // a Claude plugin is a Claude Code construct and travels nowhere else
  [DELIVERY.CLAUDE_PLUGIN]: { "claude-code": true, codex: false, "skills.sh": false },
  // the canonical ~/.agents/skills location is shared across agents
  [DELIVERY.AGENT_SKILL]: { "claude-code": true, codex: true, "skills.sh": true },
  // PATH is shared by every process on the machine
  [DELIVERY.CLI]: { "claude-code": true, codex: true, "skills.sh": true },
};

const ROUTE = {
  [DELIVERY.CLAUDE_PLUGIN]: (p) => `Claude Code skill namespace \`${p.id}:*\``,
  [DELIVERY.AGENT_SKILL]: (p) => `agent skill \`${p.identity.skill ?? p.id}\``,
  [DELIVERY.CLI]: (p) => `\`${p.identity.cli ?? p.id}\` on PATH`,
};

/**
 * Report a provider's reachability from ONE harness.
 *
 * `installed` is the global detection result; `reachable` answers whether this
 * session can invoke it. A provider that is installed but unreachable here gets
 * an explicit limitation and its truthful unavailable route - never credit.
 */
export function harnessReadiness(provider, detected, harness) {
  const delivery = provider.identity.delivery;
  const composite = Array.isArray(provider.components) && provider.components.length > 0;

  // A composite provider is reachable only where EVERY required component is.
  const deliveries = composite
    ? provider.components.filter((c) => c.required !== false).map((c) => (c.kind === "cli" ? DELIVERY.CLI : c.kind === "agent-skill" ? DELIVERY.AGENT_SKILL : delivery))
    : [delivery];

  const known = HARNESSES.includes(harness);
  const reachable = known && deliveries.every((d) => REACHABLE[d]?.[harness] === true);
  const blockers = known
    ? deliveries.filter((d) => REACHABLE[d]?.[harness] !== true)
    : [];

  return {
    harness,
    installationSurface: composite ? deliveries.join(" + ") : delivery,
    installed: detected.ready,
    // the question that actually matters: can THIS session invoke it?
    invocableHere: Boolean(detected.ready && reachable),
    reachableFromHarness: reachable,
    invocationRoute: reachable ? (composite ? deliveries.map((d) => ROUTE[d](provider)).join(" + ") : ROUTE[delivery](provider)) : null,
    activationRequired: harness === "codex" && provider.identity.delivery === DELIVERY.AGENT_SKILL ? null
      : harness === "codex" ? "explicit hook/plugin trust" : null,
    limitation: known && !reachable
      ? `${provider.title} is delivered as ${blockers.join(" + ")}, which ${harness} cannot invoke. Installation on another harness does not make it available here.`
      : (!known ? `the current harness could not be identified, so reachability is unproven` : null),
    unavailableBehavior: (detected.ready && reachable) ? null : provider.unavailable,
  };
}

// ---- public API ----------------------------------------------------------

export function detectProvider(provider, { env = defaultEnv(), rootReal = null, harness = null } = {}) {
  let result;
  try {
    result = provider.components ? detectComposite(provider, env, rootReal)
      : provider.identity.delivery === DELIVERY.CLAUDE_PLUGIN ? detectClaudePlugin(provider, env)
      : provider.identity.delivery === DELIVERY.AGENT_SKILL ? inspectSkill(env, rootReal, provider.detection.skill)
      : inspectCli(env, provider.detection.cli, provider.readiness?.args);
  } catch (e) {
    result = { state: "unknown", detail: `detection error: ${e.code ?? "error"}`, evidence: null };
  }
  if (!EXTENDED_STATES.includes(result.state)) result = { state: "unknown", detail: "unrecognized detection result" };
  const ready = result.state === "available-and-ready";
  return {
    id: provider.id, title: provider.title, delivery: provider.identity.delivery,
    identity: provider.identity.ref, ready, ...result,
    versionResolution: result.versionResolved === false || result.version === "unknown"
      ? "unresolved" : (provider.versionResolution ?? (result.version ? "resolved" : "not-applicable")),
    versionEnforced: Boolean(provider.minVersion),
    remediation: ready ? null : remediationFor(provider, result),
    unavailableBehavior: ready ? null : provider.unavailable,
    noSubstitution: provider.noSubstitution,
    // Reachability from the harness this session is actually running under.
    harnessReadiness: harnessReadiness(provider, { ready }, harness ?? currentHarness(env)),
  };
}

function remediationFor(provider, result) {
  const install = provider.install ?? {};
  const base = install.command ? `install: \`${install.command}\`` : "install the provider through its own documented flow";
  switch (result.state) {
    case "missing": return `${provider.title} is not installed. With your consent, ${base}.`;
    case PARTIALLY_READY: {
      const missing = (result.components ?? []).filter((c) => c.required && c.state !== "available-and-ready");
      return `${provider.title} is only PARTIALLY ready - ${missing.map((c) => `${c.id} is ${c.state}`).join("; ")}. It must not be treated as available until every required component is ready.`;
    }
    case "installed-but-disabled": return `${provider.title} is installed but disabled. Re-enable it in the harness; Superdev will not enable it for you.`;
    case "policy-blocked": return `${provider.title} is blocked by policy. Resolve the policy with your administrator; Superdev will not override it.`;
    case "authentication-required": return `${provider.title} requires authentication before it can be used.`;
    case POLICY_STATE_UNAVAILABLE: return `${provider.title}'s policy state could not be read, so it is NOT assumed permitted. Repair the plugin policy file, then re-run doctor.`;
    case "installed-but-incompatible": return `${provider.title} is installed at an incompatible version. Update it (${base}), then re-run doctor.`;
    case "installed-but-unhealthy": return `${provider.title} is installed but not usable (${result.detail}). Repair or reinstall it, then re-run doctor.`;
    case "unknown": return `${provider.title} state could not be determined (${result.detail}). Report this rather than assuming availability.`;
    default: return `${provider.title} is not ready (${result.state}).`;
  }
}

export function detectAll({ env = defaultEnv(), rootReal = null, only = null, harness = null } = {}) {
  const list = only ? [getProvider(only)].filter(Boolean) : PROVIDERS;
  if (only && list.length === 0) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider "${only}" (known: ${PROVIDER_IDS.join(", ")})`);
  const here = harness ?? currentHarness(env);
  const providers = list.map((p) => detectProvider(p, { env, rootReal, harness: here }));
  const ready = providers.filter((p) => p.ready).length;
  const invocableHere = providers.filter((p) => p.harnessReadiness?.invocableHere).length;
  return {
    version: 1, checked: providers.length, ready, notReady: providers.length - ready,
    note: "read-only detection: no provider was installed, enabled, configured, or invoked",
    // Installed and invocable-from-here are separate numbers on purpose.
    harness: here,
    invocableHere,
    unreachableHere: providers.filter((p) => p.ready && !p.harnessReadiness?.invocableHere)
      .map((p) => ({ id: p.id, limitation: p.harnessReadiness.limitation })),
    versionPolicy: VERSION_POLICY,
    providers,
  };
}

function main() {
  let args, positionals;
  try {
    const parsed = parseArgs({
      options: {
        root: { type: "string", default: "." }, provider: { type: "string" }, home: { type: "string" },
        json: { type: "boolean", default: false }, out: { type: "string" }, help: { type: "boolean", default: false },
      },
      allowPositionals: true,
    });
    args = parsed.values; positionals = parsed.positionals;
  } catch (err) { usageError(String(err.message ?? err), USAGE); }
  if (args.help) { console.log(USAGE); process.exit(0); }
  const op = positionals[0] ?? "detect";
  if (!["detect", "contract"].includes(op)) usageError(`unknown operation: ${op}`, USAGE);
  let rootReal;
  try { rootReal = resolveRoot(args.root); } catch (e) { usageError(e.message, USAGE); }
  try {
    let report, failed = false;
    if (op === "contract") {
      const list = args.provider ? [getProvider(args.provider)].filter(Boolean) : PROVIDERS;
      if (args.provider && !list.length) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider "${args.provider}"`);
      report = { count: list.length, versionPolicy: VERSION_POLICY, providers: list };
    } else {
      const env = defaultEnv();
      if (args.home) env.home = args.home;
      report = detectAll({ env, rootReal, only: args.provider });
      failed = report.notReady > 0;
    }
    // Machine paths and any sensitive shape are redacted at the boundary.
    const safe = redactSensitive(report);
    console.log(args.json ? JSON.stringify(safe, null, 2)
      : op === "contract" ? `contract: ${safe.count} provider(s)`
      : `providers: ${safe.ready}/${safe.checked} ready\n${safe.providers.map((p) => `  [${p.ready ? "ready" : p.state}] ${p.title}${p.version ? ` ${p.version}` : ""}${p.ready ? "" : ` - ${p.remediation}`}`).join("\n")}`);
    writeReport(args.out, safe);
    process.exit(failed ? 1 : 0);
  } catch (e) {
    if (e instanceof TalksError) { console.error(`[${e.code}] ${e.message}`); process.exit(e.code === "E_PROVIDER_UNKNOWN" ? 2 : 1); }
    throw e;
  }
}

if (isMain(import.meta.url)) main();
