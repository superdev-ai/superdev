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

import { readFileSync } from "node:fs";
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
 * Record kinds the control centre gives an area to, beyond what depth requires.
 *
 * An area with nothing behind it is worse than an absent one, because it teaches a
 * reader to wait for something that will never arrive.
 */
const SHOWN_IN_THE_INTERFACE = [
  "integration",
  "test_plan",
  "glossary_term",
  "state_machine",
];

/** Kinds only `init` is meant to write, and why that is the whole story for them. */
const SEEDED_ONLY = {
  capability_area: "seeded by init from the fixed checklist, then settled with superdev capability specify",
  module_completeness: "seeded by init per module from the fixed step list",
  task_category: "seeded by init, then managed with superdev category",
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
  for (const kind of SHOWN_IN_THE_INTERFACE) {
    if (!wanted.has(kind)) wanted.set(kind, new Set());
    wanted.get(kind).add("the control centre gives it an area");
  }

  for (const [kind, reasons] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
    if (writers.has(kind)) continue;
    if (SEEDED_ONLY[kind]) {
      findings.push(finding("AU-002", WARNING, "src/",
        `${kind} is written only by init: ${SEEDED_ONLY[kind]}`));
      continue;
    }
    findings.push(finding("AU-001", ERROR, "src/",
      `nothing in the product can create a ${kind}, and ${[...reasons].join("; ")}. A record type the product asks for has to be one the product can write.`));
  }

  return { name, findings };
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
  if (!isDirectory(join(root, "src"))) return kinds;
  for (const file of walk(join(root, "src"))) {
    if (!file.endsWith(".mjs") || file.endsWith(".test.mjs")) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/create\(\s*db\s*,\s*"([a-z_]+)"/g)) {
      kinds.add(match[1]);
    }
  }
  return kinds;
}
