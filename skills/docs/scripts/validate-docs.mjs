#!/usr/bin/env node
/**
 * Profile-aware documentation validator. Design guarantees:
 *  - flags parse independently of positional roots; --json is never a path
 *  - read-only; writes only to an explicit --out path
 *  - prohibitions are declarations; only actual usage in executable surfaces
 *    (package scripts, Makefiles, CI) is flagged - never prose. Scope: only
 *    backticked commands ("never use/run `X`") are machine-checkable
 *  - template folders and adapter-excluded globs are exempt from checks
 *  - historical/superseded documents (status marker within the first ~30
 *    lines) are exempt from active-contract checks
 *  - workspace members are scanned, not only the root package
 *  - profile-specific requirements; never forces talks-v1 on other profiles
 *  - findings carry stable rule ids + evidence paths; no file content is echoed
 *    (secret-safe by construction)
 *
 * Finding codes:
 *  DV-STRUCT-001 P0 required artifact missing (per profile)
 *  DV-STRUCT-002 P1 unregistered (orphan) module folder
 *  DV-TESTPLAN-001 P1 module missing its test plan (profiles that require one)
 *  DV-LINK-001 P0 broken relative link in current-state doc
 *  DV-PROHIB-001 P0 declared-prohibited command actually used in an executable surface
 *  DV-SUNSET-001 P2 expired "remove after YYYY-MM-DD" marker
 *  DV-PROFILE-001 P0 adapter declares an unrecognized profile (fail closed)
 *  DV-PATH-001 P0 adapter path is absolute (must be project-relative)
 *  DV-PATH-002 P0 adapter path traverses outside the project root
 *  DV-PATH-003 P0 adapter path escapes the project root through a symlink
 *  DV-WS-001 P1 unsupported or unsafe workspace pattern (inspection incomplete)
 *
 * Adapter data (talks/project.yaml) is untrusted repository input: declared
 * paths are validated (absolute/traversal/symlink-escape rejected, field name
 * reported without echoing the value) BEFORE any read they would direct.
 *
 * Exit codes: 0 clean, 1 findings, 2 usage error.
 */
import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { detectProfile, readYamlSubset, dependencyInventory } from "./profile-detect.mjs";

const USAGE = `Usage: node validate-docs.mjs [--root <path>] [--profile <id>] [--baseline <file>] [--json] [--out <file>] [--help]
  --root <path>      project root to validate (default: current directory)
  --profile <id>     override profile (talks-v1 | module-docs | legacy-flat-docs | custom)
  --baseline <file>  suppress known findings: JSON array of "RULE:path:detail" (or "RULE:path") fingerprints
  --json             machine-readable JSON on stdout
  --out <file>       also write the JSON report to this exact path
  --help             show this help`;

const DEFAULT_EXCLUDES = ["_templates", "node_modules", ".git", "vendor", "dist", "build"];
export const KNOWN_PROFILES = new Set(["talks-v1", "module-docs", "legacy-flat-docs", "custom", "none"]);

/** Root-confinement check for an adapter-declared relative path. Returns a
 *  finding (field name only - the value is never echoed) or null when safe. */
export function checkAdapterPath(root, field, value) {
  const v = String(value);
  if (path.isAbsolute(v) || /^[A-Za-z]:[\\/]/.test(v))
    return { ruleId: "DV-PATH-001", severity: "P0", file: "talks/project.yaml", detail: `absolute path in docs.${field}` };
  if (v.split(/[\\/]/).includes(".."))
    return { ruleId: "DV-PATH-002", severity: "P0", file: "talks/project.yaml", detail: `path traversal in docs.${field}` };
  const rootReal = fs.realpathSync(root);
  const resolved = path.resolve(rootReal, v);
  if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep))
    return { ruleId: "DV-PATH-002", severity: "P0", file: "talks/project.yaml", detail: `path resolves outside root in docs.${field}` };
  if (fs.existsSync(resolved)) {
    const real = fs.realpathSync(resolved);
    if (real !== rootReal && !real.startsWith(rootReal + path.sep))
      return { ruleId: "DV-PATH-003", severity: "P0", file: "talks/project.yaml", detail: `symlink escape in docs.${field}` };
  }
  return null;
}

