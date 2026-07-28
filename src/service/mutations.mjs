// The bounded write surface. This module is the authority on what it accepts:
// ALLOWED_ACTIONS is derived from the table below, and docs/module-contract.md
// reads from it rather than restating a count that then falls out of date.
//
// The browser is an untrusted caller even though it is running on the same
// machine, so nothing it sends is ever interpolated into SQL, handed to a shell,
// or resolved as a filesystem path. Every field is checked for type, length and
// allowed values before it reaches the store, and a document is addressed by its
// record id rather than by a path the caller chose.
//
// Task work is delegated to ../tasks/lifecycle.mjs so a status never moves
// without the transition rules, the history and the activity event that the
// lifecycle owns.

import { createHash } from "node:crypto";
import {
  create,
  mutate,
  patch,
  query,
  recordActivity,
  setStatus,
  currentProject,
} from "../db/store.mjs";
import { isId, uniqueSlug } from "../model/ids.mjs";
import {
  createTask,
  updateTask,
  claimTask,
  releaseTask,
  startTask,
  submitForReview,
  verifyTask,
  unblockTask,
  blockTask,
  completeTask,
  reopenTask,
  cancelTask,
  linkContract,
  addSubtask,
} from "../tasks/lifecycle.mjs";
import {
  createCategory,
  updateCategory,
  setCategoryActive,
} from "../tasks/categories.mjs";
import { acceptProposal, rejectProposal } from "../docs/proposals.mjs";

export const E = {
  UNKNOWN_ACTION: "E_UNKNOWN_ACTION",
  INVALID_PAYLOAD: "E_INVALID_PAYLOAD",
  NOT_FOUND: "E_NOT_FOUND",
  INVALID_TRANSITION: "E_INVALID_TRANSITION",
};

export class MutationError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "MutationError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const invalid = (message, detail) => new MutationError(E.INVALID_PAYLOAD, message, detail);

// ------------------------------------------------------------------ checking

/** Longest value each shape of field may carry, so one request cannot be huge. */
const LIMIT = {
  actor: 80,
  name: 200,
  line: 500,
  prose: 4000,
  listItems: 100,
  positions: 2000,
};

// Line breaks and tabs are ordinary in prose. Every other control character is
// how a log line or a generated file gets corrupted later, and a NUL is how a
// string gets truncated by something downstream that reads it as C.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function requireObject(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalid("The payload has to be an object of named fields.");
  }
  return payload;
}

function text(payload, field, { required = false, max = LIMIT.prose } = {}) {
  const raw = payload[field];
  if (raw === undefined || raw === null || raw === "") {
    if (required) throw invalid(`${field} is required.`);
    return null;
  }
  if (typeof raw !== "string") throw invalid(`${field} has to be text.`);
  const value = raw.trim();
  if (!value) {
    if (required) throw invalid(`${field} is required and cannot be only spaces.`);
    return null;
  }
  if (value.length > max) {
    throw invalid(`${field} is ${value.length} characters. The limit is ${max}.`);
  }
  if (CONTROL.test(value)) throw invalid(`${field} contains a control character.`);
  return value;
}

function identifier(payload, field, { required = false } = {}) {
  const value = text(payload, field, { required, max: 32 });
  if (value === null) return null;
  if (!isId(value)) {
    throw invalid(`${field} has to be a Superdev record id such as FEAT-0007, not "${value}".`);
  }
  return value;
}

