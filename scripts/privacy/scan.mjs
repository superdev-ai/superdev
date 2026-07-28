#!/usr/bin/env node
/**
 * Privacy/leak scanner. See references/confidentiality.md for the policy.
 *
 * Contract:
 *  - reads only; writes nothing unless --out is explicitly provided
 *  - denylist entries are NEVER echoed into output (findings carry rule ids only)
 *  - machine-readable JSON on stdout with --json
 *  - exit 0 clean, 1 findings, 2 usage error
 *
 * Binary policy (fail-closed): binary files are NEVER silently skipped.
 *  - A file with a text-expected extension that is binary is a P0 finding
 *    (BIN-TEXT) - this closes the NUL-byte blind spot.
 *  - Every binary file (whatever its extension) is byte-scanned for denylist
 *    entries and byte-searchable P0 rules (paths/emails/keys), matched over a
 *    latin1 decode so ASCII byte sequences are found across embedded NULs.
 *  - A binary file that is neither text-expected nor a known/allowlisted asset
 *    is a P0 finding (BIN-UNCLASSIFIED). Legitimate binary assets pass only via
 *    a known-binary extension or the documented allowlist file.
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const USAGE = `Usage: node scan.mjs [options]
  --denylist <path>  external denylist file (one case-insensitive substring per line, # comments)
  --root <path>      directory to scan (default: current directory)
  --staged           scan only files staged in git (contents from the index)
  --allow-binary <p> newline list of repo-relative legitimate binary asset paths
  --json             machine-readable JSON on stdout
  --out <path>       also write the report to this exact path (never writes otherwise)
  --help             show this help`;

const SKIP_DIRS = new Set([
  ".git", "node_modules", ".impeccable", ".superdev",
  ".next", ".turbo", ".cache", "coverage",
]);
// Extensions whose files MUST be text - a binary one is a P0 leak-vector (BIN-TEXT).
export const TEXT_EXTENSIONS = new Set([
  ".mjs", ".cjs", ".js", ".ts", ".mts", ".cts", ".jsx", ".tsx", ".vue", ".svelte",
  ".json", ".jsonc", ".md", ".markdown", ".yaml", ".yml", ".sh", ".bash", ".txt",
  ".html", ".css", ".xml", ".toml", ".ini", ".cfg", ".conf", ".env", ".gitignore",
  ".editorconfig", ".sql", ".py", ".rb", ".go", ".rs", ".java", ".c", ".h", ".cpp",
]);
// Extensions that are legitimately binary assets - still byte-scanned, never BIN-TEXT.
export const KNOWN_BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".woff", ".woff2", ".ttf",
  ".otf", ".eot", ".zip", ".gz", ".tar", ".wasm", ".mp3", ".mp4", ".mov", ".bin",
]);
export function classifyExtension(relPosix) {
  const ext = relPosix.slice(relPosix.lastIndexOf("."));
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (KNOWN_BINARY_EXTENSIONS.has(ext)) return "known-binary";
  return "unknown";
}
export function bufferIsBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}
const EMAIL_ALLOWED = /@(?:[a-z0-9.-]*\.)?(?:example\.(?:com|org|net)|anthropic\.com)$|\.(?:invalid|test|example|localhost)$/i;
const RULES = {
  ABS_HOME: { id: "ABS-HOME", severity: "P0", re: /\/(?:Users|home)\/[A-Za-z0-9_-]+\//g },
  EMAIL: { id: "EMAIL", severity: "P0", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  KEY: { id: "KEY", severity: "P0", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  HIENT: { id: "HIENT", severity: "P1", re: /[A-Za-z0-9+/=_-]{40,}/g },
};

// Integrity hashes are the purpose of dependency lockfiles. Treating every
// registry checksum as a possible secret makes the scanner unusable on a real
// brownfield project (a normal pnpm lockfile can produce hundreds of findings).
// Only the HIENT heuristic is skipped: denylist matches, absolute paths, emails,
// private-key markers, binary classification, and env-file rules still apply.
const DEPENDENCY_LOCKFILES = new Set([
  "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-lock.yml",
  "yarn.lock", "bun.lock", "composer.lock", "Cargo.lock", "Gemfile.lock",
  "poetry.lock", "Pipfile.lock", "uv.lock", "go.sum", "mix.lock", "Podfile.lock",
  "Package.resolved",
]);

/**
 * The compiled control center, skipped for the same reason and no broader one.
 * It is minified build output, so it is one enormous line of mangled
 * identifiers that trips an entropy heuristic by construction, and its source
 * under `ui/` is scanned in full. Skipping the heuristic here keeps the release
 * gate meaningful; a scanner that always reports one finding is one people stop
 * reading.
 *
 * As with the lockfiles above, only HIENT is skipped. The denylist, absolute
 * paths, emails, private-key markers and binary classification still judge this
 * file, because minification would carry a real leak through unchanged.
 */
const DERIVED_BUNDLES = new Set(["src/service/assets/control-center.html"]);

