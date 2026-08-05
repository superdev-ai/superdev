// A record type the product asks for must be one the product can write.
//
// Eleven of them were not. Surfaces, workflows and their steps, data entities, API
// operations and services, integrations, non-functional requirements, state
// machines, test plans, schema migrations and glossary terms could all be read,
// rendered in the control centre, derived from and reported on, and nothing in the
// product could create any of them.
//
// The consequence was not visible from any one place, which is why it survived so
// long. `standard` spec depth requires surfaces, an API or a data entity, a
// workflow and an observability requirement, so any feature declared at standard or
// full depth could never be accepted: the refusal said "Record them, or lower the
// depth", and recording them was impossible. The depth ladder had one usable rung
// and nothing said so. Meanwhile the control centre's UI Surfaces area explained
// that surfaces "appear here once a feature has had its interface specified, which
// normally happens during planning", describing a process that did not exist.
//
// Two things hid it. Superdev's own project map was seeded by rebuild scripts, so
// every read view looked populated on the only project anyone tested against, which
// is how seeding your own record by script defeats dogfooding. And the release
// criteria never asked whether the things the interface shows can be written.
//
// So this is the check, and it reads its own subject rather than carrying a list: a
// requirement added to DEPTH_REQUIREMENTS later is picked up here without anybody
// editing this file. A list would go stale the same way the last one did.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ERROR, WARNING, finding, isDirectory, walk } from "./common.mjs";
import { DEPTH_REQUIREMENTS } from "../../src/model/vocabulary.mjs";

export const name = "authorable";

/**
 * What each depth requirement needs written before it can be satisfied.
 *
 * Read from the depth gate's own component list, so the left side of this map is
 * checked against DEPTH_REQUIREMENTS at run time and a new requirement with no
 * entry here is itself a finding. That is deliberate: a requirement nobody mapped
 * is a requirement nobody checked.
 */
const SATISFIED_BY = {
  purpose: [],
  user_statement: [],
  scope: [],
  flow: [],
  acceptance_criteria: [],
  edge_cases: [],
  surfaces: ["surface"],
  api_or_data: ["api_operation", "data_entity"],
  workflow: ["workflow", "workflow_step"],
  observability: ["non_functional_requirement"],
  test_plan: [],
  decision: [],
  migration_or_rollback: ["schema_migration"],
  security_privacy: ["non_functional_requirement"],
};

/**
 * What the control centre reads, taken from the read model's own queries.
 *
 * This was a hand-written list of four kinds, and it was wrong the way every list
 * like it is wrong: it named the areas somebody remembered. A sweep afterwards found
 * twelve more record types with no writer, none of them on the list, and one of them
 * mattered immediately. Surface actions had just been written into a JSON column
 * while every counter in the interface reads the ui_actions table, so a surface
 * recorded through the new command would have shown zero actions and counted as a
 * surface with no action recorded, which is the exact figure that started the audit.
 *
 * So the subject is derived. Anything the interface selects from is something the
 * interface shows, and something the interface shows must be something the product
 * can write, or the reader is waiting for a row that will never arrive.
 */
function readByTheInterface(root) {
  const text = readFileSync(join(root, "src/service/read-model.mjs"), "utf8");
  const tables = new Set();
  for (const match of text.matchAll(/FROM\s+([a-z_]+)/g)) tables.add(match[1]);
  return tables;
}

/**
 * Kinds written by the machinery rather than by a person, and why each one is
 * complete without a command.
 *
 * Being on this list is a claim that needs a reason, which is why the reason is the
 * value. A kind added here without one is a gap dressed as a decision.
 */