function oneOf(payload, field, allowed, { required = false, fallback = null } = {}) {
  const value = text(payload, field, { required, max: 64 });
  if (value === null) return fallback;
  if (!allowed.includes(value)) {
    throw invalid(`${field} has to be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function list(payload, field, { max = LIMIT.listItems, itemMax = LIMIT.line } = {}) {
  const raw = payload[field];
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) throw invalid(`${field} has to be a list of text lines.`);
  if (raw.length > max) throw invalid(`${field} has ${raw.length} entries. The limit is ${max}.`);
  return raw.map((entry, index) => {
    if (typeof entry !== "string") throw invalid(`${field}[${index}] has to be text.`);
    const value = entry.trim();
    if (value.length > itemMax) {
      throw invalid(`${field}[${index}] is ${value.length} characters. The limit is ${itemMax}.`);
    }
    if (CONTROL.test(value)) throw invalid(`${field}[${index}] contains a control character.`);
    return value;
  });
}

function number(payload, field, { required = false, min = -1e7, max = 1e7 } = {}) {
  const raw = payload[field];
  if (raw === undefined || raw === null) {
    if (required) throw invalid(`${field} is required.`);
    return null;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw invalid(`${field} has to be a finite number.`);
  }
  if (raw < min || raw > max) throw invalid(`${field} has to be between ${min} and ${max}.`);
  return raw;
}

function integer(payload, field, { required = false, min = 0, max = 1e9 } = {}) {
  const value = number(payload, field, { required, min, max });
  if (value === null) return null;
  if (!Number.isInteger(value)) throw invalid(`${field} has to be a whole number.`);
  return value;
}

function flag(payload, field) {
  const raw = payload[field];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "boolean") throw invalid(`${field} has to be true or false.`);
  return raw;
}

const actorOf = (payload) => text(payload, "actor", { max: LIMIT.actor }) ?? "control-center";

/** Only present keys are copied, so an absent field never blanks a column. */
function pick(source, keys) {
  const out = {};
  for (const key of keys) if (source[key] !== null && source[key] !== undefined) out[key] = source[key];
  return out;
}

// ------------------------------------------------------------- vocabularies

const TASK_PRIORITIES = ["critical", "urgent", "high", "normal", "medium", "low"];

/** Statuses `task.transition` accepts. Terminal moves have their own actions. */
const TRANSITION_TARGETS = ["draft", "ready", "in_progress", "in_review", "verifying", "paused"];

const CONTRACT_TARGETS = [
  "workflow_step", "ui_action", "api_operation", "data_entity", "schema_migration",
  "integration", "job", "webhook", "nfr", "document", "decision", "acceptance_criterion",
  "surface", "state_transition", "permission",
];

const CONTRACT_RELATIONSHIPS = ["implements", "verifies", "modifies", "documents", "enables"];

const DECISION_STATUSES = [
  "proposed", "accepted", "rejected", "deprecated", "partially_superseded",
  "superseded", "time_boxed", "revisit_required",
];

const DISCOVERY_KINDS = [
  "problem", "user", "goal_candidate", "feature_candidate", "constraint",
  "assumption", "risk", "unknown", "exclusion", "capability",
];

const EPISTEMIC_STATUSES = ["confirmed", "inferred", "assumed", "unknown", "contradicted", "declined"];

const DISCOVERY_STATUSES = ["proposed", "accepted", "rejected", "superseded"];

const CANVASES = ["blueprint", "discovery", "data", "architecture", "workflow"];

const LAYOUT_RECORD_TYPES = [
  "goal", "milestone", "module", "feature", "workflow", "workflow_step", "task",
  "data_entity", "discovery_item", "runtime_piece", "decision", "surface",
];

// --------------------------------------------------------------------- tasks

/**
 * `startTask`, `submitForReview` and `verifyTask` each carry their own
 * preconditions, so the target status selects the entry point rather than a
 * generic status write.
 */
async function transitionTask(root, payload) {
  const taskId = identifier(payload, "taskId", { required: true });
  const to = oneOf(payload, "to", TRANSITION_TARGETS, { required: true });
  const actor = actorOf(payload);
  const note = text(payload, "note", { max: LIMIT.line });

  const task = await query(root, (db) => db.get("SELECT * FROM tasks WHERE id = ?", taskId));
  if (!task) throw new MutationError(E.NOT_FOUND, `There is no task ${taskId}.`);

  // Leaving blocked returns the task to what it was doing, which is a decision
  // the lifecycle already knows how to make from the recorded history.
  if (task.status === "blocked") return unblockTask(root, taskId, { actor, note, to });

  if (to === "in_progress") return startTask(root, taskId, { actor, note });
  if (to === "in_review") return submitForReview(root, taskId, { actor, note });
  if (to === "verifying") return verifyTask(root, taskId, { actor, note });

  // draft, ready and paused are plain repositionings within open work. They go
  // through setStatus, which is what writes the history and the activity event.
  const from = new Set({
    draft: ["ready"],
    ready: ["draft", "paused", "cancelled"],
    paused: ["ready", "in_progress"],
  }[to]);
  if (!from.has(task.status)) {
    throw new MutationError(
      E.INVALID_TRANSITION,
      `${taskId} is ${task.status.replace(/_/g, " ")} and cannot move to ${to.replace(/_/g, " ")} from there. Allowed from: ${[...from].join(", ")}.`,
    );
  }
  return mutate(root, (db) =>
    setStatus(db, "task", taskId, to, { projectId: task.project_id, actor, note }),
  );
}

function taskInput(payload) {
  return {
    ...pick(
      {
        name: text(payload, "name", { required: true, max: LIMIT.name }),
        description: text(payload, "description"),
        expectedOutcome: text(payload, "expectedOutcome"),
        whyNeeded: text(payload, "whyNeeded"),
        completionCriteria: list(payload, "completionCriteria"),
        verificationRequirements: list(payload, "verificationRequirements"),
        affectedBoundaries: list(payload, "affectedBoundaries"),
        priority: oneOf(payload, "priority", TASK_PRIORITIES),
        risk: text(payload, "risk", { max: LIMIT.line }),
        category: text(payload, "category", { max: LIMIT.name }),
        estimate: text(payload, "estimate", { max: 64 }),
        dueAt: text(payload, "dueAt", { max: 40 }),
        enabling: flag(payload, "enabling"),
        enabledFeatureId: identifier(payload, "enabledFeatureId"),
        enablingRationale: text(payload, "enablingRationale"),
      },
      [
        "name", "description", "expectedOutcome", "whyNeeded", "completionCriteria",
        "verificationRequirements", "affectedBoundaries", "priority", "risk", "category",
        "estimate", "dueAt", "enabling", "enabledFeatureId", "enablingRationale",
      ],
    ),
    links: contractLinks(payload),
    dependsOn: dependencyIds(payload),
    actor: actorOf(payload),
  };
}

function contractLinks(payload) {
  const raw = payload.links;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw invalid("links has to be a list of contract links.");
  if (raw.length > 50) throw invalid("links has more than 50 entries.");
  return raw.map((entry) => {
    requireObject(entry);
    return {
      targetType: oneOf(entry, "targetType", CONTRACT_TARGETS, { required: true }),
      targetId: identifier(entry, "targetId", { required: true }),
      relationship: oneOf(entry, "relationship", CONTRACT_RELATIONSHIPS, { fallback: "implements" }),
    };
  });
}

function dependencyIds(payload) {
  const raw = payload.dependsOn;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw invalid("dependsOn has to be a list of task ids.");
  if (raw.length > 50) throw invalid("dependsOn has more than 50 entries.");
  return raw.map((entry, index) => {
    if (typeof entry !== "string" || !isId(entry)) {
      throw invalid(`dependsOn[${index}] has to be a task id such as TASK-0012.`);
    }
    return entry;
  });
}

// ----------------------------------------------------------------- questions

/** The question's own options. The row is read unhydrated, so the JSON is text. */
function offeredOptions(question) {
  try {
    const parsed = JSON.parse(question.alternatives_json ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Answer a question, from its options or in the reader's own words.
 *
 * `selected` carries the options chosen; `answer` carries typed text. Either is
 * enough, both together is fine (an option plus a qualification), neither is
 * refused. A question that takes one answer refuses several, because a record
 * saying "a single service, several services" says nothing.
 *
 * The work is delegated to the engine rather than repeated here. This handler
 * used to write the answer and set the status itself, which looked equivalent and
 * was not: the engine also settles the capability area the question belongs to,
 * records a reversible assumption when the answer is "I do not know", and writes a
 * project-level answer through to the field it exists to fill. So a question
 * answered in the control centre left its readiness area awaiting a decision,
 * while the same question answered from the command line settled it. One answer
 * path is the fix; two that agree by coincidence is the defect.
 */
async function answerQuestion(root, payload) {
  const questionId = identifier(payload, "questionId", { required: true });
  const status = oneOf(payload, "status", ["answered", "deferred", "withdrawn"], {
    fallback: "answered",
  });
  const selected = list(payload, "selected") ?? [];
  const typed = text(payload, "answer", { required: status === "answered" && !selected.length });
  const deferralReason = text(payload, "deferralReason", {
    required: status === "deferred",
    max: LIMIT.prose,
  });
  const answeredBy = text(payload, "answeredBy", { max: LIMIT.actor });
  const actor = actorOf(payload);

  const question = await query(root, (db) => db.get("SELECT * FROM questions WHERE id = ?", questionId));
  if (!question) throw new MutationError(E.NOT_FOUND, `There is no question ${questionId}.`);
  if (question.status !== "open" && question.status !== "deferred") {
    throw new MutationError(
      E.INVALID_TRANSITION,
      `${questionId} is already ${question.status} and is not waiting on an answer.`,
    );
  }

  if (selected.length) {
    const offered = offeredOptions(question);
    const unknown = selected.filter((choice) => !offered.includes(choice));
    if (unknown.length) {
      throw new MutationError(
        E.INVALID_PAYLOAD,
        `${questionId} does not offer ${unknown.map((u) => JSON.stringify(u)).join(", ")}. Choose from its own options, or type an answer instead.`,
      );
    }
    if (question.select_mode !== "many" && selected.length > 1) {
      throw new MutationError(
        E.INVALID_PAYLOAD,
        `${questionId} takes one answer, and ${selected.length} were chosen. Pick one, or type an answer that says what you mean.`,
      );
    }
  }

  if (status === "withdrawn") {
    return mutate(root, async (db) => {
      const project = await currentProject(db);
      return setStatus(db, "question", questionId, "withdrawn", {
        projectId: project.id,
        actor,
        note: typed ?? deferralReason,
        activityType: "specification_changed",
        activitySummary: `${questionId} withdrawn: ${(typed ?? deferralReason ?? "no reason given").slice(0, 160)}`,
      });
    });
  }

  // The chosen options and the typed words become one sentence, in that order,
  // because the options are the shared vocabulary and the typing qualifies them.
  const answer = [selected.join("; "), typed].filter(Boolean).join(". ") || null;
  const { answerQuestion: record } = await import("../init/questions.mjs");
  const outcome = await record(root, questionId, {
    answer: status === "deferred" ? null : answer,
    // Kept apart from the composed answer so a question that writes through to a
    // project field gets the sentence somebody wrote, not the option they picked.
    inOwnWords: typed,
    unknown: status === "deferred",
    revisitTrigger: status === "deferred" ? deferralReason : null,
    actor,
    answeredBy: answeredBy ?? actor,
  });
  return { id: questionId, status, answer, selected, outcome };
}

// ----------------------------------------------------------------- decisions

async function transitionDecision(root, payload) {
  const decisionId = identifier(payload, "decisionId", { required: true });
  const to = oneOf(payload, "to", DECISION_STATUSES, { required: true });
  const reason = text(payload, "reason", { max: LIMIT.prose });
  const scopeDelta = text(payload, "scopeDelta", { max: LIMIT.prose });
  const acceptedBy = text(payload, "acceptedBy", { max: LIMIT.actor });
  const actor = actorOf(payload);

  if (to === "partially_superseded" && !scopeDelta) {
    throw invalid(
      "A partial supersession has to say which part stops applying, otherwise nobody can tell what still governs.",
    );
  }

  return mutate(root, async (db) => {
    const decision = await db.get("SELECT * FROM decisions WHERE id = ?", decisionId);
    if (!decision) throw new MutationError(E.NOT_FOUND, `There is no decision ${decisionId}.`);
    if (decision.status === to) {
      throw new MutationError(E.INVALID_TRANSITION, `${decisionId} is already ${to.replace(/_/g, " ")}.`);
    }

    const previous = await db.get(
      `SELECT sequence, immutable_hash FROM decision_transitions
        WHERE decision_id = ? ORDER BY sequence DESC LIMIT 1`,
      decisionId,
    );
    const sequence = (previous?.sequence ?? 0) + 1;
    const createdAt = new Date().toISOString();
    await create(
      db,
      "decision_transition",
      {
        decision_id: decisionId,
        from_status: decision.status,
        to_status: to,
        scope_delta: scopeDelta,
        actor_id: null,
        reason,
        created_at: createdAt,
        sequence,
        // Chained to the transition before it, so the history of a decision
        // cannot be rewritten without the break showing.
        immutable_hash: createHash("sha256")
          .update(String(previous?.immutable_hash ?? ""))
          .update(`${sequence} ${decision.status} ${to} ${createdAt}`)
          .digest("hex"),
      },
      { activity: false },
    );

    if (to === "accepted") {
      await patch(
        db,
        "decision",
        decisionId,
        decision.version,
        { accepted_by: acceptedBy ?? actor, accepted_at: createdAt },
        { projectId: decision.project_id, actor, activity: false },
      );
    }

    // setStatus re-reads the row, so it sees whatever version the patch left.
    return setStatus(db, "decision", decisionId, to, {
      projectId: decision.project_id,
      actor,
      note: reason,
      activityType: "decision_transitioned",
      activitySummary: `${decisionId} moved to ${to.replace(/_/g, " ")}${reason ? `: ${reason}` : "."}`,
    });
  });
}

// ----------------------------------------------------------------- discovery

async function upsertDiscovery(root, payload) {
  const id = identifier(payload, "id");
  const kind = oneOf(payload, "kind", DISCOVERY_KINDS, { required: !id });
  const statement = text(payload, "statement", { required: !id, max: LIMIT.prose });
  const epistemicStatus = oneOf(payload, "epistemicStatus", EPISTEMIC_STATUSES);
  const status = oneOf(payload, "status", DISCOVERY_STATUSES);
  const provenance = text(payload, "provenance", { max: LIMIT.prose });
  const x = number(payload, "positionX");
  const y = number(payload, "positionY");
  const expectedVersion = integer(payload, "expectedVersion", { min: 1 });
  const actor = actorOf(payload);

  return mutate(root, async (db) => {
    const project = await currentProject(db);
    if (!project) throw new MutationError(E.NOT_FOUND, "This directory has no Superdev project yet.");

    const values = pick(
      {
        kind,
        statement,
        epistemic_status: epistemicStatus,
        provenance,
        position_x: x,
        position_y: y,
      },
      ["kind", "statement", "epistemic_status", "provenance", "position_x", "position_y"],
    );

    if (!id) {
      return create(
        db,
        "discovery_item",
        { project_id: project.id, ...values, status: status ?? "proposed" },
        {
          projectId: project.id,
          actor,
          activityType: "scope_changed",
          activitySummary: `Discovery item recorded: ${statement.slice(0, 160)}`,
        },
      );
    }

    const existing = await db.get("SELECT * FROM discovery_items WHERE id = ?", id);
    if (!existing) throw new MutationError(E.NOT_FOUND, `There is no discovery item ${id}.`);
    if (existing.status === "converted") {
      throw new MutationError(
        E.INVALID_TRANSITION,
        `${id} has already been converted into ${existing.converted_type} ${existing.converted_id} and is now read only.`,
      );
    }
    if (status === "accepted") values.accepted_at = new Date().toISOString();
    const row = Object.keys(values).length
      ? await patch(db, "discovery_item", id, expectedVersion ?? existing.version, values, {
          projectId: project.id,
          actor,
          activityType: "scope_changed",
        })
      : existing;
    if (!status || status === row.status) return row;
    return setStatus(db, "discovery_item", id, status, {
      projectId: project.id,
      actor,
      activityType: "scope_changed",
    });
  });
}

/**
 * Turn an accepted concept into the structured record it was always about,
 * keeping the pointer back to where it came from. Nothing is deleted: the
 * discovery item stays as the provenance of the record it became.
 */
async function convertDiscovery(root, payload) {
  const id = identifier(payload, "id", { required: true });
  const to = oneOf(payload, "to", ["goal", "module", "feature"], { required: true });
  const name = text(payload, "name", { max: LIMIT.name });
  const moduleId = identifier(payload, "moduleId", { required: to === "feature" });
  const milestoneId = identifier(payload, "milestoneId");
  const actor = actorOf(payload);

  return mutate(root, async (db) => {
    const item = await db.get("SELECT * FROM discovery_items WHERE id = ?", id);
    if (!item) throw new MutationError(E.NOT_FOUND, `There is no discovery item ${id}.`);
    if (item.status === "converted") {
      throw new MutationError(
        E.INVALID_TRANSITION,
        `${id} is already ${item.converted_type} ${item.converted_id}. Open that record instead of converting again.`,
      );
    }
    const projectId = item.project_id;
    const title = name ?? item.statement.slice(0, LIMIT.name);

    let created;
    if (to === "goal") {
      created = await create(
        db,
        "goal",
        { project_id: projectId, name: title, description: item.statement, why_it_matters: item.provenance },
        { projectId, actor, activityType: "scope_changed", activitySummary: `Goal created from ${id}: ${title}` },
      );
    } else if (to === "module") {
      created = await create(
        db,
        "module",
        {
          project_id: projectId,
          name: title,
          slug: await uniqueSlug(db, "modules", projectId, title, "module"),
          purpose: item.statement,
        },
        { projectId, actor, activityType: "scope_changed", activitySummary: `Module created from ${id}: ${title}` },
      );
    } else {
      const module = await db.get("SELECT * FROM modules WHERE id = ?", moduleId);
      if (!module) {
        throw new MutationError(
          E.NOT_FOUND,
          `There is no module ${moduleId}. A feature belongs to exactly one module, so pick the module first.`,
        );
      }
      if (milestoneId) {
        const milestone = await db.get("SELECT id FROM milestones WHERE id = ?", milestoneId);
        if (!milestone) throw new MutationError(E.NOT_FOUND, `There is no milestone ${milestoneId}.`);
      }
      created = await create(
        db,
        "feature",
        {
          project_id: projectId,
          module_id: module.id,
          milestone_id: milestoneId,
          name: title,
          slug: await uniqueSlug(db, "features", projectId, title, "feature"),
          purpose: item.statement,
          user_statement: item.statement,
        },
        { projectId, actor, activityType: "scope_changed", activitySummary: `Feature created from ${id}: ${title}` },
      );
    }

    await patch(
      db,
      "discovery_item",
      id,
      item.version,
      { converted_type: to, converted_id: created.id },
      { projectId, actor, activity: false },
    );
    await setStatus(db, "discovery_item", id, "converted", {
      projectId,
      actor,
      activityType: "scope_changed",
      activitySummary: `${id} became ${to} ${created.id}.`,
    });
    return { converted: created, from: id, to };
  });
}

// -------------------------------------------------------------------- layout

/**
 * Canvas positions decorate records rather than describing them. They are saved
 * as one batch with one activity event, because a drag is a single act and a
 * per-node event would drown the timeline it shares with real work.
 */
async function saveLayout(root, payload) {
  const canvas = oneOf(payload, "canvas", CANVASES, { required: true });
  const actor = actorOf(payload);
  const raw = payload.positions;
  if (!Array.isArray(raw)) throw invalid("positions has to be a list of node positions.");
  if (raw.length > LIMIT.positions) {
    throw invalid(`positions has ${raw.length} entries. The limit is ${LIMIT.positions}.`);
  }

  const positions = raw.map((entry) => {
    requireObject(entry);
    return {
      recordType: oneOf(entry, "recordType", LAYOUT_RECORD_TYPES, { required: true }),
      recordId: identifier(entry, "recordId", { required: true }),
      x: number(entry, "x", { required: true }),
      y: number(entry, "y", { required: true }),
    };
  });
  if (!positions.length) return { canvas, saved: 0 };

  return mutate(root, async (db) => {
    const project = await currentProject(db);
    if (!project) throw new MutationError(E.NOT_FOUND, "This directory has no Superdev project yet.");
    const at = new Date().toISOString();

    for (const position of positions) {
      // layout_positions has no version column, so versionedUpdate cannot
      // address it. The values are two numbers and a record id, all already
      // validated above, and they are bound parameters rather than SQL text.
      const info = await db.run(
        `UPDATE layout_positions SET x = ?, y = ?, updated_at = ?
          WHERE project_id = ? AND canvas = ? AND record_type = ? AND record_id = ?`,
        position.x, position.y, at, project.id, canvas, position.recordType, position.recordId,
      );
      if (info.changes) continue;
      await create(
        db,
        "layout_position",
        {
          project_id: project.id,
          canvas,
          record_type: position.recordType,
          record_id: position.recordId,
          x: position.x,
          y: position.y,
          updated_at: at,
        },
        { activity: false },
      );
    }

    await recordActivity(db, project.id, {
      type: "specification_changed",
      actor,
      summary: `Saved ${positions.length} node position(s) on the ${canvas} canvas.`,
      metadata: { canvas, count: positions.length },
    });
    return { canvas, saved: positions.length };
  });
}

// ---------------------------------------------------------------- documents

/**
 * A document is addressed by its record id. The path handed to the proposal
 * machinery is the one already stored on that row, never a string the browser
 * chose, so no request can name a file the project does not track.
 */
async function resolveDocument(root, payload) {
  const documentId = identifier(payload, "documentId");
  const requested = text(payload, "path", { max: LIMIT.line });
  if (!documentId && !requested) throw invalid("documentId is required.");

  const row = await query(root, (db) =>
    documentId
      ? db.get("SELECT * FROM documents WHERE id = ?", documentId)
      : db.get("SELECT * FROM documents WHERE path = ?", requested),
  );
  if (!row) {
    throw new MutationError(
      E.NOT_FOUND,
      `${documentId ?? requested} is not a document this project tracks. Open the Readiness view for the list of documents with pending edits.`,
    );
  }
  if (row.sync_status !== "manual_edit_pending") {
    throw new MutationError(
      E.INVALID_TRANSITION,
      `${row.path} has no pending manual edit to decide about. It is currently ${row.sync_status.replace(/_/g, " ")}.`,
    );
  }
  return row;
}

// ------------------------------------------------------------------- actions

/** The complete allowlist. Anything not named here is refused. */
const ACTIONS = {
  "task.create": (root, payload) =>
    createTask(root, { ...taskInput(payload), featureId: identifier(payload, "featureId", { required: true }) }),

  "task.update": (root, payload) => {
    const taskId = identifier(payload, "taskId", { required: true });
    const values = pick(
      {
        name: text(payload, "name", { max: LIMIT.name }),
        description: text(payload, "description"),
        expectedOutcome: text(payload, "expectedOutcome"),
        whyNeeded: text(payload, "whyNeeded"),
        completionCriteria: list(payload, "completionCriteria"),
        verificationRequirements: list(payload, "verificationRequirements"),
        affectedBoundaries: list(payload, "affectedBoundaries"),
        priority: oneOf(payload, "priority", TASK_PRIORITIES),
        risk: text(payload, "risk", { max: LIMIT.line }),
        estimate: text(payload, "estimate", { max: 64 }),
        dueAt: text(payload, "dueAt", { max: 40 }),
        sequence: integer(payload, "sequence", { max: 100000 }),
        categoryId: identifier(payload, "categoryId"),
        parentTaskId: identifier(payload, "parentTaskId"),
        enabling: flag(payload, "enabling"),
        enabledFeatureId: identifier(payload, "enabledFeatureId"),
        enablingRationale: text(payload, "enablingRationale"),
      },
      [
        "name", "description", "expectedOutcome", "whyNeeded", "completionCriteria",
        "verificationRequirements", "affectedBoundaries", "priority", "risk", "estimate",
        "dueAt", "sequence", "categoryId", "parentTaskId", "enabling", "enabledFeatureId",
        "enablingRationale",
      ],
    );
    if (!Object.keys(values).length) throw invalid("task.update was given nothing to change.");
    return updateTask(root, taskId, values, {
      actor: actorOf(payload),
      expectedVersion: integer(payload, "expectedVersion", { min: 1 }),
    });
  },

  "task.claim": (root, payload) =>
    claimTask(root, identifier(payload, "taskId", { required: true }), {
      developerId: identifier(payload, "developerId"),
      agentId: identifier(payload, "agentId"),
      branchId: identifier(payload, "branchId"),
      sessionId: identifier(payload, "sessionId"),
      actor: actorOf(payload),
    }),

  "task.release": (root, payload) =>
    releaseTask(root, identifier(payload, "taskId", { required: true }), {
      actor: actorOf(payload),
      reason: text(payload, "reason", { max: LIMIT.line }),
    }),

  "task.transition": transitionTask,

  "task.block": (root, payload) =>
    blockTask(root, identifier(payload, "taskId", { required: true }), {
      reason: text(payload, "reason", { required: true, max: LIMIT.prose }),
      actor: actorOf(payload),
    }),

  "task.complete": (root, payload) =>
    completeTask(root, identifier(payload, "taskId", { required: true }), {
      actor: actorOf(payload),
      note: text(payload, "note", { max: LIMIT.line }),
    }),

  "task.reopen": (root, payload) =>
    reopenTask(root, identifier(payload, "taskId", { required: true }), {
      reason: text(payload, "reason", { required: true, max: LIMIT.prose }),
      actor: actorOf(payload),
      to: oneOf(payload, "to", ["ready", "in_progress"]),
    }),

  "task.cancel": (root, payload) =>
    cancelTask(root, identifier(payload, "taskId", { required: true }), {
      reason: text(payload, "reason", { required: true, max: LIMIT.prose }),
      actor: actorOf(payload),
    }),

  "task.link": (root, payload) =>
    linkContract(
      root,
      identifier(payload, "taskId", { required: true }),
      {
        targetType: oneOf(payload, "targetType", CONTRACT_TARGETS, { required: true }),
        targetId: identifier(payload, "targetId", { required: true }),
        relationship: oneOf(payload, "relationship", CONTRACT_RELATIONSHIPS, { fallback: "implements" }),
      },
      { actor: actorOf(payload) },
    ),

  "task.addSubtask": (root, payload) =>
    addSubtask(root, identifier(payload, "parentTaskId", { required: true }), taskInput(payload)),

  "question.answer": answerQuestion,
  "decision.transition": transitionDecision,
  "discovery.upsert": upsertDiscovery,
  "discovery.convert": convertDiscovery,
  "layout.save": saveLayout,

  "docs.acceptProposal": async (root, payload) => {
    const document = await resolveDocument(root, payload);
    return acceptProposal(root, document.path, { actor: actorOf(payload) });
  },

  "docs.rejectProposal": async (root, payload) => {
    const document = await resolveDocument(root, payload);
    return rejectProposal(root, document.path, { actor: actorOf(payload) });
  },

  // Categories are data, not constants: the seeded set is a starting
  // vocabulary and a project is expected to add its own.
  "category.create": (root, payload) =>
    createCategory(root, {
      name: text(payload, "name", { max: 60, required: true }),
      description: text(payload, "description", { max: 240 }),
      actor: actorOf(payload),
    }),

  "category.update": (root, payload) =>
    updateCategory(root, identifier(payload, "categoryId", { required: true }), {
      name: text(payload, "name", { max: 60 }),
      description: text(payload, "description", { max: 240 }),
      actor: actorOf(payload),
    }),

  // Retiring, never deleting: a category still names the work already filed
  // under it, so removing the row would rewrite that history.
  "category.retire": (root, payload) =>
    setCategoryActive(root, identifier(payload, "categoryId", { required: true }), false, actorOf(payload)),

  "category.restore": (root, payload) =>
    setCategoryActive(root, identifier(payload, "categoryId", { required: true }), true, actorOf(payload)),
};

/** Every accepted action name, for the refusal message and for the interface. */
export const ALLOWED_ACTIONS = Object.freeze(Object.keys(ACTIONS));

/**
 * Run one mutation. `action` must be on the allowlist and `payload` must survive
 * field-by-field validation; anything else is refused with a stable code before
 * a connection is opened.
 */
export async function applyMutation(root, action, payload) {
  if (typeof action !== "string" || !Object.hasOwn(ACTIONS, action)) {
    throw new MutationError(
      E.UNKNOWN_ACTION,
      `${typeof action === "string" && action ? `"${action}"` : "That"} is not something this service can do. Accepted actions: ${ALLOWED_ACTIONS.join(", ")}.`,
    );
  }
  return ACTIONS[action](root, requireObject(payload ?? {}));
}
