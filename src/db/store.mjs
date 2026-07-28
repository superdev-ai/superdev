// Repository layer. Every mutation goes through here so that four things are
// always true and never depend on a caller remembering: content is screened,
// history is appended, an activity event is recorded, and the record's version
// moves. Callers get rows, not SQL.

import { createHash } from "node:crypto";
import { join } from "node:path";
import { read, write, DbError, E as DBE } from "./connect.mjs";
import { migrate } from "./migrate.mjs";
import { nextId, tableFor, PREFIX } from "../model/ids.mjs";
import { assertRecordStorable } from "../model/screening.mjs";

export { DbError, DBE };

/** Everything Superdev writes lives under one git-ignored directory. */
export function paths(root) {
  const dir = join(root, ".superdev");
  return {
    dir,
    db: join(dir, "superdev.db"),
    backups: join(dir, "backups"),
    runtime: join(dir, "runtime"),
    exports: join(dir, "exports"),
  };
}

export async function ensureDatabase(root, { apply = true } = {}) {
  const p = paths(root);
  return migrate(p.db, { apply });
}

/** Read helper bound to a project root. Opens and closes; never pooled. */
export const query = (root, fn) => read(paths(root).db, fn);

/** Write helper bound to a project root. One transaction, then closed. */
export const mutate = (root, fn) => write(paths(root).db, fn);

// ------------------------------------------------------------------ project

export async function currentProject(db) {
  return db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
}

// ----------------------------------------------------------------- activity

const nowIso = () => new Date().toISOString();

/**
 * Append an activity event. The sequence is allocated inside the caller's
 * transaction, so it is gapless and ordered even with several writers, and the
 * hash chains each event to the one before it.
 */
export async function recordActivity(db, projectId, event) {
  const prev = await db.get(
    "SELECT sequence, immutable_hash FROM activity_events WHERE project_id = ? ORDER BY sequence DESC LIMIT 1",
    projectId,
  );
  const sequence = (prev?.sequence ?? 0) + 1;
  const id = await nextId(db, "activity_event");
  const created_at = event.createdAt ?? nowIso();
  const payload = {
    id,
    project_id: projectId,
    session_id: event.sessionId ?? null,
    actor_id: event.actorId ?? null,
    actor_label: event.actor ?? "superdev",
    task_id: event.taskId ?? null,
    feature_id: event.featureId ?? null,
    event_type: event.type,
    summary: event.summary,
    metadata_json: JSON.stringify(event.metadata ?? {}),
    created_at,
    sequence,
  };
  assertRecordStorable(payload);
  payload.immutable_hash = createHash("sha256")
    .update(String(prev?.immutable_hash ?? ""))
    .update(`${sequence}\u0000${payload.event_type}\u0000${payload.summary}\u0000${created_at}`)
    .digest("hex");

  const cols = Object.keys(payload);
  await db.run(
    `INSERT INTO activity_events (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    ...cols.map((c) => payload[c]),
  );
  return { id, sequence };
}

/** Append a status transition. Never revised, only added to. */
export async function recordStatusChange(db, projectId, recordType, recordId, from, to, opts = {}) {
  const prev = await db.get(
    "SELECT sequence FROM status_history WHERE record_type = ? AND record_id = ? ORDER BY sequence DESC LIMIT 1",
    recordType, recordId,
  );
  const id = await nextId(db, "status_history");
  await db.run(
    `INSERT INTO status_history
       (id, project_id, record_type, record_id, from_status, to_status, actor_label, note, created_at, sequence)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, projectId, recordType, recordId, from, to,
    opts.actor ?? "superdev", opts.note ?? null, opts.at ?? nowIso(), (prev?.sequence ?? 0) + 1,
  );
  return id;
}

// ------------------------------------------------------------------- writes

const AUTO = new Set(["created_at", "updated_at", "version"]);

/**
 * Turn a driver constraint failure into a sentence that names what broke.
 *
 * `FOREIGN KEY constraint failed` is the entire message the engine gives: no
 * table, no column, no value, no remedy. A reader got that single line, and
 * nothing else, when evidence was written against a goal success criterion, in a
 * product where every other refusal explains itself and names the fix. The
 * reference columns and their values are right here, so the diagnosis costs
 * nothing.
 *
 * That specific case is prevented by validating the target before writing. This is
 * the net underneath it, so the next one arrives as an explanation rather than as
 * driver noise.
 */