const SYSTEM_WRITTEN = {
  activity_event: "appended by recordActivity on every write; the log is not authored",
  status_history: "appended by setStatus, which is the only way a status moves",
  memory_link: "written by memory consolidation from what it finds, not by hand",
  layout_position: "written by the canvas when somebody drags a node, through layout.save",
  applied_migration: "written by the migration runner",
  sync_base: "written by synchronization to record what both sides held",
  sync_conflict: "written by synchronization when two sides disagree",
  task_assignment: "written by claiming and releasing a task",
  status_transition: "part of the status machinery",
  decision_transition: "written when a decision changes state",
  discovery_link: "written when the concept map is built",
  feature_flow: "written by feature specify as part of the specification",
  feature_edge_case: "written by feature specify as part of the specification",
  feature_acceptance_criterion: "written by feature specify as part of the specification",
  change_target: "written by change record as part of the change",
  decision_link: "written by decision record as part of the decision",
  capability_area: "seeded by init, then settled with superdev capability specify",
  task_category: "seeded by init, then managed with superdev category",
  test_plan_case: "written with its test plan",
  workflow_step: "written with its workflow, and added with superdev workflow step",
  state: "written with its state machine",
  ui_action: "written with its surface",
  goal_success_criterion: "written with superdev goal criterion",
  runtime_piece_edge: "a join table with no identifier of its own",
  schema_migration_entity: "a join table with no identifier of its own",
  feature_goal: "a join table, written by superdev feature goal",
  task_contract_link: "a join table, written by superdev task update --link",
  task_dependency: "a join table, written when a dependency is recorded",
  source_material: "written by init when it reads what it was given",
  discovery_item: "written by init from the brief, and converted from the control centre",
  document: "written by docs generate",
  work_session: "written by the session hooks",
  developer: "resolved from the machine and git identity",
  agent: "resolved from the harness",
  branch: "resolved from git",
  project: "written by init",
  verification_evidence: "written by superdev task evidence",
  memory_entry: "written by the memory system as work happens",
  question: "raised by init from the material catalogue",
  assumption: "written by superdev assumption record",
  change: "written by superdev change record",
  decision: "written by superdev decision record",
};

/**
 * Every record kind and the table it lives in, read from the id allocator.
 *
 * That map is the product's own list of what a record is, so deriving from it means
 * a kind added later is checked without anybody remembering to add it here.
 */
function kindsAndTables(root) {
  const text = readFileSync(join(root, "src/model/ids.mjs"), "utf8");
  const start = text.indexOf("const TABLE = {");
  const block = text.slice(start, text.indexOf("};", start));
  return [...block.matchAll(/^\s{2}([a-z_]+):\s*"([a-z_]+)"/gm)].map((m) => [m[1], m[2]]);
}

// ------------------------------------------------- state nothing can move
//
// The sibling defect. The check above asks whether a record can be created; this
// one asks whether it can be moved once it exists, because a row that opens at a
// value and can never hold another is a column pretending to be a state machine.
//
// module_completeness was exactly that for months. init created every step at
// `open`, nothing could move one, and the check above was satisfied because
// something could create it. Readiness read 0 of 220 and had no way to read
// anything else. The number was not wrong about the data; the data could not
// change.
//
// So the subject is read from the migrations rather than from a list, the same
// way the check above reads the depth gate. A hand-written list of seven tables
// was the first draft of this, and deriving it found eight, including two on
// integrations that nobody had thought of.

/**
 * Every table the schema still has, with the SQL that defines it.
 *
 * Statements are read in file order because a rebuild drops the old table and
 * renames the new one over it in that sequence. Grouping by statement kind
 * resolves the drop last and loses the table that survived, which silently
 * dropped `documents` and `capability_areas` from an earlier draft of this.
 */
function tableBodies(root) {
  const dir = join(root, "src/db/migrations");
  const byTable = new Map();
  // Table names carry digits (`capability_areas_v2`), and a pattern that allows
  // only letters skips the rename that keeps the table alive.
  const statement = /CREATE TABLE (?:IF NOT EXISTS )?([a-z0-9_]+)\s*\(([\s\S]*?)\n\);|ALTER TABLE\s+([a-z0-9_]+)\s+RENAME TO\s+([a-z0-9_]+)|DROP TABLE (?:IF EXISTS )?([a-z0-9_]+)/g;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const m of readFileSync(join(dir, file), "utf8").matchAll(statement)) {
      if (m[1]) byTable.set(m[1], m[2]);
      else if (m[3]) { byTable.set(m[4], byTable.get(m[3])); byTable.delete(m[3]); }
      else if (m[5]) byTable.delete(m[5]);
    }
  }
  return byTable;
}

