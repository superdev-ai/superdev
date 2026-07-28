// The task lifecycle, brief sections 7.2, 7.4 and 12.
//
// Task tracking is an execution contract, not a status report someone remembers
// to write. Every function here is one transaction: it checks what the brief
// says must be true, moves the record, and leaves history behind. Nothing moves
// status through a plain update, so no transition can happen unrecorded.
//
// Where the database already enforces a rule (one active assignment, no parent
// completing over open children, no task leaving draft without a contract), this
// module catches the refusal and turns it into a sentence a person can act on.

import { create, mutate, patch, query, recordActivity, setStatus, json } from "../db/store.mjs";
import { count } from "../model/vocabulary.mjs";
import { TARGET_TABLE } from "./derive.mjs";
import { leaseExpiry, leaseHolds } from "../cloud/merge.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  INVALID_TRANSITION: "E_INVALID_TRANSITION",
  ALREADY_CLAIMED: "E_ALREADY_CLAIMED",
  NOT_CLAIMED: "E_NOT_CLAIMED",
  OPEN_SUBTASKS: "E_OPEN_SUBTASKS",
  EVIDENCE_MISSING: "E_EVIDENCE_MISSING",
  EVIDENCE_FAILING: "E_EVIDENCE_FAILING",
  ACCEPTANCE_UNMET: "E_ACCEPTANCE_UNMET",
  TEST_PLAN_UNSATISFIED: "E_TEST_PLAN_UNSATISFIED",
  WITHOUT_CONTRACT: "E_TASK_WITHOUT_CONTRACT",
  ENABLING_WITHOUT_TARGET: "E_ENABLING_WITHOUT_TARGET",
  UNKNOWN_TARGET: "E_UNKNOWN_TARGET",
  STATUS_VIA_TRANSITION: "E_STATUS_VIA_TRANSITION",
  REASON_REQUIRED: "E_REASON_REQUIRED",
};

export class TaskError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "TaskError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

/** Brief 7.4. What may follow what, so nothing arrives at complete sideways. */
const ALLOWED = {
  // Brief 12.2 goes draft, link, claim, In Progress in one sitting, so a draft
  // may start directly. The database still refuses it if it implements nothing.
  draft: ["ready", "in_progress", "cancelled"],
  ready: ["draft", "in_progress", "blocked", "paused", "cancelled"],
  in_progress: ["in_review", "verifying", "blocked", "paused", "complete", "cancelled"],
  in_review: ["in_progress", "verifying", "blocked", "complete", "cancelled"],
  verifying: ["in_progress", "in_review", "blocked", "complete", "cancelled"],
  blocked: ["ready", "in_progress", "paused", "cancelled"],
  paused: ["ready", "in_progress", "blocked", "cancelled"],
  complete: ["in_progress"],
  cancelled: ["ready", "draft"],
  superseded: ["ready"],
};

const OPEN = (status) => !["complete", "cancelled", "superseded"].includes(status);

const nowIso = () => new Date().toISOString();

async function taskOr404(db, taskId) {
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", taskId);
  if (!task) throw new TaskError(E.NOT_FOUND, `Task ${taskId} does not exist. Check the id or list the tasks for the feature.`);
  return task;
}

/** Turn a trigger refusal into the reason a person can do something about. */
function explain(err, task, to) {
  const text = String(err?.message ?? "");
  if (/E_OPEN_SUBTASKS/.test(text)) {
    return new TaskError(E.OPEN_SUBTASKS,
      `${task.id} still has subtasks that are not finished. Complete or cancel them first, then complete ${task.id}.`);
  }
  if (/E_TASK_WITHOUT_CONTRACT/.test(text)) {
    return new TaskError(E.WITHOUT_CONTRACT,
      `${task.id} cannot move to ${to} because it implements nothing. Link it to a workflow step, action, operation, entity, migration, integration, requirement, document or decision, or mark it as enabling work with the feature it unblocks.`);
  }
  if (/E_ENABLING_WITHOUT_TARGET/.test(text)) {
    return new TaskError(E.ENABLING_WITHOUT_TARGET,
      `${task.id} is marked as enabling work but does not say which feature it unblocks or why. Set the enabled feature and a plain-language rationale, then move it again.`);
  }
  return err;
}

async function move(db, task, to, opts = {}) {
  if (task.status === to) return task;
  if (!(ALLOWED[task.status] ?? []).includes(to)) {
    throw new TaskError(E.INVALID_TRANSITION,
      `${task.id} is ${task.status.replace(/_/g, " ")} and cannot move straight to ${to.replace(/_/g, " ")}. Allowed from here: ${(ALLOWED[task.status] ?? []).join(", ") || "nothing"}.`);
  }
  try {
    return await setStatus(db, "task", task.id, to, { projectId: task.project_id, ...opts });
  } catch (err) {
    throw explain(err, task, to);
  }
}

const activeAssignment = (db, taskId) =>
  db.get("SELECT * FROM task_assignments WHERE task_id = ? AND active = 1", taskId);

