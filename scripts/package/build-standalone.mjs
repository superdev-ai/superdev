#!/usr/bin/env node
/**
 * Build the skills.sh standalone package.
 *
 * skills.sh has no plugin concept: it installs SKILLS, each a directory with a
 * SKILL.md. A single Superdev skill installed that way used to arrive without
 * the shared references and without any runtime, so it could describe the
 * product but not operate it.
 *
 * This produces one self-contained skill under `dist/skills/superdev/` carrying
 * the orchestrator, every capability skill including Docs, the deterministic
 * runtime under `src/`, the shared contracts and the compiled control center.
 * It resolves its own paths relative to the skill directory, so it never depends
 * on ${CLAUDE_PLUGIN_ROOT}.
 *
 * CANONICAL SOURCE STAYS THE REPOSITORY. This directory is generated output -
 * `check` fails if it has drifted, so the two can never silently disagree.
 *
 * Deterministic by construction: sorted traversal, byte-for-byte copies, no
 * timestamps in generated content. Exit codes: 0 ok, 1 drift/error, 2 usage.
 */
import { parseArgs } from "node:util";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeReport } from "../../src/model/toolkit.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DIST_REL = "dist/skills/superdev";

const USAGE = `Usage: node build-standalone.mjs <build|check> [--root <repo>] [--json] [--out <file>]
  build   regenerate ${DIST_REL} from the canonical source
  check   verify the generated package matches the source (no writes)
  --out <file>  also write the machine-readable report to this exact path`;

/**
 * Directories copied into the package at their repository-relative paths.
 *
 * The layout is preserved rather than flattened, because the runtime addresses
 * itself with relative imports: `scripts/doctor/doctor.mjs` reaches
 * `src/model/toolkit.mjs` as `../../src/model/toolkit.mjs`, and that only
 * resolves if both keep the depth they had in the repository.
 *
 * `src/` carries the compiled control center at `src/service/assets/` when it
 * has been built. It is not listed separately and it is not required: a package
 * built before `ui:build` simply has no control center in it, which `check`
 * reports as drift the moment one exists.
 */
const RUNTIME_DIRS = [
  "src",
  "skills",
  "references",
  "scripts/doctor",
  "scripts/privacy",
  "scripts/providers",
  "scripts/style",
];
// The licence and the notice that Apache 2.0 section 4(d) asks to travel with
// it. A distribution carrying the terms and not the attribution is incomplete.
const ROOT_FILES = ["LICENSE", "NOTICE"];

/** Never part of an installed skill, at any depth: dependencies are installed
 *  rather than vendored, and build output is rebuilt rather than copied. */
const NEVER_PACKAGED = new Set(["node_modules", "dist", "build", "coverage"]);

/**
 * Contributor tooling. `scripts/validate/` judges THIS repository and
 * `scripts/package/` builds it; neither means anything inside an installed
 * skill, and shipping them invites someone to run a repository gate against
 * their own product and read the result as a verdict on their work.
 */

function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const name of fs.readdirSync(abs).sort()) {
    if (NEVER_PACKAGED.has(name)) continue;
    const childRel = path.posix.join(rel, name);
    const st = fs.lstatSync(path.join(root, childRel));
    if (st.isSymbolicLink()) continue;              // never follow links into a package
    if (st.isDirectory()) walk(root, childRel, out);
    else out.push(childRel);
  }
  return out;
}

/**
 * The standalone SKILL.md.
 *
 * The plugin skill addresses its resources through ${CLAUDE_PLUGIN_ROOT}. That
 * variable does not exist on skills.sh, so the standalone copy is rewritten to
 * address them relative to the skill directory the agent is told about at
 * invocation.
 */
export function standaloneSkill(repoRoot) {
  const src = fs.readFileSync(path.join(repoRoot, "skills/project/SKILL.md"), "utf8");
  const body = src
    // One mapping, not two. The package keeps the repository's own layout, so
    // the plugin root and the skill directory address exactly the same tree and
    // a second, flattening rule would only be a way for the two to disagree.
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, "<skill-dir>/")
    .replace(/\n\*Standalone[^\n]*note:[\s\S]*?\*\n?$/, "\n")
    // skills.sh requires `name` to equal the directory name. As `project` in a
    // directory called `superdev` the package installs under the wrong name and
    // collides with any other tool's `project` skill - verified against the
    // real CLI, which registered it as "project".
    .replace(/^---\nname: project\n/, "---\nname: superdev\n");

  return body.trimEnd() + `

## Running standalone (skills.sh)

This package is self-contained. \`<skill-dir>\` is the directory this SKILL.md
lives in - the path stated when the skill is invoked. Every script and reference
above resolves under it; nothing here depends on a plugin runtime.

**One install step.** The database driver is declared in \`package.json\` rather
than vendored, so run \`npm install\` once inside \`<skill-dir>\`. Until that is
done every command that reads the project database fails on a missing module,
and the failure should be reported as exactly that rather than worked around.

**skills.sh has no lifecycle hooks.** There is no session-start context, no
dirty marking after an edit, and no end-of-session prompt, because there is
nothing to install them into. That is a real limitation, not a degraded mode:

- Begin a session by asking for **project status** - it reconciles from the
  canonical records regardless of hooks.
- End a session by asking Superdev to **record the session outcome**, so the
  next session resumes from the record rather than from memory.

Provider readiness is reported for the harness you are actually in. A Claude
Code plugin is not invocable from a skills.sh session, and it is reported
unreachable rather than credited.

## License

Superdev is released under the Apache License 2.0. The full terms are included
in \`LICENSE\`.
`;
}

