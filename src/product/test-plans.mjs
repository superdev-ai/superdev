// The agreed verification strategies, and whether anyone has run them.
//
// Section 9.3 makes the accepted test plan a completion condition. A plan is
// therefore not a document: it is a gate, and a gate needs a way to be opened.
// Two ways exist here, and the difference between them is the point.
//
// A plan whose how_to_run is a command this project can run unattended is run,
// and the result recorded is whatever the run produced. Nothing asserts that it
// passed. A plan whose how_to_run is a journey, such as opening every area of
// the control centre or restoring a backup and checking what came back, cannot
// be run by a script, and pretending otherwise would put a self issued pass
// where an observation belongs. Those are recorded by whoever performed them,
// and say who and what they saw.

import { create, mutate, query } from "../db/store.mjs";
import { refuseReason, runCheck } from "../verify/index.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  NOT_ACCEPTED: "E_PLAN_NOT_ACCEPTED",
  NOT_RUNNABLE: "E_PLAN_NOT_RUNNABLE",
};

export class PlanError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "PlanError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

/** How many current passing runs a plan carries, as a subquery every read wants. */
const PASSING_RUNS = `(SELECT COUNT(*) FROM verification_evidence e
   WHERE e.test_plan_id = p.id AND e.status = 'current' AND e.result = 'pass'
     AND (e.last_check_result IS NULL OR e.last_check_result = 'pass'))`;

export async function listPlans(root) {
  const rows = await query(root, (db) => db.all(
    `SELECT p.id, p.name, p.strategy, p.how_to_run, p.passing_condition, p.status,
            p.feature_id, p.module_id, p.workflow_id, ${PASSING_RUNS} AS passing_runs
       FROM test_plans p ORDER BY p.id`));
  return rows.map((p) => ({
    ...p,
    passing_runs: Number(p.passing_runs),
    satisfied: Number(p.passing_runs) > 0,
    // Whether this plan can be closed by a command or only by a person, said
    // once here so no caller has to work it out again.
    runnable: refuseReason(p.how_to_run) === null,
    why_not_runnable: refuseReason(p.how_to_run),
  }));
}

export async function showPlan(root, id) {
  const found = await query(root, async (db) => ({
    plan: await db.get(
      `SELECT p.*, ${PASSING_RUNS} AS passing_runs FROM test_plans p WHERE p.id = ?`, id),
    runs: await db.all(
      `SELECT id, task_id, summary, result, reference, recorded_by, recorded_at,
              last_check_result, last_checked_at
         FROM verification_evidence WHERE test_plan_id = ? ORDER BY recorded_at DESC LIMIT 20`, id),
  }));
  if (!found.plan) {
    throw new PlanError(E.NOT_FOUND, `There is no test plan ${id}. Run superdev test-plan list to see them.`);
  }
  const p = found.plan;
  return {
    ...found,
    plan: {
      ...p,
      passing_runs: Number(p.passing_runs),
      satisfied: Number(p.passing_runs) > 0,
      runnable: refuseReason(p.how_to_run) === null,
      why_not_runnable: refuseReason(p.how_to_run),
    },
  };
}

async function acceptedPlan(db, id) {
  const plan = await db.get("SELECT * FROM test_plans WHERE id = ?", id);
  if (!plan) throw new PlanError(E.NOT_FOUND, `There is no test plan ${id}. Run superdev test-plan list to see them.`);
  if (plan.status !== "accepted") {
    throw new PlanError(E.NOT_ACCEPTED,
      `${id} is ${plan.status.replace(/_/g, " ")}, not accepted. A plan nobody has agreed to cannot satisfy anything.`);
  }
  return plan;
}

/**
 * Write one run of a plan into the evidence table.
 *
 * A new run of the same plan supersedes the previous one rather than joining
 * it. Runs of a plan are not separate claims that accumulate: they are the same
 * claim, answered again. Left as they were, a plan that failed on Tuesday and
 * passed on Wednesday would report both forever, and every reader would have to
 * work out which one still counts.
 *
 * The superseded rows stay readable, so the failure is still part of the
 * record. Nothing is deleted, and `test-plan show` lists them in order.
 */
