// Work sessions: start, heartbeat, compaction, handoff, end, and presence.
//
// A session is the thread that ties a developer, an agent, a branch and a task
// together so the next agent can resume from records instead of a transcript.
// The heartbeat is `work_sessions.last_activity_at`, updated freely and
// silently; an activity event is only written at a boundary a human would want
// to read. Brief sections 12.1, 12.3, 12.5 and 13.

import { existsSync } from "node:fs";
import {
  paths, query, mutate, create, currentProject, recordActivity, DbError,
} from "../db/store.mjs";
import { sanitizeExternal } from "../model/screening.mjs";
import { resolveIdentity } from "./identity.mjs";

/** No activity for four hours is idle. Idle is a healthy state, not an error. */
export const IDLE_AFTER_HOURS = 4;
const IDLE_AFTER_MS = IDLE_AFTER_HOURS * 60 * 60 * 1000;

/** A session is still live while it is being worked on or has just compacted. */
const LIVE_STATUSES = ["active", "compacted"];

const nowIso = () => new Date().toISOString();

const clean = (text) => {
  const out = sanitizeExternal(text).trim();
  return out || null;
};

const trim = (text, max = 240) => {
  const value = clean(text);
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
};

// -------------------------------------------------------------------- start

/**
 * Begin or rejoin a session for this developer, agent and branch.
 *
 * An agent that reconnects gets its live session back rather than a second one,
 * so a restarted harness cannot leave a trail of sessions that all look active.
 * Identity resolution happens first and in its own transaction, because it
 * shells out to git.
 */
export async function startSession(root, opts = {}) {
  const identity = await resolveIdentity(root, opts);
  const at = opts.at ?? nowIso();
  const objective = clean(opts.objective);

  return mutate(root, async (db) => {
    const project = identity.project ?? await currentProject(db);
    const { developer, agent, branch } = identity;

    // An assignment outstrips whatever the caller thinks it is doing: if this
    // actor already holds a task, that is the work in progress.
    const assignment = await db.get(
      `SELECT a.*, t.name AS task_name, t.status AS task_status
         FROM task_assignments a JOIN tasks t ON t.id = a.task_id
        WHERE a.active = 1 AND (a.developer_id IS ? OR a.agent_id IS ?)
        ORDER BY a.assigned_at DESC LIMIT 1`,
      developer?.id ?? null, agent?.id ?? null,
    );
    const taskId = opts.taskId ?? assignment?.task_id ?? null;

    // A session that states no objective inherits the last one, because the
    // work did not change purpose when the process restarted. Section 12.1 asks
    // resume for everything the next session needs to carry on, and the
    // objective is the first thing a reader looks for: without this, every
    // resumed session reported nothing to carry on toward.
    const carried = objective ?? (await db.get(
      `SELECT objective FROM work_sessions
        WHERE project_id = ? AND objective IS NOT NULL
        ORDER BY started_at DESC LIMIT 1`,
      project.id,
    ))?.objective ?? null;

    const live = await db.get(
      `SELECT * FROM work_sessions
        WHERE project_id = ? AND agent_id IS ? AND ended_at IS NULL
          AND status IN (${LIVE_STATUSES.map(() => "?").join(",")})
        ORDER BY started_at DESC LIMIT 1`,
      project.id, agent?.id ?? null, ...LIVE_STATUSES,
    );

    if (live) {
      await db.run(
        `UPDATE work_sessions
            SET last_activity_at = ?, status = 'active',
                branch_id = coalesce(?, branch_id),
                active_task_id = coalesce(?, active_task_id),
                objective = coalesce(?, objective)
          WHERE id = ?`,
        at, branch?.id ?? null, taskId, carried, live.id,
      );
      const row = await db.get("SELECT * FROM work_sessions WHERE id = ?", live.id);
      return { ...shapeSession(row), resumed: true, assignment: assignment ?? null };
    }

    const row = await create(db, "work_session", {
      project_id: project.id,
      developer_id: developer?.id ?? null,
      agent_id: agent?.id ?? null,
      branch_id: branch?.id ?? null,
      active_task_id: taskId,
      objective: carried,
      started_at: at,
      last_activity_at: at,
      status: "active",
    });

    await recordActivity(db, project.id, {
      type: "session_started",
      summary: sessionSummary(developer, agent, branch, carried),
      sessionId: row.id,
      actorId: agent?.id ?? null,
      actor: developer?.display_name ?? agent?.harness ?? "superdev",
      taskId,
      createdAt: at,
      metadata: {
        harness: identity.harness?.harness ?? agent?.harness ?? null,
        hooks: identity.harness?.hooks ?? null,
        branch: branch?.name ?? null,
        head: branch?.head_revision ?? null,
      },
    });

    return { ...shapeSession(row), resumed: false, assignment: assignment ?? null };
  });
}

