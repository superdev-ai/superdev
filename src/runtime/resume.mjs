// Resuming without conversation memory.
//
// Everything here is read from the project database. A new agent, or the same
// agent after a compaction, gets the active task, the feature and workflow step
// it serves, the decisions that govern it, what is blocking it, what changed in
// scope, which documents are waiting on a person, what was last verified, where
// the working tree is, and the one thing to do next. Brief sections 12.1 and 13.

import { existsSync } from "node:fs";
import { paths, query, currentProject, json } from "../db/store.mjs";
import { handoffPacket } from "../memory/index.mjs";
import { sanitizeExternal } from "../model/screening.mjs";
import { detectHarness, gitState } from "./identity.mjs";
import { activeSession, IDLE_AFTER_HOURS } from "./session.mjs";
import { untrackedSince } from "./hooks.mjs";

const nowIso = () => new Date().toISOString();

const SOURCE_NOTE =
  "Read from the project database, not from conversation. Memory entries are recall and must be checked against the records before they change anything.";

const noProject = (git) => ({
  generatedAt: nowIso(),
  project: null,
  git,
  nextAction: { action: "Run superdev init to create the project database in this directory.", source: "project" },
  note: SOURCE_NOTE,
});

/** Everything needed to continue the work in this directory. */
export async function resumeContext(root) {
  // Shells out, so it happens before anything opens a connection.
  const git = gitState(root);

  // A session-start hook runs wherever the person happens to be. Opening a
  // database that was never created reports an engine I/O error, which reads
  // like a fault when the honest answer is that there is no project here.
  if (!existsSync(paths(root).db)) return noProject(git);

  const session = await activeSession(root, { includeEnded: true });
  const packet = session ? await handoffPacket(root, session.id) : null;

  const extra = await query(root, async (db) => {
    const project = await currentProject(db);
    if (!project) return { project: null };

    const taskId = packet?.activeTask?.id ?? null;

    const workflowSteps = taskId
      ? await db.all(
        `SELECT s.id, s.sequence, s.action, s.owner_type, s.owner_ref, s.input_contract,
                s.expected_result, s.failure_behavior, s.status,
                w.id AS workflow_id, w.name AS workflow_name, w.completion_criteria
           FROM task_contract_links l
           JOIN workflow_steps s ON s.id = l.target_id
           JOIN workflows w ON w.id = s.workflow_id
          WHERE l.task_id = ? AND l.target_type = 'workflow_step'
          ORDER BY s.sequence`, taskId)
      : [];

    // Scope changes are recorded as activity, which is the only append-only
    // record of them; the task's own fields show the result, not the change.
    const scopeChanges = await db.all(
      `SELECT id, summary, task_id, feature_id, created_at, metadata_json
         FROM activity_events
        WHERE project_id = ? AND event_type = 'scope_changed'
        ORDER BY sequence DESC LIMIT 10`, project.id);

    const blockedTasks = await db.all(
      `SELECT id, name, status, block_reason, feature_id FROM tasks
        WHERE project_id = ? AND status = 'blocked'
        ORDER BY updated_at DESC LIMIT 5`, project.id);

    const readyTasks = await db.all(
      `SELECT t.id, t.name, t.priority, t.feature_id FROM tasks t
         LEFT JOIN task_assignments a ON a.task_id = t.id AND a.active = 1
        WHERE t.project_id = ? AND t.status = 'ready' AND a.task_id IS NULL
        ORDER BY t.sequence, t.id LIMIT 5`, project.id);

    const lastVerified = await db.get(
      `SELECT id, task_id, feature_id, evidence_type, summary, reference, result, status, recorded_at
         FROM verification_evidence
        WHERE project_id = ? AND status <> 'superseded'
        ORDER BY recorded_at DESC LIMIT 1`, project.id);

    const recordedBranch = git.branch
      ? await db.get(
        "SELECT * FROM branches WHERE project_id = ? AND name = ? AND worktree_fingerprint IS ?",
        project.id, git.branch, git.worktreeFingerprint)
      : null;

    const revision = await db.value(
      "SELECT max(sequence) FROM activity_events WHERE project_id = ?", project.id);

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        workingMode: project.working_mode,
        statement: project.statement,
      },
      revision: revision ?? 0,
      workflowSteps: workflowSteps.map((s) => ({
        id: s.id,
        workflowId: s.workflow_id,
        workflowName: s.workflow_name,
        sequence: s.sequence,
        action: s.action,
        ownerType: s.owner_type,
        ownerRef: s.owner_ref,
        inputContract: s.input_contract,
        expectedResult: s.expected_result,
        failureBehavior: s.failure_behavior,
        status: s.status,
        completionCriteria: s.completion_criteria,
      })),
      scopeChanges: scopeChanges.map((e) => ({
        id: e.id,
        summary: e.summary,
        taskId: e.task_id,
        featureId: e.feature_id,
        at: e.created_at,
        detail: json(e.metadata_json, {}),
      })),
      blockedTasks: blockedTasks.map((t) => ({
        id: t.id, name: t.name, status: t.status, reason: t.block_reason, featureId: t.feature_id,
      })),
      readyTasks: readyTasks.map((t) => ({
        id: t.id, name: t.name, priority: t.priority, featureId: t.feature_id,
      })),
      lastVerified: lastVerified ?? null,
      recordedBranch,
    };
  });

  if (!extra.project) return noProject(git);

  const context = {
    generatedAt: nowIso(),
    note: SOURCE_NOTE,
    project: extra.project,
    revision: extra.revision,
    git: {
      branch: git.branch,
      head: git.head,
      dirty: git.dirty,
      worktreeFingerprint: git.worktreeFingerprint,
      recordedBranchId: extra.recordedBranch?.id ?? null,
      // The branch row is refreshed on session start and at boundaries, so it
      // can trail the working tree. The live reading above is the authority.
      recordedHead: extra.recordedBranch?.head_revision ?? null,
    },
    session: session ?? null,
    developer: packet?.developer ?? null,
    agent: packet?.agent ?? null,
    activeTask: packet?.activeTask ?? null,
    feature: packet?.feature ?? null,
    workflowSteps: extra.workflowSteps,
    governingDecisions: packet?.governingDecisions ?? [],
    openQuestions: packet?.openQuestions ?? [],
    blockers: packet?.blockers ?? [],
    blockedTasks: extra.blockedTasks,
    scopeChanges: extra.scopeChanges,
    pendingDocumentation: packet?.pendingDocumentation ?? [],
    lastVerified: packet?.evidence?.[0] ?? extra.lastVerified,
    memory: packet?.memory ?? [],
    recentActivity: packet?.recentActivity ?? [],
    readyTasks: extra.readyTasks,
    handoff: session?.handoff ?? null,
    // Work the record cannot explain. Section 12.1 asks resume for everything
    // the next session needs to carry on, and changes nobody attached to a task
    // are exactly what the next session would otherwise rebuild or undo.
    untrackedChanges: await untrackedSince(root).catch(() => 0),
  };

  context.nextAction = nextAction(context);
  return context;
}