async function recordEvidence(db, plan, { summary, result, reference, checkCommand, taskId, actor, sessionId }) {
  await db.run(
    `UPDATE verification_evidence SET status = 'superseded'
      WHERE test_plan_id = ? AND status = 'current'`,
    plan.id,
  );
  return create(db, "verification_evidence", {
    project_id: plan.project_id,
    task_id: taskId,
    feature_id: plan.feature_id,
    test_plan_id: plan.id,
    evidence_type: checkCommand ? "command_output" : "manual_check",
    summary,
    reference,
    result,
    check_command: checkCommand,
    last_checked_at: checkCommand ? new Date().toISOString() : null,
    last_check_result: checkCommand ? result : null,
    recorded_by: actor,
    recorded_at: new Date().toISOString(),
    status: "current",
  }, {
    projectId: plan.project_id, actor, sessionId, taskId,
    activityType: "verification_attached",
    activitySummary: `${plan.id} ${result === "pass" ? "ran and passed" : result === "fail" ? "ran and failed" : "was inconclusive"}: ${summary}`.slice(0, 200),
  });
}

/**
 * Run a plan's recorded command and record what it showed.
 *
 * The result comes from the exit status, so a failing run is recorded as
 * failing. That is the only version of this worth having: one that recorded a
 * pass regardless would turn the completion gate into a formality.
 */
export async function runPlan(root, id, { actor = "superdev", sessionId = null, taskId = null, apply = false } = {}) {
  const plan = await query(root, (db) => acceptedPlan(db, id));
  const refused = refuseReason(plan.how_to_run);
  if (refused) {
    throw new PlanError(E.NOT_RUNNABLE,
      `${id} cannot be run unattended: ${refused}. Perform it and record what you saw with superdev test-plan record ${id} --summary "..." --result pass.`,
      { howToRun: plan.how_to_run, why: refused });
  }
  const outcome = await runCheck(root, plan.how_to_run, { timeoutMs: 300000 });
  const result = outcome.result === "pass" ? "pass" : outcome.result === "fail" ? "fail" : "inconclusive";
  const summary = `${plan.how_to_run} ${result === "pass" ? "passed" : result === "fail" ? "failed" : "could not be judged"}. ${outcome.detail}`.trim().slice(0, 400);

  if (!apply) return { applied: false, plan, result, summary, detail: outcome.detail };

  const evidence = await mutate(root, async (db) => {
    const current = await acceptedPlan(db, id);
    return recordEvidence(db, current, {
      summary, result, reference: null, checkCommand: plan.how_to_run, taskId, actor, sessionId,
    });
  });
  return { applied: true, plan, result, summary, detail: outcome.detail, evidence };
}

/**
 * Record a run that a person or an agent performed, for a plan no script can
 * run. It takes a summary of what was observed rather than a bare verdict,
 * because a pass with nothing behind it is what evidence exists to prevent.
 */
export async function recordPlanRun(root, id, {
  summary, result = "pass", reference = null, taskId = null,
  actor = "superdev", sessionId = null, apply = false,
} = {}) {
  if (!summary) {
    throw new PlanError(E.NOT_FOUND, "Say what was actually observed when the plan was performed, not only whether it passed.");
  }
  if (!["pass", "fail", "inconclusive"].includes(result)) {
    throw new PlanError(E.NOT_FOUND, `A result is pass, fail or inconclusive, not ${result}.`);
  }
  const plan = await query(root, (db) => acceptedPlan(db, id));
  if (!apply) return { applied: false, plan, result, summary };
  const evidence = await mutate(root, async (db) => {
    const current = await acceptedPlan(db, id);
    return recordEvidence(db, current, {
      summary, result, reference, checkCommand: null, taskId, actor, sessionId,
    });
  });
  return { applied: true, plan, result, summary, evidence };
}
