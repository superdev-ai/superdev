// Folding a duplicate task into the one that keeps the work.
//
// Deriving twice, or creating by hand what derivation had already created, leaves
// two records for one piece of work. Each collects some of the evidence, so each
// looks half finished, the feature they serve can never show either as done, and
// progress counts the same work twice while completing neither.
//
// Deleting one is the obvious move and the wrong one. A task carries why it
// existed, what it implements and what proved it, and history here is append only
// on purpose: a deleted task takes its evidence with it and leaves a commit
// message or a branch name pointing at an identifier nobody can look up. So
// nothing is deleted. What the duplicate owns moves to the survivor, the duplicate
// becomes superseded, and it says which task replaced it.
//
// What does not move, and why:
//
//   Activity events stay where they happened. They are a record of a moment, and
//   rewriting them to point elsewhere would make the log say something that is not
//   true about the past.
//
//   Claims stay with whoever made them. An assignment names a person, a machine
//   and a branch; moving it would put somebody's name against work they did not
//   take. The duplicate's claim is released instead.

import { mutate, query, recordActivity, setStatus } from "../db/store.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  SAME_TASK: "E_SAME_TASK",
  DIFFERENT_PROJECT: "E_DIFFERENT_PROJECT",
  NOT_MERGEABLE: "E_NOT_MERGEABLE",
  HELD: "E_ALREADY_CLAIMED",
};

export class MergeError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "MergeError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

/** A task in one of these has already been closed out; merging it again says nothing. */
const CLOSED = new Set(["superseded", "cancelled"]);

/**
 * What a merge would move, without moving any of it.
 *
 * Counted per kind rather than totalled, because "6 things would move" tells a
 * reader nothing about whether they meant to move them.
 */
export async function planMerge(root, duplicateId, survivorId) {
  return query(root, async (db) => {
    const [duplicate, survivor] = await Promise.all([
      db.get("SELECT * FROM tasks WHERE id = ?", duplicateId),
      db.get("SELECT * FROM tasks WHERE id = ?", survivorId),
    ]);
    refuseImpossible(duplicate, survivor, duplicateId, survivorId);

    const held = await db.get(
      "SELECT id, developer_id, agent_id FROM task_assignments WHERE task_id = ? AND active = 1",
      duplicateId,
    );

    return {
      duplicate: summary(duplicate),
      survivor: summary(survivor),
      moving: {
        evidence: await countOf(db, "SELECT COUNT(*) AS n FROM verification_evidence WHERE task_id = ?", duplicateId),
        // Counted as what the survivor would gain, not as what the duplicate has:
        // a link the survivor already carries is not moved anywhere.
        contractLinks: await countOf(db,
          `SELECT COUNT(*) AS n FROM task_contract_links d
            WHERE d.task_id = ?
              AND NOT EXISTS (SELECT 1 FROM task_contract_links s
                               WHERE s.task_id = ? AND s.target_type = d.target_type
                                 AND s.target_id = d.target_id AND s.relationship = d.relationship)`,
          duplicateId, survivorId),
        dependencies: await countOf(db,
          "SELECT COUNT(*) AS n FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?", duplicateId, duplicateId),
        memories: await countOf(db, "SELECT COUNT(*) AS n FROM memory_entries WHERE task_id = ?", duplicateId),
        changes: await countOf(db, "SELECT COUNT(*) AS n FROM changes WHERE task_id = ?", duplicateId),
        children: await countOf(db, "SELECT COUNT(*) AS n FROM tasks WHERE parent_task_id = ?", duplicateId),
      },
      // A claim is released rather than moved, and the reader is told so before it
      // happens rather than discovering it afterwards.
      releasing: held ? held.id : null,
      staying: {
        history: await countOf(db, "SELECT COUNT(*) AS n FROM activity_events WHERE task_id = ?", duplicateId),
      },
    };
  });
}

/**
 * Move everything the duplicate owns onto the survivor and supersede it.
 *
 * Every move is `OR IGNORE` or guarded, because the survivor may already carry the
 * same link, and a merge that fails halfway through on a uniqueness constraint
 * would leave the work split across two tasks with no way to tell which half went
 * where. The whole thing is one transaction, so it either happens or it does not.
 */
