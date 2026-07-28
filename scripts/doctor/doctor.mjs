#!/usr/bin/env node
/**
 * Capability doctor.
 *
 * `inspect` - READ-ONLY, zero writes, bounded, root-confined, network-free.
 *   Harness state comes from the LIVE supported interfaces
 *   (`claude plugin list --json`, `codex plugin list --json`, `skills ls --json`);
 *   filesystem inspection is a documented fallback only. A failed or malformed
 *   probe NEVER fails open.
 *
 * `plan` - a deterministic plan with a stable planId (hash). Executes nothing.
 * `apply` - executes ONLY the exact allowlisted commands of an approved plan,
 *   bound to that plan's id; refuses changed/expired/unknown/tampered plans and
 *   every broad-consent flag. Uses argument arrays, never shell interpolation.
 *   Re-inspects afterwards and reports the ACTUAL resulting state.
 * `lock` - records the capability lock.
 *
 * Every output path is redacted at the boundary: absolute machine paths become
 * neutral labels and any sensitive shape is removed before stdout, --out, or
 * persistence.
 *
 * Exit codes: 0 ok, 1 not ready / consent required / partial failure, 2 usage.
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  TalksError, isMain, resolveRoot, safeResolve, stableStringify, atomicWrite,
  assertNotInterrupted, assertSafeField, nowStamp, usageError, writeReport, redactSensitive,
} from "../../src/model/toolkit.mjs";
import { PROVIDERS, PROVIDER_IDS, getProvider, VERSION_POLICY } from "../providers/registry.mjs";
import { detectAll, defaultEnv, liveClaudePlugins, liveCodexPlugins, liveSkillsList } from "../providers/detect.mjs";
import { installationPlan } from "../providers/adapter.mjs";

const USAGE = `Usage: node doctor.mjs <inspect|setup|plan|apply|lock> --root <path> [options]
  inspect                      READ-ONLY capability report; writes nothing
  setup                        first-use readiness: summary + one bounded plan; installs nothing
  plan   [--install <ids>]     deterministic plan with a planId; executes nothing
         [--consent]           record that the informed-consent step was given
  apply  --plan-id <id> --consent   execute ONLY that approved plan's commands
  lock   [--apply]             write talks/state/capabilities.lock.json
  [--home <dir>]               inspect a different home (testing / clean profiles)
  --json / --out <file>`;

export const LOCK_REL = "talks/state/capabilities.lock.json";
export const PLAN_REL = "talks/state/setup-plan.json";
export const LOCK_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/** Commands this tool is ever willing to execute, as argument ARRAYS. Anything
 *  not derivable from a provider's recorded install command is not executable. */
