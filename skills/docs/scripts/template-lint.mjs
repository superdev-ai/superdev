#!/usr/bin/env node
/**
 * Template neutrality lint: checks universal templates and capability fragments
 * against known vendor, latency, cloud-region, compliance-regime, and env-var
 * patterns. A denylist scan - it catches known violations; it does not prove
 * absence. Placeholders ({{...}}) and HTML comments are exempt.
 *
 * Finding codes:
 *  TL-001 P0 concrete latency/availability number
 *  TL-002 P0 cloud region identifier
 *  TL-003 P0 concrete compliance regime asserted
 *  TL-004 P1 concrete environment-variable name
 *  TL-005 P0 vendor/product name
 *
 * Exit codes: 0 clean, 1 findings, 2 usage error.
 */
import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const USAGE = `Usage: node template-lint.mjs [--dir <path>] [--json] [--out <file>] [--help]
  --dir <path>  assets directory to lint (default: the skill's own assets/)
  --json        machine-readable JSON on stdout
  --out <file>  also write the JSON report to this exact path
  --help        show this help`;

/** Shared CLI reporting contract: --out writes exactly the machine-readable
 *  report, atomically, with a trailing newline; no --out, no report file. */
function writeReport(outPath, report) {
  if (!outPath) return;
  const dir = path.dirname(path.resolve(outPath));
  const tmp = path.join(dir, `.tmp-report-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(report, null, 2) + "\n");
  fs.renameSync(tmp, path.resolve(outPath));
}

// Public product names that must never be baked into neutral templates.
// (Naming them here is the enforcement mechanism, not an endorsement or a leak -
// these are all public products.) "envx" is excluded: it is a declared external
// provider (see the repository's references/provider-contracts.md).
const VENDORS =
  /\b(aws|amazon|azure|gcp|vercel|netlify|heroku|cloudflare|firebase|supabase|stripe|paypal|razorpay|twilio|sendgrid|mailgun|postmark|postgres(?:ql)?|mysql|mariadb|mongodb|dynamodb|redis|kafka|rabbitmq|sqs|auth0|okta|cognito|keycloak|sentry|datadog|posthog|mixpanel|amplitude|segment|launchdarkly|algolia|elasticsearch|next\.?js|react|vue|angular|svelte|drizzle|prisma|hasura|graphql-yoga|expo)\b/i;
const LATENCY = /\b\d+(?:\.\d+)?\s?(?:ms|milliseconds|seconds?)\b|\b\d{2}\.\d+\s?%|\b99\.\d+\b/;
// Region shapes: AWS-style (us-east-1), GCP-style (us-central1, europe-west1),
// Azure-style (westus2, northeurope).
const REGION =
  /\b(?:us|eu|ap|sa|ca|me|af)-(?:east|west|north|south|central|northeast|southeast|southwest|northwest)-\d\b|\b(?:us|europe|asia|australia|northamerica|southamerica)-(?:east|west|north|south|central)\d\b|\b(?:east|west|north|south|central)(?:us|europe|asia)\d?\b/i;
const REGIME = /\b(GDPR|HIPAA|CCPA|CPRA|DPDP|PCI[- ]?DSS|SOC\s?2|ISO\s?27001|FedRAMP|COPPA|FERPA)\b/;
const ENVVAR = /\b[A-Z][A-Z0-9]{1,}(?:_[A-Z0-9]+){1,}\b/;

export function stripExempt(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "").replace(/\{\{[^}]*\}\}/g, "");
}

export function lintFile(relFile, text) {
  const findings = [];
  const lines = text.split("\n");
  let inComment = false;
  lines.forEach((rawLine, i) => {
    let line = rawLine;
    if (inComment) {
      const end = line.indexOf("-->");
      if (end === -1) return;
      line = line.slice(end + 3);
      inComment = false;
    }
    line = line.replace(/<!--[\s\S]*?-->/g, "");
    const open = line.indexOf("<!--");
    if (open !== -1) {
      line = line.slice(0, open);
      inComment = true;
    }
    line = line.replace(/\{\{[^}]*\}\}/g, "");
    const loc = { file: relFile, line: i + 1 };
    if (LATENCY.test(line)) findings.push({ ruleId: "TL-001", severity: "P0", ...loc, detail: "concrete latency/availability number" });
    if (REGION.test(line)) findings.push({ ruleId: "TL-002", severity: "P0", ...loc, detail: "cloud region identifier" });
    if (REGIME.test(line)) findings.push({ ruleId: "TL-003", severity: "P0", ...loc, detail: "concrete compliance regime" });
    if (ENVVAR.test(line)) findings.push({ ruleId: "TL-004", severity: "P1", ...loc, detail: "concrete env-var name" });
    if (VENDORS.test(line)) findings.push({ ruleId: "TL-005", severity: "P0", ...loc, detail: "vendor/product name" });
  });
  return findings;
}

export function lintDir(assetsDir) {
  const findings = [];
  const stack = [assetsDir];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".md"))
        findings.push(...lintFile(path.relative(assetsDir, full), fs.readFileSync(full, "utf8")));
    }
  }
  return findings;
}

function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        dir: { type: "string" },
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
  const assetsDir = args.dir ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    console.error(`assets directory not found: ${assetsDir}`);
    console.error(USAGE);
    process.exit(2);
  }
  const findings = lintDir(assetsDir);
  const report = { version: 1, dir: path.resolve(assetsDir), count: findings.length, findings };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`template lint - ${findings.length} finding(s)`);
    for (const f of findings) console.log(`  [${f.severity}] ${f.ruleId} ${f.file}:${f.line} - ${f.detail}`);
    if (!findings.length) console.log("  clean");
  }
  writeReport(args.out, report);
  process.exit(findings.length ? 1 : 0);
}

// Main-module guard: realpath both sides - Node resolves symlinks (e.g. /tmp
// on macOS) when building import.meta.url for the entry module.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