export async function mergeTasks(root, duplicateId, survivorId, { actor = "superdev", reason = null } = {}) {
  return mutate(root, async (db) => {
    const [duplicate, survivor] = await Promise.all([
      db.get("SELECT * FROM tasks WHERE id = ?", duplicateId),
      db.get("SELECT * FROM tasks WHERE id = ?", survivorId),
    ]);
    refuseImpossible(duplicate, survivor, duplicateId, survivorId);

    const moved = {};

    moved.evidence = await moveRows(db,
      "UPDATE verification_evidence SET task_id = ? WHERE task_id = ?", survivorId, duplicateId);

    // Contract links are copied, not moved.
    //
    // Moving them emptied the duplicate, and a trigger refuses any task leaving
    // draft without at least one contract link, so superseding it then failed and
    // the whole merge rolled back. The trigger is right: a task in an active status
    // that implements nothing is not a task. Copying is also the truer record,
    // because the duplicate really was written to implement that criterion, and it
    // is superseded rather than open so it no longer competes for the work.
    moved.contractLinks = await moveRows(db,
      `INSERT OR IGNORE INTO task_contract_links (task_id, target_type, target_id, relationship)
         SELECT ?, target_type, target_id, relationship FROM task_contract_links WHERE task_id = ?`,
      survivorId, duplicateId);

    moved.dependencies = await moveRows(db,
      "UPDATE OR IGNORE task_dependencies SET task_id = ? WHERE task_id = ?", survivorId, duplicateId);
    moved.dependencies += await moveRows(db,
      "UPDATE OR IGNORE task_dependencies SET depends_on_task_id = ? WHERE depends_on_task_id = ?", survivorId, duplicateId);
    // Anything left pointed at the duplicate, and a task cannot depend on itself.
    await db.run("DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?", duplicateId, duplicateId);
    await db.run("DELETE FROM task_dependencies WHERE task_id = depends_on_task_id");

    moved.memories = await moveRows(db,
      "UPDATE memory_entries SET task_id = ? WHERE task_id = ?", survivorId, duplicateId);
    moved.changes = await moveRows(db,
      "UPDATE changes SET task_id = ? WHERE task_id = ?", survivorId, duplicateId);
    moved.children = await moveRows(db,
      "UPDATE tasks SET parent_task_id = ? WHERE parent_task_id = ?", survivorId, duplicateId);

    // The claim is released, not moved: an assignment names a person, a machine and
    // a branch, and moving it would put somebody's name against work they did not
    // take.
    const held = await db.get(
      "SELECT id FROM task_assignments WHERE task_id = ? AND active = 1", duplicateId);
    if (held) {
      await db.run("UPDATE task_assignments SET active = 0, released_at = ? WHERE id = ?",
        new Date().toISOString(), held.id);
    }
    await db.run(
      "UPDATE work_sessions SET active_task_id = NULL WHERE project_id = ? AND active_task_id = ?",
      duplicate.project_id, duplicateId);

    // The pointer is written before the status moves, so nothing can observe a
    // superseded task that does not say what replaced it.
    await db.run("UPDATE tasks SET superseded_by = ? WHERE id = ?", survivorId, duplicateId);

    const why = reason
      ? `${duplicateId} merged into ${survivorId}: ${reason}`
      : `${duplicateId} merged into ${survivorId} as a duplicate.`;
    await setStatus(db, "task", duplicateId, "superseded", {
      projectId: duplicate.project_id,
      actor,
      note: why,
      activityType: "task_updated",
      activitySummary: why,
    });

    await recordActivity(db, survivor.project_id, {
      type: "task_updated",
      actor,
      taskId: survivorId,
      featureId: survivor.feature_id,
      summary: `${survivorId} absorbed ${duplicateId}: ${describe(moved)}`,
      metadata: { mergedFrom: duplicateId, moved },
    });

    return {
      duplicate: summary(await db.get("SELECT * FROM tasks WHERE id = ?", duplicateId)),
      survivor: summary(await db.get("SELECT * FROM tasks WHERE id = ?", survivorId)),
      moved,
      released: held?.id ?? null,
    };
  });
}

// ------------------------------------------------------------------ helpers

/** Everything that makes a merge impossible, refused in one place. */
function refuseImpossible(duplicate, survivor, duplicateId, survivorId) {
  if (duplicateId === survivorId) {
    throw new MergeError(E.SAME_TASK, `${duplicateId} cannot be merged into itself.`);
  }
  if (!duplicate) throw new MergeError(E.NOT_FOUND, `There is no task ${duplicateId}.`);
  if (!survivor) throw new MergeError(E.NOT_FOUND, `There is no task ${survivorId}.`);
  if (duplicate.project_id !== survivor.project_id) {
    throw new MergeError(E.DIFFERENT_PROJECT,
      `${duplicateId} and ${survivorId} belong to different projects, so merging them would move work between records that do not share a scope.`);
  }
  if (duplicate.superseded_by) {
    throw new MergeError(E.NOT_MERGEABLE,
      `${duplicateId} was already merged into ${duplicate.superseded_by}. Merge that one instead.`);
  }
  if (CLOSED.has(duplicate.status)) {
    throw new MergeError(E.NOT_MERGEABLE,
      `${duplicateId} is ${duplicate.status}, so it has already been closed out and there is nothing to fold in.`);
  }
  if (CLOSED.has(survivor.status)) {
    throw new MergeError(E.NOT_MERGEABLE,
      `${survivorId} is ${survivor.status}, so merging into it would move the work onto a task nobody is going to finish.`);
  }
}

const summary = (task) => task && ({
  id: task.id,
  name: task.name,
  status: task.status,
  featureId: task.feature_id,
  supersededBy: task.superseded_by ?? null,
});

async function countOf(db, sql, ...args) {
  return Number((await db.get(sql, ...args))?.n ?? 0);
}

/** How many rows a statement actually moved, whichever field the driver reports it in. */
async function moveRows(db, sql, ...args) {
  const result = await db.run(sql, ...args);
  return Number(result?.changes ?? result?.rowsAffected ?? 0);
}

const describe = (moved) => {
  const said = Object.entries(moved)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${LABEL[kind] ?? kind}`);
  return said.length ? said.join(", ") : "nothing to move";
};

const LABEL = {
  evidence: "pieces of evidence",
  contractLinks: "contract links copied across",
  dependencies: "dependencies",
  memories: "memory entries",
  changes: "recorded changes",
  children: "child tasks",
};