/** Who holds a task, in words rather than ids, for the already-claimed message. */
async function holderOf(db, assignment) {
  const developer = assignment.developer_id
    ? await db.get("SELECT display_name FROM developers WHERE id = ?", assignment.developer_id)
    : null;
  const agent = assignment.agent_id
    ? await db.get("SELECT harness, model_label FROM agents WHERE id = ?", assignment.agent_id)
    : null;
  const parts = [
    developer?.display_name,
    agent ? `${agent.harness}${agent.model_label ? ` (${agent.model_label})` : ""}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" via ") : "an unnamed session";
}

async function release(db, task, actor, note) {
  const assignment = await activeAssignment(db, task.id);
  if (!assignment) return null;
  // task_assignments carries no version column, so versionedUpdate cannot address
  // it; the activity event is written here instead of being skipped.
  await db.run("UPDATE task_assignments SET active = 0, released_at = ? WHERE id = ?", nowIso(), assignment.id);
  await recordActivity(db, task.project_id, {
    type: "task_released",
    actor,
    taskId: task.id,
    featureId: task.feature_id,
    summary: note ?? `Assignment on ${task.id} released.`,
    metadata: { assignment: assignment.id },
  });
  // Every path that ends a claim runs through here: releasing it, completing it,
  // cancelling it. So this is the one place that has to stop pointing a session at
  // a task it no longer holds, and only the session that held it is cleared.
  await db.run(
    "UPDATE work_sessions SET active_task_id = NULL WHERE project_id = ? AND active_task_id = ?",
    task.project_id, task.id,
  );
  return assignment;
}

// ------------------------------------------------------------------- writing

/**
 * Create a task. It lands in draft, gains its contract links, and only then may
 * be asked for a further status, because the database refuses a task that leaves
 * draft implementing nothing.
 */
export async function createTask(root, input = {}) {
  const {
    featureId, name, description = null, expectedOutcome = null, whyNeeded = null,
    completionCriteria = [], verificationRequirements = [], affectedBoundaries = [],
    priority = "normal", risk = null, category = null, estimate = null, dueAt = null,
    parentTaskId = null, enabling = false, enabledFeatureId = null, enablingRationale = null,
    links = [], dependsOn = [], status = "draft", actor = "superdev", sessionId = null,
  } = input;

  if (!featureId) {
    throw new TaskError(E.NOT_FOUND, "A task must belong to exactly one feature. Pass the feature id, or specify the feature first if it does not exist yet.");
  }
  if (!name) throw new TaskError(E.REASON_REQUIRED, "A task needs a name that states the outcome.");

  return mutate(root, async (db) => {
    const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
    if (!feature) throw new TaskError(E.NOT_FOUND, `Feature ${featureId} does not exist. Create or accept the feature specification before creating work against it.`);
    if (enabling && (!enabledFeatureId || !enablingRationale)) {
      throw new TaskError(E.ENABLING_WITHOUT_TARGET,
        "Enabling work must name the feature it unblocks and say, in plain language, why that feature is blocked without it.");
    }
    const categoryId = category
      ? (await db.get("SELECT id FROM task_categories WHERE project_id = ? AND name = ?", feature.project_id, category))?.id ?? null
      : null;

    const row = await create(db, "task", {
      project_id: feature.project_id,
      feature_id: feature.id,
      parent_task_id: parentTaskId,
      category_id: categoryId,
      name,
      description,
      expected_outcome: expectedOutcome,
      why_needed: whyNeeded,
      completion_criteria_json: JSON.stringify(completionCriteria),
      verification_requirements_json: JSON.stringify(verificationRequirements),
      affected_boundaries_json: JSON.stringify(affectedBoundaries),
      priority,
      risk,
      estimate,
      due_at: dueAt,
      enabling: enabling ? 1 : 0,
      enabled_feature_id: enabling ? enabledFeatureId : null,
      enabling_rationale: enabling ? enablingRationale : null,
    }, { projectId: feature.project_id, actor, sessionId, activityType: "task_created" });

    for (const l of links) await attachLink(db, row.id, l);
    for (const dep of dependsOn) {
      if (dep === row.id) continue;
      await db.run(
        "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?,?,?)",
        row.id, typeof dep === "string" ? dep : dep.taskId, typeof dep === "string" ? "blocks" : dep.type ?? "blocks",
      );
    }
    if (status !== "draft") return move(db, row, status, { actor, sessionId });
    return row;
  });
}

/** Edit the description of the work. Status never moves through here. */
export async function updateTask(root, taskId, values = {}, { actor = "superdev", expectedVersion = null } = {}) {
  if (values.status) {
    throw new TaskError(E.STATUS_VIA_TRANSITION,
      "Status moves through the lifecycle functions so it always leaves history. Use startTask, blockTask, completeTask and the rest.");
  }
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    const row = { ...values };
    for (const [from, to] of [
      ["expectedOutcome", "expected_outcome"], ["whyNeeded", "why_needed"], ["dueAt", "due_at"],
      ["parentTaskId", "parent_task_id"], ["categoryId", "category_id"],
      ["enabledFeatureId", "enabled_feature_id"], ["enablingRationale", "enabling_rationale"],
    ]) {
      if (from in row) { row[to] = row[from]; delete row[from]; }
    }
    for (const [key, column] of [
      ["completionCriteria", "completion_criteria_json"],
      ["verificationRequirements", "verification_requirements_json"],
      ["affectedBoundaries", "affected_boundaries_json"],
    ]) {
      if (key in row) { row[column] = JSON.stringify(row[key]); delete row[key]; }
    }
    if ("enabling" in row) row.enabling = row.enabling ? 1 : 0;
    return patch(db, "task", taskId, expectedVersion ?? task.version, row, {
      projectId: task.project_id, actor, activityType: "task_updated",
    });
  });
}

async function attachLink(db, taskId, l) {
  const targetType = l.targetType ?? l.target_type;
  const targetId = l.targetId ?? l.target_id;
  const table = TARGET_TABLE[targetType];
  if (!table) {
    throw new TaskError(E.UNKNOWN_TARGET,
      `${targetType} is not something a task can implement. Use one of: ${Object.keys(TARGET_TABLE).join(", ")}.`);
  }
  const target = await db.get(`SELECT id FROM ${table} WHERE id = ?`, targetId);
  if (!target) throw new TaskError(E.NOT_FOUND, `${targetType} ${targetId} does not exist, so a task cannot claim to implement it.`);
  await db.run(
    "INSERT OR IGNORE INTO task_contract_links (task_id, target_type, target_id, relationship) VALUES (?,?,?,?)",
    taskId, targetType, targetId, l.relationship ?? "implements",
  );
}

/** Point a task at the contract it implements. Brief 7.2. */
export async function linkContract(root, taskId, link, { actor = "superdev" } = {}) {
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    await attachLink(db, taskId, link);
    await recordActivity(db, task.project_id, {
      type: "task_updated",
      actor,
      taskId,
      featureId: task.feature_id,
      summary: `${taskId} now implements ${link.targetType ?? link.target_type} ${link.targetId ?? link.target_id}.`,
      metadata: { link },
    });
    return db.get("SELECT * FROM tasks WHERE id = ?", taskId);
  });
}

/** A subtask exists to make execution clearer, so it carries the parent's feature. */
export async function addSubtask(root, parentTaskId, input = {}) {
  const parent = await query(root, (db) => db.get("SELECT * FROM tasks WHERE id = ?", parentTaskId));
  if (!parent) throw new TaskError(E.NOT_FOUND, `Task ${parentTaskId} does not exist, so nothing can hang off it.`);
  return createTask(root, {
    ...input,
    featureId: input.featureId ?? parent.feature_id,
    parentTaskId,
  });
}

// ---------------------------------------------------------------- assignment

/**
 * Claim a task for a developer, agent, branch and session. The database keeps a
 * partial unique index over active assignments, so a second claim is impossible
 * rather than merely unlikely; this reports who holds it instead of a constraint.
 */
export async function claimTask(root, taskId, who = {}) {
  let { developerId = null, agentId = null, branchId = null, sessionId = null, actor = "superdev" } = who;

  // A claim whose whole purpose is recording who holds the task is worthless
  // with three nulls in it, so identity is resolved here rather than left to
  // each caller to remember. It runs BEFORE mutate opens: resolveIdentity shells
  // out to git, and subprocess work inside a write transaction holds the
  // exclusive lock across it.
  if (!developerId && !agentId) {
    const identity = await whoIsActing(root, { actor, displayName: who.displayName });
    developerId = developerId ?? identity.developerId;
    agentId = agentId ?? identity.agentId;
    branchId = branchId ?? identity.branchId;
  }

  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    if (!OPEN(task.status)) {
      throw new TaskError(E.INVALID_TRANSITION, `${taskId} is ${task.status} and is not open work. Reopen it before claiming it.`);
    }

    // These are identifiers, and a person naturally passes a name. Checking here
    // turns "FOREIGN KEY constraint failed" into a sentence that says which one
    // was not found and how to see the real ones.
    for (const [label, id, table, listing] of [
      ["developer", developerId, "developers", "superdev services"],
      ["agent", agentId, "agents", "superdev services"],
      ["branch", branchId, "branches", "superdev status"],
      ["session", sessionId, "work_sessions", "superdev services"],
    ]) {
      if (!id) continue;
      const found = await db.get(`SELECT id FROM ${table} WHERE id = ?`, id);
      if (!found) {
        throw new TaskError(
          E.NOT_FOUND,
          `There is no ${label} ${id} in this project. That flag takes the ${label}'s identifier, not their name; ${listing} lists the real ones. Leaving it off lets Superdev work out who is claiming.`,
          { [`${label}Id`]: id },
        );
      }
    }
    const held = await activeAssignment(db, taskId);
    if (held) {
      // A lease from another machine names an alias rather than a person,
      // because section 18 forbids disclosing who works where. Saying which
      // alias holds it and until when is enough to act on, and an expired lease
      // is not a claim: a machine that crashed must not hold a task forever.
      if (held.lease_holder && held.origin_peer && leaseHolds(held)) {
        throw new TaskError(E.ALREADY_CLAIMED,
          `${taskId} is held by ${held.lease_holder} on another machine${
            held.lease_expires_at ? `, until ${held.lease_expires_at}` : ""
          }. Their lease has to lapse or be released there before this machine can take it.`,
          { leaseHolder: held.lease_holder, expiresAt: held.lease_expires_at });
      }
      if (held.lease_holder && held.origin_peer && !leaseHolds(held)) {
        // Lapsed. Clearing it here is what makes expiry mean anything.
        await db.run("UPDATE task_assignments SET active = 0, released_at = ? WHERE id = ?",
          nowIso(), held.id);
      } else {
        throw new TaskError(E.ALREADY_CLAIMED,
          `${taskId} is already claimed by ${await holderOf(db, held)} since ${held.assigned_at}. Ask them to release it, or pick up another task.`,
          { assignmentId: held.id, developerId: held.developer_id, agentId: held.agent_id });
      }
    }

    // A lease is a statement to somebody else. With no peer configured there is
    // nobody to hear it, and the local unique index is already the whole answer.
    try {
      await assign(db, task, {
        developerId, agentId, branchId, sessionId, actor,
        summary: `${taskId} claimed.`,
      });
    } catch (err) {
      // Only a uniqueness failure means someone else got the claim first. The
      // test used to accept any message containing "constraint", so a foreign
      // key violation, which is an unknown developer, agent or branch, was
      // reported as a phantom competing session and the person was told to pick
      // up another task. Rechecking the assignment table is what settles it: a
      // real lost race leaves a holder behind, and nothing else does.
      const unique = /UNIQUE/i.test(String(err?.message ?? ""));
      const now = unique ? await activeAssignment(db, taskId) : null;
      if (!now) throw err;
      throw new TaskError(E.ALREADY_CLAIMED,
        `${taskId} was claimed by ${await holderOf(db, now)} a moment before this claim. Pick up another task.`);
    }
    // The session is pointed at the task it just claimed.
    //
    // Claiming recorded an assignment and nothing else, so work_sessions.active_task_id
    // stayed null on every session on every project. The session-start hook reads
    // exactly that field to decide whether work is tracked, so it recorded an
    // "untracked work" marker on every file edit, including edits made under a
    // task that was claimed and in progress. The readiness report then raised its
    // only high-severity warning, "changes were made while no task was claimed",
    // against work that was properly tracked. A warning that fires when the rule
    // was followed teaches the reader to stop reading warnings, and this is the
    // one that means the record has fallen behind.
    //
    // Written here rather than in each caller, because the control centre claims
    // tasks too and the field has to mean the same thing whichever surface moved it.
    return db.get("SELECT * FROM tasks WHERE id = ?", taskId);
  });
}