/** A column is a state if it is named like one and the schema enumerates it. */
const isStateName = (c) => c === "status" || c === "state" || c.endsWith("_status") || c.endsWith("_state");

function stateColumns(root) {
  const columns = [];
  for (const [table, body] of tableBodies(root)) {
    for (const m of body.matchAll(/CHECK\s*\(\s*([a-z_]+)\s+IN\s*\(([^)]*)\)\s*\)/g)) {
      const column = m[1];
      if (!isStateName(column)) continue;
      const values = [...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1]);
      // One allowed value is a constant, not a state, and nothing could move it
      // anywhere by definition.
      if (values.length < 2) continue;
      const opens = new RegExp(`\\b${column}\\s+TEXT[^,]*?DEFAULT\\s+'([a-z_]*)'`).exec(body);
      columns.push({ table, column, values, opens: opens?.[1] ?? null });
    }
  }
  return columns;
}

/** The object literal a call passes, by matching braces from the call site. */
function argumentObject(text, from) {
  const open = text.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && (depth -= 1) === 0) return text.slice(open, i + 1);
  }
  return "";
}

/**
 * The function a call sits in.
 *
 * Scoped to the function rather than the file because a `patch` in one function
 * and a `status:` in another are not the same fact. File scope said modules.status
 * could move, and it cannot: renameModule patches a module, and the only `status:`
 * in that file belongs to a different record.
 */
function enclosing(text, index) {
  const start = Math.max(
    text.lastIndexOf("\nfunction", index),
    text.lastIndexOf("\nasync function", index),
    text.lastIndexOf("\nexport async function", index), 0);
  const after = ["\nfunction", "\nasync function", "\nexport async function"]
    .map((k) => text.indexOf(k, index)).filter((n) => n > index);
  return text.slice(start, after.length ? Math.min(...after) : text.length);
}

/**
 * Known state columns nothing can move, and what the consequence is.
 *
 * Every entry is a defect rather than a decision, which is why each one says what
 * goes wrong rather than why it is fine. They are warnings so that the gate keeps
 * reporting them without blocking a release on work nobody has scheduled, and a
 * state column that is not on this list is an error, so the next one cannot arrive
 * unnoticed. "The row is seeded" is not a reason and does not appear here.
 */
const IMMOVABLE = {
  "modules.status": "every module reads Planned for the life of the project, however much of it ships",
  "branches.status": "a branch stays active after it is merged, and the active-branch count never falls",
  "schema_migrations.status": "the plan and the database never agree about what has actually been applied",
  "integrations.configuration_status": "an integration cannot be recorded as configured",
  "integrations.verification_status": "an integration cannot be recorded as verified",
  "memory_embeddings.status": "a queued embedding stays pending, because no embedding worker ships yet",
  "changes.status": "a recorded change cannot be reverted or withdrawn",
  "test_plans.status": "a test plan cannot leave draft",
};

export async function run(root) {
  const findings = [];

  // Every requirement the depth gate names has to be accounted for here.
  const named = new Set(Object.values(DEPTH_REQUIREMENTS).flat());
  for (const requirement of named) {
    if (!(requirement in SATISFIED_BY)) {
      findings.push(finding("AU-000", ERROR, "scripts/validate/authorable.mjs",
        `the depth gate requires "${requirement}" and this validator does not say what writes it, so nothing checks that it can be satisfied`));
    }
  }

  const writers = writersByKind(root);

  const wanted = new Map();
  for (const [depth, requirements] of Object.entries(DEPTH_REQUIREMENTS)) {
    for (const requirement of requirements) {
      for (const kind of SATISFIED_BY[requirement] ?? []) {
        if (!wanted.has(kind)) wanted.set(kind, new Set());
        wanted.get(kind).add(`${depth} depth needs ${requirement}`);
      }
    }
  }
  const shown = readByTheInterface(root);
  for (const [kind, table] of kindsAndTables(root)) {
    if (!shown.has(table)) continue;
    if (!wanted.has(kind)) wanted.set(kind, new Set());
    wanted.get(kind).add(`the control centre reads ${table}`);
  }

  for (const [kind, reasons] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
    if (writers.has(kind)) continue;
    if (SYSTEM_WRITTEN[kind]) continue;
    findings.push(finding("AU-001", ERROR, "src/",
      `nothing in the product can create a ${kind}, and ${[...reasons].join("; ")}. A record type the product asks for has to be one the product can write.`));
  }

  findings.push(...stuckState(root));
  return { name, findings };
}