function sessionSummary(developer, agent, branch, objective) {
  const who = developer?.display_name ?? "an unnamed developer";
  const how = agent?.harness ? ` in ${agent.harness}` : "";
  const where = branch?.name ? ` on ${branch.name}` : "";
  return trim(`Session started by ${who}${how}${where}${objective ? `: ${objective}` : ""}`, 200);
}

// ---------------------------------------------------------------- heartbeat

/**
 * Move the heartbeat, and record an event only when the caller names a boundary.
 *
 * Without a summary this writes timestamps and nothing else, which is what a
 * file read or a shell command deserves. With a summary it appends one activity
 * event, unless it repeats the session's previous event verbatim, because a loop
 * that reports the same step twice is noise rather than history.
 */
export async function touchSession(root, sessionId, opts = {}) {
  const at = opts.at ?? nowIso();
  const summary = trim(opts.summary, 300);
  const type = opts.type ?? "specification_changed";
  const git = opts.git ?? null;

  return mutate(root, async (db) => {
    const session = await requireLiveSession(db, sessionId);

    await db.run(
      `UPDATE work_sessions
          SET last_activity_at = ?, active_task_id = coalesce(?, active_task_id)
        WHERE id = ?`,
      at, opts.taskId ?? null, sessionId,
    );
    if (session.agent_id) {
      await db.run("UPDATE agents SET status = 'active', last_seen_at = ? WHERE id = ?", at, session.agent_id);
    }
    // Branch HEAD and dirty state, brief 12.3. `git` is computed by the caller
    // before this transaction opens, never by shelling out from in here.
    if (session.branch_id && git) {
      await db.run(
        "UPDATE branches SET head_revision = coalesce(?, head_revision), dirty = ?, last_seen_at = ? WHERE id = ?",
        git.head ?? null, git.dirty ? 1 : 0, at, session.branch_id,
      );
    }

    if (!summary) return { sessionId, lastActivityAt: at, recorded: false };

    const previous = await db.get(
      "SELECT event_type, summary FROM activity_events WHERE session_id = ? ORDER BY sequence DESC LIMIT 1",
      sessionId,
    );
    if (previous && previous.event_type === type && previous.summary === summary) {
      return { sessionId, lastActivityAt: at, recorded: false, reason: "repeat of the previous event" };
    }

    const event = await recordActivity(db, session.project_id, {
      type,
      summary,
      sessionId,
      actorId: session.agent_id,
      actor: opts.actor,
      taskId: opts.taskId ?? session.active_task_id ?? null,
      featureId: opts.featureId ?? null,
      createdAt: at,
      metadata: opts.metadata ?? {},
    });
    return { sessionId, lastActivityAt: at, recorded: true, event };
  });
}

// --------------------------------------------------------------- compaction

/**
 * Persist everything brief 12.5 lists, so the next agent needs no conversation.
 *
 * The lists become memory entries in the same transaction rather than through
 * the memory module, because that module opens its own write connection and the
 * engine allows one writer at a time. The individual entries record no activity
 * of their own; one session_compacted event stands for the whole compaction.
 */
export async function compactSession(root, sessionId, details = {}) {
  const at = details.at ?? nowIso();
  return mutate(root, async (db) => {
    const session = await requireLiveSession(db, sessionId);
    const written = await persistWorkingState(db, session, details, at);

    await db.run(
      `UPDATE work_sessions
          SET status = 'compacted', last_activity_at = ?,
              objective = coalesce(?, objective),
              active_task_id = coalesce(?, active_task_id),
              outcome = coalesce(?, outcome),
              next_action = coalesce(?, next_action)
        WHERE id = ?`,
      at, clean(details.objective), details.activeTaskId ?? null,
      trim(details.lastVerifiedResult?.summary ?? details.lastVerifiedResult, 300),
      trim(details.nextAction, 300), sessionId,
    );

    await recordActivity(db, session.project_id, {
      type: "session_compacted",
      summary: trim(
        `Session ${sessionId} compacted. ${written.memories.length} memories kept. Next action: ${clean(details.nextAction) ?? "not recorded"}`,
        300,
      ),
      sessionId,
      actorId: session.agent_id,
      actor: details.actor,
      taskId: details.activeTaskId ?? session.active_task_id ?? null,
      featureId: written.featureId,
      createdAt: at,
      metadata: { memories: written.memories, counts: written.counts },
    });

    const row = await db.get("SELECT * FROM work_sessions WHERE id = ?", sessionId);
    return { ...shapeSession(row), memories: written.memories };
  });
}