/**
 * Point a session at the task it is working on, or at nothing.
 *
 * The session is the one named, or the most recently active one on this machine,
 * because a claim from the command line does not carry a session identifier and
 * the hook that reads this field cannot ask.
 */
async function pointSessionAt(db, projectId, sessionId, taskId) {
  const session = sessionId
    ? await db.get("SELECT id FROM work_sessions WHERE id = ?", sessionId)
    : await db.get(
        `SELECT id FROM work_sessions
          WHERE project_id = ? AND ended_at IS NULL
          ORDER BY last_activity_at DESC, started_at DESC LIMIT 1`, projectId);
  if (!session) return null;
  await db.run(
    "UPDATE work_sessions SET active_task_id = ?, last_activity_at = ? WHERE id = ?",
    taskId, nowIso(), session.id,
  );
  return session.id;
}

/** Hand a task back. The task keeps its status; only the claim ends. */
export async function releaseTask(root, taskId, { actor = "superdev", reason = null } = {}) {
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    const released = await release(db, task, actor, reason ? `${taskId} released: ${reason}` : null);
    if (!released) throw new TaskError(E.NOT_CLAIMED, `${taskId} is not claimed by anyone, so there is nothing to release.`);
    return db.get("SELECT * FROM tasks WHERE id = ?", taskId);
  });
}

