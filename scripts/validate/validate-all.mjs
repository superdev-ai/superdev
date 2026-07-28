#!/usr/bin/env node
// The validation entry point. Runs every deterministic validator against one
// repository root and reports what each of them found.
//
// Exit codes: 0 no findings, 1 findings, 2 usage error.
//
// A validator that throws is itself a finding. Swallowing the error would turn
// a broken validator into a passing run, which is the single most expensive
// failure mode a gate can have.

import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { ERROR, finding } from "./common.mjs";

import * as manifests from "./manifests.mjs";
import * as skills from "./skills.mjs";
import * as docsTemplates from "./docs-templates.mjs";
import * as migrations from "./migrations.mjs";
import * as markdown from "./markdown.mjs";
import * as style from "./style.mjs";
import * as privacy from "./privacy.mjs";
import * as imports from "./imports.mjs";
import * as dependencies from "./dependencies.mjs";
import * as noTests from "./no-tests.mjs";
import * as footprint from "./footprint.mjs";
import * as dataModel from "./data-model.mjs";
import * as recordLinks from "./record-links.mjs";
import * as skillCommands from "./skill-commands.mjs";
import * as specification from "./specification.mjs";

/** Declaration order is report order, so two runs read the same way. */
export const VALIDATORS = [
  manifests, skills, docsTemplates, migrations, markdown,
  style, privacy, imports, dependencies, noTests, footprint, dataModel, recordLinks, skillCommands, specification,
];

const USAGE = `Usage: node validate-all.mjs [--root <path>] [--only <name,...>] [--json] [--out <file>] [--help]
  --root <path>   repository root to validate (default: current directory)
  --only <names>  comma separated validator names, run only these
  --json          machine-readable JSON on stdout
  --out <file>    also write the JSON report to this exact path
  --help          show this help

Validators: ${VALIDATORS.map((v) => v.name).join(", ")}

Exit codes: 0 clean, 1 findings, 2 usage error.`;

export async function runAll(root, { only = [] } = {}) {
  const selected = only.length ? VALIDATORS.filter((v) => only.includes(v.name)) : VALIDATORS;
  const results = [];
  for (const validator of selected) {
    try {
      const result = await validator.run(root);
      results.push({ name: result.name ?? validator.name, findings: result.findings ?? [] });
    } catch (err) {
      results.push({
        name: validator.name,
        findings: [finding("VA-001", ERROR, ".", `the ${validator.name} validator threw: ${String(err?.stack ?? err?.message ?? err)}`)],
      });
    }
  }
  return results;
}

/** --out writes exactly the machine-readable report, atomically. */
function writeReport(outPath, report) {
  if (!outPath) return;
  const target = resolve(outPath);
  const tmp = join(dirname(target), `.tmp-validate-${process.pid}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(tmp, JSON.stringify(report, null, 2) + "\n");
  renameSync(tmp, target);
}

function printTable(results) {
  const rows = results.map((result) => ({
    name: result.name,
    errors: result.findings.filter((f) => f.severity === ERROR).length,
    warnings: result.findings.filter((f) => f.severity !== ERROR).length,
  }));
  const width = Math.max(9, ...rows.map((row) => row.name.length));
  console.log(`${"validator".padEnd(width)}  errors  warnings  result`);
  console.log(`${"-".repeat(width)}  ------  --------  ------`);
  for (const row of rows) {
    const verdict = row.errors || row.warnings ? "findings" : "clean";
    console.log(
      `${row.name.padEnd(width)}  ${String(row.errors).padStart(6)}  ${String(row.warnings).padStart(8)}  ${verdict}`,
    );
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        root: { type: "string", default: "." },
        only: { type: "string" },
        json: { type: "boolean", default: false },
        out: { type: "string" },
        help: { type: "boolean", default: false },
      },
      allowPositionals: true,
    });
  } catch (err) {
    console.error(String(err.message ?? err));
    console.error(USAGE);
    process.exit(2);
  }
  if (parsed.values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const root = resolve(parsed.positionals[0] ?? parsed.values.root);
  if (!existsSync(root) || !statSync(root).isDirectory() || !existsSync(join(root, "package.json"))) {
    console.error(`root is not a repository directory: ${parsed.positionals[0] ?? parsed.values.root}`);
    console.error(USAGE);
    process.exit(2);
  }

  const only = (parsed.values.only ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  const unknown = only.filter((n) => !VALIDATORS.some((v) => v.name === n));
  if (unknown.length) {
    console.error(`unknown validator(s): ${unknown.join(", ")}`);
    console.error(USAGE);
    process.exit(2);
  }

  const results = await runAll(root, { only });
  const findings = results.flatMap((result) => result.findings.map((f) => ({ validator: result.name, ...f })));
  const errors = findings.filter((f) => f.severity === ERROR).length;
  const report = { version: 1, root, results, findings, errors };

  if (parsed.values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTable(results);
    for (const result of results) {
      if (!result.findings.length) continue;
      console.log(`\n${result.name}`);
      for (const item of result.findings) {
        console.log(`  [${item.code}] ${item.severity} ${item.path}: ${item.message}`);
      }
    }
    console.log(findings.length ? `\n${findings.length} finding(s)` : "\nclean");
    if (errors === 0 && findings.length > 0) {
      // Said out loud rather than left to the exit code, so a warning is not
      // quietly treated as nothing.
      console.log("No errors. The findings above are warnings and did not fail this run.");
    }
  }

  writeReport(parsed.values.out, report);
  // Errors fail the run; warnings are reported and do not.
  //
  // This used to exit on any finding, which made the whole gate fail on every
  // fresh clone: the project database is git-ignored by design, so the three
  // validators that read it correctly warn that they had nothing to check, and a
  // release workflow running this on a checkout would have failed every time
  // without anything being wrong.
  //
  // The distinction is not a relaxation. An error is a claim the repository makes
  // that is false, and none of those is tolerated. A warning is something worth
  // a reader's attention that does not make the tree incorrect, and a gate that
  // cannot tell the two apart teaches people to ignore it.
  process.exit(errors > 0 ? 1 : 0);
}

// Main-module guard: realpath both sides, because Node resolves symlinks when
// it builds import.meta.url for the entry module and /tmp is one on macOS.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
