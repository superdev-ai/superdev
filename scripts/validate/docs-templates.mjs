// Template neutrality. The Docs templates and capability fragments are forms a
// product fills in from its own evidence. A vendor name, a latency number, a
// cloud region or a compliance regime written into the form becomes an invented
// fact in every product document generated from it, indistinguishable from one
// the project actually established.
//
// This is a denylist scan. It catches the known ways neutrality is lost; it
// does not prove neutrality. Placeholders ({{...}}) and HTML comments are
// exempt, because a placeholder is the form asking, not the form asserting.

import { extname, join } from "node:path";
import { ERROR, WARNING, finding, isDirectory, readText, rel, walk } from "./common.mjs";

export const name = "docs-templates";

// Naming these here is the enforcement mechanism, not a recommendation. They
// are all public products. "envx" is absent deliberately: it is a declared
// external provider of this project, not an invented choice.
const VENDOR =
  /\b(aws|amazon|azure|gcp|vercel|netlify|heroku|cloudflare|firebase|supabase|stripe|paypal|razorpay|twilio|sendgrid|mailgun|postmark|postgres(?:ql)?|mysql|mariadb|mongodb|dynamodb|redis|kafka|rabbitmq|sqs|auth0|okta|cognito|keycloak|sentry|datadog|posthog|mixpanel|amplitude|segment|launchdarkly|algolia|elasticsearch|next\.?js|react|vue|angular|svelte|drizzle|prisma|hasura|expo)\b/i;
const LATENCY = /\b\d+(?:\.\d+)?\s?(?:ms|milliseconds|seconds?)\b|\b\d{2}\.\d+\s?%|\b99\.\d+\b/;
// Region shapes: AWS style (us-east-1), GCP style (europe-west1, us-central1),
// Azure style (westus2, northeurope).
const REGION =
  /\b(?:us|eu|ap|sa|ca|me|af)-(?:east|west|north|south|central|northeast|southeast|southwest|northwest)-\d\b|\b(?:us|europe|asia|australia|northamerica|southamerica)-(?:east|west|north|south|central)\d\b|\b(?:east|west|north|south|central)(?:us|europe|asia)\d?\b/i;
const REGIME = /\b(GDPR|HIPAA|CCPA|CPRA|DPDP|PCI[- ]?DSS|SOC\s?2|ISO\s?27001|FedRAMP|COPPA|FERPA)\b/;
const ENV_VAR = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/;

const RULES = [
  { code: "DT-001", severity: ERROR, test: LATENCY, message: "states a concrete latency or availability number" },
  { code: "DT-002", severity: ERROR, test: REGION, message: "names a cloud region" },
  { code: "DT-003", severity: ERROR, test: REGIME, message: "asserts a concrete compliance regime" },
  { code: "DT-004", severity: WARNING, test: ENV_VAR, message: "names a concrete environment variable" },
  { code: "DT-005", severity: ERROR, test: VENDOR, message: "names a vendor or product" },
];

/**
 * Lint one document line by line, with HTML comments and placeholders removed.
 * Comment state carries across lines because a template header comment spans
 * several, and a naive per-line strip would judge its continuation as prose.
 */
export function lintText(path, text) {
  const findings = [];
  let inComment = false;
  text.split("\n").forEach((raw, index) => {
    let line = raw;
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
    for (const rule of RULES) {
      if (rule.test.test(line)) {
        findings.push(finding(rule.code, rule.severity, `${path}:${index + 1}`, rule.message));
      }
    }
  });
  return findings;
}

export async function run(root) {
  const findings = [];
  const assets = join(root, "skills", "docs", "assets");
  const templates = join(assets, "templates");
  const fragments = join(assets, "fragments");

  for (const [label, dir] of [["templates", templates], ["fragments", fragments]]) {
    if (!isDirectory(dir)) {
      findings.push(finding("DT-000", ERROR, rel(root, dir),
        `the Docs ${label} directory is missing; there is nothing to lint`));
    }
  }
  if (findings.length) return { name, findings };

  const files = [...walk(templates), ...walk(fragments)].filter((file) => extname(file) === ".md");
  if (!files.length) {
    findings.push(finding("DT-000", ERROR, rel(root, assets), "no template or fragment documents found"));
    return { name, findings };
  }

  for (const file of files) {
    const text = readText(file);
    if (text === null) {
      findings.push(finding("DT-006", ERROR, rel(root, file), "document is unreadable"));
      continue;
    }
    findings.push(...lintText(rel(root, file), text));
  }

  return { name, findings };
}
