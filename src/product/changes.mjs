// Recording what moved in accepted scope, and why.
//
// Section 6.2 says a Change must record the affected records and the reason,
// and 14.2 says changes must preserve audit history. An activity event records
// that something happened; a change records that accepted scope moved, which is
// the claim a reader comes back for months later when asking why the product is
// not what the plan said.
//
// A change is append-only, enforced by a trigger. Recording one wrongly is
// corrected by recording another that says so, never by editing the first.

import { create, mutate, query } from "../db/store.mjs";
import { assertStorable } from "../model/screening.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  INVALID: "E_INVALID",
};

export class ChangeError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "ChangeError";
    this.code = code;
    this.detail = detail;
  }
}

/** The kinds a change can be, in the vocabulary the schema accepts. */
export const CHANGE_TYPES = [
  "scope_added", "scope_removed", "behavior_changed",
  "contract_changed", "correction", "scope_changed",
];

const asList = (value) =>
  (value === null || value === undefined ? [] : [].concat(value))
    .map((v) => String(v).trim()).filter(Boolean);

/**
 * Record a change to accepted scope or behaviour.
 *
 * A summary and a reason are both required. A change with no reason is an event
 * log entry wearing a different name, and the reason is the whole point: it is
 * what tells the next reader whether the product drifted or was steered.
 *
 * Targets are required for the same reason. "Something changed" is not a record
 * anyone can act on, so a change names what it moved.
 */
export async function recordChange(root, input = {}) {
  const summary = String(input.summary ?? "").trim();
  const reason = String(input.reason ?? "").trim();
  if (!summary) {
    throw new ChangeError(E.INVALID, "A change needs a summary saying what moved.");
  }
  if (!reason) {
    throw new ChangeError(E.INVALID,
      "A change needs its reason. Without it nobody can tell later whether the product was steered or drifted.");
  }

  const changeType = String(input.changeType ?? "scope_changed");
  if (!CHANGE_TYPES.includes(changeType)) {
    throw new ChangeError(E.INVALID,
      `"${changeType}" is not a kind of change. Use one of: ${CHANGE_TYPES.join(", ")}.`);
  }

  const targets = asList(input.targets);
  if (targets.length === 0) {
    throw new ChangeError(E.INVALID,
      "A change names what it moved. Pass at least one target as <type>:<id>, for example feature:FEAT-0001.");
  }

  const parsed = targets.map((t) => {
    const [type, id, ...rest] = t.split(":");
    if (!type || !id) {
      throw new ChangeError(E.INVALID,
        `"${t}" is not a target. Write it as <type>:<id>, for example feature:FEAT-0001.`);
    }
    return { type, id, what: rest.join(":") || null };
  });

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ChangeError(E.NOT_FOUND, "There is no project to record a change against.");

    // A target that does not exist makes the audit trail point at nothing, and
    // a dangling reference is the failure the record links validator exists to
    // catch. Better to refuse than to write one.
    for (const t of parsed) {
      const table = TARGET_TABLES[t.type];
      if (!table) {
        throw new ChangeError(E.INVALID,
          `"${t.type}" is not a kind of record this can point at. Known kinds: ${Object.keys(TARGET_TABLES).join(", ")}.`);
      }
      const found = await db.get(`SELECT 1 AS ok FROM ${table} WHERE id = ?`, t.id);
      if (!found) throw new ChangeError(E.NOT_FOUND, `There is no ${t.type} ${t.id}.`);
    }

    const row = await create(db, "change", {
      project_id: project.id,
      summary: assertStorable("summary", summary),
      reason: assertStorable("reason", reason),
      change_type: changeType,
      requested_by: input.requestedBy ?? null,
      decided_by: input.decidedBy ?? input.actor ?? null,
      decision_id: input.decisionId ?? null,
      task_id: input.taskId ?? null,
      session_id: input.sessionId ?? null,
      status: "recorded",
    }, {
      projectId: project.id,
      actor: input.actor ?? "superdev",
      sessionId: input.sessionId ?? null,
      taskId: input.taskId ?? null,
      activityType: "scope_changed",
      activitySummary: `Change recorded: ${summary}`.slice(0, 200),
    });

    for (const t of parsed) {
      await db.run(
        "INSERT OR IGNORE INTO change_targets (change_id, target_type, target_id, what_changed) VALUES (?, ?, ?, ?)",
        row.id, t.type, t.id, t.what ? assertStorable("what_changed", t.what) : null,
      );
    }

    row.targets = parsed;
    return row;
  });
}

/** Where each target type resolves, so a change cannot point at nothing. */
const TARGET_TABLES = {
  goal: "goals",
  milestone: "milestones",
  module: "modules",
  feature: "features",
  workflow: "workflows",
  workflow_step: "workflow_steps",
  surface: "surfaces",
  api_operation: "api_operations",
  api_service: "api_services",
  data_entity: "data_entities",
  integration: "integrations",
  task: "tasks",
  decision: "decisions",
  nfr: "non_functional_requirements",
  acceptance_criterion: "feature_acceptance_criteria",
  test_plan: "test_plans",
};

/** Every change, newest first, each carrying what it moved. */
export async function listChanges(root, { limit = 50, targetType = null, targetId = null } = {}) {
  return query(root, async (db) => {
    const filtered = targetType && targetId;
    const rows = await db.all(
      `SELECT c.* FROM changes c
        ${filtered ? "JOIN change_targets t ON t.change_id = c.id AND t.target_type = ? AND t.target_id = ?" : ""}
        ORDER BY c.created_at DESC, c.id DESC LIMIT ?`,
      ...(filtered ? [targetType, targetId, limit] : [limit]),
    );
    for (const row of rows) {
      row.targets = await db.all(
        "SELECT target_type, target_id, what_changed FROM change_targets WHERE change_id = ?", row.id);
    }
    return rows;
  });
}

/** One change in full. */
export async function showChange(root, changeId) {
  return query(root, async (db) => {
    const row = await db.get("SELECT * FROM changes WHERE id = ?", changeId);
    if (!row) throw new ChangeError(E.NOT_FOUND, `There is no change ${changeId}.`);
    row.targets = await db.all(
      "SELECT target_type, target_id, what_changed FROM change_targets WHERE change_id = ?", changeId);
    if (row.decision_id) {
      row.decision = await db.get("SELECT id, title, status FROM decisions WHERE id = ?", row.decision_id);
    }
    return row;
  });
}
