// Database maintenance: integrity, backups, restore, and portable export.
//
// Two engine facts shape this whole file, both measured against the bundled
// engine rather than assumed from SQLite:
//
//   1. With `journal_mode = mvcc` the committed data lives in the sidecar
//      `superdev.db-log` until a checkpoint. A freshly migrated project has an
//      8 KB `superdev.db` and a 90 KB log, so copying the main file alone
//      produces a backup with no data in it. Backups are taken with
//      `VACUUM INTO`, which writes one self-contained file under the exclusive
//      lock, so it can neither miss the log nor tear against a live writer.
//   2. The engine refuses to open a database whose sidecar files are missing,
//      even when they would be empty. Restoring therefore recreates them empty
//      rather than leaving the replaced database's log in place.
//
// Import and hydrate write rows with plain SQL instead of the repository
// helpers. That is deliberate and is the one place it is correct: restoring a
// snapshot must reproduce the exact ids, versions, hash chain and timestamps
// that were exported. Routing it through `create` would mint new ids and append
// a second set of activity events, which is the opposite of a restore.

import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { paths, ensureDatabase, query, mutate, currentProject, DbError } from "./store.mjs";
import { writeRaw } from "./connect.mjs";
import { inspect } from "./migrate.mjs";
import { assertNoLiveService } from "../service/manage.mjs";
import { slugify } from "../model/ids.mjs";

export const E = {
  NO_DATABASE: "E_NO_DATABASE",
  NO_BACKUP: "E_NO_BACKUP",
  BAD_EXPORT: "E_BAD_EXPORT",
  PROJECT_MISMATCH: "E_PROJECT_MISMATCH",
  SCHEMA_AHEAD: "E_SCHEMA_AHEAD",
  NOT_EMPTY: "E_NOT_EMPTY",
};

/** Format tag on every export header. A reader that does not know it refuses. */
export const EXPORT_FORMAT = "superdev-export-v1";

/** How many backups survive. Older ones are deleted as new ones are taken. */
export const KEEP_BACKUPS = 10;

// Files the engine keeps beside the database. Recreated empty on restore.
const SIDECARS = ["-log", "-wal"];

const stamp = (iso) => iso.replace(/[:.]/g, "-");

const missingDatabase = () =>
  new DbError(E.NO_DATABASE, "This project has no Superdev database yet. Run the init command first.");

/**
 * User tables in creation order.
 *
 * Creation order, not alphabetical: it is just as deterministic and it puts
 * parents before children, so a straight replay of the export satisfies the
 * foreign keys. `applied_migrations` is included on purpose, so a hydrated
 * database knows which schema version it is at.
 */
async function tableNames(db) {
  const rows = await db.all("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY rowid");
  return rows.map((r) => r.name).filter((n) => !internal(n));
}

const internal = (name) =>
  name.startsWith("sqlite_") || name.startsWith("__") || name.toLowerCase().includes("turso_internal");

// ------------------------------------------------------------------ integrity

/**
 * Structural health of the project database. Run before status output and
 * before anything that rewrites the file.
 *
 * `ok` covers what silently corrupts a project: page corruption, dangling
 * foreign keys, and migration drift. A pending migration is reported under
 * `migrations` but does not make the database unhealthy, it makes it behind.
 */
export async function integrityCheck(root) {
  const p = paths(root);
  if (!existsSync(p.db)) throw missingDatabase();
  const migrations = await inspect(p.db);

  return query(root, async (db) => {
    const integrity = (await db.all("PRAGMA integrity_check")).map((row) => String(Object.values(row)[0]));
    const foreignKeys = await db.all("PRAGMA foreign_key_check");
    const counts = {};
    for (const table of await tableNames(db)) {
      counts[table] = Number(await db.value(`SELECT count(*) FROM ${table}`));
    }
    const ok =
      integrity.length === 1 && integrity[0] === "ok" &&
      foreignKeys.length === 0 &&
      migrations.drift.length === 0;
    return { ok, integrity, foreignKeys, migrations, counts };
  });
}