/** Validate every adapter-controlled path field before any read they direct. */
export function checkAdapterPaths(root, adapterDocs) {
  const findings = [];
  const single = { canonicalRoot: adapterDocs.canonicalRoot, modulesRoot: adapterDocs.modulesRoot, ownership: adapterDocs.ownership };
  for (const [field, value] of Object.entries(single)) {
    if (typeof value !== "string") continue;
    const f = checkAdapterPath(root, field, value);
    if (f) findings.push(f);
  }
  for (const [field, list] of [["required", adapterDocs.required], ["excluded", adapterDocs.excluded]]) {
    if (!Array.isArray(list)) continue;
    list.forEach((value, i) => {
      const bare = String(value).replace(/[*]/g, "x"); // confine the shape; globs share path rules
      const f = checkAdapterPath(root, `${field}[${i}]`, bare);
      if (f) findings.push(f);
    });
  }
  return findings;
}

/** relPosix uses "/" on every platform. Multi-segment excludes match on path
 *  boundaries; single-name excludes match any path segment. Empty entries never match. */
export function isExcluded(relPosix, excludes) {
  return excludes.some((ex) => {
    if (!ex) return false;
    if (ex.includes("/")) return relPosix === ex || relPosix.startsWith(ex + "/");
    return relPosix.split("/").includes(ex);
  });
}

function walkMd(dir, root, excludes, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const relPosix = path.relative(root, full).split(path.sep).join("/");
    if (isExcluded(relPosix, excludes)) continue;
    if (entry.isDirectory()) walkMd(full, root, excludes, out);
    else if (entry.name.endsWith(".md")) out.push(relPosix);
  }
  return out;
}

/** Historical detection window: the first 30 lines (accommodates frontmatter). */
export function isHistorical(text, markers) {
  const head = text.split("\n").slice(0, 30).join("\n");
  if (/^\s*-?\s*\**Status:?\**\s*(Superseded|Deprecated|Historical|Archived)/im.test(head)) return true;
  return markers.some((m) => head.includes(m));
}

/** Prohibition declarations: "never use/run `X`" in prose. Scope: only
 *  backticked commands are machine-checkable; unbackticked prose prohibitions
 *  are deliberately out of scope (stated in references/validation.md). */
export function collectProhibitions(text) {
  const out = [];
  for (const m of text.matchAll(/never\s+(?:use|run)\s+`([^`\n]+)`/gi)) out.push(m[1].trim());
  return out;
}

/** Executable surfaces where prohibited-command *usage* counts. */
export function collectExecutableUsage(root, inventory) {
  const usage = [];
  const { packages } = inventory ?? dependencyInventory(root);
  for (const pkg of packages) {
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      usage.push({ where: `${pkg.path}#scripts.${name}`, text: String(cmd) });
    }
  }
  for (const candidate of ["Makefile", "makefile"]) {
    const p = path.join(root, candidate);
    if (fs.existsSync(p)) usage.push({ where: candidate, text: fs.readFileSync(p, "utf8") });
  }
  const ciDirs = [path.join(root, ".github", "workflows"), path.join(root, ".ci")];
  for (const dir of ciDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/\.(ya?ml|sh)$/.test(f)) usage.push({ where: path.relative(root, path.join(dir, f)), text: fs.readFileSync(path.join(dir, f), "utf8") });
    }
  }
  return usage;
}

export function checkLinks(root, relFile, text) {
  const findings = [];
  const dir = path.dirname(path.join(root, relFile));
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
    const clean = target.split("#")[0];
    if (!clean) continue;
    let decoded = clean;
    try {
      decoded = decodeURIComponent(clean);
    } catch {
      // literal % in the target - check the raw string instead of crashing
    }
    if (!fs.existsSync(path.resolve(dir, decoded)))
      findings.push({ ruleId: "DV-LINK-001", severity: "P0", file: relFile, detail: `broken link: ${clean}` });
  }
  return findings;
}

export function checkSunset(relFile, text, today) {
  const findings = [];
  for (const m of text.matchAll(/remove after (\d{4}-\d{2}-\d{2})/gi)) {
    if (m[1] < today) findings.push({ ruleId: "DV-SUNSET-001", severity: "P2", file: relFile, detail: `expired sunset marker (${m[1]})` });
  }
  return findings;
}

