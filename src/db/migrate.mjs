// Ordered migrations. Schema changes only ever arrive as a numbered file that
// runs exactly once, in order, inside a transaction, after a backup.
// Schema push is not a workflow here.

import { readdirSync, readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeRaw, read, CREATE_PRAGMAS } from "./connect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, "migrations");

const BOOKKEEPING = `
CREATE TABLE IF NOT EXISTS applied_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  checksum   TEXT NOT NULL,
  applied_at TEXT NOT NULL
);`;

export function availableMigrations(dir = MIGRATIONS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = readFileSync(join(dir, file), "utf8");
      return {
        version: Number(file.slice(0, 3)),
        name: file,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    });
}

/**
 * Split a migration file into statements. The engine executes one statement per
 * exec call, and a naive split on ";" would cut triggers in half, so BEGIN/END
 * blocks are tracked.
 */
export function splitStatements(sql) {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  const out = [];
  let buf = "";
  let depth = 0;
  for (const rawLine of withoutComments.split("\n")) {
    const line = rawLine;
    buf += line + "\n";
    if (/\bBEGIN\b/i.test(line) && /CREATE\s+TRIGGER/i.test(buf)) depth = 1;
    if (depth === 1 && /\bEND\s*;/i.test(line)) {
      out.push(buf.trim());
      buf = "";
      depth = 0;
      continue;
    }
    if (depth === 0 && /;\s*$/.test(line.trim())) {
      const stmt = buf.trim();
      if (stmt.replace(/;/g, "").trim()) out.push(stmt);
      buf = "";
    }
  }
  if (buf.trim().replace(/;/g, "").trim()) out.push(buf.trim());
  return out;
}

export async function currentVersion(file) {
  if (!existsSync(file)) return 0;
  return read(file, async (db) => {
    const row = await db.get("PRAGMA user_version");
    return row?.user_version ?? 0;
  });
}

export async function pendingMigrations(file, dir = MIGRATIONS_DIR) {
  const at = await currentVersion(file);
  return availableMigrations(dir).filter((m) => m.version > at);
}

/**
 * Copy the database aside before a schema change. Recovery, not a record.
 *
 * This must be VACUUM INTO, not copyFileSync. Under journal_mode=mvcc the rows
 * live in the `superdev.db-log` sidecar until checkpoint, so copying
 * `superdev.db` alone yields an 8 KB header that holds no data and that the
 * engine refuses to open. VACUUM INTO writes one self-contained file under an
 * exclusive lock, so it cannot tear against a writer.
 */
export async function backupBeforeMigration(file, label = "migration") {
  if (!existsSync(file)) return null;
  const dir = join(dirname(file), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(dir, `${label}-${stamp}.db`);
  rmSync(target, { force: true }); // VACUUM INTO refuses to write over a file
  await writeRaw(file, (db) => db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`));
  return target;
}

/**
 * Apply every pending migration. Returns what ran, or what would run when
 * `apply` is false.
 */
export async function migrate(file, { apply = false, dir = MIGRATIONS_DIR } = {}) {
  const fresh = !existsSync(file);
  const pending = fresh ? availableMigrations(dir) : await pendingMigrations(file, dir);
  if (!pending.length) {
    return { applied: [], pending: [], from: await currentVersion(file), to: await currentVersion(file), backup: null };
  }
  if (!apply) {
    const from = fresh ? 0 : await currentVersion(file);
    return {
      applied: [],
      pending: pending.map((m) => ({ version: m.version, name: m.name, statements: splitStatements(m.sql).length })),
      from,
      to: pending[pending.length - 1].version,
      backup: null,
    };
  }

  // Read where we actually started, before anything moves it. Deriving it from
  // the first pending migration assumes the numbering has no gaps, so a database
  // at 3 with 5 pending would report having come from 4, a version it was never
  // at. The dry run above reads it; the run that actually changes the database
  // has more reason to be right, not less.
  const from = fresh ? 0 : await currentVersion(file);

  const backup = fresh ? null : await backupBeforeMigration(file);
  const applied = [];

  await writeRaw(file, async (db) => {
    if (fresh) for (const p of CREATE_PRAGMAS) await db.exec(p);
    await db.exec(BOOKKEEPING.trim());
    for (const m of pending) {
      await db.exec("BEGIN IMMEDIATE");
      try {
        for (const stmt of splitStatements(m.sql)) await db.exec(stmt);
        await db.run(
          "INSERT INTO applied_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
          m.version, m.name, m.checksum, new Date().toISOString(),
        );
        await db.exec(`PRAGMA user_version = ${m.version}`);
        await db.exec("COMMIT");
        applied.push({ version: m.version, name: m.name });
      } catch (err) {
        await db.exec("ROLLBACK").catch(() => {});
        err.message = `migration ${m.name} failed: ${err.message}`;
        throw err;
      }
    }
  });

  return { applied, pending: [], from, to: applied.at(-1)?.version ?? 0, backup };
}

/** Structural report used by the migration validator and `superdev db status`. */
export async function inspect(file, dir = MIGRATIONS_DIR) {
  const available = availableMigrations(dir);
  const exists = existsSync(file);
  const at = exists ? await currentVersion(file) : 0;
  const drift = [];
  if (exists) {
    const rows = await read(file, async (db) => {
      try {
        return await db.all("SELECT version, name, checksum FROM applied_migrations ORDER BY version");
      } catch {
        return [];
      }
    });
    for (const row of rows) {
      const known = available.find((m) => m.version === row.version);
      if (!known) drift.push({ version: row.version, problem: "applied migration is not in the migration directory" });
      else if (known.checksum !== row.checksum) drift.push({ version: row.version, problem: "migration file changed after it was applied" });
    }
  }
  return {
    databaseExists: exists,
    version: at,
    latest: available.at(-1)?.version ?? 0,
    available: available.map((m) => ({ version: m.version, name: m.name })),
    pending: available.filter((m) => m.version > at).map((m) => ({ version: m.version, name: m.name })),
    drift,
  };
}