/**
 * Hand the work to whoever comes next: the same persistence as compaction, plus
 * the session is closed and its claim released, because an assignment held by a
 * session that is over is a claim nobody is working.
 */
export async function handoffSession(root, sessionId, details = {}) {
  const at = details.at ?? nowIso();
  return mutate(root, async (db) => {
    const session = await requireLiveSession(db, sessionId);
    const handoff = clean(details.handoff ?? details.note);
    const written = await persistWorkingState(db, session, {
      ...details,
      handoff: handoff ?? details.nextAction,
    }, at);

    await db.run(
      `UPDATE work_sessions
          SET status = 'handed_off', ended_at = ?, last_activity_at = ?,
              objective = coalesce(?, objective),
              active_task_id = coalesce(?, active_task_id),
              outcome = coalesce(?, outcome),
              handoff = coalesce(?, handoff),
              next_action = coalesce(?, next_action)
        WHERE id = ?`,
      at, at, clean(details.objective), details.activeTaskId ?? null,
      trim(details.outcome ?? details.lastVerifiedResult?.summary ?? details.lastVerifiedResult, 300),
      trim(handoff, 1000), trim(details.nextAction, 300), sessionId,
    );

    const released = await releaseAssignments(db, session, at, details.actor);
    await closeAgent(db, session, at);

    await recordActivity(db, session.project_id, {
      type: "session_handed_off",
      summary: trim(
        `Session ${sessionId} handed off. Next action: ${clean(details.nextAction) ?? handoff ?? "not recorded"}`,
        300,
      ),
      sessionId,
      actorId: session.agent_id,
      actor: details.actor,
      taskId: details.activeTaskId ?? session.active_task_id ?? null,
      featureId: written.featureId,
      createdAt: at,
      metadata: { to: clean(details.to), released, memories: written.memories },
    });

    const row = await db.get("SELECT * FROM work_sessions WHERE id = ?", sessionId);
    return { ...shapeSession(row), memories: written.memories, released };
  });
}

/** Close the session, release any claim it holds, and say how it ended. */
export async function endSession(root, sessionId, details = {}) {
  const at = details.at ?? nowIso();
  return mutate(root, async (db) => {
    const session = await db.get("SELECT * FROM work_sessions WHERE id = ?", sessionId);
    if (!session) throw new DbError("E_NOT_FOUND", `Session ${sessionId} does not exist.`);
    if (session.ended_at) return shapeSession(session);

    const written = details.summarize === false
      ? { memories: [], counts: {}, featureId: null }
      : await persistWorkingState(db, session, details, at);

    await db.run(
      `UPDATE work_sessions
          SET status = 'ended', ended_at = ?, last_activity_at = ?,
              outcome = coalesce(?, outcome),
              next_action = coalesce(?, next_action)
        WHERE id = ?`,
      at, at, trim(details.outcome, 1000), trim(details.nextAction, 300), sessionId,
    );

    const released = await releaseAssignments(db, session, at, details.actor);
    await closeAgent(db, session, at);

    await recordActivity(db, session.project_id, {
      type: "session_ended",
      summary: trim(
        `Session ${sessionId} ended. ${clean(details.outcome) ?? "No outcome recorded."}`,
        300,
      ),
      sessionId,
      actorId: session.agent_id,
      actor: details.actor,
      taskId: session.active_task_id,
      featureId: written.featureId,
      createdAt: at,
      metadata: { released, memories: written.memories },
    });

    const row = await db.get("SELECT * FROM work_sessions WHERE id = ?", sessionId);
    return { ...shapeSession(row), memories: written.memories, released };
  });
}

// ------------------------------------------------------------------ reading

/**
 * The session to resume. Live sessions win; with `includeEnded` the most recent
 * finished one is returned so a resume can still read its handoff.
 */