/** Adapter exclude globs reduce to the matcher's two shapes: "**\/name/**" →
 *  segment exclude "name"; "dir/sub/**" → boundary-prefix exclude "dir/sub".
 *  Entries that reduce to nothing are dropped - an empty exclude must never match. */
export function normalizeExclude(glob) {
  let e = String(glob).replace(/^\.\//, "");
  if (e.startsWith("**/")) e = e.slice(3).replace(/\/?\*\*.*$/, "").replace(/\/.*$/, "");
  else e = e.replace(/\/?\*\*.*$/, "");
  return e.replace(/\/$/, "");
}

function profileConfig(profile, adapter, detected) {
  const cfg = {
    excludes: [...DEFAULT_EXCLUDES],
    historicalMarkers: [],
    required: [],
    modulesRoot: null,
    docsRoot: null,
    requireModuleTestPlan: false,
  };
  const a = adapter?.docs ?? {};
  if (Array.isArray(a.excluded)) cfg.excludes.push(...a.excluded.map(normalizeExclude).filter(Boolean));
  if (Array.isArray(a.historicalMarkers)) cfg.historicalMarkers.push(...a.historicalMarkers);
  if (Array.isArray(a.required)) cfg.required.push(...a.required);
  cfg.docsRoot = a.canonicalRoot ?? detected?.docsRoot ?? null;
  cfg.modulesRoot = a.modulesRoot ?? null;

  if (profile === "talks-v1") {
    cfg.docsRoot ??= "talks";
    cfg.required.push("talks/project.yaml", "talks/state/schema-version.json");
    cfg.modulesRoot ??= "talks/project/modules";
    cfg.requireModuleTestPlan = true;
  } else if (profile === "module-docs") {
    if (!cfg.modulesRoot && cfg.docsRoot) cfg.modulesRoot = `${cfg.docsRoot}/modules`;
    cfg.requireModuleTestPlan = true;
  }
  // legacy-flat-docs and custom: only adapter-declared requirements - never talks-v1's.
  return cfg;
}

export function validateDocs(root, { profile: profileOverride, baselinePath } = {}) {
  if (profileOverride && !KNOWN_PROFILES.has(profileOverride))
    throw new RangeError(`unknown profile: ${profileOverride} (known: ${[...KNOWN_PROFILES].join(", ")})`);
  const detected = detectProfile(root);
  const adapter = detected.adapter ?? null;

  // Fail closed BEFORE any adapter-directed read or profile interpretation.
  if (adapter?.docs) {
    const early = [];
    if (adapter.docs.profile && !KNOWN_PROFILES.has(adapter.docs.profile))
      early.push({ ruleId: "DV-PROFILE-001", severity: "P0", file: "talks/project.yaml", detail: "unrecognized docs.profile (fail closed; no checks were run)" });
    early.push(...checkAdapterPaths(root, adapter.docs));
    if (early.length) {
      const counts = { P0: early.filter((f) => f.severity === "P0").length, P1: early.filter((f) => f.severity === "P1").length, P2: 0 };
      return { version: 1, profile: "rejected", profileSource: "adapter", root: path.resolve(root), counts, suppressed: 0, findings: early };
    }
  }

  const profile = profileOverride ?? detected.profile;
  const cfg = profileConfig(profile, adapter, detected);
  const findings = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const req of cfg.required) {
    if (!fs.existsSync(path.join(root, req)))
      findings.push({ ruleId: "DV-STRUCT-001", severity: "P0", file: req, detail: "required artifact missing" });
  }

  if (cfg.modulesRoot && fs.existsSync(path.join(root, cfg.modulesRoot))) {
    for (const entry of fs.readdirSync(path.join(root, cfg.modulesRoot), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      const moduleRel = path.join(cfg.modulesRoot, entry.name);
      if (!fs.existsSync(path.join(root, moduleRel, "module.md"))) {
        findings.push({ ruleId: "DV-STRUCT-002", severity: "P1", file: moduleRel, detail: "unregistered (orphan) module folder - no module.md" });
      } else if (cfg.requireModuleTestPlan && !fs.existsSync(path.join(root, moduleRel, "test-plan.md"))) {
        findings.push({ ruleId: "DV-TESTPLAN-001", severity: "P1", file: moduleRel, detail: "module missing test-plan.md" });
      }
    }
  }

  const inventory = dependencyInventory(root);
  for (const u of inventory.unsupported) {
    findings.push({ ruleId: "DV-WS-001", severity: "P1", file: "package.json", detail: `workspace inspection incomplete: ${u.reason} (${u.pattern})` });
  }

  const scanRoot = cfg.docsRoot && fs.existsSync(path.join(root, cfg.docsRoot)) ? path.join(root, cfg.docsRoot) : root;
  const mdFiles = walkMd(scanRoot, root, cfg.excludes);
  const prohibitions = new Set();
  for (const rel of mdFiles) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const historical = isHistorical(text, cfg.historicalMarkers);
    for (const p of collectProhibitions(text)) if (!historical) prohibitions.add(p);
    if (historical) continue; // historical docs are exempt from active-contract checks
    findings.push(...checkLinks(root, rel, text));
    findings.push(...checkSunset(rel, text, today));
  }

  if (prohibitions.size) {
    const usage = collectExecutableUsage(root, inventory);
    for (const prohibited of prohibitions) {
      for (const u of usage) {
        if (u.text.includes(prohibited))
          findings.push({ ruleId: "DV-PROHIB-001", severity: "P0", file: u.where, detail: `prohibited command in executable surface` });
      }
    }
  }

  let suppressed = 0;
  let active = findings;
  if (baselinePath) {
    const baseline = new Set(JSON.parse(fs.readFileSync(baselinePath, "utf8")));
    // Fingerprint includes the detail so one baselined finding never hides a
    // different finding of the same rule in the same file.
    active = findings.filter((f) => {
      const hit = baseline.has(`${f.ruleId}:${f.file}:${f.detail}`) || baseline.has(`${f.ruleId}:${f.file}`);
      if (hit) suppressed += 1;
      return !hit;
    });
  }

  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const f of active) counts[f.severity] += 1;
  return { version: 1, profile, profileSource: profileOverride ? "override" : detected.source, root: path.resolve(root), counts, suppressed, findings: active };
}