/** Manifest of the generated package: path → sha256. The drift check compares
 *  this, so a changed byte anywhere is caught. */
export function manifestOf(root, base) {
  const files = walk(root, base).sort();
  const out = {};
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(root, rel));
    out[path.posix.relative(base, rel)] = crypto.createHash("sha256").update(buf).digest("hex");
  }
  return out;
}

/**
 * The runtime dependency is declared, not vendored.
 *
 * The package deliberately ships no `node_modules`, so without a manifest the
 * installed skill fails at its first database call with a resolution error and
 * no statement of what to install. Only what the package can actually honour is
 * carried over: the repository's own scripts validate and build the repository
 * and would fail by design here.
 */
export function standalonePackageJson(repoRoot) {
  const source = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  return JSON.stringify({
    name: "superdev-standalone",
    version: source.version,
    private: true,
    type: "module",
    description: source.description,
    author: source.author,
    license: source.license,
    engines: source.engines,
    // The skills say to run `superdev`, and this is what makes that true here.
    // The bundle carries the whole runtime, so installing it provides the
    // command rather than requiring the npm package alongside it. Without this
    // entry the skills named a command a standalone install did not have, and
    // the runtime it shipped went unused.
    bin: { superdev: "src/cli.mjs" },
    dependencies: source.dependencies,
  }, null, 2) + "\n";
}

/** Everything the package should contain, as rel → contents. */
export function plannedContents(repoRoot) {
  const files = new Map();
  const add = (destRel, buf) => files.set(destRel, buf);

  for (const rel of ROOT_FILES) add(rel, fs.readFileSync(path.join(repoRoot, rel)));
  for (const dir of RUNTIME_DIRS) {
    for (const rel of walk(repoRoot, dir)) add(rel, fs.readFileSync(path.join(repoRoot, rel)));
  }
  add("package.json", Buffer.from(standalonePackageJson(repoRoot), "utf8"));
  add("SKILL.md", Buffer.from(standaloneSkill(repoRoot), "utf8"));
  return files;
}

export function build(repoRoot, { apply = true } = {}) {
  const dist = path.join(repoRoot, DIST_REL);
  const planned = plannedContents(repoRoot);
  if (apply) {
    fs.rmSync(dist, { recursive: true, force: true });
    for (const rel of [...planned.keys()].sort()) {
      const dest = path.join(dist, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, planned.get(rel));
    }
  }
  return { files: planned.size, dist: DIST_REL, applied: apply };
}

/** Has the generated package drifted from the canonical source? */
export function check(repoRoot) {
  const dist = path.join(repoRoot, DIST_REL);
  if (!fs.existsSync(dist)) return { drift: true, reason: "the standalone package has not been generated", differences: [] };
  const planned = plannedContents(repoRoot);
  const actual = manifestOf(repoRoot, DIST_REL);
  const differences = [];
  for (const rel of [...planned.keys()].sort()) {
    const want = crypto.createHash("sha256").update(planned.get(rel)).digest("hex");
    if (!actual[rel]) differences.push({ file: rel, kind: "missing from the package" });
    else if (actual[rel] !== want) differences.push({ file: rel, kind: "differs from the source" });
  }
  for (const rel of Object.keys(actual).sort()) {
    if (!planned.has(rel)) differences.push({ file: rel, kind: "stale - no longer part of the package" });
  }
  return { drift: differences.length > 0, reason: differences.length ? "the package no longer matches the source" : null, differences };
}

function main() {
  let args, positionals;
  try {
    const parsed = parseArgs({
      options: { root: { type: "string", default: REPO }, json: { type: "boolean", default: false },
                 out: { type: "string" }, help: { type: "boolean", default: false } },
      allowPositionals: true,
    });
    args = parsed.values; positionals = parsed.positionals;
  } catch (e) {
    console.error(String(e.message ?? e)); console.error(USAGE); process.exit(2);
  }
  if (args.help) { console.log(USAGE); process.exit(0); }
  const op = positionals[0] ?? "build";
  if (!["build", "check"].includes(op)) { console.error(`unknown operation: ${op}`); console.error(USAGE); process.exit(2); }
  const root = path.resolve(args.root);

  if (op === "build") {
    const r = build(root);
    console.log(args.json ? JSON.stringify(r, null, 2) : `built ${r.dist} (${r.files} files)`);
    writeReport(args.out, r);
    process.exit(0);
  }
  const r = check(root);
  console.log(args.json ? JSON.stringify(r, null, 2)
    : r.drift ? `standalone package DRIFTED: ${r.reason}\n${r.differences.slice(0, 12).map((d) => `  ${d.kind}: ${d.file}`).join("\n")}`
      : "standalone package matches the canonical source");
  writeReport(args.out, r);
  process.exit(r.drift ? 1 : 0);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