async function explain(table, row, write, db = null) {
  try {
    return await write();
  } catch (err) {
    const message = String(err?.message ?? "");
    // A CHECK failure arrives as the constraint's own SQL, truncated, with no column
    // named and no list of what would have been accepted. Two of these came back as
    // `('none', 'personal', 'financial', 'secret', 'regulated') (19)` and
    // `'system', 'job', 'external') (19)`, which name neither the column nor the
    // value that was rejected. The schema holds both, so they are read from it.
    if (/CHECK constraint failed|constraint failed:/i.test(message) && !/FOREIGN KEY/i.test(message)) {
      const allowed = db ? await enumeratedColumns(db, table).catch(() => new Map()) : new Map();
      const offending = [...(allowed ?? new Map())].filter(([column, values]) => {
        const value = row[column];
        return value !== null && value !== undefined && !values.includes(String(value));
      });
      if (offending.length) {
        throw new DbError(
          "E_NOT_ALLOWED",
          offending.map(([column, values]) =>
            `${table}.${column} does not accept ${JSON.stringify(String(row[column]))}. It is one of: ${values.join(", ")}.`,
          ).join(" "),
          { table, offending: offending.map(([column]) => column) },
        );
      }
    }
    if (/FOREIGN KEY constraint failed/i.test(message)) {
      const pointers = Object.entries(row)
        .filter(([key, value]) => key.endsWith("_id") && value !== null && value !== undefined)
        .map(([key, value]) => `${key}=${value}`);
      throw new DbError(
        "E_UNKNOWN_REFERENCE",
        `A row for ${table} points at a record that does not exist. One of these is wrong: ${
          pointers.join(", ") || "no reference column was set"
        }. Check that each identifier exists and is of the kind that column expects.`,
        { table, pointers },
      );
    }
    throw err;
  }
}

/**
 * Every column the schema pins to a fixed set, and the values it accepts.
 *
 * Read from the table's own definition, so a new enumerated column explains itself
 * without anybody adding it to a list here. The last list of this kind went stale.
 */
async function enumeratedColumns(db, table) {
  const sql = String(await db.value("SELECT sql FROM sqlite_master WHERE name = ?", table) ?? "");
  const found = new Map();
  for (const match of sql.matchAll(/(\w+)[^,]*?CHECK\s*\(\s*\w+\s+IN\s*\(([^)]*)\)/g)) {
    found.set(match[1], match[2].split(",").map((v) => v.trim().replace(/^'|'$/g, "")));
  }
  return found;
}

/**
 * Insert a record of `kind`. Mints the id, screens every field, stamps
 * timestamps, and records the creation as activity when the table has a
 * project.
 */