/**
 * One instruction, and where it came from. A recorded next action always wins,
 * because someone wrote it deliberately; everything after it is derived from the
 * state the records are actually in.
 */
function nextAction(context) {
  const session = context.session;
  if (session?.nextAction) return { action: session.nextAction, source: "session" };
  if (session?.handoff && session.status === "handed_off") {
    return { action: `Pick up the handoff from ${session.id}: ${session.handoff}`, source: "handoff" };
  }

  const task = context.activeTask;
  if (task) {
    if (task.status === "blocked") {
      return {
        action: `Clear the blocker on ${task.id}: ${task.blockReason ?? "the reason was never recorded, so record it first"}`,
        source: "task",
      };
    }
    const open = task.openSubtasks?.[0];
    if (open) {
      return { action: `Finish subtask ${open.id} ${open.name} before ${task.id} can complete.`, source: "subtask" };
    }
    const waiting = task.dependencies?.[0];
    if (waiting) {
      return { action: `${task.id} waits on ${waiting.id} ${waiting.name} (${waiting.status}).`, source: "dependency" };
    }
    if (task.status === "ready" || task.status === "draft") {
      return { action: `Claim ${task.id} ${task.name} and move it to in progress.`, source: "task" };
    }
    if (task.status === "verifying" || task.status === "in_review") {
      return { action: `Verify ${task.id} against ${describeVerification(task)} and attach the evidence.`, source: "task" };
    }
    return {
      action: `Continue ${task.id} ${task.name}. Expected outcome: ${task.expectedOutcome ?? "not recorded, write it before continuing"}`,
      source: "task",
    };
  }

  const blocked = context.blockedTasks[0];
  if (blocked) {
    return { action: `Clear the blocker on ${blocked.id} ${blocked.name}: ${blocked.reason ?? "reason not recorded"}`, source: "blocked-task" };
  }
  const ready = context.readyTasks[0];
  if (ready) return { action: `Claim ${ready.id} ${ready.name}.`, source: "ready-task" };
  if (context.feature?.nextAction) return { action: context.feature.nextAction, source: "feature" };

  const pending = context.pendingDocumentation[0];
  if (pending) {
    return { action: `Review the documentation change waiting on ${pending.path} and accept or reject it.`, source: "documentation" };
  }
  const question = context.openQuestions[0];
  if (question) return { action: `Answer ${question.id}: ${question.question}`, source: "question" };

  return { action: "No open work is recorded. Plan the next feature before writing code.", source: "none" };
}