export function highEntropyHeuristicApplies(relFile) {
  const posix = relFile.replaceAll("\\", "/");
  if (DERIVED_BUNDLES.has(posix)) return false;
  return !DEPENDENCY_LOCKFILES.has(path.posix.basename(posix));
}

export function loadDenylist(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  return lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((pattern, i) => ({ id: `DL-${i + 1}`, pattern: pattern.toLowerCase() }));
}

function shannonEntropy(s) {
  const freq = {};
  for (const ch of s) freq[ch] = (freq[ch] ?? 0) + 1;
  return -Object.values(freq).reduce((acc, n) => {
    const p = n / s.length;
    return acc + p * Math.log2(p);
  }, 0);
}

function isBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Byte-searchable P0 rules over a latin1 decode (1:1 byte↔char for ASCII), so
 *  denylist entries, paths, emails, and key markers are caught even inside a
 *  binary blob or after an embedded NUL. Never echoes matched values. */
export function scanBytes(relFile, buf, denylist) {
  const findings = [];
  const latin1 = buf.toString("latin1");
  const lower = latin1.toLowerCase();
  for (const { id, pattern } of denylist) {
    if (lower.includes(pattern)) findings.push({ ruleId: id, severity: "P0", file: relFile, line: 0 });
  }
  if (RULES.ABS_HOME.re.test(latin1)) findings.push({ ruleId: RULES.ABS_HOME.id, severity: "P0", file: relFile, line: 0 });
  RULES.ABS_HOME.re.lastIndex = 0;
  for (const m of latin1.matchAll(RULES.EMAIL.re)) {
    if (!EMAIL_ALLOWED.test(m[0])) findings.push({ ruleId: RULES.EMAIL.id, severity: "P0", file: relFile, line: 0 });
  }
  if (RULES.KEY.re.test(latin1)) findings.push({ ruleId: RULES.KEY.id, severity: "P0", file: relFile, line: 0 });
  RULES.KEY.re.lastIndex = 0;
  return findings;
}

export function scanContent(relFile, text, denylist) {
  const findings = [];
  const lines = text.split("\n");
  const lowerLines = lines.map((l) => l.toLowerCase());
  const scanHighEntropy = highEntropyHeuristicApplies(relFile);

  for (const { id, pattern } of denylist) {
    lowerLines.forEach((l, i) => {
      if (l.includes(pattern)) findings.push({ ruleId: id, severity: "P0", file: relFile, line: i + 1 });
    });
    if (relFile.toLowerCase().includes(pattern))
      findings.push({ ruleId: id, severity: "P0", file: relFile, line: 0 });
  }

  lines.forEach((l, i) => {
    if (RULES.ABS_HOME.re.test(l)) findings.push({ ruleId: RULES.ABS_HOME.id, severity: "P0", file: relFile, line: i + 1 });
    RULES.ABS_HOME.re.lastIndex = 0;

    for (const m of l.matchAll(RULES.EMAIL.re)) {
      if (!EMAIL_ALLOWED.test(m[0])) findings.push({ ruleId: RULES.EMAIL.id, severity: "P0", file: relFile, line: i + 1 });
    }

    if (RULES.KEY.re.test(l)) findings.push({ ruleId: RULES.KEY.id, severity: "P0", file: relFile, line: i + 1 });
    RULES.KEY.re.lastIndex = 0;

    if (scanHighEntropy) {
      for (const m of l.matchAll(RULES.HIENT.re)) {
        // Entropy heuristic; thresholds change only alongside fixture updates proving the change.
        if (m[0].length >= 40 && shannonEntropy(m[0]) > 4.5 && /[A-Z]/.test(m[0]) && /[a-z]/.test(m[0]) && /[0-9]/.test(m[0])) {
          findings.push({ ruleId: RULES.HIENT.id, severity: "P1", file: relFile, line: i + 1 });
        }
      }
    }
  });

  if (/(^|\/)\.env(\.|rc$|$)/.test(relFile)) findings.push({ ruleId: "ENVFILE", severity: "P0", file: relFile, line: 0 });

  return findings;
}

function* walk(dir, root) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // Never skip silently: a symlink target can carry an absolute home path,
      // username, or internal host. Yield it so its target is scanned.
      yield { rel: path.relative(root, full), symlink: true };
      continue;
    }
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full, root);
    } else if (entry.isFile()) {
      yield path.relative(root, full);
    }
  }
}

function stagedFiles(root) {
  const out = execFileSync("git", ["-C", root, "diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], { encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

/**
 * A repository scan covers exactly what can enter version control: tracked and
 * non-ignored untracked files. Build caches contain machine paths, integrity
 * hashes, compiled third-party code, and binary archives; walking them produces
 * noise while saying nothing about what the repository can publish.
 *
 * Fall back to the conservative filesystem walk for non-git directories and
 * subdirectory roots, which keeps standalone fixture/scaffold scanning useful.
 */
function treeEntries(root) {
  try {
    const quietGit = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    const top = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], quietGit).trim();
    if (fs.realpathSync(top) !== fs.realpathSync(root)) throw new Error("root is not repository top");
    const out = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], quietGit);
    return out.split("\0").filter(Boolean).flatMap((rel) => {
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) return []; // deleted tracked content cannot leak from the tree
      return [{ rel, symlink: fs.lstatSync(full).isSymbolicLink() }];
    });
  } catch {
    return [...walk(root, root)].map((e) => (typeof e === "string" ? { rel: e } : e));
  }
}

