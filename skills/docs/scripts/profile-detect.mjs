#!/usr/bin/env node
/**
 * Documentation-profile detection with evidence and confidence.
 * Never guesses silently: low confidence is reported as such; an adapter, when
 * present, is authoritative. Read-only; writes only with an explicit --out.
 *
 * Exit codes: 0 detection completed (including "none"), 2 usage error.
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const USAGE = `Usage: node profile-detect.mjs [--root <path>] [--json] [--out <file>] [--help]
  --root <path>  project root to inspect (default: current directory)
  --json         machine-readable JSON on stdout
  --out <file>   also write the JSON report to this exact path
  --help         show this help`;

/** Minimal YAML subset reader for the talks adapter: nested "key: value" maps,
 *  block and flow string lists, inline comments. The adapter file format is
 *  owned by this project and stays inside this documented subset; content
 *  outside the subset is ignored rather than misparsed into other keys. */
export function readYamlSubset(text) {
  const root = {};
  // Each frame: the map receiving keys at deeper indents, plus (for empty-value
  // keys) where that map hangs, so list items can convert it into an array.
  const stack = [{ indent: -1, node: root, parentNode: null, key: null }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    const isList = /^-\s+/.test(line);
    // List items may sit at the same indent as their key; keys at that indent
    // close the frame. Hence strict "<" for list lines, "<=" for key lines.
    while (
      stack.length > 1 &&
      (isList ? indent < stack[stack.length - 1].indent : indent <= stack[stack.length - 1].indent)
    )
      stack.pop();
    const frame = stack[stack.length - 1];
    if (isList) {
      const item = line.replace(/^-\s+/, "");
      if (frame.parentNode && frame.key) {
        if (!Array.isArray(frame.parentNode[frame.key])) frame.parentNode[frame.key] = [];
        frame.parentNode[frame.key].push(stripQuotes(stripComment(item)));
      }
      continue;
    }
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    const value = stripComment(rawValue);
    if (value === "") {
      frame.node[key] = {};
      stack.push({ indent, node: frame.node[key], parentNode: frame.node, key });
    } else if (value.startsWith("[") && value.endsWith("]")) {
      frame.node[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else {
      frame.node[key] = stripQuotes(value);
    }
  }
  return root;
}

/** Inline comments on unquoted values: `talks-v1 # note` → `talks-v1`. */
function stripComment(value) {
  if (/^["']/.test(value)) return value;
  return value.replace(/\s+#.*$/, "").trim();
}

function stripQuotes(s) {
  const m = s.match(/^["'](.*)["']$/);
  return m ? m[1] : s;
}

function exists(...parts) {
  return fs.existsSync(path.join(...parts));
}

function dirNames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

/**
 * Markdown under a directory that Git is not ignoring, at most three levels down.
 *
 * The bare existence of a subdirectory used to count as documentation. A real
 * repository had `docs/` holding nothing but `.DS_Store` and a git-ignored
 * `docs/client-shared/` of material the client had sent in. That is input to a
 * project, not a projection of one, and detection called it "documentation
 * present matching no known profile" and routed a brand new repository to adopt,
 * which refuses to initialize.
 *
 * Git's own ignore list is the right authority for "is this part of the
 * repository": it is the file the user already maintains to say so. Without Git
 * the scan simply keeps everything, which is the old behaviour minus the
 * empty-directory case.
 */
function trackedMarkdown(root, dir) {
  const found = markdownUnder(dir, 3);
  const ignored = ignoredByGit(root, found);
  return found.filter((file) => !ignored.has(file));
}

function markdownUnder(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...markdownUnder(full, depth - 1));
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

/** One `git check-ignore` for the whole list: a call per file is a call per file. */
function ignoredByGit(root, files) {
  if (!files.length || !fs.existsSync(path.join(root, ".git"))) return new Set();
  try {
    const out = execFileSync("git", ["-C", root, "check-ignore", "--stdin"], {
      input: files.join("\n"),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 10000,
    });
    return new Set(out.split(/\r?\n/).filter(Boolean).map((line) => path.resolve(root, line)));
  } catch (error) {
    // Exit 1 means nothing matched, which is an answer, not a failure. Anything
    // else means git could not tell us, and then nothing is treated as ignored.
    if (error?.status === 1) return new Set();
    return new Set();
  }
}

const TYPE_FOLDERS = ["features", "apis", "api", "data", "database", "workflows", "schemas"];
const DOCS_ROOT_CANDIDATES = ["docs/project", "docs", "documentation"];

/** First docs-root candidate that exists - used so adapter-declared profiles
 *  still learn where documentation lives when canonicalRoot is omitted. */
function findDocsRoot(root) {
  for (const candidate of DOCS_ROOT_CANDIDATES) {
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }
  return null;
}

export function detectProfile(root) {
  const evidence = [];
  const adapterPath = path.join(root, "talks", "project.yaml");
  if (fs.existsSync(adapterPath)) {
    const adapter = readYamlSubset(fs.readFileSync(adapterPath, "utf8"));
    const profile = adapter.docs?.profile;
    if (profile) {
      evidence.push({ what: "adapter declares profile", where: "talks/project.yaml" });
      const docsRoot = adapter.docs?.canonicalRoot ?? findDocsRoot(root);
      return { profile, confidence: "high", source: "adapter", evidence, adapter, docsRoot };
    }
    evidence.push({ what: "adapter present without docs.profile", where: "talks/project.yaml" });
  }

  if (exists(root, "talks", "state", "schema-version.json")) {
    evidence.push({ what: "talks/state/schema-version.json present", where: "talks/state/schema-version.json" });
    return { profile: "talks-v1", confidence: "high", source: "structure", evidence, docsRoot: "talks" };
  }

  for (const candidate of DOCS_ROOT_CANDIDATES) {
    const docsRoot = path.join(root, candidate);
    if (!fs.existsSync(docsRoot)) continue;

    const modulesDir = path.join(docsRoot, "modules");
    const moduleDirs = dirNames(modulesDir);
    const registered = moduleDirs.filter((m) => exists(modulesDir, m, "module.md"));
    if (registered.length) {
      evidence.push({ what: `modules root with ${registered.length} registered module(s)`, where: path.relative(root, modulesDir) });
      return { profile: "module-docs", confidence: "high", source: "structure", evidence, docsRoot: candidate };
    }
    if (moduleDirs.length) {
      evidence.push({ what: "modules folder present but no module.md registrations", where: path.relative(root, modulesDir) });
      return { profile: "module-docs", confidence: "low", source: "structure", evidence, docsRoot: candidate };
    }

    const typeFolders = dirNames(docsRoot).filter((d) => TYPE_FOLDERS.includes(d));
    if (typeFolders.length >= 2) {
      evidence.push({ what: `sibling type folders: ${typeFolders.join(", ")}`, where: candidate });
      return { profile: "legacy-flat-docs", confidence: "medium", source: "structure", evidence, docsRoot: candidate };
    }

    // Markdown Git is keeping, not a directory that happens to be here.
    const mdFiles = trackedMarkdown(root, docsRoot);
    if (mdFiles.length) {
      evidence.push({ what: "documentation present matching no known profile", where: candidate });
      return { profile: "custom", confidence: "low", source: "structure", evidence, docsRoot: candidate };
    }
  }

  evidence.push({ what: "no documentation structure found", where: "." });
  return { profile: "none", confidence: "high", source: "structure", evidence };
}

/** Workspace-aware dependency inventory: root manifest plus every workspace
 *  member. Supported declaration shapes (documented safe subset):
 *   - npm/yarn `workspaces` as an array, or an object with a `packages` array
 *   - pnpm-workspace.yaml `packages` list
 *   - exact member paths ("services/api") at any depth
 *   - one trailing-level globs ("packages/*", "apps/web/plugins/*")
 *  Anything else (multi-star, "**", mid-path stars, traversal, absolute paths,
 *  non-string entries, malformed declarations) is NEVER silently ignored - it
 *  is reported in `unsupported` so callers can surface incomplete inspection. */
export function dependencyInventory(root) {
  const packages = [];
  const unsupported = [];
  const seen = new Set();
  const rootPkgPath = path.join(root, "package.json");
  if (!fs.existsSync(rootPkgPath)) return { packages, unsupported };
  const readPkg = (p, rel) => {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) return null;
    seen.add(resolved);
    try {
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      packages.push({
        path: rel.split(path.sep).join("/"),
        name: pkg.name ?? rel,
        dependencies: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
        scripts: pkg.scripts ?? {},
      });
      return pkg;
    } catch {
      unsupported.push({ pattern: rel, reason: "unreadable or malformed package manifest" });
      return null;
    }
  };
  const rootPkg = readPkg(rootPkgPath, "package.json");
  const globs = [];
  const ws = rootPkg?.workspaces;
  if (Array.isArray(ws)) globs.push(...ws);
  else if (ws && typeof ws === "object" && Array.isArray(ws.packages)) globs.push(...ws.packages);
  else if (ws !== undefined) unsupported.push({ pattern: String(ws), reason: "malformed workspaces declaration" });
  const pnpmWs = path.join(root, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmWs)) {
    const y = readYamlSubset(fs.readFileSync(pnpmWs, "utf8"));
    if (Array.isArray(y.packages)) globs.push(...y.packages);
    else if (y.packages !== undefined) unsupported.push({ pattern: "pnpm-workspace.yaml#packages", reason: "malformed packages declaration" });
  }
  for (const glob of globs) {
    if (typeof glob !== "string" || !glob.trim()) {
      unsupported.push({ pattern: String(glob), reason: "non-string workspace entry" });
      continue;
    }
    const g = glob.replace(/^\.\//, "").replace(/\/$/, "");
    if (path.isAbsolute(g) || /^[A-Za-z]:[\\/]/.test(g) || g.split(/[\\/]/).includes("..")) {
      unsupported.push({ pattern: g, reason: "absolute or traversing workspace path rejected" });
      continue;
    }
    const stars = (g.match(/\*/g) ?? []).length;
    if (stars === 0) {
      const p = path.join(root, g, "package.json");
      if (fs.existsSync(p)) readPkg(p, path.join(g, "package.json"));
      continue;
    }
    if (stars === 1 && g.endsWith("/*")) {
      const base = g.slice(0, -2);
      for (const member of dirNames(path.join(root, base))) {
        const p = path.join(root, base, member, "package.json");
        if (fs.existsSync(p)) readPkg(p, path.join(base, member, "package.json"));
      }
      continue;
    }
    unsupported.push({ pattern: g, reason: "unsupported glob shape (supported: exact paths and one trailing '/*')" });
  }
  return { packages, unsupported };
}

/** Presence-only environment markers; never opens or decrypts anything. */
export function envMarkers(root) {
  const markers = [];
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return markers;
  }
  for (const name of entries) {
    if (/^\.env.*\.gpg$/.test(name) || name === ".envxrc") markers.push({ kind: "envx", file: name });
    else if (/^\.env\.(example|template|sample)$/.test(name)) markers.push({ kind: "conventional-example", file: name });
    else if (/^\.env(\..+)?$/.test(name)) markers.push({ kind: "conventional", file: name });
  }
  return markers;
}

function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        root: { type: "string", default: "." },
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
  const report = {
    version: 1,
    ...detectProfile(args.root),
    workspace: dependencyInventory(args.root),
    envMarkers: envMarkers(args.root),
  };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`profile: ${report.profile} (confidence: ${report.confidence}, source: ${report.source})`);
    for (const e of report.evidence) console.log(`  evidence: ${e.what} [${e.where}]`);
    console.log(`workspace packages: ${report.workspace.packages.length}`);
    if (report.envMarkers.length) console.log(`env markers: ${report.envMarkers.map((m) => m.kind).join(", ")}`);
  }
  if (args.out) {
    const outDir = path.dirname(path.resolve(args.out));
    const tmpOut = path.join(outDir, `.tmp-report-${process.pid}`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(tmpOut, JSON.stringify(report, null, 2) + "\n");
    fs.renameSync(tmpOut, path.resolve(args.out));
  }
  process.exit(0);
}

// Main-module guard: realpath both sides - Node resolves symlinks (e.g. /tmp
// on macOS) when building import.meta.url for the entry module.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
