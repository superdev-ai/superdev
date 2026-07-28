#!/usr/bin/env node
/**
 * Writing style scanner and migrator.
 *
 * Superdev never generates or persists em dash characters or emoji. The rule is
 * enforced at the storage boundary in src/model/screening.mjs, so nothing new can land.
 * This command is for what landed BEFORE the rule existed, and for checking a
 * tree stays clean afterwards.
 *
 * Contract:
 *  - `scan` reads only and writes nothing unless --out is given
 *  - `fix` rewrites prohibited punctuation, never deletes the sentence around it
 *  - `fix` is a dry run until --apply, like every other mutating Superdev command
 *  - exit 0 clean, 1 findings, 2 usage error
 *
 * Scope: files Superdev owns. Third party dependencies, vendored material,
 * binaries and the generated standalone mirror are excluded, because rewriting
 * someone else's prose is not this tool's business and the mirror is rebuilt
 * from source anyway.
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EM_DASH, rewriteWritingStyle } from "../../src/model/toolkit.mjs";
import { EMOJI_PATTERN } from "../../src/model/screening.mjs";

const USAGE = `Usage: node style.mjs <scan|fix> [options]
  scan               report prohibited characters in Superdev owned files
  fix                rewrite them (dry run unless --apply)
  --root <path>      project root (default: current directory)
  --apply            perform the rewrite
  --json             machine-readable output
  --out <file>       also write the report to this exact path
  --help             show this help

Exit codes: 0 clean, 1 findings, 2 usage error.`;

/** Extensions whose content Superdev authors or generates. */
const TEXT_EXTENSIONS = new Set([".md", ".mjs", ".js", ".json", ".html", ".css", ".txt", ".yml", ".yaml"]);

/**
 * Paths excluded from the migration.
 *
 * `dist/` is the generated standalone mirror: rewriting it directly would drift
 * it from its source, and rebuilding regenerates it correctly. Change events and
 * session records are an append only ledger of what actually happened, so their
 * historical text is left alone; the rule binds what Superdev writes from now
 * on, and rewriting history to look compliant would be the dishonest reading of
 * a policy about honesty.
 */
const EXCLUDED = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /^dist\//,
];

// This scanner carried its own third copy of the emoji rule, and that copy held
// a literal variation selector inside the pattern source, so it demanded the
// very character it meant to describe. Importing the rule means the fixer, the
// gate and the storage boundary cannot drift apart again.
const EMOJI_RE = new RegExp(EMOJI_PATTERN, "gu");

export function isExcluded(rel) {
  return EXCLUDED.some((re) => re.test(rel));
}

/** Git tracked text files Superdev owns, relative to the root. */
export function ownedFiles(rootReal) {
  let listed = [];
  try {
    listed = execFileSync("git", ["ls-files", "-z"], { cwd: rootReal, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0").filter(Boolean);
  } catch {
    // Not a git repository: walk the tree instead, still honouring exclusions.
    const walk = (dir, prefix = "") => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix + entry.name;
        if (isExcluded(rel + (entry.isDirectory() ? "/" : ""))) continue;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), rel + "/");
        else listed.push(rel);
      }
    };
    walk(rootReal);
  }
  return listed.filter((rel) => TEXT_EXTENSIONS.has(path.extname(rel)) && !isExcluded(rel));
}

/** Every prohibited occurrence in one file, with enough context to judge it. */
export function inspectFile(abs, rel) {
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  const findings = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    let at = line.indexOf(EM_DASH);
    while (at !== -1) {
      findings.push({ file: rel, line: i + 1, column: at + 1, rule: "EM-DASH", excerpt: line.trim().slice(0, 120) });
      at = line.indexOf(EM_DASH, at + 1);
    }
    EMOJI_RE.lastIndex = 0;
    let m;
    while ((m = EMOJI_RE.exec(line)) !== null) {
      findings.push({ file: rel, line: i + 1, column: m.index + 1, rule: "EMOJI", excerpt: line.trim().slice(0, 120) });
    }
  });
  return findings;
}

export function scan(rootReal) {
  const findings = [];
  for (const rel of ownedFiles(rootReal)) findings.push(...inspectFile(path.join(rootReal, rel), rel));
  const byRule = findings.reduce((a, f) => ({ ...a, [f.rule]: (a[f.rule] ?? 0) + 1 }), {});
  return {
    findings,
    files: [...new Set(findings.map((f) => f.file))],
    counts: { total: findings.length, ...byRule },
  };
}

/**
 * Rewrite prohibited punctuation in place.
 *
 * Emoji are reported but never auto removed: an emoji is content someone chose,
 * and deleting it silently is the "quietly make the problem disappear" move this
 * policy exists to prevent. Em dashes have an unambiguous safe replacement, so
 * they are rewritten.
 */
export function fix(rootReal, { apply = false } = {}) {
  const changed = [];
  const manual = [];
  for (const rel of ownedFiles(rootReal)) {
    const abs = path.join(rootReal, rel);
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    EMOJI_RE.lastIndex = 0;
    if (EMOJI_RE.test(text)) manual.push({ file: rel, rule: "EMOJI", reason: "an emoji is authored content; replace it deliberately with words or an icon" });
    if (!text.includes(EM_DASH)) continue;
    const next = rewriteWritingStyle(text);
    const before = (text.match(new RegExp(EM_DASH, "g")) ?? []).length;
    changed.push({ file: rel, replaced: before });
    if (apply) fs.writeFileSync(abs, next);
  }
  return { applied: apply, changed, manual, totals: { files: changed.length, replacements: changed.reduce((n, c) => n + c.replaced, 0) } };
}

function main() {
  let args, positionals;
  try {
    const parsed = parseArgs({
      options: {
        root: { type: "string", default: "." },
        apply: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        out: { type: "string" },
        help: { type: "boolean", default: false },
      },
      allowPositionals: true,
    });
    args = parsed.values;
    positionals = parsed.positionals;
  } catch (e) {
    console.error(String(e.message ?? e));
    console.error(USAGE);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const op = positionals[0];
  if (!["scan", "fix"].includes(op)) {
    console.error(`unknown operation: ${op ?? "(none)"}`);
    console.error(USAGE);
    process.exit(2);
  }
  const rootReal = fs.realpathSync(args.root);

  const report = op === "scan" ? scan(rootReal) : fix(rootReal, { apply: args.apply });
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + "\n");
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else if (op === "scan") {
    console.log(`writing style scan: ${report.counts.total} finding(s) in ${report.files.length} file(s)`);
    for (const f of report.findings.slice(0, 20)) console.log(`  ${f.file}:${f.line}:${f.column} ${f.rule}  ${f.excerpt}`);
    if (report.findings.length > 20) console.log(`  ... and ${report.findings.length - 20} more`);
    if (!report.counts.total) console.log("  clean");
  } else {
    console.log(report.applied
      ? `rewrote ${report.totals.replacements} em dash(es) across ${report.totals.files} file(s)`
      : `plan: would rewrite ${report.totals.replacements} em dash(es) across ${report.totals.files} file(s) (run with --apply)`);
    for (const m of report.manual) console.log(`  manual: ${m.file} ${m.rule} ${m.reason}`);
  }

  const findings = op === "scan" ? report.counts.total : report.manual.length;
  process.exit(findings ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
