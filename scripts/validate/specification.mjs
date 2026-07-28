// Can the specification actually be verified, or only agreed with?
//
// A quality requirement that states no target and no measurement method cannot
// be checked by anyone. It reads like a requirement and behaves like a wish:
// nobody can say whether the product meets it, so nobody can say whether the
// work behind it is done.
//
// This is not a style point. Every task derived from a quality requirement is
// given the verification "Measure NFR-xxxx using its declared measurement
// method and record the value, not an impression". When no requirement declares
// one, those tasks state a verification that cannot be performed, and they sit
// open forever with nobody able to say why.
//
// The depth gate checks that requirements of certain categories exist before a
// feature is accepted. It does not check that any of them can be measured, so
// features were accepted carrying requirements that could never be verified.
// This reports that rather than refusing it: refusing would retroactively
// invalidate every accepted feature, which is the owner's call and not a
// validator's.
//
// DEC-0021 records the rule this enforces. A requirement that genuinely cannot
// be measured here is not a defect as long as it says so, so a stated reason
// counts as declared and only silence is reported.

import { join } from "node:path";

import { WARNING, finding } from "./common.mjs";

export const name = "specification";

const blank = (v) => v === null || v === undefined || String(v).trim() === "";

export async function run(root) {
  const findings = [];
  const { query } = await import(join(root, "src/db/store.mjs"));

  let data;
  try {
    data = await query(root, async (db) => ({
      nfrs: await db.all(
        `SELECT n.id, n.category, n.requirement, n.target, n.measurement_method, n.feature_id,
                f.name AS feature, f.status AS feature_status
         FROM non_functional_requirements n
         LEFT JOIN features f ON f.id = n.feature_id
         ORDER BY n.id`),
      steps: await db.all(
        "SELECT id, action, expected_result FROM workflow_steps ORDER BY id"),
    }));
  } catch (error) {
    return {
      name,
      findings: [finding("specification-unreadable", WARNING, ".superdev",
        `The project database could not be read, so the specification was not checked: ${error.message}`)],
    };
  }

  const unmeasurable = data.nfrs.filter((n) => blank(n.target) && blank(n.measurement_method));
  const declaredUnmeasurable = data.nfrs.filter(
    (n) => !blank(n.measurement_method) && /^Not measurable in this repository/.test(String(n.measurement_method)));
  if (unmeasurable.length > 0) {
    // One finding for the whole population. Ninety-nine identical lines say the
    // same thing ninety-nine times and bury everything else in the report.
    const accepted = unmeasurable.filter((n) => n.feature_status === "accepted").length;
    findings.push(finding("quality-requirement-unmeasurable", WARNING, ".superdev",
      `${unmeasurable.length} of ${data.nfrs.length} quality requirements declare neither a target nor a measurement method, and do not say why, so nothing can show whether the product meets them. ${accepted} belong to features that are already accepted. First: ${unmeasurable.slice(0, 3).map((n) => n.id).join(", ")}.`));
  }

  // A requirement with a target and no way to read it is the same problem in a
  // smaller form, and worth naming separately because the fix differs.
  for (const n of data.nfrs) {
    if (blank(n.target) || !blank(n.measurement_method)) continue;
    findings.push(finding("quality-requirement-has-no-method", WARNING, ".superdev",
      `${n.id} states the target "${String(n.target).slice(0, 60)}" and no way to measure it.`));
  }

  if (declaredUnmeasurable.length > 0) {
    findings.push(finding("quality-requirement-declared-unmeasurable", WARNING, ".superdev",
      `${declaredUnmeasurable.length} quality requirements say plainly that nothing here can measure them. That is honest rather than broken, and it is the number to watch: ${declaredUnmeasurable.slice(0, 3).map((n) => n.id).join(", ")}.`));
  }

  for (const s of data.steps) {
    if (!blank(s.expected_result)) continue;
    findings.push(finding("workflow-step-has-no-expected-result", WARNING, ".superdev",
      `${s.id} says to "${String(s.action).slice(0, 60)}" and never says what should happen, so following it proves nothing.`));
  }

  return { name, findings };
}
