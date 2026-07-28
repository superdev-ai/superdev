<!-- superdev:generated source=FEAT-0006 revision=2984 hash=b16359279c83e558cb78cabcb262fba58c6af8ce635638d6221518c930ac4398 -->
# Feature: Create the project database on acceptance

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Persist the accepted product model as the operational source of truth
- **User:** A developer who has just accepted the plan wants that decision to become the durable, queryable source of truth immediately, not a document that could later drift from what is actually built.
- **User value:** Not recorded
- **Scope:** in: Applying with apply:true creates or migrates the control database, then creates the project row plus seeded capability areas, stack slots and task categories inside one transaction, Reuses an existing project row rather than creating a duplicate if one is already present, so a repeated apply is idempotent, Verified end to end: the database file and its write-ahead-log files exist on disk after apply, and a later status read confirms the seeded data; out: Does not create the database on a dry run; database creation only happens once apply is set to true, Does not require a separate manual migration step; migration is applied automatically as part of apply, Does not itself generate documentation or derive tasks; those happen as later, separate steps in the same apply run
- **Affected contracts:** none linked

### Primary flow

1. Run superdev init --apply (or adopt --apply) after the plan has been accepted
2. The database is created or migrated to the current schema version
3. One transaction creates the project row plus its seeded capability areas, stack slots and task categories
4. Run superdev status to confirm the project and its seed data are persisted and queryable

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| After plan acceptance, a project database exists with versioned migrations applied | Do it through the surface a person would use and record what was observed. | Met | EV-0092 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | Documentation generation and task derivation run in their own transactions outside the project-creation transaction; a failure there is caught and recorded as failed without undoing the project that was already created. |
| Duplication | Applicable | Re-running --apply on the same project finds the existing project row by its creation order and reuses it, reporting that step as already existed rather than inserting a second project. |
| State Machine Violations | Applicable | Applying on a repository with existing, undetected documentation and no --adopt flag throws before the database is created or migrated, so no partial project is left behind. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| The database created by initialization is present and sound: | command | pass | node src/cli.mjs db status |
| The changes and change_targets tables exist, created by migration 008. A change records what moved in accepted scope, why, and every record it touched, and the table is append only so the audit trail section 14.2 requires cannot be revised. change record, change list and change show reach it. | validator | pass | scripts/validate/data-model.mjs |

## Delivery state

- **What works now:** Reached by superdev init --apply or superdev adopt --apply. Confirmed by direct filesystem check after both apply runs: scratch init produced .superdev/superdev.db (plus -log/-wal) and a working project readable via `superdev status`; scratch adopt likewise produced .superdev/superdev.db alongside talks/project.yaml. Code path: applyInit/adoptProject in src/init/index.mjs call ensureDatabase/create from src/db/store.mjs to seed the project row, capability areas, stack slots and task categories inside one transaction.
- **What remains:** Nothing known.
- **Next action:** Not recorded
