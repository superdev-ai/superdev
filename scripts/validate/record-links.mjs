// Do the record-to-record links still point at records that exist?
//
// Several link tables are polymorphic: they carry a target_type and a target_id
// rather than a foreign key, because one column cannot reference six tables. A
// foreign key is what normally makes a dangling reference impossible, so these
// tables have no such protection and deleting a record leaves its links behind,
// silently, pointing at nothing.
//
// That is not hypothetical. Removing the data entities that were not database
// tables left 84 tasks linked to entity identifiers that no longer existed, and
// nothing reported it: the tasks still listed what they implemented, and the
// identifier resolved to nothing.

import { join } from "node:path";

import { ERROR, WARNING, finding } from "./common.mjs";

/**
 * The polymorphic link tables, and where each target_type resolves.
 *
 * A target_type missing from this map is reported rather than skipped, so
 * adding a new kind of target cannot quietly opt out of the check.
 */
const LINK_TABLES = {
  task_contract_links: "target_type",
  decision_links: "target_type",
  memory_links: "target_type",
  // discovery_links joins two discovery items directly, so it carries a real
  // foreign key on both ends and needs no check here.
};

/** Where a target_type name resolves. */
const TARGET_TABLES = {
  data_entity: "data_entities",
  feature: "features",
  module: "modules",
  workflow: "workflows",
  task: "tasks",
  goal: "goals",
  milestone: "milestones",
  decision: "decisions",
  surface: "surfaces",
  api_operation: "api_operations",
  acceptance_criterion: "feature_acceptance_criteria",
  nfr: "non_functional_requirements",
  workflow_step: "workflow_steps",
  runtime_component: "runtime_components",
  integration: "integrations",
  question: "open_questions",
  risk: "risks",
  document: "documents",
};

export const name = "record-links";

export async function run(root) {
  const findings = [];
  const { query } = await import(join(root, "src/db/store.mjs"));

  let result;
  try {
    result = await query(root, async (db) => {
      const present = new Set(
        (await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name),
      );
      const out = [];
      for (const [table, typeColumn] of Object.entries(LINK_TABLES)) {
        if (!present.has(table)) continue;
        const rows = await db.all(
          `SELECT ${typeColumn} AS target_type, target_id, COUNT(*) AS n
           FROM ${table} GROUP BY ${typeColumn}, target_id`,
        );
        for (const row of rows) {
          const targetTable = TARGET_TABLES[row.target_type];
          if (!targetTable) {
            out.push({ table, unknownType: row.target_type, n: row.n });
            continue;
          }
          if (!present.has(targetTable)) {
            out.push({ table, missingTable: targetTable, type: row.target_type, n: row.n });
            continue;
          }
          const hit = await db.get(
            `SELECT 1 AS ok FROM ${targetTable} WHERE id = ?`, row.target_id,
          );
          if (!hit) out.push({ table, dangling: row.target_id, type: row.target_type, n: row.n });
        }
      }
      return out;
    });
  } catch (error) {
    return {
      name,
      findings: [finding("record-links-unreadable", WARNING, ".superdev",
        `The project database could not be read, so record links were not checked: ${error.message}`)],
    };
  }

  // One finding per target, not per link row: ten tasks pointing at the same
  // deleted entity is one deletion to undo, not ten problems to read.
  // An unknown target type is one gap in this map however many rows use it,
  // so it collapses to a single finding rather than repeating per target.
  const unknown = new Map();
  for (const item of result) {
    if (!item.unknownType) continue;
    const key = `${item.table}/${item.unknownType}`;
    unknown.set(key, (unknown.get(key) ?? 0) + item.n);
  }
  for (const [key, n] of unknown) {
    const [table, type] = key.split("/");
    findings.push(finding("link-target-type-unknown", WARNING, "scripts/validate/record-links.mjs",
      `${table} has ${n} links to target type "${type}", which this validator does not know how to resolve. Add it to TARGET_TABLES or stop writing it.`));
  }

  for (const item of result) {
    if (item.unknownType) {
      continue;
    } else if (item.missingTable) {
      findings.push(finding("link-target-table-missing", ERROR, "src/db/migrations",
        `${item.table} links to ${item.type}, which resolves to the table ${item.missingTable} that does not exist.`));
    } else {
      findings.push(finding("link-target-missing", ERROR, ".superdev",
        `${item.table} has ${item.n} link${item.n === 1 ? "" : "s"} to ${item.dangling}, which no longer exists.`));
    }
  }
  return { name, findings };
}