export async function activeSession(root, filter = {}) {
  // Reads run wherever the caller happens to be. A missing database is "nobody
  // is working here", not a fault, and reading one that was never created
  // raises an engine I/O error that reads like a broken install.
  if (!existsSync(paths(root).db)) return null;
  return query(root, async (db) => {
    const where = [];
    const params = [];
    if (filter.sessionId) { where.push("s.id = ?"); params.push(filter.sessionId); }
    if (filter.developerId) { where.push("s.developer_id = ?"); params.push(filter.developerId); }
    if (filter.agentId) { where.push("s.agent_id = ?"); params.push(filter.agentId); }
    if (filter.branchId) { where.push("s.branch_id = ?"); params.push(filter.branchId); }
    if (!filter.includeEnded) {
      where.push(`s.ended_at IS NULL AND s.status IN (${LIVE_STATUSES.map(() => "?").join(",")})`);
      params.push(...LIVE_STATUSES);
    }

    const row = await db.get(
      `SELECT s.*, d.display_name AS developer_name, a.harness AS agent_harness,
              a.model_label AS agent_model, b.name AS branch_name,
              b.head_revision AS branch_head, b.dirty AS branch_dirty,
              t.name AS task_name, t.status AS task_status
         FROM work_sessions s
         LEFT JOIN developers d ON d.id = s.developer_id
         LEFT JOIN agents a ON a.id = s.agent_id
         LEFT JOIN branches b ON b.id = s.branch_id
         LEFT JOIN tasks t ON t.id = s.active_task_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY CASE WHEN s.ended_at IS NULL THEN 0 ELSE 1 END,
                 coalesce(s.last_activity_at, s.started_at) DESC
        LIMIT 1`,
      ...params,
    );
    return row ? shapeSession(row) : null;
  });
}

/**
 * Who is here, on what, and when they were last seen. Feeds the Team view.
 * A developer, agent or branch with no activity for four hours reads as idle,
 * which is normal and is not reported as a fault.
 */
export async function presence(root, opts = {}) {
  const limit = Math.max(1, Math.min(Number(opts.sessionLimit) || 25, 200));
  if (!existsSync(paths(root).db)) return emptyPresence();
  return query(root, async (db) => {
    const project = await currentProject(db);
    if (!project) return emptyPresence();

    const now = Date.now();
    const [developers, agents, branches, sessions] = await Promise.all([
      db.all("SELECT * FROM developers WHERE project_id = ? ORDER BY display_name", project.id),
      db.all(
        `SELECT a.* FROM agents a JOIN developers d ON d.id = a.developer_id
          WHERE d.project_id = ? ORDER BY coalesce(a.last_seen_at, '') DESC`, project.id),
      db.all(
        "SELECT * FROM branches WHERE project_id = ? ORDER BY coalesce(last_seen_at, '') DESC", project.id),
      db.all(
        `SELECT s.*, d.display_name AS developer_name, a.harness AS agent_harness,
                a.model_label AS agent_model, b.name AS branch_name,
                b.head_revision AS branch_head, b.dirty AS branch_dirty,
                t.name AS task_name, t.status AS task_status
           FROM work_sessions s
           LEFT JOIN developers d ON d.id = s.developer_id
           LEFT JOIN agents a ON a.id = s.agent_id
           LEFT JOIN branches b ON b.id = s.branch_id
           LEFT JOIN tasks t ON t.id = s.active_task_id
          WHERE s.project_id = ?
          ORDER BY CASE WHEN s.ended_at IS NULL THEN 0 ELSE 1 END,
                   coalesce(s.last_activity_at, s.started_at) DESC
          LIMIT ${limit}`, project.id),
    ]);

    const latestByDeveloper = new Map();
    const latestByAgent = new Map();
    const latestByBranch = new Map();
    for (const s of sessions) {
      const stamp = s.last_activity_at ?? s.started_at;
      keepLatest(latestByDeveloper, s.developer_id, stamp);
      keepLatest(latestByAgent, s.agent_id, stamp);
      keepLatest(latestByBranch, s.branch_id, stamp);
    }

    return {
      generatedAt: new Date(now).toISOString(),
      idleAfterHours: IDLE_AFTER_HOURS,
      note: `A developer, agent or branch with no activity for ${IDLE_AFTER_HOURS} hours is idle. Idle is a normal state.`,
      developers: developers.map((d) => ({
        id: d.id,
        displayName: d.display_name,
        externalIdentity: d.external_identity,
        status: d.status,
        lastActivityAt: latestByDeveloper.get(d.id) ?? null,
        state: liveness(latestByDeveloper.get(d.id), now, d.status === "inactive"),
        agents: agents.filter((a) => a.developer_id === d.id).map((a) => a.id),
      })),
      agents: agents.map((a) => ({
        id: a.id,
        developerId: a.developer_id,
        harness: a.harness,
        modelLabel: a.model_label,
        status: a.status,
        lastSeenAt: a.last_seen_at ?? latestByAgent.get(a.id) ?? null,
        state: liveness(a.last_seen_at ?? latestByAgent.get(a.id), now, a.status === "ended"),
      })),
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        headRevision: b.head_revision,
        dirty: Boolean(b.dirty),
        worktreeFingerprint: b.worktree_fingerprint,
        status: b.status,
        lastSeenAt: b.last_seen_at ?? latestByBranch.get(b.id) ?? null,
        state: liveness(b.last_seen_at ?? latestByBranch.get(b.id), now, b.status !== "active"),
      })),
      sessions: sessions.map((s) => shapeSession(s, now)),
    };
  });
}

