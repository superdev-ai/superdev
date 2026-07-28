// The only place `connect()` is called.
//
// The engine takes an exclusive process-level lock for a connection's whole
// lifetime and `connect()` fails immediately rather than waiting, so this module
// exposes exactly two entry points and never hands a live write connection to a
// caller: `read` (lock-free) and `write` (open, one transaction, close).
//
// See ADR-0014 for the measurements this design is built on.

import { connect } from "@tursodatabase/database";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const E = {
  LOCKED: "E_DB_LOCKED",
  VERSION_CONFLICT: "E_VERSION_CONFLICT",
  ENGINE_MISSING: "E_ENGINE_MISSING",
};

export class DbError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "DbError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

// Contention does not always say "lock". When this process already holds a
// readonly connection to the same file, the engine refuses the write with
// "Resource is read-only" at BEGIN IMMEDIATE rather than at open. That is a
// transient collision, not a permission fault, so it is retried like a lock.
const LOCK_RE = /lock|resource is read-?only|database is busy/i;
const isLockError = (err) => LOCK_RE.test(String(err?.message ?? ""));

// Bounded retry with jitter. The engine fails fast at 0 ms, so without this a
// write would lose any race instead of waiting out a 3 ms transaction.
const RETRY_ATTEMPTS = 60;
const RETRY_BASE_MS = 8;
const RETRY_MAX_MS = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Open for writing, retrying while the file is contended.
 *
 * `begin` opens the transaction inside the retry, because the engine can accept
 * the connection and only then refuse BEGIN IMMEDIATE. Retrying is safe: the
 * refusal lands before any statement of the transaction has run.
 */
async function openExclusive(file, { begin = false } = {}) {
  let last;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    let db;
    try {
      db = await connect(file);
      // Foreign key enforcement is per connection, so it is re-armed every time.
      for (const p of SESSION_PRAGMAS) await db.exec(p);
      if (begin) await db.exec("BEGIN IMMEDIATE");
      return db;
    } catch (err) {
      if (db) await db.close().catch(() => {});
      if (!isLockError(err)) throw err;
      last = err;
      const backoff = Math.min(RETRY_BASE_MS * 2 ** Math.floor(attempt / 6), RETRY_MAX_MS);
      await sleep(backoff / 2 + Math.random() * backoff);
    }
  }
  throw new DbError(
    E.LOCKED,
    "The project database is held by another Superdev process. Wait a moment and run the command again.",
    String(last?.message ?? ""),
  );
}

/**
 * Read the database without taking the write lock.
 *
 * The option name is lower-case `readonly`. `readOnly` is silently accepted by
 * the engine and takes the *write* path, which blocks. Asserted, not trusted.
 *
 * DO NOT CACHE OR POOL THE CONNECTION THIS OPENS.
 *
 * A readonly connection is pinned to the snapshot it saw when it opened. It
 * never observes another process's later commits: measured, a long-lived
 * readonly handle reported zero rows while a fresh one on the same file
 * reported two. Holding one open across requests would serve permanently stale
 * data and the staleness would be invisible, because every query still
 * succeeds. Opening per read costs 0.3 ms, which is why this is affordable and
 * why "optimizing" it into a pool is the one change that must never be made.
 */
export async function read(file, fn) {
  const db = await connect(file, { readonly: true });
  try {
    return await fn(wrap(db, file));
  } finally {
    await db.close().catch(() => {});
  }
}

/**
 * Run one transaction and close. The lock is held for the duration of `fn` only,
 * so `fn` must not await anything unrelated to the database.
 */
export async function write(file, fn) {
  mkdirSync(dirname(file), { recursive: true });
  const db = await openExclusive(file, { begin: true });
  const api = wrap(db, file);
  let began = true;
  try {
    const result = await fn(api);
    await db.exec("COMMIT");
    began = false;
    return result;
  } catch (err) {
    if (began) await db.exec("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await db.close().catch(() => {});
  }
}

/** Open exclusively without a transaction. For migrations and maintenance only. */
export async function writeRaw(file, fn) {
  mkdirSync(dirname(file), { recursive: true });
  const db = await openExclusive(file);
  try {
    return await fn(wrap(db, file));
  } finally {
    await db.close().catch(() => {});
  }
}

function wrap(db, file) {
  return {
    raw: db,
    /** Which database this handle is on, so caches keyed by table stay correct. */
    file,
    exec: (sql) => db.exec(sql),
    all: (sql, ...params) => db.prepare(sql).all(...params),
    get: (sql, ...params) => db.prepare(sql).get(...params),
    run: (sql, ...params) => db.prepare(sql).run(...params),
    /** A single scalar from the first column of the first row, or undefined. */
    async value(sql, ...params) {
      const row = await db.prepare(sql).get(...params);
      return row === undefined ? undefined : Object.values(row)[0];
    },
    /**
     * Update guarded by an optimistic version. Returns the new version.
     * A zero-row result means someone else moved the record, which is a
     * conflict and never a silent no-op.
     */
    async versionedUpdate(table, id, expectedVersion, assignments) {
      const sets = Object.keys(assignments).map((c) => `${c} = ?`).join(", ");
      const values = Object.values(assignments);
      const info = await db
        .prepare(
          `UPDATE ${table} SET ${sets}, version = version + 1
           WHERE id = ? AND version = ?`,
        )
        .run(...values, id, expectedVersion);
      if (!info.changes) {
        const current = await db.prepare(`SELECT version FROM ${table} WHERE id = ?`).get(id);
        throw new DbError(
          E.VERSION_CONFLICT,
          current === undefined
            ? `${table} ${id} does not exist.`
            : `${table} ${id} changed underneath this edit. It is now at version ${current.version}, this edit expected ${expectedVersion}.`,
          { table, id, expected: expectedVersion, actual: current?.version ?? null },
        );
      }
      return expectedVersion + 1;
    },
  };
}

/** Pragmas applied to a freshly created database. `mvcc` persists in the header. */
export const CREATE_PRAGMAS = [
  "PRAGMA journal_mode = mvcc",
  "PRAGMA foreign_keys = ON",
  "PRAGMA busy_timeout = 5000",
];

/** Pragmas re-applied on every connection. `foreign_keys` is per-connection. */
export const SESSION_PRAGMAS = ["PRAGMA foreign_keys = ON", "PRAGMA busy_timeout = 5000"];

export async function applySessionPragmas(api) {
  for (const p of SESSION_PRAGMAS) await api.exec(p);
}
