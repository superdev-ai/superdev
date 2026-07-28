// What may cross the boundary, and what never does. DEC-TBD-007.
//
// This is the one place that decides. Every other module asks it, so widening
// what is shared is a change to this list rather than a change scattered across
// a serializer, a merge and a report. Section 18 requires that a developer's
// identity and a project's existence are not disclosed across an organization
// boundary, and a rule spread over three files is a rule nobody can check.
//
// The list is what is allowed, never what is forbidden. A table added to the
// schema tomorrow is not shared until somebody adds it here and says why, which
// is the safe direction for a mistake to fall.

/**
 * Tables that travel, in dependency order so a bundle can be applied top down
 * without a foreign key failing.
 *
 * Specifications, decisions and evidence, which is what a colleague needs to
 * understand what was agreed and what proved it. Tasks travel with them because
 * an execution contract nobody can see is not shareable work, but they travel
 * stripped: see PERSONAL below.
 */
export const SHARED_TABLES = [
  "projects",
  "goals",
  "milestones",
  "modules",
  "features",
  "feature_flows",
  "feature_acceptance_criteria",
  "feature_edge_cases",
  "workflows",
  "workflow_steps",
  "data_entities",
  "data_fields",
  "api_services",
  "api_operations",
  "surfaces",
  "integrations",
  "non_functional_requirements",
  "schema_migrations",
  "capability_areas",
  "decisions",
  "decision_links",
  "test_plans",
  "test_plan_cases",
  "changes",
  "change_targets",
  "assumptions",
  "tasks",
  "task_contract_links",
  "verification_evidence",
];

/**
 * Tables that never travel, with the reason, so a reader can see this was
 * decided rather than overlooked.
 */
export const WITHHELD = {
  memory_entries: "A memory is one machine's recollection, not an agreed fact. DEC-TBD-007 keeps it local.",
  memory_links: "Links into memory would describe the memory even without it.",
  memory_search_terms: "An index of memory is memory.",
  activity_events: "The activity trail records who did what and when, which is a working pattern.",
  work_sessions: "A session says when a person was at their desk.",
  developers: "A person's name and identity. Section 18 forbids disclosing it.",
  agents: "Which harness and model somebody runs.",
  task_assignments: "Who holds what. A lease crosses instead, carrying an alias rather than a person.",
  branches: "Local branch names describe a working style and often a person.",
  status_history: "A minute by minute record of how somebody worked.",
  documents: "Generated files belong to the machine that generated them.",
  source_material: "Intake material may contain anything the owner supplied.",
  questions: "An open question is a conversation with the owner, not an agreed artifact.",
  layout_positions: "Where somebody dragged a box on their own screen.",
  sync_peers: "Who else this project syncs with. Section 18 forbids disclosing that another organization exists.",
  sync_base: "A record of what a different peer holds.",
  sync_conflicts: "A conflict is between two specific copies and means nothing to a third.",
  applied_migrations: "The local schema history of one machine.",
};

/**
 * Columns stripped from a row before it leaves, by table.
 *
 * A shared table can still carry a personal column. The row is worth sending
 * and the column is not, so it is removed rather than the row withheld.
 */
const PERSONAL = {
  tasks: ["assignee_developer_id", "assignee_agent_id", "branch_id", "session_id"],
  verification_evidence: ["recorded_by", "session_id"],
  decisions: ["accepted_by"],
  changes: ["requested_by", "decided_by", "session_id", "task_id"],
  assumptions: ["recorded_by", "session_id"],
  capability_areas: ["owner"],
};

/** Whether a table is shared at all. */
export const isShared = (table) => SHARED_TABLES.includes(table);

/**
 * A row as it may leave this machine.
 *
 * Unknown columns are kept: a column added to a shared table is data about the
 * product, and treating it as personal by default would silently drop product
 * information. Personal columns are enumerated because they are the exception
 * and each one was a judgement somebody made.
 */
export function project(table, row) {
  const strip = PERSONAL[table];
  if (!strip) return { ...row };
  const out = { ...row };
  for (const column of strip) delete out[column];
  return out;
}

/** Why a table is withheld, for a reader asking where their data went. */
export const withheldReason = (table) =>
  WITHHELD[table] ?? "It is not on the list of what may be shared, and the list is what is allowed rather than what is forbidden.";