// ---------------------------------------------------------------- transitions

export async function startTask(root, taskId, { actor = "superdev", sessionId = null, note = null } = {}) {
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    const blockers = await db.all(
      `SELECT d.depends_on_task_id AS id, t.name, t.status FROM task_dependencies d
         JOIN tasks t ON t.id = d.depends_on_task_id
        WHERE d.task_id = ? AND d.dependency_type = 'blocks'
          AND t.status NOT IN ('complete','cancelled','superseded')`,
      taskId,
    );
    if (blockers.length) {
      // Not a refusal: the person may know something the graph does not. It is
      // recorded so the decision to start anyway is visible afterwards.
      await recordActivity(db, task.project_id, {
        type: "task_updated",
        actor, sessionId, taskId, featureId: task.feature_id,
        summary: `${taskId} started while ${blockers.map((b) => b.id).join(", ")} are still open.`,
        metadata: { blockers: blockers.map((b) => ({ id: b.id, status: b.status })) },
      });
    }
    return move(db, task, "in_progress", { actor, sessionId, note });
  });
}

export async function blockTask(root, taskId, { reason, actor = "superdev", sessionId = null } = {}) {
  // Captured before the move, so the reason is remembered even if the
  // transition is refused: knowing what blocked someone is useful either way.
  await rememberMoment(root, {
    type: "task_blocked",
    subjectId: taskId,
    title: `${taskId} blocked`,
    content: String(reason ?? "No reason was given."),
    sourceRef: taskId,
    taskId,
    sessionId,
    links: [{ type: "task", id: taskId }],
  });
  if (!reason) throw new TaskError(E.REASON_REQUIRED, "A blocked task needs the reason it is blocked, in plain language, so the next person can unblock it.");
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    return move(db, task, "blocked", { actor, sessionId, reason, note: reason });
  });
}

/** Return to whatever the task was doing before it blocked, not to a guess. */
export async function unblockTask(root, taskId, { actor = "superdev", note = null, to = null } = {}) {
  const identity = await whoIsActing(root, { actor });
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    if (task.status !== "blocked") {
      throw new TaskError(E.INVALID_TRANSITION, `${taskId} is ${task.status}, not blocked, so there is nothing to unblock.`);
    }
    const previous = await db.get(
      `SELECT from_status FROM status_history
        WHERE record_type = 'task' AND record_id = ? AND to_status = 'blocked'
        ORDER BY sequence DESC LIMIT 1`,
      taskId,
    );
    const wanted = to ?? (ACTIVE.has(previous?.from_status) ? previous.from_status : "ready");
    const owned = await ownedTarget(db, task, wanted, { actor, identity });
    const moved = await move(db, task, owned.target, { actor, note, activityType: "task_unblocked" });
    return owned.note ? { ...moved, unclaimed: owned.note } : moved;
  });
}

export async function submitForReview(root, taskId, { actor = "superdev", note = null } = {}) {
  return mutate(root, async (db) => move(db, await taskOr404(db, taskId), "in_review", { actor, note }));
}

export async function verifyTask(root, taskId, { actor = "superdev", note = null } = {}) {
  return mutate(root, async (db) => move(db, await taskOr404(db, taskId), "verifying", { actor, note }));
}

// ---------------------------------------------------------------- completion

/**
 * The accepted test plans that cover a task, and whether each has been run.
 *
 * Section 9.3 requires that the product tests defined by the accepted test plan
 * pass before a task completes. Which plan covers which task is a question of
 * scope: a plan written for a feature covers that feature's work, a plan
 * written for a module covers everything inside it, and a plan with no scope at
 * all is the product's own, which covers everything.
 *
 * A plan is satisfied by a passing run recorded anywhere in the project, not by
 * one per task. Requiring every task to run the whole product suite again would
 * be theatre: the run either passed or it did not, and re-running it for the
 * next task is what `superdev verify` is for. A run whose re-check has since
 * failed stops counting, which is the point of recording the command.
 */
export async function testPlansInScope(db, task) {
  const feature = task.feature_id
    ? await db.get("SELECT id, module_id FROM features WHERE id = ?", task.feature_id)
    : null;
  const plans = await db.all(
    `SELECT p.id, p.name, p.strategy, p.how_to_run, p.passing_condition, p.status,
            p.feature_id, p.module_id, p.workflow_id,
            (SELECT COUNT(*) FROM verification_evidence e
              WHERE e.test_plan_id = p.id AND e.status = 'current' AND e.result = 'pass'
                AND (e.last_check_result IS NULL OR e.last_check_result = 'pass')) AS passing_runs
       FROM test_plans p
      WHERE p.status = 'accepted'
        AND (
          (p.feature_id IS NULL AND p.module_id IS NULL AND p.workflow_id IS NULL)
          OR (p.feature_id IS NOT NULL AND p.feature_id = ?)
          OR (p.module_id IS NOT NULL AND p.module_id = ?)
        )
      ORDER BY p.id`,
    task.feature_id ?? null,
    feature?.module_id ?? null,
  );
  return plans.map((p) => ({ ...p, satisfied: Number(p.passing_runs) > 0 }));
}