const emptyPresence = () => ({
  generatedAt: nowIso(),
  idleAfterHours: IDLE_AFTER_HOURS,
  note: "No Superdev project in this directory yet.",
  developers: [], agents: [], branches: [], sessions: [],
});

function keepLatest(map, key, stamp) {
  if (!key || !stamp) return;
  const held = map.get(key);
  if (!held || stamp > held) map.set(key, stamp);
}

const liveness = (stamp, now, ended) => {
  if (ended) return "ended";
  if (!stamp) return "idle";
  return now - Date.parse(stamp) > IDLE_AFTER_MS ? "idle" : "active";
};

// ------------------------------------------------------------------ helpers

async function requireLiveSession(db, sessionId) {
  const session = await db.get("SELECT * FROM work_sessions WHERE id = ?", sessionId);
  if (!session) throw new DbError("E_NOT_FOUND", `Session ${sessionId} does not exist.`);
  if (session.ended_at) {
    throw new DbError(
      "E_SESSION_ENDED",
      `Session ${sessionId} ended at ${session.ended_at}. Start a new session before recording more work.`,
    );
  }
  return session;
}

/**
 * The 12.5 packet, written as memory entries. Each list may hold plain strings
 * or objects; both end up as a title and a body, cleaned of secrets and home
 * paths before storage.
 */
async function persistWorkingState(db, session, details, at) {
  const taskId = details.activeTaskId ?? session.active_task_id ?? null;
  const task = taskId ? await db.get("SELECT * FROM tasks WHERE id = ?", taskId) : null;
  const featureId = details.featureId ?? task?.feature_id ?? null;

  if (details.git && session.branch_id) {
    await db.run(
      "UPDATE branches SET head_revision = coalesce(?, head_revision), dirty = ?, last_seen_at = ? WHERE id = ?",
      details.git.head ?? null, details.git.dirty ? 1 : 0, at, session.branch_id,
    );
  }

  const groups = [
    ["decision", details.decisions, "Decision"],
    ["blocker", details.blockers, "Blocker"],
    ["outcome", details.scopeChanges, "Scope change"],
    ["unresolved_question", details.pendingDocumentation, "Pending documentation"],
    ["outcome", details.lastVerifiedResult, "Last verified result"],
    ["handoff", details.handoff, "Handoff"],
  ];

  const memories = [];
  const counts = {};
  for (const [kind, value, label] of groups) {
    const items = normalize(value, label);
    if (items.length) counts[label] = (counts[label] ?? 0) + items.length;
    for (const item of items) {
      const row = await create(db, "memory_entry", {
        project_id: session.project_id,
        session_id: session.id,
        task_id: taskId,
        feature_id: featureId,
        kind,
        title: item.title,
        content: item.content,
        source_ref: item.sourceRef,
        epistemic_status: item.epistemicStatus,
        embedding: null,
        created_at: at,
      });
      memories.push(row.id);
    }
  }

  const summary = compactionSummary(session, details, task);
  if (summary) {
    const row = await create(db, "memory_entry", {
      project_id: session.project_id,
      session_id: session.id,
      task_id: taskId,
      feature_id: featureId,
      kind: "summary",
      title: `Session ${session.id} state`,
      content: summary,
      epistemic_status: "confirmed",
      embedding: null,
      created_at: at,
    });
    memories.push(row.id);
  }

  return { memories, counts, featureId };
}