function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        root: { type: "string", default: "." },
        profile: { type: "string" },
        baseline: { type: "string" },
        json: { type: "boolean", default: false },
        out: { type: "string" },
        help: { type: "boolean", default: false },
      },
      allowPositionals: false,
    }).values;
  } catch (err) {
    console.error(String(err.message ?? err));
    console.error(USAGE);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (!fs.existsSync(args.root) || !fs.statSync(args.root).isDirectory()) {
    console.error(`root is not a directory: ${args.root}`);
    console.error(USAGE);
    process.exit(2);
  }
  if (args.baseline && !fs.existsSync(args.baseline)) {
    console.error(`baseline file not found: ${args.baseline}`);
    process.exit(2);
  }
  if (args.profile && !KNOWN_PROFILES.has(args.profile)) {
    console.error(`unknown profile: ${args.profile} (known: ${[...KNOWN_PROFILES].join(", ")})`);
    console.error(USAGE);
    process.exit(2);
  }
  const report = validateDocs(args.root, { profile: args.profile, baselinePath: args.baseline });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`docs validation - profile ${report.profile}, ${report.findings.length} finding(s) (P0=${report.counts.P0} P1=${report.counts.P1} P2=${report.counts.P2}${report.suppressed ? `, ${report.suppressed} baseline-suppressed` : ""})`);
    for (const f of report.findings) console.log(`  [${f.severity}] ${f.ruleId} ${f.file} - ${f.detail}`);
    if (!report.findings.length) console.log("  clean");
  }
  if (args.out) {
    const outDir = path.dirname(path.resolve(args.out));
    const tmpOut = path.join(outDir, `.tmp-report-${process.pid}`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(tmpOut, JSON.stringify(report, null, 2) + "\n");
    fs.renameSync(tmpOut, path.resolve(args.out));
  }
  process.exit(report.findings.length ? 1 : 0);
}

// Main-module guard: realpath both sides - Node resolves symlinks (e.g. /tmp
// on macOS) when building import.meta.url for the entry module.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