async function completionBlockers(db, task) {
  const problems = [];
  const open = await db.all(
    `SELECT id, name, status FROM tasks
      WHERE parent_task_id = ? AND status NOT IN ('complete','cancelled','superseded')`,
    task.id,
  );
  if (open.length) {
    problems.push(new TaskError(E.OPEN_SUBTASKS,
      `${task.id} has ${open.length} subtask${open.length === 1 ? "" : "s"} still open: ${open.map((t) => `${t.id} (${t.status})`).join(", ")}. Complete or cancel them first.`,
      { subtasks: open }));
  }

  const evidence = await db.all(
    "SELECT * FROM verification_evidence WHERE task_id = ? AND status = 'current'", task.id,
  );
  const required = json(task.verification_requirements_json, []);
  const failing = evidence.filter((e) => e.result === "fail");
  if (failing.length) {
    problems.push(new TaskError(E.EVIDENCE_FAILING,
      `${task.id} has failing verification evidence: ${failing.map((e) => e.summary).join("; ")}. Fix the work or record why the evidence no longer applies.`,
      { evidence: failing }));
  }
  // Every stated requirement needs its own passing evidence, not one row
  // standing in for all of them, and work that states no requirement still has
  // to show something. The previous rule let a task with three requirements
  // complete on one passing row, while listing all three in the refusal as
  // though each had been checked, and let a task with no stated requirement
  // complete on no evidence at all.
  const passing = evidence.filter((e) => e.result === "pass");
  if (required.length && passing.length < required.length) {
    problems.push(new TaskError(E.EVIDENCE_MISSING,
      `${task.id} states ${count(required.length, "verification requirement")} and carries ${count(passing.length, "passing result")}: ${required.join("; ")}. Run the rest and attach the evidence.`,
      { required, passing: passing.length }));
  }
  if (!required.length && !passing.length) {
    problems.push(new TaskError(E.EVIDENCE_MISSING,
      `${task.id} states no verification requirement and carries no evidence, so nothing shows it is done. Attach a result, or say what verifying it means with task update --verify.`,
      { required: [] }));
  }

  const criteria = await db.all(
    `SELECT ac.id, ac.criterion, ac.status FROM task_contract_links l
       JOIN feature_acceptance_criteria ac ON ac.id = l.target_id
      WHERE l.task_id = ? AND l.target_type = 'acceptance_criterion'`,
    task.id,
  );
  const unmet = criteria.filter((c) => c.status === "unmet");
  if (unmet.length) {
    problems.push(new TaskError(E.ACCEPTANCE_UNMET,
      `${task.id} verifies acceptance criteria that are still unmet: ${unmet.map((c) => `${c.id} (${c.criterion})`).join("; ")}. Attach a passing result to each with task evidence ${task.id} --criterion ${unmet[0].id}, or waive it with feature waive ${unmet[0].id} --reason.`,
      { criteria: unmet }));
  }

  const unrun = (await testPlansInScope(db, task)).filter((p) => !p.satisfied);
  if (unrun.length) {
    problems.push(new TaskError(E.TEST_PLAN_UNSATISFIED,
      `${task.id} is covered by ${count(unrun.length, "accepted test plan")} with no passing run: ${
        unrun.map((p) => `${p.id} (${p.name}), run ${p.how_to_run}`).join("; ")
      }. Run it and attach the result with task evidence --plan.`,
      { plans: unrun.map((p) => ({ id: p.id, name: p.name, howToRun: p.how_to_run })) }));
  }
  return problems;
}

/**
 * Complete a task only when it is actually finished: verification evidence is
 * present and passing, every acceptance criterion it verifies is met, and no
 * subtask is still open. The assignment is released as part of the same
 * transaction, so a completed task is never left held by nobody.
 */
/**
 * Remember what a lifecycle moment showed.
 *
 * Imported lazily and never awaited for correctness: section 15.6 asks for
 * capture at these moments, and P-008 says memory is recall rather than
 * authority, so a failure to remember must never fail the work that happened.
 */
async function rememberMoment(root, event) {
  try {
    const { capture } = await import("../memory/capture.mjs");
    await capture(root, event);
  } catch { /* recall is not authority, and its absence is not a failure */ }
}

export async function completeTask(root, taskId, { actor = "superdev", sessionId = null, note = null } = {}) {
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    const problems = await completionBlockers(db, task);
    if (problems.length) {
      if (problems.length === 1) throw problems[0];
      const first = problems[0];
      throw new TaskError(first.code, problems.map((p) => p.message).join(" "), { problems: problems.map((p) => p.code) });
    }
    const row = await move(db, task, "complete", { actor, sessionId, note });
    await release(db, task, actor, `${taskId} completed, assignment released.`);
    return { row, task };
  }).then(async ({ row, task }) => {
    // A feature whose last task just finished is finished, and saying so is a
    // derivation rather than a claim: completionReadiness reads the criteria
    // and the tasks and decides. It runs after the commit and never throws
    // outward, because a task genuinely completed must not be undone by the
    // feature above it not being ready.
    if (task.feature_id) {
      try {
        const { completeFeature } = await import("../features/acceptance.mjs");
        await completeFeature(root, task.feature_id, { actor, apply: true });
      } catch {
        // Not finished yet, which is the normal case and not a failure.
      }
    }
    return { row, task };
  }).then(async ({ row, task }) => {
    // Remembered after the transaction commits, so nothing is recalled that did
    // not actually land. Section 15.6 names task completion as a moment worth
    // capturing, and completion is confirmed rather than inferred because the
    // gate only allows it once evidence passed.
    await rememberMoment(root, {
      type: "task_completed",
      subjectId: taskId,
      title: `${taskId} complete: ${task.name ?? ""}`.trim().slice(0, 160),
      content: `${task.name ?? taskId} completed. ${task.expected_outcome ?? "No outcome was recorded."}`.trim(),
      confirmed: true,
      sourceRef: taskId,
      taskId,
      featureId: task.feature_id ?? null,
      sessionId,
      links: [
        { type: "task", id: taskId },
        task.feature_id ? { type: "feature", id: task.feature_id } : null,
      ].filter(Boolean),
    });
    return row;
  });
}

/** Reopening is a recorded decision, never a quiet edit of a finished record. */
/**
 * Who is acting, resolved outside every transaction.
 *
 * resolveIdentity shells out to git, and subprocess work inside a write
 * transaction holds the engine's exclusive lock across it, so this always runs
 * before mutate opens. A claim recording three nulls says nothing about who holds
 * the task, which is the only reason the claim exists.
 */