export async function create(db, kind, values, opts = {}) {
  const table = tableFor(kind);
  if (!table) throw new Error(`unknown record kind: ${kind}`);
  const columns = await columnsOf(db, table);
  const at = opts.at ?? nowIso();

  const row = { ...values };
  if (!row.id) row.id = await nextId(db, kind);
  if (columns.has("created_at") && !row.created_at) row.created_at = at;
  if (columns.has("updated_at") && !row.updated_at) row.updated_at = at;

  // A key that is not a column is a typo, and deleting it quietly is how a
  // field silently keeps its default while the caller believes it was written.
  const unknown = Object.keys(row).filter((key) => !columns.has(key));
  if (unknown.length) {
    throw new DbError(
      "E_UNKNOWN_COLUMN",
      `${table} has no column named ${unknown.join(", ")}. Check the spelling against the migration that defines the table.`,
      { table, unknown },
    );
  }
  assertRecordStorable(row);

  const cols = Object.keys(row);
  await explain(table, row, () => db.run(
    `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    ...cols.map((c) => row[c]),
  ), db);

  if (opts.projectId && opts.activity !== false) {
    await recordActivity(db, opts.projectId, {
      type: opts.activityType ?? "specification_changed",
      summary: opts.activitySummary ?? `Created ${kind.replace(/_/g, " ")} ${row.id}`,
      actor: opts.actor,
      sessionId: opts.sessionId,
      featureId: row.feature_id ?? opts.featureId ?? null,
      taskId: kind === "task" ? row.id : opts.taskId ?? null,
      metadata: { kind, id: row.id },
    });
  }
  return db.get(`SELECT * FROM ${table} WHERE id = ?`, row.id);
}

/**
 * Update a record under its optimistic version. A zero-row result means someone
 * else moved it, which surfaces as a conflict rather than a silent no-op.
 */
export async function patch(db, kind, id, expectedVersion, values, opts = {}) {
  const table = tableFor(kind);
  const columns = await columnsOf(db, table);
  const row = {};
  const unknown = [];
  for (const [k, v] of Object.entries(values)) {
    if (AUTO.has(k)) continue;
    if (!columns.has(k)) { unknown.push(k); continue; }
    row[k] = v;
  }
  if (unknown.length) {
    throw new DbError(
      "E_UNKNOWN_COLUMN",
      `${table} has no column named ${unknown.join(", ")}. Check the spelling against the migration that defines the table.`,
      { table, unknown },
    );
  }
  if (!Object.keys(row).length) return db.get(`SELECT * FROM ${table} WHERE id = ?`, id);
  assertRecordStorable(row);
  if (columns.has("updated_at")) row.updated_at = opts.at ?? nowIso();

  await db.versionedUpdate(table, id, expectedVersion, row);

  if (opts.projectId && opts.activity !== false) {
    await recordActivity(db, opts.projectId, {
      type: opts.activityType ?? "specification_changed",
      summary: opts.activitySummary ?? `Updated ${kind.replace(/_/g, " ")} ${id}`,
      actor: opts.actor,
      sessionId: opts.sessionId,
      metadata: { kind, id, fields: Object.keys(row).filter((k) => k !== "updated_at") },
    });
  }
  return db.get(`SELECT * FROM ${table} WHERE id = ?`, id);
}

/**
 * Move a record's status, appending history and activity. Status is never
 * changed through `patch`, so no transition can happen without a record of it.
 */
export async function setStatus(db, kind, id, toStatus, opts = {}) {
  const table = tableFor(kind);
  const before = await db.get(`SELECT * FROM ${table} WHERE id = ?`, id);
  if (!before) throw new DbError("E_NOT_FOUND", `${kind} ${id} does not exist.`);
  if (before.status === toStatus) return before;

  const assignments = { status: toStatus };
  const columns = await columnsOf(db, table);
  const at = opts.at ?? nowIso();
  if (columns.has("updated_at")) assignments.updated_at = at;

  // When a table keeps a column for the moment a status was reached, fill it.
  // This used to run only for tasks, so a feature could be accepted and leave
  // accepted_at null, and every reading built on that column counted zero: the
  // status report headline read "0 features accepted" while 35 were.
  const STAMP = {
    accepted: "accepted_at",
    complete: "completed_at",
    completed: "completed_at",
    cancelled: "cancelled_at",
    in_progress: "started_at",
  };
  const stamp = STAMP[toStatus];
  // started_at records the first start, so a task returning to in_progress
  // keeps the original. Every other stamp records the latest transition.
  if (stamp && columns.has(stamp) && !(stamp === "started_at" && before[stamp])) {
    assignments[stamp] = at;
  }

  if (kind === "task") {
    if (toStatus === "blocked") assignments.block_reason = opts.reason ?? before.block_reason ?? null;
    if (before.status === "blocked" && toStatus !== "blocked") assignments.block_reason = null;
  }

  await db.versionedUpdate(table, id, opts.expectedVersion ?? before.version, assignments);
  await recordStatusChange(db, opts.projectId ?? before.project_id, kind, id, before.status, toStatus, opts);

  const projectId = opts.projectId ?? before.project_id ?? null;
  if (projectId && opts.activity !== false) {
    await recordActivity(db, projectId, {
      type: opts.activityType ?? statusEventType(kind, toStatus),
      summary: opts.activitySummary ?? `${labelFor(kind)} ${id} moved to ${toStatus.replace(/_/g, " ")}`,
      actor: opts.actor,
      sessionId: opts.sessionId,
      taskId: kind === "task" ? id : null,
      featureId: kind === "feature" ? id : before.feature_id ?? null,
      metadata: { kind, id, from: before.status, to: toStatus, note: opts.note ?? null },
    });
  }
  return db.get(`SELECT * FROM ${table} WHERE id = ?`, id);
}

function statusEventType(kind, to) {
  if (kind !== "task") return "specification_changed";
  return {
    in_progress: "task_started",
    blocked: "task_blocked",
    complete: "task_completed",
    cancelled: "task_cancelled",
    ready: "task_updated",
  }[to] ?? "task_updated";
}

const labelFor = (kind) => kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ------------------------------------------------------------------ helpers

const columnCache = new Map();
async function columnsOf(db, table) {
  // Keyed by database as well as table: two roots at different schema versions
  // in one process would otherwise share a column set.
  const key = `${db.file ?? ""}\u0000${table}`;
  if (columnCache.has(key)) return columnCache.get(key);
  const info = await db.all(`PRAGMA table_info(${table})`);
  const set = new Set(info.map((c) => c.name));
  columnCache.set(key, set);
  return set;
}


export const json = (value, fallback = []) => {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/**
 * Walk a parent chain iteratively. This engine has no recursive CTEs, and task
 * and module trees are shallow enough that a few sub-millisecond reads beat any
 * materialized path that could fall out of step.
 */
export async function ancestors(db, table, id, parentColumn = "parent_task_id", limit = 32) {
  const chain = [];
  let current = id;
  for (let i = 0; i < limit && current; i++) {
    const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, current);
    if (!row) break;
    chain.push(row);
    current = row[parentColumn];
  }
  return chain;
}

/** Collect a whole subtree, breadth first, without recursion in SQL. */
export async function descendants(db, table, id, parentColumn = "parent_task_id", limit = 5000) {
  const out = [];
  let frontier = [id];
  const seen = new Set(frontier);
  while (frontier.length && out.length < limit) {
    const placeholders = frontier.map(() => "?").join(",");
    const rows = await db.all(`SELECT * FROM ${table} WHERE ${parentColumn} IN (${placeholders})`, ...frontier);
    if (!rows.length) break;
    frontier = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      frontier.push(row.id);
    }
  }
  return out;
}

export { PREFIX };
