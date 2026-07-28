// Migration validator.
//
// This one builds its artifact rather than reading one: it applies the whole
// ordered migration set forward into a throwaway database in a temp directory,
// proves the schema is intact and the guard triggers actually fire, and deletes
// it. Nothing is committed, nothing is simulated, and a passing run means the
// SQL in the repository really does produce the schema it claims to.
//
// It fails when there are no migrations. A migration validator that skips
// itself when the input is missing is how a broken schema ships.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { availableMigrations, migrate } from "../../src/db/migrate.mjs";
import { create, mutate, paths, query, setStatus } from "../../src/db/store.mjs";
import { ERROR, finding } from "./common.mjs";

export const name = "migrations";

const MIGRATIONS_PATH = "src/db/migrations";

/** Run a probe that must be refused, and say what the refusal proved. */
async function mustRefuse(tmpRoot, code, path, expectedCode, description, action) {
  try {
    await mutate(tmpRoot, action);
  } catch (err) {
    const message = String(err?.message ?? err);
    if (message.includes(expectedCode)) return null;
    return finding(code, ERROR, path,
      `${description} was refused with "${message}" rather than ${expectedCode}`);
  }
  return finding(code, ERROR, path, `${description} was allowed; ${expectedCode} did not fire`);
}

export async function run(root) {
  const findings = [];
  const dir = join(root, "src", "db", "migrations");
  const available = availableMigrations(dir);

  if (!available.length) {
    findings.push(finding("MG-000", ERROR, MIGRATIONS_PATH,
      "no migration files found; the schema cannot be applied or proven"));
    return { name, findings };
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "superdev-validate-migrations-"));
  try {
    const dbFile = paths(tmpRoot).db;

    // ------------------------------------------------- apply the full set forward
    let applied;
    try {
      applied = await migrate(dbFile, { apply: true, dir });
    } catch (err) {
      findings.push(finding("MG-001", ERROR, MIGRATIONS_PATH,
        `applying the migration set forward failed: ${String(err?.message ?? err)}`));
      return { name, findings };
    }

    if (applied.applied.length !== available.length) {
      findings.push(finding("MG-002", ERROR, MIGRATIONS_PATH,
        `${available.length} migration file(s) on disk but ${applied.applied.length} applied`));
    }

    // ------------------------------------------------------ integrity and keys
    const health = await query(tmpRoot, async (db) => {
      const out = {};
      try {
        out.integrity = await db.all("PRAGMA integrity_check");
      } catch (err) {
        out.integrityError = String(err?.message ?? err);
      }
      try {
        out.foreignKeys = await db.all("PRAGMA foreign_key_check");
      } catch (err) {
        out.foreignKeyError = String(err?.message ?? err);
      }
      out.bookkeeping = await db.all("SELECT version, name, checksum FROM applied_migrations ORDER BY version");
      return out;
    });

    if (health.integrityError) {
      findings.push(finding("MG-003", ERROR, MIGRATIONS_PATH, `integrity check could not run: ${health.integrityError}`));
    } else {
      const verdicts = (health.integrity ?? []).map((row) => String(Object.values(row)[0] ?? "")).filter(Boolean);
      const bad = verdicts.filter((v) => v.toLowerCase() !== "ok");
      if (!verdicts.length) findings.push(finding("MG-003", ERROR, MIGRATIONS_PATH, "integrity check returned nothing"));
      else if (bad.length) findings.push(finding("MG-003", ERROR, MIGRATIONS_PATH, `integrity check reported: ${bad.join("; ")}`));
    }

    if (health.foreignKeyError) {
      findings.push(finding("MG-004", ERROR, MIGRATIONS_PATH, `foreign key check could not run: ${health.foreignKeyError}`));
    } else if ((health.foreignKeys ?? []).length) {
      findings.push(finding("MG-004", ERROR, MIGRATIONS_PATH,
        `foreign key check reported ${health.foreignKeys.length} violation(s) in a freshly migrated database`));
    }

    // -------------------------------- applied list equals the checked-in files
    const onDisk = available.map((m) => `${m.version} ${m.name} ${m.checksum}`);
    const recorded = (health.bookkeeping ?? []).map((row) => `${row.version} ${row.name} ${row.checksum}`);
    if (onDisk.join("\n") !== recorded.join("\n")) {
      const missing = onDisk.filter((entry) => !recorded.includes(entry)).map((e) => e.split(" ")[1]);
      const extra = recorded.filter((entry) => !onDisk.includes(entry)).map((e) => e.split(" ")[1]);
      findings.push(finding("MG-005", ERROR, MIGRATIONS_PATH,
        `the applied migration list does not equal the migration files${missing.length ? `; not applied or altered: ${missing.join(", ")}` : ""}${extra.length ? `; applied but not on disk: ${extra.join(", ")}` : ""}`));
    }

    // ------------------------------------------------------- prove the triggers
    let taskId = null;
    try {
      taskId = await mutate(tmpRoot, async (db) => {
        const project = await create(db, "project", { name: "Validator probe", slug: "validator-probe" });
        const module = await create(db, "module", {
          project_id: project.id, name: "Probe module", slug: "probe-module",
        }, { projectId: project.id });
        const feature = await create(db, "feature", {
          project_id: project.id, module_id: module.id, name: "Probe feature", slug: "probe-feature",
        }, { projectId: project.id });
        const task = await create(db, "task", {
          project_id: project.id, feature_id: feature.id, name: "Probe task",
        }, { projectId: project.id });
        return task.id;
      });
    } catch (err) {
      findings.push(finding("MG-006", ERROR, MIGRATIONS_PATH,
        `the schema could not hold a minimal project, module, feature and task: ${String(err?.message ?? err)}`));
      return { name, findings };
    }

    // The append-only probes need a real row: a statement that matches nothing
    // never reaches the trigger and would pass without proving anything.
    const eventId = await query(tmpRoot, (db) =>
      db.value("SELECT id FROM activity_events ORDER BY sequence LIMIT 1"));
    if (!eventId) {
      findings.push(finding("MG-006", ERROR, MIGRATIONS_PATH,
        "creating records recorded no activity event, so the append-only triggers cannot be proven"));
      return { name, findings };
    }

    const refusals = [
      await mustRefuse(tmpRoot, "MG-007", MIGRATIONS_PATH, "E_TASK_WITHOUT_CONTRACT",
        "moving a task out of draft with no contract link",
        (db) => setStatus(db, "task", taskId, "ready")),
      await mustRefuse(tmpRoot, "MG-008", MIGRATIONS_PATH, "E_APPEND_ONLY",
        "updating an activity event",
        (db) => db.run("UPDATE activity_events SET summary = ? WHERE id = ?", "rewritten", eventId)),
      await mustRefuse(tmpRoot, "MG-009", MIGRATIONS_PATH, "E_APPEND_ONLY",
        "deleting an activity event",
        (db) => db.run("DELETE FROM activity_events WHERE id = ?", eventId)),
    ];
    findings.push(...refusals.filter(Boolean));

    // The constraint has to permit the mapped case too, or "always refuses" would
    // read as "correctly refuses".
    try {
      await mutate(tmpRoot, async (db) => {
        await db.run(
          "INSERT INTO task_contract_links (task_id, target_type, target_id, relationship) VALUES (?,?,?,?)",
          taskId, "acceptance_criterion", "AC-0001", "implements",
        );
        await setStatus(db, "task", taskId, "ready");
      });
    } catch (err) {
      findings.push(finding("MG-010", ERROR, MIGRATIONS_PATH,
        `a task with a contract link could not leave draft: ${String(err?.message ?? err)}`));
    }

    // Only meaningful once a transition exists; a missing one is already MG-010.
    const historyId = await query(tmpRoot, (db) =>
      db.value("SELECT id FROM status_history ORDER BY id LIMIT 1"));
    if (historyId) {
      const historyRefusal = await mustRefuse(tmpRoot, "MG-011", MIGRATIONS_PATH, "E_APPEND_ONLY",
        "deleting a status transition",
        (db) => db.run("DELETE FROM status_history WHERE id = ?", historyId));
      if (historyRefusal) findings.push(historyRefusal);
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
    if (existsSync(tmpRoot)) {
      findings.push(finding("MG-012", ERROR, MIGRATIONS_PATH,
        "the throwaway database directory could not be removed"));
    }
  }

  return { name, findings };
}
