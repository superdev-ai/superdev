# ADR-0015: A normalized schema replaces the generic node model

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** The entire product and execution schema.
- **Supersedes:** ADR-0003, ADR-0011

## Context

The previous model stored every record type in one `nodes` table with a JSON
`fields` column and one `links` table for all fourteen relationship kinds. Adding
an entity type was a row rather than a migration. The cost was that the database
could not enforce, or even describe, what a feature or a task actually requires.
Field requirements lived in a runtime table in JavaScript, so the store had no
opinion about correctness.

The Docs skill templates define a rich information model. Flattening them into a
JSON bag is what allowed features and tasks to be created in quantity without
representing a complete contract.

## Decision

Typed normalized tables, one per concept, with real foreign keys. No generic node
table. The schema follows brief section 10 and adds what section 10 omits.

Specific mechanisms:

- **The task mapping constraint** is enforced by triggers, not by application
  code. `feature_id` is `NOT NULL` at the column level. A deferred check on
  insert and update raises `E_TASK_WITHOUT_CONTRACT` when a task is neither
  marked enabling nor linked in `task_contract_links`, and
  `E_ENABLING_WITHOUT_FEATURE` when enabling work names no unblocked feature.
  Triggers were verified to abort correctly on this engine.
- **Append-only history** is enforced by triggers that raise on `UPDATE` and
  `DELETE` against `activity_events`, `decision_transitions`, and status history
  tables.
- **Optimistic versioning** uses a `version` column. Every update carries an
  expected version in its `WHERE` clause; a zero-row result is a conflict, not a
  silent no-op.
- **Hierarchy traversal** happens in application code with iterative queries,
  because this engine has no recursive CTEs. Task trees are shallow and the cost
  is a few sub-millisecond round trips.

## Additions beyond brief section 10

The brief requires behavior that section 10 has no table for. These are added:

- `capability_areas` - the production readiness checklist of section 8.2. One row
  per applicable area with state `specified`, `awaiting_decision`,
  `not_applicable`, or `deferred`, plus reason, owner, revisit trigger and
  consequence. Without this, "silent gaps are invalid" is unenforceable.
- `module_completeness` - the twenty-step loop of section 9.3. One row per module
  per step, filled or deliberately marked not applicable with a reason.
- `document_bodies` - the generated body for each document, so a manual edit can
  be diffed against what was generated rather than only hash-compared.
- `feature_flows` and `workflow_actors` - normalized rather than the JSON columns
  the brief sketched, so they are queryable.

## Consequences

- Positive: the store enforces the contract. A task with no feature cannot exist.
- Negative: adding an entity type is now a migration.
- Neutral: queries become explicit joins rather than graph walks.

## Enforcement

Migration inspection and a foreign key and integrity validator.

## Related

ADR-0013, ADR-0014, ADR-0016.