async function whoIsActing(root, { actor, displayName } = {}) {
  try {
    const { resolveIdentity, detectHarness } = await import("../runtime/identity.mjs");
    const identity = await resolveIdentity(root, {
      harness: detectHarness(process.env).harness,
      displayName: displayName ?? (actor && actor !== "superdev" ? actor : undefined),
    });
    return {
      developerId: identity.developer?.id ?? null,
      agentId: identity.agent?.id ?? null,
      branchId: identity.branch?.id ?? null,
    };
  } catch {
    // An unresolvable identity must not block the work: the claim still happens
    // and simply says so rather than naming somebody.
    return { developerId: null, agentId: null, branchId: null };
  }
}

/**
 * Create the claim, point the session at it, and say who holds it now.
 *
 * Factored out of claimTask so that reopening a task can take the claim through
 * exactly the same path. Two ways of claiming would be two things to keep in
 * agreement, and the last three defects in this area were all one fact recorded
 * in one place and read from another.
 */
async function assign(db, task, { developerId, agentId, branchId, sessionId, actor, summary }) {
  const peer = await db.get("SELECT alias FROM sync_peers WHERE status = 'connected' LIMIT 1")
    .catch(() => null);
  await create(db, "task_assignment", {
    task_id: task.id,
    developer_id: developerId,
    agent_id: agentId,
    branch_id: branchId,
    session_id: sessionId,
    assigned_at: nowIso(),
    active: 1,
    lease_holder: peer?.alias ?? null,
    lease_expires_at: peer ? leaseExpiry(nowIso()) : null,
  }, { projectId: task.project_id, actor, sessionId, taskId: task.id, activityType: "task_claimed",
       activitySummary: summary });
  await pointSessionAt(db, task.project_id, sessionId, task.id);
}

/**
 * Statuses that assert somebody is working on the task right now.
 *
 * A task in one of these with no claim behind it is a state the record should not
 * be able to reach, and it had two ways in. `task reopen` moved a completed task
 * straight to in_progress, and `task unblock` restored whatever status the task
 * held before it was blocked. Neither took a claim, so the session's active task
 * stayed null while a task said it was in progress, and the untracked-work hook,
 * which reads exactly that field, then recorded every later edit as work nobody
 * had accounted for. Readiness reported it at high severity against work being
 * done on a correctly specified, in-progress task.
 */
const ACTIVE = new Set(["in_progress", "in_review", "verifying"]);

/**
 * The status a transition may actually use, given who holds the task.
 *
 * An unclaimed task drops to ready rather than being claimed on somebody's
 * behalf: reopening a task is a statement that the work is not finished, which is
 * a different fact from somebody working on it this minute, and taking a claim
 * silently would be worse than asking for one. A task the caller already holds
 * keeps the active status, and the session is pointed at it either way.
 */
async function ownedTarget(db, task, target, { actor, identity }) {
  if (!ACTIVE.has(target)) return { target, note: null };
  const held = await activeAssignment(db, task.id);
  if (held) {
    // Somebody already holds it, including possibly another machine. Their claim
    // stands; this only makes sure the session it belongs to points at it.
    await pointSessionAt(db, task.project_id, held.session_id, task.id);
    return { target, note: null };
  }
  // Nobody holds it. Dropping to ready is not available: the status machine only
  // allows complete to in_progress, and loosening a transition to work around a
  // missing claim would be the wrong repair. So the claim is taken, by the actor
  // who asked for this, which is an explicit act that already carries a reason.
  await assign(db, task, {
    developerId: identity?.developerId ?? null,
    agentId: identity?.agentId ?? null,
    branchId: identity?.branchId ?? null,
    sessionId: null,
    actor,
    summary: `${task.id} claimed by reopening it.`,
  });
  return { target, note: `It is claimed for ${actor}, because a task in progress that no session owns is a state the record should not be able to reach.` };
}

export async function reopenTask(root, taskId, { reason, actor = "superdev", to = null } = {}) {
  if (!reason) throw new TaskError(E.REASON_REQUIRED, "Reopening a finished task needs a reason, because the record already said it was done.");
  // Before mutate, because reopening may have to take the claim and resolving who
  // is acting shells out to git.
  const identity = await whoIsActing(root, { actor });
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    if (OPEN(task.status)) {
      throw new TaskError(E.INVALID_TRANSITION, `${taskId} is ${task.status} and already open. There is nothing to reopen.`);
    }
    const wanted = to ?? (task.status === "complete" ? "in_progress" : "ready");
    const { target, note } = await ownedTarget(db, task, wanted, { actor, identity });
    const cleared = await patch(db, "task", taskId, task.version, {
      completed_at: null,
      cancelled_at: null,
    }, { projectId: task.project_id, actor, activityType: "task_reopened",
         activitySummary: `${taskId} reopened: ${reason}` });
    const moved = await move(db, cleared, target, { actor, note: reason, activityType: "task_reopened" });
    return note ? { ...moved, unclaimed: note } : moved;
  });
}

export async function cancelTask(root, taskId, { reason, actor = "superdev" } = {}) {
  if (!reason) throw new TaskError(E.REASON_REQUIRED, "Cancelling a task needs a reason, so the next person does not derive it again by accident.");
  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    const row = await move(db, task, "cancelled", { actor, note: reason });
    await release(db, task, actor, `${taskId} cancelled, assignment released.`);
    return row;
  });
}

// ------------------------------------------------------------------ evidence

/**
 * Record what was actually observed. Passing evidence against an acceptance
 * criterion marks that criterion met, which is the only way it is ever met.
 */