/** Every enumerated state column with nothing in src able to move it. */
function stuckState(root) {
  const findings = [];
  const kindOf = new Map(kindsAndTables(root).map(([kind, table]) => [table, kind]));
  const files = sourceFiles(root);
  const all = files.join("\n");

  for (const { table, column, values, opens } of stateColumns(root)) {
    const kind = kindOf.get(table);
    let movable = false;

    // The status machinery, which is the only thing that moves a `status`.
    if (column === "status" && kind && new RegExp(`setStatus\\(\\s*db\\s*,\\s*"${kind}"`).test(all)) movable = true;
    // A direct update, which is how every detail row without a version column moves.
    if (new RegExp(`UPDATE\\s+${table}\\b[\\s\\S]{0,600}?\\b${column}\\s*=`, "i").test(all)) movable = true;

    if (!movable && kind) {
      for (const text of files) {
        for (const m of text.matchAll(new RegExp(`patch\\(\\s*db\\s*,\\s*"${kind}"`, "g"))) {
          const scope = enclosing(text, m.index);
          if (new RegExp(`\\b${column}\\s*:`).test(scope) || new RegExp(`\\.${column}\\s*=[^=]`).test(scope)) movable = true;
        }
        // A column the creator computes is chosen rather than frozen: the row opens
        // at whatever the caller worked out, so more than one value is reachable.
        // Only a bare literal freezes it. Screening a source material and measuring
        // a non-functional requirement both work this way and are not defects.
        for (const m of text.matchAll(new RegExp(`create\\(\\s*db\\s*,\\s*"${kind}"`, "g"))) {
          const set = new RegExp(`\\b${column}\\s*:\\s*([^,\\n]+)`).exec(argumentObject(text, m.index));
          if (set && !/^["'][a-z_]*["']\s*$/.test(set[1].trim())) movable = true;
        }
      }
    }
    if (movable) continue;

    const stuck = `${table}.${column}`;
    const reachable = values.filter((v) => v !== opens);
    const says = `${stuck} opens at ${JSON.stringify(opens)} and nothing in src can move it to ${reachable.map((v) => JSON.stringify(v)).join(", ")}`;
    findings.push(IMMOVABLE[stuck]
      ? finding("AU-002", WARNING, "src/", `${says}, so ${IMMOVABLE[stuck]}.`)
      : finding("AU-003", ERROR, "src/",
        `${says}. Give it a writer, or record what goes wrong without one in IMMOVABLE in scripts/validate/authorable.mjs. That the row is seeded is not a reason.`));
  }
  return findings;
}

/**
 * Which record kinds anything under src/ creates.
 *
 * Matches the one helper every write goes through. A raw INSERT would slip past
 * this, and that is acceptable: `create` allocates the id, screens every field and
 * records the activity, so a write that avoids it is a defect on its own terms and
 * the import validator already refuses the shapes that would need one.
 */
function writersByKind(root) {
  const kinds = new Set();
  for (const text of sourceFiles(root)) {
    for (const match of text.matchAll(/create\(\s*db\s*,\s*"([a-z_]+)"/g)) {
      kinds.add(match[1]);
    }
  }
  return kinds;
}

/** Every shipped module under src/, read once and shared by both checks. */
function sourceFiles(root) {
  if (!isDirectory(join(root, "src"))) return [];
  const texts = [];
  for (const file of walk(join(root, "src"))) {
    if (!file.endsWith(".mjs") || file.endsWith(".test.mjs")) continue;
    texts.push(readFileSync(file, "utf8"));
  }
  return texts;
}