export function allowedCommandFor(providerId) {
  const p = getProvider(providerId);
  if (!p?.install?.command) return null;
  const parts = String(p.install.command).trim().split(/\s+/);
  // Reject anything with shell metacharacters - we never interpolate a shell.
  if (parts.some((t) => /[;&|><`$(){}[\]\\]/.test(t))) return null;
  const forbidden = new Set(p.consent?.forbiddenFlags ?? ["--all", "-y", "--yes"]);
  if (parts.some((t) => forbidden.has(t))) return null;
  return { cmd: parts[0], args: parts.slice(1) };
}

// ---- harness inspection (LIVE first, fallback documented) -----------------

function probe(env, cli, args) {
  try { return String(env.run(cli, args)).trim().split("\n")[0]; } catch { return null; }
}

function inspectClaude(env) {
  const version = probe(env, "claude", ["--version"]);
  const live = version ? liveClaudePlugins(env) : { ok: false, reason: "claude not present" };
  const storeFile = path.join(env.home, ".claude", "plugins", "installed_plugins.json");
  const hasStore = fs.existsSync(storeFile);
  const state = !version ? "missing"
    : live.ok ? "available-and-ready"
    : hasStore ? "installed-but-unhealthy" : "unknown";
  return {
    harness: "claude-code", present: Boolean(version), version,
    inspection: live.ok ? "live:claude plugin list --json" : hasStore ? "fallback:plugin store" : "none",
    liveListingAvailable: live.ok,
    liveListingProblem: live.ok ? null : (version ? live.reason : null),
    pluginsVisible: live.ok ? live.entries.length : null,
    supports: version ? { pluginValidate: true, pluginDir: true, nativeDependencies: true, hooks: true, livePluginList: live.ok } : null,
    state,
    remediation: version
      ? (live.ok ? null : `Claude Code is present but its plugin listing could not be read (${live.reason}); capability is reported from the fallback and may be incomplete.`)
      : "Claude Code was not detected. Superdev's plugin surface requires it; the skills/ surface still works standalone.",
  };
}

function inspectCodex(env) {
  const version = probe(env, "codex", ["--version"]);
  const live = version ? liveCodexPlugins(env) : { ok: false, reason: "codex not present" };
  return {
    harness: "codex", present: Boolean(version), version,
    inspection: live.ok ? "live:codex plugin list --json" : "none",
    liveListingAvailable: live.ok,
    liveListingProblem: version && !live.ok ? live.reason : null,
    pluginsVisible: live.ok ? live.entries.length : null,
    // Verified: Codex exposes NO offline manifest validator, and hooks require
    // explicit user trust before they fire.
    supports: version ? { pluginCli: true, offlinePluginValidate: false, hooksRequireTrust: true, livePluginList: live.ok } : null,
    state: version ? "available-and-ready" : "optional-and-absent",
    degradation: version
      ? "Codex hooks run only after the user explicitly trusts them; until trusted, Superdev's lifecycle behavior falls back to manual invocation and says so."
      : "Codex is not installed. Superdev's Codex surface is unavailable - the Claude and skills surfaces are unaffected.",
    setupPath: version ? "codex plugin marketplace add <source> && codex plugin add superdev" : "Install Codex, then add the marketplace and plugin.",
    remediation: version ? null : "Optional: install Codex to use the Codex distribution surface.",
  };
}

function inspectSkillsSh(env, rootReal) {
  const version = probe(env, "skills", ["--version"]);
  const live = version ? liveSkillsList(env) : { ok: false, reason: "skills CLI not present" };
  return {
    harness: "skills.sh", present: Boolean(version), version,
    inspection: live.ok ? "live:skills ls --json" : "none",
    liveListingAvailable: live.ok,
    liveListingProblem: version && !live.ok ? live.reason : null,
    skillsVisible: live.ok ? live.entries.length : null,
    // Verified: the CLI has no validate/doctor subcommand; skills-ref validates.
    supports: version ? { add: true, find: true, update: true, validateSubcommand: false, liveList: live.ok } : null,
    state: version ? "available-and-ready" : "optional-and-absent",
    degradation: version ? null : "The skills CLI is absent; skill discovery and installation are unavailable. Superdev never fabricates a catalogue - it reports the gap.",
    setupPath: "npx skills add <skill>   (never with --all, never with a silent -y)",
    remediation: version ? null : "Optional: use `npx skills` (no global install required) or install the skills CLI.",
  };
}

/** Report which lifecycle automation is actually active, per harness.
 *
 *  These hooks are development convenience - session context, dirty marking,
 *  bounded project-view refresh, and end-of-session continuity. They are NOT a permission gate: external,
 *  destructive, publishing and installation actions are governed by the
 *  harness's own permission model. Reported honestly per surface, because a
 *  user who believes automation is running when it is not is worse off than
 *  one who knows it is not.
 */
function inspectLifecycle(harnesses) {
  const hooksFile = new URL("../../hooks/hooks.json", import.meta.url);
  let declared = null, problem = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(hooksFile, "utf8"));
    declared = Object.keys(parsed.hooks ?? {});
  } catch (e) { problem = `hooks/hooks.json could not be read (${e.code ?? "error"})`; }

  const by = (h) => harnesses.find((x) => x.harness === h);
  const coverage = [];
  if (by("claude-code")?.present) {
    coverage.push({
      harness: "claude-code", active: Boolean(declared), events: declared ?? [],
      covers: "session context on start, dirty marking after Write/Edit, one bounded projection/dashboard refresh after a batch edits canonical product records, and end-of-session/pre-compaction continuity prompts",
      caveat: "Plugin hooks load when the plugin is installed or run with --plugin-dir.",
      manualFallback: null,
    });
  }
  if (by("codex")?.present) {
    coverage.push({
      harness: "codex", active: "requires-trust", events: declared ?? [],
      // Verified 2026-07-25 against the Codex migration reference.
      covers: "shell-command events only - Write/Edit are NOT intercepted on Codex, so dirty marking does not fire there",
      caveat: "Each hook must be explicitly trusted (hash-based) before it fires.",
      manualFallback: 'Ask for "project status" - it reconciles from canonical records regardless of hooks.',
    });
  }
  if (by("skills.sh")?.present) {
    coverage.push({
      harness: "skills.sh", active: false, events: [],
      covers: "nothing - skills.sh has no hook mechanism",
      caveat: "A standalone skills.sh install gets no session context and no dirty marking.",
      manualFallback: 'Ask for "project status" at the start and end of a session; it re-derives everything from canonical records.',
    });
  }
  return {
    declared: declared ?? [],
    problem,
    purpose: "development automation only - session continuity, staleness marking, and bounded derived-view convergence",
    notASecurityBoundary:
      "Superdev is a development orchestrator, not a security sandbox. External, destructive, publishing and installation actions are gated by the harness's own permission model and by explicit skill-level approval, never by these hooks.",
    coverage,
  };
}

// ---- capability lock -----------------------------------------------------

export function readLock(rootReal) {
  const file = safeResolve(rootReal, LOCK_REL);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw new TalksError("E_LOCK_TORN", "the capability lock is unreadable (integrity); re-run `doctor lock --apply`"); }
}

function lockEntry(p) {
  const provider = getProvider(p.id);
  return {
    id: p.id, identity: p.identity, delivery: p.delivery,
    source: provider.install.marketplaceSource ?? provider.install.source ?? (provider.install.npm ? { source: "npm", package: provider.install.npm } : null),
    version: p.version ?? null, versionResolution: p.versionResolution,
    constraint: provider.minVersion ?? null, versionEnforced: Boolean(provider.minVersion),
    scope: "user",
    harness: p.delivery === "claude-plugin" ? "claude-code" : p.delivery === "cli" ? "shell" : "agent-skills",
    license: "unverified", trust: "user-installed",
    readiness: p.state, lastVerified: nowStamp(), verificationMethod: provider.detection.kind,
  };
}

// ---- operations ----------------------------------------------------------

export function inspect(rootReal, { env = defaultEnv() } = {}) {
  const harnesses = [inspectClaude(env), inspectCodex(env), inspectSkillsSh(env, rootReal)];
  const providerReport = detectAll({ env, rootReal });
  let lock = null, lockError = null;
  try { lock = readLock(rootReal); } catch (e) { lockError = e.message; }
  const now = Date.now();
  const providers = providerReport.providers.map((p) => {
    const locked = lock?.providers?.find((l) => l.id === p.id) ?? null;
    const age = locked?.lastVerified ? now - Date.parse(locked.lastVerified) : null;
    return {
      ...p,
      lock: locked ? {
        recordedReadiness: locked.readiness, recordedVersion: locked.version, lastVerified: locked.lastVerified,
        stale: age === null ? true : age > LOCK_FRESHNESS_MS,
        agreesWithLive: locked.readiness === p.state && (locked.version ?? null) === (p.version ?? null),
      } : null,
    };
  });
  const notReady = providers.filter((p) => !p.ready);
  return {
    version: 1, mode: "inspect", readOnly: true,
    lifecycle: inspectLifecycle(harnesses),
    // Installed and invocable-from-here are different questions.
    harness: {
      current: providerReport.harness,
      invocableHere: providerReport.invocableHere,
      installedTotal: providerReport.ready,
      unreachableHere: providerReport.unreachableHere,
      note: "A provider installed on another harness is not invocable from this one; unreachable providers are listed rather than credited.",
    },
    note: "read-only: this inspection installed, enabled, configured and invoked nothing",
    versionPolicy: VERSION_POLICY,
    harnesses, providers,
    summary: { providersReady: providers.length - notReady.length, providersTotal: providers.length, harnessesPresent: harnesses.filter((h) => h.present).length },
    lockPresent: Boolean(lock), lockError,
    lockDisagreements: providers.filter((p) => p.lock && !p.lock.agreesWithLive).map((p) => p.id),
    remediation: notReady.map((p) => ({ provider: p.id, state: p.state, action: p.remediation })),
  };
}

/** Deterministic plan identity: same targets + same commands => same planId. */
function computePlanId(steps) {
  return crypto.createHash("sha256").update(JSON.stringify(steps.map((s) => [s.provider, s.identity, s.command]))).digest("hex").slice(0, 16);
}

export function plan(rootReal, { install = [], consent = false, flags = [], env = defaultEnv() } = {}) {
  const unknown = install.filter((id) => !PROVIDER_IDS.includes(id));
  if (unknown.length) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider(s): ${unknown.join(", ")} (known: ${PROVIDER_IDS.join(", ")})`);
  const live = detectAll({ env, rootReal });
  const targets = install.length ? install : live.providers.filter((p) => !p.ready).map((p) => p.id);
  const steps = targets.map((id) => {
    const state = live.providers.find((p) => p.id === id);
    const p = installationPlan(id, { consentGiven: consent, flags });
    const allowed = allowedCommandFor(id);
    return {
      provider: id, currentState: state?.state ?? "unknown", alreadyReady: Boolean(state?.ready),
      identity: p.identity, source: p.source, command: p.command,
      executable: allowed ? { cmd: allowed.cmd, args: allowed.args } : null,
      effect: `installs ${p.identity} into the user scope`,
      risk: "adds an external capability to this machine; nothing is removed or overwritten",
      consentRequired: p.consentRequired, consentGiven: p.consentGiven,
      mayProceed: p.mayProceed && !state?.ready, prompt: p.prompt, forbiddenFlags: p.forbiddenFlags,
    };
  });
  const planId = computePlanId(steps);
  const needConsent = steps.filter((s) => !s.alreadyReady && !s.consentGiven);
  return {
    version: 1, mode: "plan", executesNothing: true, planId,
    informedConsent: {
      required: needConsent.length > 0, given: consent,
      boundTo: planId,
      statement: needConsent.length
        ? `Install ${needConsent.length} provider(s): ${needConsent.map((s) => `${s.provider} (${s.identity})`).join("; ")}. Approval is bound to plan ${planId}; nothing is installed until you approve, and no blanket or auto-approve flag is ever used.`
        : "No installation is required.",
    },
    steps, blocked: needConsent.map((s) => s.provider),
  };
}

/**
 * Readiness facts for one capability state, stated EXPLICITLY.
 *
 * Deriving these by exclusion ("installed unless the state is missing") turned
 * every state the author had not enumerated into a positive claim: a `missing`
 * provider reported enabled and healthy, and `policy-state-unavailable` - the
 * one state whose whole purpose is refusing to conclude "permitted" - reported
 * installed, enabled AND healthy. This is the readiness function; asserting here
 * is the worst place in the product to assert.
 *
 * `null` means UNPROVEN. It is never treated as true, and never as false.
 */
export function readinessFacts(state) {
  switch (state) {
    case "available-and-ready":          return { installed: true,  enabled: true,  healthy: true };
    case "installed-but-disabled":       return { installed: true,  enabled: false, healthy: true };
    case "installed-but-unhealthy":      return { installed: true,  enabled: true,  healthy: false };
    case "installed-but-incompatible":   return { installed: true,  enabled: true,  healthy: false };
    case "authentication-required":      return { installed: true,  enabled: true,  healthy: false };
    case "policy-blocked":               return { installed: true,  enabled: false, healthy: null  };
    // partially installed: some required component is absent, so "installed" is
    // not honestly true and not honestly false
    case "partially-ready":              return { installed: null,  enabled: null,  healthy: false };
    case "missing":                      return { installed: false, enabled: false, healthy: false };
    case "optional-and-absent":          return { installed: false, enabled: false, healthy: false };
    case "marketplace-unavailable":      return { installed: false, enabled: null,  healthy: null  };
    // we could not determine anything; claim nothing
    case "policy-state-unavailable":     return { installed: null,  enabled: null,  healthy: null  };
    case "unknown":                      return { installed: null,  enabled: null,  healthy: null  };
    default:                             return { installed: null,  enabled: null,  healthy: null  };
  }
}

/**
 * First-use readiness: one call the orchestrator makes before substantial work.
 *
 * This is where the REAL inspection happens - deliberately not in a lifecycle
 * hook, which has a couple of seconds and must never spawn provider probes or
 * touch the network. The hook only reports that verification is due.
 *
 * Returns the readiness summary plus, when something is missing, exactly one
 * bounded plan. It installs nothing: consent is a separate, explicit step.
 */
export function setup(rootReal, { env = defaultEnv(), harness = null } = {}) {
  const report = inspect(rootReal, { env });
  const here = harness ?? report.harness.current;

  const providers = report.providers.map((p) => ({
    id: p.id, title: p.title,
    ...readinessFacts(p.state),
    activated: p.harnessReadiness?.activationRequired ? "requires " + p.harnessReadiness.activationRequired : "not required",
    invocableHere: Boolean(p.harnessReadiness?.invocableHere),
    state: p.state,
    version: p.version ?? null,
    route: p.harnessReadiness?.invocationRoute ?? null,
    limitation: p.harnessReadiness?.limitation ?? null,
    remediation: p.remediation ?? null,
  }));

  // `null` means unproven, and unproven is not the same as false. It must never
  // collapse into a positive claim on either side of a filter.
  const needsInstall = providers.filter((x) => x.installed === false);
  const unproven = providers.filter((x) => x.installed === null || x.healthy === null || x.enabled === null);
  const unhealthy = providers.filter((x) => x.installed === true && x.healthy === false);
  const unreachable = providers.filter((x) => x.installed === true && x.healthy === true && !x.invocableHere);
  const usable = providers.filter((x) => x.invocableHere);

  // A provider that is absent OR only partially installed both need the same
  // remedy: an install. An unproven state is reported, never silently installed.
  const installable = [...needsInstall, ...providers.filter((x) => x.state === "partially-ready")];
  const proposal = installable.length ? plan(rootReal, { install: [...new Set(installable.map((m) => m.id))], consent: false, env }) : null;

  return {
    version: 1, mode: "setup", executesNothing: true,
    harness: here,
    verification: capabilityVerificationState(rootReal),
    summary: {
      usable: usable.length, total: providers.length,
      missing: needsInstall.map((m) => m.id),
      partiallyInstalled: providers.filter((x) => x.state === "partially-ready").map((m) => m.id),
      unhealthy: unhealthy.map((m) => m.id),
      // reported separately: "we could not determine this" is not a readiness verdict
      unproven: unproven.map((m) => ({ id: m.id, state: m.state })),
      unreachableHere: unreachable.map((m) => m.id),
    },
    providers,
    // Exactly one bounded plan, or none. Never a partial or implicit install.
    plan: proposal ? {
      planId: proposal.planId,
      installs: proposal.steps.map((s) => ({ provider: s.provider, identity: s.identity, source: s.source, command: s.command })),
      consentStatement: proposal.informedConsent.statement,
      approveWith: `doctor apply --plan-id ${proposal.planId} --consent`,
    } : null,
    nothingInstalled: true,
  };
}

/** Lock freshness, read from the file rather than assumed. */
function capabilityVerificationState(rootReal) {
  let lock = null;
  try { lock = readLock(rootReal); } catch { return { locked: false, stale: true, reason: "the capability lock is unreadable" }; }
  if (!lock) return { locked: false, stale: true, reason: "capabilities have never been verified in this project" };
  const stamps = (lock.providers ?? []).map((p) => Date.parse(p.lastVerified)).filter(Number.isFinite);
  if (!stamps.length) return { locked: true, stale: true, reason: "the lock records no verification time" };
  const age = Date.now() - Math.min(...stamps);
  return age > LOCK_FRESHNESS_MS
    ? { locked: true, stale: true, reason: `last verified ${Math.floor(age / 86400000)} days ago` }
    : { locked: true, stale: false, reason: null };
}

/**
 * Execute an approved plan. ONLY the exact allowlisted commands of the plan
 * whose id matches `planId` may run, and only with explicit consent.
 * `runner` is injectable so tests never touch real installations.
 */
export function apply(rootReal, { planId = null, consent = false, install = [], flags = [], env = defaultEnv(), runner = null } = {}) {
  if (!consent) throw new TalksError("E_CONSENT_REQUIRED", "apply requires explicit consent bound to an approved plan");
  if (!planId) throw new TalksError("E_PLAN_ID_REQUIRED", "apply requires --plan-id naming the exact approved plan");
  const current = plan(rootReal, { install, consent: true, flags, env });
  // The plan must be EXACTLY the one approved: a changed target set, a changed
  // command, or an unknown id all produce a different id and are refused.
  if (current.planId !== planId)
    throw new TalksError("E_PLAN_MISMATCH", `the approved plan ${planId} no longer matches the current plan ${current.planId}; re-plan and re-approve`);

  const exec = runner ?? ((cmd, args) => execFileSync(cmd, args, { encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] }));
  const results = [];
  for (const step of current.steps) {
    if (step.alreadyReady) { results.push({ provider: step.provider, skipped: "already ready" }); continue; }
    if (!step.executable) { results.push({ provider: step.provider, executed: false, error: "no allowlisted command is recorded for this provider" }); continue; }
    // Argument ARRAY only - never a shell string.
    try {
      const out = exec(step.executable.cmd, step.executable.args);
      results.push({ provider: step.provider, executed: true, command: `${step.executable.cmd} ${step.executable.args.join(" ")}`, output: String(out ?? "").slice(0, 400) });
    } catch (e) {
      results.push({ provider: step.provider, executed: true, failed: true, command: `${step.executable.cmd} ${step.executable.args.join(" ")}`, error: String(e.code ?? e.message ?? "failed").slice(0, 200) });
    }
  }
  // Re-inspect: report the ACTUAL resulting state, never the intended one.
  const after = detectAll({ env, rootReal });
  const stillNotReady = after.providers.filter((p) => current.steps.some((s) => s.provider === p.id) && !p.ready);
  return {
    version: 1, mode: "apply", planId, consentBound: true,
    results,
    resultingState: after.providers.filter((p) => current.steps.some((s) => s.provider === p.id)).map((p) => ({ provider: p.id, state: p.state, ready: p.ready })),
    // Partial failure is truthful and recoverable - never "ready".
    partialFailure: stillNotReady.length > 0,
    stillNotReady: stillNotReady.map((p) => ({ provider: p.id, state: p.state, remediation: p.remediation })),
    note: stillNotReady.length ? "Some providers are still not ready after apply; they are NOT marked ready. Re-run inspect after resolving each remediation." : "All planned providers are ready.",
  };
}

export function writeLock(rootReal, { apply: doApply = false, env = defaultEnv() } = {}) {
  const live = detectAll({ env, rootReal });
  const record = {
    schemaVersion: 1, generatedAt: nowStamp(),
    note: "A RECORD of what was verified, not proof of current state. The doctor rechecks live state on every inspect.",
    versionPolicy: VERSION_POLICY,
    providers: live.providers.map(lockEntry),
  };
  assertSafeField(record, "capability lock");
  // Redact before persisting: a lock must never carry machine paths.
  const safe = redactSensitive(record);
  if (!doApply) return { mode: "lock", applied: false, plan: safe };
  assertNotInterrupted(rootReal);
  atomicWrite(safeResolve(rootReal, LOCK_REL), stableStringify(safe));
  return { mode: "lock", applied: true, file: LOCK_REL, providers: safe.providers.length };
}

function main() {
  let args, positionals;
  try {
    const parsed = parseArgs({
      options: {
        root: { type: "string", default: "." }, home: { type: "string" },
        install: { type: "string" }, consent: { type: "boolean", default: false },
        "plan-id": { type: "string" }, apply: { type: "boolean", default: false },
        all: { type: "boolean", default: false }, yes: { type: "boolean", default: false },
        json: { type: "boolean", default: false }, out: { type: "string" }, help: { type: "boolean", default: false },
      },
      allowPositionals: true,
    });
    args = parsed.values; positionals = parsed.positionals;
  } catch (err) { usageError(String(err.message ?? err), USAGE); }
  if (args.help) { console.log(USAGE); process.exit(0); }
  const op = positionals[0] ?? "inspect";
  if (!["inspect", "setup", "plan", "apply", "lock"].includes(op)) usageError(`unknown operation: ${op}`, USAGE);
  let rootReal;
  try { rootReal = resolveRoot(args.root); } catch (e) { usageError(e.message, USAGE); }
  const env = defaultEnv();
  if (args.home) env.home = args.home;
  const flags = [...(args.all ? ["--all"] : []), ...(args.yes ? ["--yes"] : [])];
  const ids = args.install ? args.install.split(",").map((s) => s.trim()).filter(Boolean) : [];
  try {
    let report, failed = false;
    if (op === "inspect") {
      report = inspect(rootReal, { env });
      failed = report.summary.providersReady < report.summary.providersTotal;
    } else if (op === "setup") {
      report = setup(rootReal, { env });
      failed = report.summary.usable < report.summary.total;
    } else if (op === "plan") {
      report = plan(rootReal, { install: ids, consent: args.consent, flags, env });
      failed = report.blocked.length > 0;
    } else if (op === "apply") {
      report = apply(rootReal, { planId: args["plan-id"], consent: args.consent, install: ids, flags, env });
      failed = report.partialFailure;
    } else {
      report = writeLock(rootReal, { apply: args.apply, env });
    }
    // (A7) Redact at the report boundary - stdout AND persisted reports.
    const safe = redactSensitive(report);
    console.log(args.json ? JSON.stringify(safe, null, 2) : humanize(op, safe));
    writeReport(args.out, safe);
    process.exit(failed ? 1 : 0);
  } catch (e) {
    if (e instanceof TalksError) {
      console.error(`[${e.code}] ${e.message}`);
      process.exit(e.code === "E_PROVIDER_UNKNOWN" ? 2 : 1);
    }
    throw e;
  }
}

function humanize(op, r) {
  if (op === "inspect") {
    const h = r.harnesses.map((x) => `  ${x.present ? "✓" : "·"} ${x.harness}${x.version ? ` ${x.version}` : ""} - ${x.state} [${x.inspection}]`).join("\n");
    const p = r.providers.map((x) => `  ${x.ready ? "✓" : "✗"} ${x.title}${x.version ? ` ${x.version}` : ""} - ${x.state}${x.ready ? "" : `\n      → ${x.remediation}`}`).join("\n");
    const g = r.lifecycle
      ? `\nlifecycle automation (development convenience, not a permission gate): ${r.lifecycle.declared.join(", ") || "not declared"}\n` +
        r.lifecycle.coverage.map((c) => `  ${c.harness}: ${c.active === true ? "active" : c.active === false ? "NOT ACTIVE" : c.active} - ${c.covers}`).join("\n")
      : "";
    const hs = r.harness ? `\nharness: ${r.harness.current} - ${r.harness.invocableHere}/${r.harness.installedTotal} installed providers are invocable here` +
      (r.harness.unreachableHere?.length ? `\n  unreachable here: ${r.harness.unreachableHere.map((u) => u.id).join(", ")}` : "") : "";
    const s = r.storage ? `\nstorage: ${r.storage.backend}${r.storage.accelerated ? " (SQLite acceleration active)" : ` (SQLite unavailable - ${r.storage.reason}; direct canonical projection in use)`}` : "";
    return `doctor (read-only; nothing was installed or invoked)\nharnesses:\n${h}\nproviders: ${r.summary.providersReady}/${r.summary.providersTotal} ready\n${p}${hs}${s}${g}`;
  }
  if (op === "setup") {
    const rows = r.providers.map((p) => `  ${p.invocableHere ? "✓" : p.installed ? "!" : "·"} ${p.title}${p.version ? ` ${p.version}` : ""} - ${p.invocableHere ? p.route : (p.limitation ?? p.remediation ?? p.state)}`).join("\n");
    const head = `readiness on ${r.harness}: ${r.summary.usable}/${r.summary.total} providers usable here` +
      (r.verification.stale ? `\ncapability verification: DUE (${r.verification.reason})` : "\ncapability verification: current");
    const plan = r.plan
      ? `\n\n${r.plan.consentStatement}\n${r.plan.installs.map((i) => `  ${i.provider}: ${i.command ?? "(no command)"}  [${i.source ?? "source unrecorded"}]`).join("\n")}\napprove with: ${r.plan.approveWith}\n(nothing has been installed)`
      : "\n\nNo installation is required.";
    return `${head}\n${rows}${plan}`;
  }
  if (op === "plan") return `installation plan ${r.planId} (executes nothing)\n${r.informedConsent.statement}\n${r.steps.map((s) => `  ${s.provider}: ${s.command ?? "(no command)"}${s.alreadyReady ? " [already ready]" : s.consentGiven ? " [approved]" : " [awaiting consent]"}`).join("\n")}`;
  if (op === "apply") return `apply for plan ${r.planId}\n${r.results.map((x) => `  ${x.provider}: ${x.skipped ?? (x.failed ? `FAILED (${x.error})` : "executed")}`).join("\n")}\n${r.note}`;
  return r.applied ? `capability lock written: ${r.file} (${r.providers} providers)` : `capability lock plan (${r.plan.providers.length} providers) - re-run with --apply to write`;
}

if (isMain(import.meta.url)) main();
