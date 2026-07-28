// Stable, human-readable, typed identifiers.
//
// Ids appear in deep links, generated Markdown, commit messages and agent
// conversation, so they are readable rather than opaque. Uniqueness comes from
// the primary key: a colliding insert fails and the caller retries with the
// next number, which is safe because every write is already a transaction.

export const PREFIX = {
  project: "PRJ",
  project_scope_item: "SCOPE",
  glossary_term: "TERM",
  runtime_piece: "RT",
  source_material: "SRC",
  discovery_item: "DIS",
  question: "Q",
  goal: "GOAL",
  goal_success_criterion: "GSC",
  milestone: "MS",
  module: "MOD",
  feature: "FEAT",
  feature_flow: "FLOW",
  feature_acceptance_criterion: "AC",
  feature_edge_case: "EC",
  workflow: "WF",
  workflow_actor: "WFA",
  workflow_step: "STEP",
  workflow_branch: "BR",
  state_machine: "SM",
  state: "ST",
  state_transition: "STT",
  surface: "SRF",
  surface_state: "SRS",
  ui_action: "ACT",
  api_operation: "API",
  data_entity: "ENT",
  data_field: "FLD",
  data_relationship: "REL",
  schema_migration: "MIG",
  integration: "INT",
  job: "JOB",
  webhook: "WH",
  role: "ROLE",
  permission: "PERM",
  non_functional_requirement: "NFR",
  decision: "DEC",
  decision_link: "DL",
  change: "CHG",
  assumption: "ASM",
  test_plan: "TP",
  test_plan_case: "TPC",
  api_service: "SVC",
  decision_transition: "DT",
  document: "DOC",
  capability_area: "CAP",
  module_completeness: "MCS",
  task: "TASK",
  task_category: "TC",
  task_assignment: "ASG",
  developer: "DEV",
  agent: "AGT",
  branch: "GBR",
  work_session: "SES",
  activity_event: "EVT",
  verification_evidence: "EV",
  status_history: "SH",
  memory_entry: "MEM",
  memory_link: "ML",
  sync_peer: "PEER",
  sync_conflict: "CONF",
  layout_position: "POS",
};

const TABLE = {
  project: "projects",
  // Added by migration 002. runtime_piece_edges is deliberately absent: it has a
  // composite primary key and no id column, like the other join tables here.
  project_scope_item: "project_scope_items",
  glossary_term: "glossary_terms",
  runtime_piece: "runtime_pieces",
  source_material: "source_material",
  discovery_item: "discovery_items",
  question: "questions",
  goal: "goals",
  goal_success_criterion: "goal_success_criteria",
  milestone: "milestones",
  module: "modules",
  feature: "features",
  feature_flow: "feature_flows",
  feature_acceptance_criterion: "feature_acceptance_criteria",
  feature_edge_case: "feature_edge_cases",
  workflow: "workflows",
  workflow_actor: "workflow_actors",
  workflow_step: "workflow_steps",
  workflow_branch: "workflow_branches",
  state_machine: "state_machines",
  state: "states",
  state_transition: "state_transitions",
  surface: "surfaces",
  surface_state: "surface_states",
  ui_action: "ui_actions",
  api_operation: "api_operations",
  data_entity: "data_entities",
  data_field: "data_fields",
  data_relationship: "data_relationships",
  schema_migration: "schema_migrations",
  integration: "integrations",
  job: "jobs",
  webhook: "webhooks",
  role: "roles",
  permission: "permissions",
  non_functional_requirement: "non_functional_requirements",
  decision: "decisions",
  decision_link: "decision_links",
  change: "changes",
  assumption: "assumptions",
  test_plan: "test_plans",
  test_plan_case: "test_plan_cases",
  api_service: "api_services",
  decision_transition: "decision_transitions",
  document: "documents",
  capability_area: "capability_areas",
  module_completeness: "module_completeness",
  task: "tasks",
  task_category: "task_categories",
  task_assignment: "task_assignments",
  developer: "developers",
  agent: "agents",
  branch: "branches",
  work_session: "work_sessions",
  activity_event: "activity_events",
  verification_evidence: "verification_evidence",
  status_history: "status_history",
  memory_entry: "memory_entries",
  memory_link: "memory_links",
  sync_peer: "sync_peers",
  sync_conflict: "sync_conflicts",
  layout_position: "layout_positions",
};

export const tableFor = (kind) => TABLE[kind];

const PAD = 4;

/** `FEAT-0007`. Sequential per kind, derived from what is already stored. */
export async function nextId(db, kind) {
  const prefix = PREFIX[kind];
  const table = TABLE[kind];
  if (!prefix || !table) throw new Error(`unknown record kind: ${kind}`);
  const row = await db.get(
    `SELECT id FROM ${table} WHERE id LIKE ? ORDER BY length(id) DESC, id DESC LIMIT 1`,
    `${prefix}-%`,
  );
  const last = row ? Number(String(row.id).slice(prefix.length + 1)) : 0;
  const next = (Number.isFinite(last) ? last : 0) + 1;
  return `${prefix}-${String(next).padStart(PAD, "0")}`;
}

export function kindOf(id) {
  const prefix = String(id).split("-")[0];
  return Object.keys(PREFIX).find((k) => PREFIX[k] === prefix) ?? null;
}

export const isId = (value) => typeof value === "string" && /^[A-Z]{1,5}-\d{4,}$/.test(value);

/** URL and filesystem safe slug. Used for module and feature document paths. */
export function slugify(text, fallback = "item") {
  const slug = String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

export async function uniqueSlug(db, table, projectId, text, fallback) {
  const base = slugify(text, fallback);
  let candidate = base;
  for (let n = 2; n < 500; n++) {
    const clash = await db.get(`SELECT 1 FROM ${table} WHERE project_id = ? AND slug = ?`, projectId, candidate);
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  throw new Error(`could not find a free slug for "${text}"`);
}
