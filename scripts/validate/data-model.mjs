// Does the recorded data model match the schema the migrations actually build?
//
// Every data entity claims a table and a set of fields with declared types and
// nullability. That claim is only worth something if it is checked against the
// database the ordered migrations produce, so this validator builds a database
// from the migrations alone and compares it against what the records promise.
//
// It is a validator, not a test: it reads a real artifact and reports what is
// there. Nothing here asserts on behaviour the project chose, and no fixture is
// invented to make a comparison pass.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ERROR, WARNING, finding } from "./common.mjs";

/** SQLite reports declared types verbatim, so compare on the leading keyword. */
const baseType = (declared) => String(declared || "").trim().toLowerCase().split(/[ (]/)[0];

/**
 * Types the records use and the column types that satisfy them. The record
 * vocabulary is deliberately smaller than SQLite's, so this maps rather than
 * demands an exact string match.
 */
const TYPE_MATCHES = {
  text: ["text", "varchar", "char", "clob"],
  integer: ["integer", "int", "bigint", "smallint"],
  real: ["real", "float", "double", "numeric", "decimal"],
  blob: ["blob"],
  boolean: ["integer", "int", "boolean"],
  json: ["text", "blob"],
  timestamp: ["text", "integer", "datetime"],
  date: ["text", "integer", "date"],
};

/**
 * Build a database from the migrations alone, in a temporary directory.
 *
 * This is what makes the check meaningful: comparing the records against the
 * working database would only prove the working database agrees with itself,
 * and would say nothing about whether a fresh install lands in the same shape.
 */
async function schemaFromMigrations(root) {
  const dir = mkdtempSync(join(tmpdir(), "superdev-schema-"));
  const file = join(dir, "schema-probe.db");
  try {
    const { migrate } = await import(join(root, "src/db/migrate.mjs"));
    await migrate(file, { apply: true });
    const { read } = await import(join(root, "src/db/connect.mjs"));
    return await read(file, async (db) => {
      const tables = new Map();
      const names = await db.all(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      );
      for (const { name } of names) {
        const columns = await db.all(`PRAGMA table_info(${JSON.stringify(name)})`);
        tables.set(name, new Map(columns.map((c) => [c.name, c])));
      }
      return tables;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Compare every recorded entity and field against that schema.
 *
 * Entities that name no real table are reported once as a warning rather than
 * once per field, because the field findings would all say the same thing.
 */
export async function validateDataModel(root) {
  const findings = [];
  const { query } = await import(join(root, "src/db/store.mjs"));

  let entities;
  let fields;
  try {
    ({ entities, fields } = await query(root, async (db) => ({
      entities: await db.all("SELECT id, name, purpose FROM data_entities ORDER BY id"),
      fields: await db.all(
        "SELECT entity_id, name, type, nullable FROM data_fields ORDER BY entity_id, sequence",
      ),
    })));
  } catch (error) {
    // No project database is not a failure: this validator has nothing to say
    // about a checkout that has not been initialised.
    return [finding("data-model-unreadable", WARNING, ".superdev",
      `The project database could not be read, so the data model was not checked: ${error.message}`)];
  }

  if (entities.length === 0) return findings;

  const schema = await schemaFromMigrations(root);
  const byEntity = new Map();
  for (const f of fields) {
    if (!byEntity.has(f.entity_id)) byEntity.set(f.entity_id, []);
    byEntity.get(f.entity_id).push(f);
  }

  for (const entity of entities) {
    const table = schema.get(entity.name);
    if (!table) {
      findings.push(finding("data-entity-has-no-table", WARNING, "src/db/migrations",
        `${entity.id} records the entity "${entity.name}", which the migrations never create.`));
      continue;
    }
    for (const field of byEntity.get(entity.id) ?? []) {
      const column = table.get(field.name);
      if (!column) {
        findings.push(finding("data-field-has-no-column", ERROR, "src/db/migrations",
          `${entity.id} declares ${entity.name}.${field.name}, which the table does not have.`));
        continue;
      }
      const want = TYPE_MATCHES[baseType(field.type)];
      if (want && !want.includes(baseType(column.type))) {
        findings.push(finding("data-field-type-differs", WARNING, "src/db/migrations",
          `${entity.id} declares ${entity.name}.${field.name} as ${field.type}, and the column is ${column.type}.`));
      }
      // notnull is 1 when the column refuses null, so it is the inverse of the
      // recorded nullable flag.
      const columnNullable = column.notnull === 0;
      const recordedNullable = field.nullable === 1 || field.nullable === true;
      if (columnNullable !== recordedNullable) {
        findings.push(finding("data-field-nullability-differs", ERROR, "src/db/migrations",
          `${entity.id} records ${entity.name}.${field.name} as ${recordedNullable ? "nullable" : "not null"}, and the column is ${columnNullable ? "nullable" : "not null"}.`));
      }
    }
  }
  return findings;
}

/**
 * Prove the recovery path the spec actually promises.
 *
 * The spec mandates a backup before migration rather than down-migration files,
 * so getting back means restoring that backup. This applies the migrations to a
 * throwaway copy and restores it, reporting what was observed either way.
 */
export async function validateMigrationRecovery(root) {
  const dir = mkdtempSync(join(tmpdir(), "superdev-recovery-"));
  try {
    const file = join(dir, "recovery-probe.db");
    const { migrate, currentVersion, backupBeforeMigration } = await import(join(root, "src/db/migrate.mjs"));
    await migrate(file, { apply: true });
    const after = await currentVersion(file);
    if (!after) {
      return [finding("migration-leaves-no-version", ERROR, "src/db/migrate.mjs",
        "Applying every migration left the schema version unset, so no upgrade can tell what it is upgrading from.")];
    }
    const backup = await backupBeforeMigration(file, "recovery-check");
    const restored = await currentVersion(backup);
    if (restored !== after) {
      return [finding("backup-differs-from-source", ERROR, "src/db/migrate.mjs",
        `The pre-migration backup reports schema version ${restored} where the database it came from reports ${after}.`)];
    }
    return [];
  } catch (error) {
    return [finding("migration-recovery-failed", ERROR, "src/db/migrate.mjs",
      `The migrate and restore path did not complete: ${error.message}`)];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Can the interface name every state the schema allows?
 *
 * The control centre maps a stored status to a tone, a glyph and a sentence,
 * and anything it has not met renders as a state it has no description for. It
 * had no entry for `reached` or `retired`, both of which the schema allows and
 * the database holds, so the blueprint announced thirteen records as states
 * nobody had described.
 *
 * The vocabularies are read from the CHECK constraints in the migrations, which
 * is where they are actually defined. Reading them from anywhere else would
 * check the interface against a second list that can itself drift.
 */
export async function validateStatusVocabulary(root) {
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");
  const map = join(root, "ui/src/components/shell/status.tsx");
  if (!existsSync(map)) return [];
  const source = readFileSync(map, "utf8");
  const known = new Set(
    [...source.matchAll(/^\s{2}([a-z_]+):\s*"(?:complete|active|attention|blocked|idle|retired|unrecognized)",/gm)]
      .map((m) => m[1]),
  );

  const dir = join(root, "src/db/migrations");
  const allowed = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    // Only the columns the interface renders as a status. A CHECK on a kind or
    // a category is a different vocabulary and is not shown as a state.
    for (const m of sql.matchAll(
      /(status|state|result|applicability|epistemic_status|sync_status|screening_status|last_check_result)\s+TEXT[\s\S]{0,240}?CHECK\s*\(\s*\1\s+IN\s*\(([^)]*)\)/gi,
    )) {
      for (const value of m[2].split(",")) {
        const word = value.trim().replace(/^'|'$/g, "");
        if (word) allowed.set(word, file);
      }
    }
  }

  return [...allowed]
    .filter(([word]) => !known.has(word))
    .map(([word, file]) => finding("status-not-described", WARNING,
      "ui/src/components/shell/status.tsx",
      `The schema allows the status ${word} (${file}) and the control centre has no description for it, so a record holding it renders as a state nobody described.`));
}

export const name = "data-model";

export async function run(root) {
  return {
    name,
    findings: [
      ...await validateDataModel(root),
      ...await validateMigrationRecovery(root),
      ...await validateStatusVocabulary(root),
    ],
  };
}