/** Denylist entries must never appear in output - including inside file paths.
 *  Uses a write cursor so an inserted `[DL-n]` marker is never re-scanned
 *  (a denylist entry like "dl" could otherwise match its own marker and loop). */
export function redactText(text, denylist) {
  let out = text;
  for (const { id, pattern } of denylist) {
    let result = "";
    let from = 0;
    const lower = out.toLowerCase();
    let idx;
    while ((idx = lower.indexOf(pattern, from)) !== -1) {
      result += out.slice(from, idx) + `[${id}]`;
      from = idx + pattern.length;
    }
    out = result + out.slice(from);
  }
  return out;
}

export function loadAllowBinary(file) {
  if (!file) return new Set();
  return new Set(
    fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  );
}

export function runScan({ root, staged, denylistPath, allowBinaryPath, allowBinary }) {
  const denylist = denylistPath ? loadDenylist(denylistPath) : [];
  const allow = allowBinary ?? loadAllowBinary(allowBinaryPath);
  const entries = staged ? stagedFiles(root).map((rel) => ({ rel })) : treeEntries(root);
  const findings = [];
  for (const entry of entries) {
    const rel = entry.rel;
    const relPosix = rel.split(path.sep).join("/");
    const full = path.join(root, rel);

    // Symlinks (tree mode): scan the target STRING for leaks, never follow.
    if (entry.symlink) {
      let target = "";
      try {
        target = fs.readlinkSync(full);
      } catch {
        findings.push({ ruleId: "SCAN-UNREADABLE", severity: "P0", file: relPosix, line: 0, detail: "symlink unreadable - fail closed" });
        continue;
      }
      findings.push(...scanBytes(relPosix, Buffer.from(target, "utf8"), denylist));
      continue;
    }

    let buf;
    try {
      buf = staged
        ? execFileSync("git", ["-C", root, "show", `:${rel}`], { maxBuffer: 512 * 1024 * 1024 })
        : fs.readFileSync(full);
    } catch (e) {
      // Fail closed: an unreadable/oversize file blocks the gate instead of
      // being silently skipped (the pre-commit staged mode especially).
      findings.push({ ruleId: "SCAN-UNREADABLE", severity: "P0", file: relPosix, line: 0, detail: `unscannable (${e.code ?? "read error"}) - fail closed` });
      continue;
    }
    if (isBinary(buf)) {
      // Never silently skip: byte-scan for leaks, and classify the binary.
      findings.push(...scanBytes(relPosix, buf, denylist));
      const cls = classifyExtension(relPosix);
      if (cls === "text")
        findings.push({ ruleId: "BIN-TEXT", severity: "P0", file: relPosix, line: 0, detail: "text-expected file is binary (leak-scan blind spot)" });
      else if (cls === "unknown" && !allow.has(relPosix))
        findings.push({ ruleId: "BIN-UNCLASSIFIED", severity: "P0", file: relPosix, line: 0, detail: "unclassified binary; add to --allow-binary if a legitimate asset" });
      continue;
    }
    findings.push(...scanContent(relPosix, buf.toString("utf8"), denylist));
  }
  const safeFindings = findings.map((f) => ({ ...f, file: redactText(f.file, denylist) }));
  const counts = { P0: findings.filter((f) => f.severity === "P0").length, P1: findings.filter((f) => f.severity === "P1").length };
  return { version: 1, root: redactText(path.resolve(root), denylist), mode: staged ? "staged" : "tree", rulesLoaded: { denylist: denylist.length, builtin: Object.keys(RULES).length + 2 }, counts, findings: safeFindings };
}

function formatHuman(report) {
  const lines = [`privacy scan (${report.mode}) - ${report.findings.length} finding(s), P0=${report.counts.P0} P1=${report.counts.P1}`];
  for (const f of report.findings) lines.push(`  [${f.severity}] ${f.ruleId} ${f.file}${f.line ? ":" + f.line : ""}`);
  if (!report.findings.length) lines.push("  clean");
  return lines.join("\n");
}

function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        denylist: { type: "string" },
        root: { type: "string", default: "." },
        staged: { type: "boolean", default: false },
        "allow-binary": { type: "string" },
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
    process.exit(2);
  }
  if (args.denylist && !fs.existsSync(args.denylist)) {
    console.error(`denylist file not found`);
    process.exit(2);
  }
  if (args["allow-binary"] && !fs.existsSync(args["allow-binary"])) {
    console.error(`allow-binary file not found`);
    process.exit(2);
  }
  const report = runScan({ root: args.root, staged: args.staged, denylistPath: args.denylist, allowBinaryPath: args["allow-binary"] });
  const output = args.json ? JSON.stringify(report, null, 2) : formatHuman(report);
  console.log(output);
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
