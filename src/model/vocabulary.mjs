// The words the product uses. Data, not UI constants: categories and capability
// areas are seeded as rows so a project can add its own.

/** Brief section 7.4. Order is lifecycle order, used for board columns. */
export const TASK_STATUSES = [
  "draft", "ready", "in_progress", "in_review", "verifying",
  "blocked", "paused", "complete", "cancelled", "superseded",
];

export const OPEN_TASK_STATUSES = TASK_STATUSES.filter(
  (s) => !["complete", "cancelled", "superseded"].includes(s),
);

export const TERMINAL_TASK_STATUSES = ["complete", "cancelled", "superseded"];

/** Human-facing label. Title Case, plain language, no internal vocabulary. */
export const LABEL = {
  draft: "Draft",
  ready: "Ready",
  in_progress: "In Progress",
  in_review: "In Review",
  verifying: "Verifying",
  blocked: "Blocked",
  paused: "Paused",
  complete: "Complete",
  cancelled: "Cancelled",
  superseded: "Superseded",
  planned: "Planned",
  implemented: "Implemented",
  deprecated: "Deprecated",
  accepted: "Accepted",
  proposed: "Proposed",
  rejected: "Rejected",
  specified: "Specified",
  awaiting_decision: "Awaiting Decision",
  not_applicable: "Not Applicable",
  deferred: "Deferred",
  met: "Met",
  unmet: "Unmet",
  unmeasured: "Unmeasured",
  open: "Open",
  filled: "Filled",
  answered: "Answered",
};

export const titleCase = (value) =>
  LABEL[value] ??
  String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Brief section 7.3, plus the categories the derivation inputs in 11.1 actually
 * produce. Seeded per project, and projects may add their own: these are a
 * starting vocabulary, not a closed set.
 *
 * The later entries exist because derivation was otherwise forced to file real
 * work under a category that did not describe it. Proving rollout and rollback
 * is not Infrastructure, and a surface with its actions is not a generic
 * Feature.
 */
export const SYSTEM_TASK_CATEGORIES = [
  "Feature", "Improvement", "Bug", "Refactor", "Investigation", "Documentation",
  "Integration", "Migration", "Infrastructure", "Security", "Quality", "Backlog",
  "Design", "Testing", "Performance", "Accessibility", "Observability",
  "Data", "Release", "Compliance", "Chore",
];

/**
 * One line per category, so the interface can say what a category means rather
 * than assuming everyone reads the same meaning into a single word. Shown in
 * the category picker and in filter help.
 */
export const TASK_CATEGORY_MEANINGS = {
  Feature: "New product behavior somebody asked for.",
  Improvement: "Existing behavior made better without changing what it is.",
  Bug: "Behavior that does not match what was accepted.",
  Refactor: "Internal change with no change in behavior.",
  Investigation: "Finding something out before deciding what to build.",
  Documentation: "Keeping the written record in step with the product.",
  Integration: "Work at the boundary with something outside this product.",
  Migration: "Moving data or schema from one shape to another.",
  Infrastructure: "The ground the product runs on.",
  Security: "Protecting the product, its data and the people in it.",
  Quality: "Work that raises confidence rather than adding behavior.",
  Backlog: "Agreed as worth doing, not yet scheduled.",
  Design: "Surfaces, actions and how the product presents itself.",
  Testing: "Product tests derived from the accepted test plan.",
  Performance: "Meeting a declared speed or capacity target.",
  Accessibility: "Making the product operable by everyone who uses it.",
  Observability: "Signals that prove the product is working in the open.",
  Data: "Modelling the entities and relationships the product owns.",
  Release: "Getting the work out, and being able to take it back.",
  Compliance: "Obligations under a regime this project has declared.",
  Chore: "Routine upkeep that keeps the project healthy.",
};