export async function attachEvidence(root, taskId, evidence = {}) {
  const {
    evidenceType = "manual_check", summary, reference = null, result = "pass",
    acceptanceCriterionId = null, goalCriterionId = null, contentHash = null, recordedBy = null,
    actor = "superdev", sessionId = null, checkCommand = null, testPlanId = null,
  } = evidence;
  if (!summary) throw new TaskError(E.REASON_REQUIRED, "Evidence needs a one-line summary of what was observed, not just a result.");

  return mutate(root, async (db) => {
    const task = await taskOr404(db, taskId);
    // A goal criterion is a different target from an acceptance criterion, and the
    // identifier says which. Resolved here, before anything is written, because
    // this is what used to be decided by the foreign key: the plan resolved the id
    // and promised to mark it met, the write put it in the acceptance-criterion
    // column, and the driver answered `FOREIGN KEY constraint failed` with no
    // record, column or remedy named.
    if (goalCriterionId) {
      const goalCriterion = await db.get(
        "SELECT id FROM goal_success_criteria WHERE id = ?", goalCriterionId);
      if (!goalCriterion) {
        throw new TaskError(E.UNKNOWN_TARGET,
          `There is no goal success criterion ${goalCriterionId}. superdev goal show <GOAL-id> lists the criteria a goal carries.`);
      }
    }
    if (acceptanceCriterionId) {
      const criterion = await db.get(
        "SELECT id FROM feature_acceptance_criteria WHERE id = ?", acceptanceCriterionId);
      if (!criterion) {
        throw new TaskError(E.UNKNOWN_TARGET,
          `There is no acceptance criterion ${acceptanceCriterionId}. superdev feature show <FEAT-id> lists the criteria a feature carries.`);
      }
    }

    // What already proves this criterion, read before the new row is written.
    //
    // Two current records for one criterion is legitimate: two different checks can
    // both prove one thing. It is also how a correction is made, and the second row
    // silently joining the first is how a project ends up with one record failing
    // forever because its command moved. So the caller is told, and told what to do
    // about it, rather than the product guessing which of the two was meant.
    const alreadyProving = acceptanceCriterionId
      ? await db.all(
          `SELECT id, check_command FROM verification_evidence
            WHERE acceptance_criterion_id = ? AND status = 'current' AND result = 'pass'
            ORDER BY recorded_at, id`,
          acceptanceCriterionId)
      : [];

    if (acceptanceCriterionId && result === "pass") {
      // Fresh proof of a criterion retires the stale proof it replaces. Marking
      // evidence stale is verify saying the check stopped passing, and the
      // remedy it prints is to run the check again and record fresh evidence.
      // Doing exactly that used to leave the stale row warning forever, so the
      // product told a reader to do something that did not clear the warning.
      await db.run(
        `UPDATE verification_evidence SET status = 'superseded'
          WHERE acceptance_criterion_id = ? AND status = 'stale'`,
        acceptanceCriterionId,
      );
    }
    if (testPlanId) {
      const plan = await db.get("SELECT id, status FROM test_plans WHERE id = ?", testPlanId);
      if (!plan) throw new TaskError(E.UNKNOWN_TARGET, `There is no test plan ${testPlanId}. Run superdev test-plan list to see them.`);
      if (plan.status !== "accepted") {
        throw new TaskError(E.UNKNOWN_TARGET,
          `${testPlanId} is ${plan.status}, not accepted, so a run of it does not satisfy anything yet.`);
      }
    }
    const row = await create(db, "verification_evidence", {
      project_id: task.project_id,
      task_id: taskId,
      feature_id: task.feature_id,
      acceptance_criterion_id: acceptanceCriterionId,
      goal_criterion_id: goalCriterionId,
      evidence_type: evidenceType,
      summary,
      reference,
      result,
      content_hash: contentHash,
      // The command that proved it, so the claim can be checked again rather
      // than believed forever. Null is honest for a check nobody can automate.
      check_command: checkCommand,
      // Which agreed verification strategy this was a run of. Section 9.3 makes
      // the accepted test plan a completion condition, and a plan nothing can
      // point at is a condition nothing can satisfy.
      test_plan_id: testPlanId,
      recorded_by: recordedBy ?? actor,
      recorded_at: nowIso(),
      status: "current",
    }, {
      projectId: task.project_id, actor, sessionId, taskId,
      activityType: "verification_attached",
      activitySummary: `${result === "pass" ? "Passing" : result === "fail" ? "Failing" : "Inconclusive"} evidence recorded for ${taskId}: ${summary}`,
    });

    // feature_acceptance_criteria carries no version column, so versionedUpdate
    // cannot address it. The activity event is written here rather than lost.
    //
    // Passing and failing are separate branches on purpose. Nesting the failure
    // case inside the passing case made it unreachable, so a later failure never
    // retracted the claim and the acceptance component and the evidence
    // component of the same report disagreed.
    if (acceptanceCriterionId && result === "pass") {
      const before = await db.get("SELECT * FROM feature_acceptance_criteria WHERE id = ?", acceptanceCriterionId);
      if (before && before.status !== "met") {
        await db.run(
          "UPDATE feature_acceptance_criteria SET status = 'met', evidence_id = ? WHERE id = ?",
          row.id, acceptanceCriterionId,
        );
        await recordActivity(db, task.project_id, {
          type: "specification_changed",
          actor, sessionId, taskId, featureId: task.feature_id,
          summary: `Acceptance criterion ${acceptanceCriterionId} is met, evidenced by ${row.id}.`,
          metadata: { criterion: acceptanceCriterionId, evidence: row.id },
        });
      }
    } else if (acceptanceCriterionId && result === "fail") {
      const before = await db.get("SELECT * FROM feature_acceptance_criteria WHERE id = ?", acceptanceCriterionId);
      if (before && before.status === "met") {
        await db.run(
          "UPDATE feature_acceptance_criteria SET status = 'unmet', evidence_id = NULL WHERE id = ?",
          acceptanceCriterionId,
        );
        await recordActivity(db, task.project_id, {
          type: "specification_changed",
          actor, sessionId, taskId, featureId: task.feature_id,
          summary: `Acceptance criterion ${acceptanceCriterionId} is no longer met: ${row.id} records a failure.`,
          metadata: { criterion: acceptanceCriterionId, evidence: row.id },
        });
      }
    }

    // A measured outcome moves on the same rule: proof makes it met, a failure
    // takes it back. Without this the goal criteria component of progress was a
    // permanent zero on every project, and no command could move it.
    if (goalCriterionId) {
      const before = await db.get(
        "SELECT * FROM goal_success_criteria WHERE id = ?", goalCriterionId);
      const wanted = result === "pass" ? "met" : "unmet";
      if (before && before.status !== wanted) {
        await db.run(
          "UPDATE goal_success_criteria SET status = ? WHERE id = ?", wanted, goalCriterionId);
        await recordActivity(db, task.project_id, {
          type: "specification_changed",
          actor, sessionId, taskId, featureId: task.feature_id,
          summary: result === "pass"
            ? `Goal success criterion ${goalCriterionId} is met, evidenced by ${row.id}.`
            : `Goal success criterion ${goalCriterionId} is no longer met: ${row.id} records a failure.`,
          metadata: { goalCriterion: goalCriterionId, evidence: row.id },
        });
      }
    }

    const task_after = await db.get("SELECT * FROM tasks WHERE id = ?", taskId);
    task_after.evidence = row;
    // Carried out so the surface can say it. A correction that looks identical to a
    // second independent proof is how one record ends up failing forever.
    task_after.alsoProving = alreadyProving;
    return task_after;
  });
}

