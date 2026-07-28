// Everything needed to judge one task, read only, as JSON.
//
// Judging a task means reading what it promises and then checking the product
// against it. That means the task, its feature, and whatever contract it links
// to: a workflow step's action and expected result, a quality requirement's
// target and measurement method, a data entity's fields.
//
// This exists so that judgement reads the same record every time. Ten separate
// queries written ten times drift, and a judgement made against a half-read
// contract is worse than no judgement.
//
// Usage: node scripts/task-context.mjs TASK-0042 [TASK-0043 ...]

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const ROOT = process.cwd();
const { query } = await import(pathToFileURL(join(ROOT, "src/db/store.mjs")).href);

const ids = process.argv.slice(2).filter((a) => /^TASK-/i.test(a)).map((a) => a.toUpperCase());
if (ids.length === 0) {
  console.error("Name at least one task: node scripts/task-context.mjs TASK-0042");
  process.exit(2);
}

const placeholders = ids.map(() => "?").join(", ");

const out = await query(ROOT, async (db) => {
  const tasks = await db.all(
    `SELECT id, name, description, why_needed, expected_outcome, status, priority,
            completion_criteria_json, verification_requirements_json, feature_id, block_reason
     FROM tasks WHERE id IN (${placeholders})`, ...ids);

  const result = [];
  for (const task of tasks) {
    const feature = task.feature_id
      ? await db.get(`SELECT f.id, f.name, f.purpose, f.status, m.name AS module
                      FROM features f LEFT JOIN modules m ON m.id = f.module_id WHERE f.id = ?`, task.feature_id)
      : null;

    const links = await db.all(
      "SELECT target_type, target_id, relationship FROM task_contract_links WHERE task_id = ?", task.id);

    // Resolve each contract the task points at, so the judgement is made
    // against the specification rather than against the task's own summary.
    const contracts = [];
    for (const link of links) {
      if (link.target_type === "workflow_step") {
        const step = await db.get(
          `SELECT s.id, s.sequence, s.action, s.input_contract, s.expected_result, s.failure_behavior,
                  s.owner_type, w.name AS workflow, w.id AS workflow_id
           FROM workflow_steps s JOIN workflows w ON w.id = s.workflow_id WHERE s.id = ?`, link.target_id);
        if (step) contracts.push({ kind: "workflow_step", ...step });
      } else if (link.target_type === "nfr") {
        const nfr = await db.get(
          "SELECT id, category, requirement, target, measurement_method, status FROM non_functional_requirements WHERE id = ?",
          link.target_id);
        if (nfr) contracts.push({ kind: "quality_requirement", ...nfr });
      } else if (link.target_type === "data_entity") {
        const entity = await db.get("SELECT id, name, purpose, store FROM data_entities WHERE id = ?", link.target_id);
        if (entity) {
          entity.fields = await db.all(
            "SELECT name, type, nullable FROM data_fields WHERE entity_id = ? ORDER BY sequence", entity.id);
          contracts.push({ kind: "data_entity", ...entity });
        }
      } else if (link.target_type === "surface") {
        const surface = await db.get("SELECT id, name, purpose, route, status FROM surfaces WHERE id = ?", link.target_id);
        if (surface) contracts.push({ kind: "surface", ...surface });
      } else if (link.target_type === "acceptance_criterion") {
        const ac = await db.get(
          "SELECT id, criterion, status FROM feature_acceptance_criteria WHERE id = ?", link.target_id);
        if (ac) contracts.push({ kind: "acceptance_criterion", ...ac });
      } else {
        contracts.push({ kind: link.target_type, id: link.target_id, unresolved: true });
      }
    }

    const evidence = await db.all(
      "SELECT id, result, status, summary, reference FROM verification_evidence WHERE task_id = ?", task.id);

    result.push({
      id: task.id,
      name: task.name,
      status: task.status,
      blockReason: task.block_reason,
      whyNeeded: task.why_needed,
      expectedOutcome: task.expected_outcome,
      description: task.description,
      completionCriteria: JSON.parse(task.completion_criteria_json || "[]"),
      verificationRequirements: JSON.parse(task.verification_requirements_json || "[]"),
      feature,
      contracts,
      evidenceAlreadyRecorded: evidence,
    });
  }
  return result;
});

console.log(JSON.stringify(out, null, 2));