const describeVerification = (task) => {
  const requirements = task.verificationRequirements ?? [];
  return requirements.length ? requirements.join("; ") : "the verification its feature requires";
};

// ------------------------------------------------------------------- report

/**
 * The compact text a session-start hook injects.
 *
 * It stays short because it is prepended to every session, and it is passed
 * through the storage screen on the way out so no environment value, credential
 * or machine path can reach a transcript even if one reached a record.
 */
export async function sessionStartReport(root, opts = {}) {
  const harness = typeof opts.harness === "string"
    ? { harness: opts.harness, hooks: null, note: null }
    : opts.harness ?? detectHarness(opts.env);

  const context = await resumeContext(root);
  const lines = [];

  if (!context.project) {
    lines.push("Superdev: no project in this directory.");
    lines.push(`Next action: ${context.nextAction.action}`);
    return sanitizeExternal(lines.join("\n"));
  }

  lines.push(`Superdev: ${context.project.name} (${context.project.status}, ${context.project.workingMode} mode)`);
  lines.push(`Harness: ${harness.harness}${harness.hooks ? `, lifecycle hooks ${harness.hooks}` : ""}`);
  if (harness.hooks && harness.hooks !== "supported") lines.push(`- ${harness.note}`);

  lines.push(`Branch: ${context.git.branch ?? "none"} at ${short(context.git.head)}${context.git.dirty ? ", uncommitted changes" : ", clean"}`);

  const session = context.session;
  if (session) {
    const state = session.endedAt ? `${session.status} ${ago(session.endedAt)}` : `${session.state}, last activity ${ago(session.lastActivityAt)}`;
    lines.push(`Session: ${session.id} ${state}${session.objective ? ` (${session.objective})` : ""}`);
    if (session.state === "idle" && !session.endedAt) {
      lines.push(`- Idle means no recorded activity for ${IDLE_AFTER_HOURS} hours. That is normal, not a fault.`);
    }
  } else {
    lines.push("Session: none started yet.");
  }

  const task = context.activeTask;
  if (task) {
    lines.push(`Active task: ${task.id} ${task.name} (${task.status})`);
    if (context.feature) lines.push(`- Feature: ${context.feature.id} ${context.feature.name} (${context.feature.status})`);
    const step = context.workflowSteps[0];
    if (step) lines.push(`- Workflow step: ${step.id} step ${step.sequence} of ${step.workflowName}, ${step.action}`);
  } else {
    lines.push("Active task: none claimed.");
  }

  if (context.governingDecisions.length) {
    lines.push(`Decisions in force: ${list(context.governingDecisions.map((d) => `${d.id} ${d.title}`), 3)}`);
  }

  const blockerText = [
    ...context.blockedTasks.map((t) => `${t.id} ${t.reason ?? "reason not recorded"}`),
    ...context.blockers.map((b) => b.title),
  ];
  lines.push(`Blockers: ${blockerText.length ? list(blockerText, 3) : "none recorded"}`);

  if (context.scopeChanges.length) {
    lines.push(`Scope changes: ${list(context.scopeChanges.map((s) => s.summary), 2)}`);
  }
  if (context.pendingDocumentation.length) {
    lines.push(`Documentation waiting on a person: ${list(context.pendingDocumentation.map((d) => d.path), 3)}`);
  }
  if (context.openQuestions.length) {
    lines.push(`Open questions: ${context.openQuestions.length}, first is ${context.openQuestions[0].id} ${context.openQuestions[0].question}`);
  }

  const verified = context.lastVerified;
  lines.push(verified
    ? `Last verified: ${verified.result} ${ago(verified.recorded_at ?? verified.recordedAt)}, ${verified.summary}`
    : "Last verified: nothing recorded yet.");

  lines.push(`Next action: ${context.nextAction.action}`);

  return sanitizeExternal(lines.join("\n"));
}

const short = (head) => (head ? String(head).slice(0, 7) : "no commit");

function list(values, max) {
  const kept = values.filter(Boolean).slice(0, max);
  const rest = values.length - kept.length;
  return `${kept.join("; ")}${rest > 0 ? `; and ${rest} more` : ""}`;
}

function ago(iso) {
  if (!iso) return "at an unrecorded time";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "at an unrecorded time";
  if (ms < 60_000) return "just now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