// -------------------------------------------------------------------- search

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "you", "your", "our",
  "add", "make", "use", "can", "should", "must", "when", "then", "than", "there",
  "task", "work", "please", "need", "needs", "want", "have", "has", "was", "were",
  "are", "not", "but", "all", "any", "its", "it", "a", "an", "of", "to", "in", "on",
]);

const tokenize = (text) => [...new Set(
  String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)),
)];

/**
 * Brief 12.2 step one: before creating work, look for the task that already
 * covers it. Scoring is token overlap over open tasks, which is enough for the
 * few hundred tasks a project holds.
 *
 * ponytail: no full text index and no vector index in this engine, so this is a
 * bounded scan. Ceiling is a few thousand tasks; the upgrade path is the same
 * bounded scan over stored embeddings that memory recall already needs.
 */
export async function findTaskForWork(root, { description, featureId = null, limit = 5 } = {}) {
  const wanted = tokenize(description);
  if (!wanted.length) return null;
  return query(root, async (db) => {
    const rows = await db.all(
      `SELECT * FROM tasks
        WHERE status NOT IN ('cancelled','superseded')
          ${featureId ? "AND feature_id = ?" : ""}
        ORDER BY (status = 'complete'), id`,
      ...(featureId ? [featureId] : []),
    );
    const scored = [];
    for (const row of rows) {
      const hay = tokenize(`${row.name} ${row.description ?? ""} ${row.expected_outcome ?? ""} ${row.why_needed ?? ""}`);
      if (!hay.length) continue;
      const hit = wanted.filter((w) => hay.includes(w));
      const score = hit.length / wanted.length;
      if (score >= 0.34) scored.push({ row, score, matched: hit });
    }
    scored.sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id));
    if (!scored.length) return null;
    const best = scored[0];
    best.row.score = Number(best.score.toFixed(3));
    best.row.matched_terms = best.matched;
    best.row.alternatives = scored.slice(1, limit).map((s) => ({ id: s.row.id, name: s.row.name, score: Number(s.score.toFixed(3)) }));
    return best.row;
  });
}

/**
 * Retire one evidence record that no longer applies.
 *
 * A check whose script moved keeps failing forever, and the row cannot be
 * corrected: `task evidence` only appends. Under the old verify allowlist such a
 * row was refused and merely counted as unrunnable, so it was invisible; once
 * containment let the path through, verify ran it, the file was gone, and it
 * failed on every run of a healthy project. `decision supersede` and
 * `memory supersede` have existed all along; this is the same shape for the one
 * record type that is the whole basis of a completion claim.
 *
 * Nothing is deleted. What was observed and when is the point of keeping it, and
 * the reason it stopped applying is worth as much as the observation was.
 */
export async function supersedeEvidence(root, evidenceId, { reason, actor = "superdev" } = {}) {
  if (!reason) {
    throw new TaskError(E.REASON_REQUIRED,
      "Superseding evidence needs a reason, because the record already said this was observed.");
  }
  return mutate(root, async (db) => {
    const row = await db.get("SELECT * FROM verification_evidence WHERE id = ?", evidenceId);
    if (!row) {
      throw new TaskError(E.NOT_FOUND,
        `There is no evidence ${evidenceId}. superdev verify --json names every record it ran, and task show lists what a task carries.`);
    }
    if (row.status === "superseded") {
      throw new TaskError(E.INVALID_TRANSITION, `${evidenceId} is already superseded.`);
    }

    await db.run("UPDATE verification_evidence SET status = 'superseded' WHERE id = ?", evidenceId);

    // The criterion this was the proof for now rests on whatever else is current,
    // and on nothing if there is nothing else. Leaving it met on retired proof
    // would be the same defect as a green check that never ran.
    let criterion = null;
    if (row.acceptance_criterion_id) {
      const replacement = await db.get(
        `SELECT id FROM verification_evidence
          WHERE acceptance_criterion_id = ? AND status = 'current' AND result = 'pass' AND id <> ?
          ORDER BY recorded_at DESC, id DESC LIMIT 1`,
        row.acceptance_criterion_id, evidenceId,
      );
      const before = await db.get(
        "SELECT * FROM feature_acceptance_criteria WHERE id = ?", row.acceptance_criterion_id);
      if (before && before.evidence_id === evidenceId) {
        await db.run(
          "UPDATE feature_acceptance_criteria SET status = ?, evidence_id = ? WHERE id = ?",
          replacement ? "met" : "unmet", replacement?.id ?? null, row.acceptance_criterion_id,
        );
      }
      criterion = {
        id: row.acceptance_criterion_id,
        status: before?.evidence_id === evidenceId ? (replacement ? "met" : "unmet") : before?.status ?? null,
        restingOn: replacement?.id ?? null,
      };
    }

    await recordActivity(db, row.project_id, {
      type: "verification_attached",
      actor,
      taskId: row.task_id,
      featureId: row.feature_id,
      summary: `Evidence ${evidenceId} superseded: ${reason}`,
      metadata: { evidenceId, reason, criterion: row.acceptance_criterion_id ?? null },
    });

    return { evidenceId, was: row.status, summary: row.summary, command: row.check_command ?? null, criterion };
  });
}