// -------------------------------------------------------------------- backups

/**
 * Snapshot the database into `.superdev/backups/` and prune to the newest ten.
 * Cheap enough to run at session handoff and before every destructive command.
 */
export async function backup(root, label = "manual") {
  const p = paths(root);
  if (!existsSync(p.db)) throw missingDatabase();
  mkdirSync(p.backups, { recursive: true });

  const at = new Date().toISOString();
  const path = join(p.backups, `${slugify(label, "backup")}-${stamp(at)}.db`);
  rmSync(path, { force: true }); // VACUUM INTO refuses to write over a file

  await writeRaw(p.db, (db) => db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`));

  for (const old of (await listBackups(root)).slice(KEEP_BACKUPS)) rmSync(old.path, { force: true });
  return { path, bytes: statSync(path).size, at };
}

/** Backups newest first. The name stamp breaks ties within the same second. */
export async function listBackups(root) {
  const dir = paths(root).backups;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => {
      const path = join(dir, name);
      const info = statSync(path);
      return {
        name,
        path,
        label: name.replace(/-\d{4}-\d{2}-\d{2}T.*$/, ""),
        bytes: info.size,
        at: info.mtime.toISOString(),
      };
    })
    .sort((a, b) => (a.at === b.at ? b.name.localeCompare(a.name) : b.at.localeCompare(a.at)));
}

/**
 * Replace the project database with a backup. The current database is backed up
 * first, so a restore from the wrong file is itself recoverable; that safety
 * copy is also why the backup is not validated before it is put in place.
 */
export async function restore(root, backupPath, { apply = false } = {}) {
  // The control centre holds this exact file open. Replacing it underneath a
  // live process, and blanking the sidecar the engine is using, is how a restore
  // corrupts the thing it was meant to rescue.
  if (apply) await assertNoLiveService(root);
  const p = paths(root);
  // A bare name is resolved against the backups directory, because that is what
  // every command prints. `db backup` reports the name it wrote and `db status`
  // lists them by name, and passing one of those names back produced "there is
  // no backup file named ..." for a file sitting exactly where it was left. The
  // path was being resolved against the working directory instead.
  const named = basename(backupPath) === backupPath ? join(p.backups, backupPath) : null;
  const from = named && existsSync(named) ? named : resolve(backupPath);
  if (!existsSync(from)) {
    const known = (await listBackups(root)).slice(0, 5).map((b) => b.name);
    throw new DbError(E.NO_BACKUP, known.length
      ? `There is no backup file named ${basename(from)}. The most recent are: ${known.join(", ")}.`
      : `There is no backup file named ${basename(from)}, and no backup has been taken yet.`);
  }

  const replaces = existsSync(p.db);
  const plan = {
    from,
    to: p.db,
    bytes: statSync(from).size,
    replaces,
    backsUpCurrent: replaces,
  };
  if (!apply) return { applied: false, plan, safetyBackup: null };

  const safetyBackup = replaces ? await backup(root, "pre-restore") : null;
  mkdirSync(p.dir, { recursive: true });
  copyFileSync(from, p.db);
  resetSidecars(p.db);
  return { applied: true, plan, safetyBackup };
}

/** A VACUUM INTO snapshot carries everything, so any leftover log must go. */
function resetSidecars(dbFile) {
  for (const suffix of SIDECARS) writeFileSync(dbFile + suffix, "");
}

// --------------------------------------------------------------------- export

// SQLite values that JSON cannot carry on its own. Blobs (the memory embedding
// vectors) survive as base64, big integers as decimal strings.
const encodeValue = (v) => {
  if (v instanceof Uint8Array) return { $blob: Buffer.from(v).toString("base64") };
  if (typeof v === "bigint") return { $int: v.toString() };
  return v;
};

const decodeValue = (v) => {
  if (v && typeof v === "object") {
    if (typeof v.$blob === "string") return Buffer.from(v.$blob, "base64");
    if (typeof v.$int === "string") return Number(v.$int);
  }
  return v;
};

/**
 * Write a portable JSONL snapshot: one header line, then one `{table, row}` line
 * per row in table creation order and rowid order within a table. Two exports of
 * an unchanged database differ only in the header timestamp.
 */
export async function exportProject(root, { out } = {}) {
  const p = paths(root);
  if (!existsSync(p.db)) throw missingDatabase();
  const at = new Date().toISOString();

  const snapshot = await query(root, async (db) => {
    const project = await currentProject(db);
    const schemaVersion = Number(await db.value("PRAGMA user_version"));
    const lines = [];
    const tables = [];
    for (const table of await tableNames(db)) {
      const rows = await db.all(`SELECT * FROM ${table} ORDER BY rowid`);
      for (const row of rows) {
        const clean = {};
        for (const [k, v] of Object.entries(row)) clean[k] = encodeValue(v);
        lines.push(JSON.stringify({ table, row: clean }));
      }
      tables.push({ table, rows: rows.length });
    }
    return { project, schemaVersion, lines, tables };
  });

  const header = {
    format: EXPORT_FORMAT,
    schemaVersion: snapshot.schemaVersion,
    project: snapshot.project
      ? { id: snapshot.project.id, name: snapshot.project.name, slug: snapshot.project.slug }
      : null,
    at,
    tables: snapshot.tables,
  };

  const path = resolve(
    out ?? join(p.exports, `${snapshot.project?.slug ?? "project"}-${stamp(at)}.jsonl`),
  );
  mkdirSync(dirname(path), { recursive: true });
  // ponytail: the whole snapshot is built in memory. A project database is
  // thousands of rows, not millions; stream it if that ever stops being true.
  writeFileSync(path, [JSON.stringify(header), ...snapshot.lines].join("\n") + "\n");

  return {
    path,
    bytes: statSync(path).size,
    at,
    rows: snapshot.lines.length,
    tables: snapshot.tables,
  };
}

// --------------------------------------------------------------------- import

/** Parse and validate an export file. Groups rows by table, keeping file order. */
function readExport(file) {
  const path = resolve(file);
  if (!existsSync(path)) throw new DbError(E.BAD_EXPORT, `There is no export file at ${basename(path)}.`);
  const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.trim());
  if (!lines.length) throw new DbError(E.BAD_EXPORT, "That export file is empty.");

  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    throw new DbError(E.BAD_EXPORT, "The first line of that file is not a Superdev export header.");
  }
  if (header?.format !== EXPORT_FORMAT) {
    throw new DbError(E.BAD_EXPORT, `That file is not a ${EXPORT_FORMAT} export.`);
  }
  if (!Number.isInteger(header.schemaVersion)) {
    throw new DbError(E.BAD_EXPORT, "The export header has no schema version, so it cannot be checked against this database.");
  }
  if (!header.project?.id) {
    throw new DbError(E.BAD_EXPORT, "The export header names no project, so it cannot be matched against this database.");
  }

  const byTable = new Map();
  for (let i = 1; i < lines.length; i++) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      throw new DbError(E.BAD_EXPORT, `Line ${i + 1} of the export is not valid JSON.`);
    }
    if (!entry?.table || !entry.row || typeof entry.row !== "object") {
      throw new DbError(E.BAD_EXPORT, `Line ${i + 1} of the export is not a {table, row} record.`);
    }
    const row = {};
    for (const [k, v] of Object.entries(entry.row)) row[k] = decodeValue(v);
    if (!byTable.has(entry.table)) byTable.set(entry.table, []);
    byTable.get(entry.table).push(row);
  }
  return { path, header, byTable };
}

/**
 * Load an export into an existing database, in one transaction.
 *
 * Rows are inserted, never overwritten: a row whose primary key is already there
 * is left alone. That keeps the import idempotent, keeps it off the append-only
 * history tables, and means a local edit is never silently replaced by a
 * snapshot. Replacing a database wholesale is what `restore` is for.
 */
export async function importProject(root, file, { apply = false } = {}) {
  // Bulk inserts across sixty tables while the control centre reads from a
  // pinned snapshot means the interface shows a half arrived project and calls
  // it current. The import is transactional, so nothing is corrupted; what is
  // wrong is answering with a state nobody chose to be in.
  if (apply) await assertNoLiveService(root);
  const p = paths(root);
  if (!existsSync(p.db)) {
    throw new DbError(
      E.NO_DATABASE,
      "This project has no database to import into. Use hydrate to build one from an export.",
    );
  }
  const { header, byTable } = readExport(file);

  const current = await query(root, async (db) => ({
    schemaVersion: Number(await db.value("PRAGMA user_version")),
    projects: await db.all("SELECT id FROM projects"),
    tables: new Set(await tableNames(db)),
  }));

  if (header.schemaVersion > current.schemaVersion) {
    throw new DbError(
      E.SCHEMA_AHEAD,
      `The export is at schema version ${header.schemaVersion} and this database is at ${current.schemaVersion}. Migrate the database first.`,
    );
  }
  if (current.projects.length && !current.projects.some((r) => r.id === header.project.id)) {
    const here = current.projects.map((r) => r.id).join(", ");
    throw new DbError(
      E.PROJECT_MISMATCH,
      `This database already holds ${here} and the export holds ${header.project.id}. ` +
        "Import only into an empty database or into the same project.",
    );
  }

  const known = [...byTable.keys()].filter((t) => current.tables.has(t));
  const skipped = [...byTable.keys()].filter((t) => !current.tables.has(t));
  const plan = {
    project: header.project,
    schemaVersion: header.schemaVersion,
    into: current.projects.length ? "existing project" : "empty database",
    tables: known.map((table) => ({ table, rows: byTable.get(table).length })),
    skipped,
  };
  if (!apply) return { applied: false, plan, tables: [], rows: 0, inserted: 0, skipped };

  const tables = await mutate(root, async (db) => {
    // The export replays parents before children, but an export written by a
    // different schema version need not, and deferring costs nothing.
    await db.exec("PRAGMA defer_foreign_keys = ON");
    const out = [];
    for (const table of known) {
      const columns = new Set((await db.all(`PRAGMA table_info(${table})`)).map((c) => c.name));
      let inserted = 0;
      let present = 0;
      for (const row of byTable.get(table)) {
        const keys = Object.keys(row).filter((k) => columns.has(k));
        const info = await db.run(
          `INSERT OR IGNORE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
          ...keys.map((k) => row[k]),
        );
        if (info.changes) inserted++;
        else present++;
      }
      out.push({ table, rows: byTable.get(table).length, inserted, present });
    }
    return out;
  });

  return {
    applied: true,
    plan,
    project: header.project,
    tables,
    rows: tables.reduce((n, t) => n + t.rows, 0),
    inserted: tables.reduce((n, t) => n + t.inserted, 0),
    skipped,
  };
}

/**
 * Build a project database from an export. Refuses to touch an existing one, and
 * removes the database it created if the import fails, so a retry still sees an
 * empty project rather than a half-built one.
 */
export async function hydrate(root, file) {
  const p = paths(root);
  if (existsSync(p.db)) {
    throw new DbError(
      E.NOT_EMPTY,
      "This project already has a database. Move .superdev aside first, or restore from a backup instead.",
    );
  }
  readExport(file); // fail before creating anything if the file is not an export

  const migrations = await ensureDatabase(root, { apply: true });
  try {
    const result = await importProject(root, file, { apply: true });
    return { ...result, created: true, migrations };
  } catch (err) {
    rmSync(p.db, { force: true });
    for (const suffix of SIDECARS) rmSync(p.db + suffix, { force: true });
    throw err;
  }
}