/** Brief section 8.2. Every area is answered or explicitly not applicable. */
export const CAPABILITY_AREAS = [
  "Product purpose and success criteria",
  "Users, roles, permissions and tenancy",
  "Frontend delivery shape",
  "Navigation and information architecture",
  "Design system and accessibility",
  "Backend boundaries and service responsibilities",
  "API style and public contracts",
  "Authentication and session lifecycle",
  "Authorization enforcement",
  "Database and data ownership",
  "Data migrations and rollback",
  "File or object storage",
  "Search and indexing",
  "Real-time behavior",
  "Offline behavior and conflict handling",
  "Background jobs and scheduling",
  "Events and webhooks",
  "External integrations",
  "Notifications",
  "Rate limiting and abuse controls",
  "Security and privacy",
  "Compliance",
  "Observability and operational response",
  "Performance and capacity targets",
  "Environments and secret management",
  "Continuous integration and delivery",
  "Infrastructure and deployment",
  "Backups, recovery, retention and deletion",
  "Product analytics",
  "Testing strategy for the product",
  "Release and rollback",
];

/** Brief section 9.3, the twenty-step module loop. */
export const MODULE_STEPS = [
  "Pages and surfaces", "UI composition", "Actions", "API surface", "Data",
  "End-to-end wiring", "State machines", "Events", "Edge cases", "UI states",
  "Telemetry", "Accessibility", "Internationalization", "Feature flags",
  "Responsive behavior", "User-facing copy", "URL state and deep links",
  "Performance", "Discoverability and SEO", "Compliance and product tests",
];

/** Docs edge-case categories. Each is specified or deliberately not applicable. */
export const EDGE_CASE_CATEGORIES = [
  "empty_states", "boundary_values", "invalid_input", "permission_boundaries",
  "state_machine_violations", "concurrent_actions", "ordering", "duplication",
  "network_failure", "dependency_failure", "slow_paths", "time",
  "data_migration_states", "recovery", "limits_and_quotas",
  "multi_device_session", "offline_degraded", "localization",
  "platform_variance", "versioning", "deletion_semantics", "consistency",
  "privacy_lifecycle", "auditability",
];

export const ACTIVITY_EVENT_TYPES = [
  "task_created", "task_claimed", "task_started", "task_updated", "task_blocked",
  "task_unblocked", "verification_attached", "task_completed", "task_reopened",
  "task_released", "task_cancelled", "decision_created", "decision_transitioned",
  "specification_changed", "code_changed", "documentation_generated",
  "documentation_proposal_raised", "documentation_proposal_resolved",
  "session_started", "session_compacted", "session_handed_off", "session_ended",
  "project_initialized", "scope_changed", "tasks_derived",
];

export const SPEC_DEPTHS = ["microspec", "standard", "full"];

/** What each depth must carry before it can be accepted. Brief section 9.2. */
export const DEPTH_REQUIREMENTS = {
  microspec: ["purpose", "user_statement", "scope", "flow", "acceptance_criteria", "edge_cases"],
  standard: ["purpose", "user_statement", "scope", "flow", "acceptance_criteria", "edge_cases",
             "surfaces", "api_or_data", "workflow", "observability", "test_plan"],
  full: ["purpose", "user_statement", "scope", "flow", "acceptance_criteria", "edge_cases",
         "surfaces", "api_or_data", "workflow", "observability", "test_plan",
         "decision", "migration_or_rollback", "security_privacy"],
};

/**
 * `3 features`, `1 feature`, `2 categories`.
 *
 * The one place a count meets its noun. Superdev used to write `feature(s)`
 * everywhere, which is a machine hedging about grammar it already has the
 * number for, and it produced sentences no person would write: "1 verification
 * record(s) are out of date", where the count is singular and the verb is not.
 * Irregular plurals are passed in rather than guessed, because "criterion(s)"
 * was the other half of the same problem and the plural is "criteria".
 */
export function count(n, singular, many = `${singular}s`) {
  return `${n} ${n === 1 ? singular : many}`;
}

/** The same choice without the number, for a verb that has to agree with it. */
export const agrees = (n, one, many) => (n === 1 ? one : many);