function normalize(value, label) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((item) => {
      const source = typeof item === "string" ? { content: item } : item ?? {};
      const content = clean(source.content ?? source.note ?? source.summary ?? source.title);
      if (!content) return null;
      const named = clean(source.title ?? source.summary ?? source.id);
      return {
        title: trim(named ? `${label}: ${named}` : `${label}: ${content}`, 160),
        content,
        sourceRef: clean(source.sourceRef ?? source.reference ?? source.id),
        epistemicStatus: EPISTEMIC.has(source.epistemicStatus) ? source.epistemicStatus : "confirmed",
      };
    })
    .filter(Boolean);
}

const EPISTEMIC = new Set(["confirmed", "inferred", "assumed", "unknown", "contradicted"]);

function compactionSummary(session, details, task) {
  const lines = [
    `Objective: ${clean(details.objective) ?? clean(session.objective) ?? "not recorded"}`,
    `Active task: ${task ? `${task.id} ${task.name} (${task.status})` : "none"}`,
    `Branch: ${clean(details.git?.branch) ?? "unknown"} at ${details.git?.head?.slice(0, 7) ?? "unknown"}${details.git?.dirty ? ", uncommitted changes" : ""}`,
    `Next action: ${clean(details.nextAction) ?? "not recorded"}`,
  ];
  return lines.join("\n");
}

async function releaseAssignments(db, session, at, actor) {
  const held = await db.all(
    "SELECT * FROM task_assignments WHERE session_id = ? AND active = 1", session.id,
  );
  if (!held.length) return [];

  await db.run(
    "UPDATE task_assignments SET active = 0, released_at = ? WHERE session_id = ? AND active = 1",
    at, session.id,
  );
  for (const assignment of held) {
    await recordActivity(db, session.project_id, {
      type: "task_released",
      summary: `Task ${assignment.task_id} released when session ${session.id} finished.`,
      sessionId: session.id,
      actorId: session.agent_id,
      actor,
      taskId: assignment.task_id,
      createdAt: at,
      metadata: { assignment: assignment.id },
    });
  }
  return held.map((a) => ({ id: a.id, taskId: a.task_id }));
}

async function closeAgent(db, session, at) {
  if (!session.agent_id) return;
  await db.run("UPDATE agents SET status = 'ended', last_seen_at = ? WHERE id = ?", at, session.agent_id);
}

/** Statuses a task never comes back from, so it stops being the active one. */
const TERMINAL_TASK = new Set(["complete", "completed", "cancelled", "superseded"]);

function shapeSession(row, now = Date.now()) {
  const lastActivityAt = row.last_activity_at ?? row.started_at ?? null;
  return {
    id: row.id,
    projectId: row.project_id,
    developerId: row.developer_id,
    developerName: row.developer_name ?? null,
    agentId: row.agent_id,
    harness: row.agent_harness ?? null,
    modelLabel: row.agent_model ?? null,
    branchId: row.branch_id,
    branchName: row.branch_name ?? null,
    branchHead: row.branch_head ?? null,
    branchDirty: row.branch_dirty === undefined ? null : Boolean(row.branch_dirty),
    // A task that has reached a terminal state is not the active task, however
    // recently it was. active_task_id is written with coalesce and is therefore
    // only ever set, never cleared, so a session goes on pointing at work that
    // finished. Every reader then reports a completed or cancelled task as the
    // thing to pick up next, and the session start hook tells a person to move
    // a cancelled task to in progress, which it can never do.
    //
    // Resolved on read rather than by clearing the column, so existing sessions
    // are correct immediately and no reader has to remember this rule.
    ...(TERMINAL_TASK.has(String(row.task_status ?? ""))
      ? { activeTaskId: null, activeTaskName: null, activeTaskStatus: null,
          lastTaskId: row.active_task_id, lastTaskName: row.task_name ?? null,
          lastTaskStatus: row.task_status ?? null }
      : { activeTaskId: row.active_task_id,
          activeTaskName: row.task_name ?? null,
          activeTaskStatus: row.task_status ?? null }),
    objective: row.objective,
    startedAt: row.started_at,
    lastActivityAt,
    endedAt: row.ended_at,
    outcome: row.outcome,
    handoff: row.handoff,
    nextAction: row.next_action,
    status: row.status,
    live: !row.ended_at && LIVE_STATUSES.includes(row.status),
    state: liveness(lastActivityAt, now, Boolean(row.ended_at)),
    idle: !row.ended_at && Boolean(lastActivityAt) && now - Date.parse(lastActivityAt) > IDLE_AFTER_MS,
  };
}
