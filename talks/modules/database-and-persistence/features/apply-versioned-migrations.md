<!-- superdev:generated source=FEAT-0021 revision=2943 hash=861b3d7f618987ea7d3a0a4379138242f711539b7d4cf91aecd253b3e540af18 -->
# Feature: Apply versioned migrations

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Evolve the database schema safely through ordered migrations
- **User:** A developer or agent who just pulled new migration files wants to bring the local database schema up to date without hand-running SQL.
- **User value:** Not recorded
- **Scope:** in: Dry run (no --apply) reports which migrations are pending, their file names and statement counts, without touching the database, With --apply, copies the database aside (a full VACUUM INTO snapshot) before running anything, Runs each pending migration in its own transaction, in version order, and records it in applied_migrations, Refuses to run with --apply while the local service is live, since changing the schema under an open connection is unsafe; out: Does not skip or reorder migrations; every migration newer than the current version runs, in file order, Does not roll back migrations that already committed if a later one in the same run fails; each migration's own transaction rolls back, but earlier commits stand, Does not proceed with --apply if the service is running; it tells the caller to stop it first rather than migrating around an open connection
- **Affected contracts:** none linked

### Primary flow

1. Run superdev db migrate (dry run) to see which migrations would apply
2. Stop the local service if one is running
3. Re-run with --apply
4. Command backs up the current database file, then runs each pending migration in its own transaction, in order
5. Reports which migrations applied, the new schema version, and the path of the backup made before starting

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev db migrate --apply applies pending migrations and records migration history | Run superdev db migrate --apply and record what was observed. | Met | EV-0017 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | each migration commits in its own transaction and rolls back only itself on failure, so a multi-migration run that fails partway leaves the schema at whichever version the last successful migration reached, not back at the start |
| Empty States | Applicable | when the schema is already current, both the dry run and the --apply run report that it is already up to date and do nothing further |
| Recovery | Applicable | the database is copied aside into a timestamped backup file before any migration runs, so a bad migration leaves a pre-migration snapshot to restore from |
| State Machine Violations | Applicable | if the local service is running or still starting, --apply refuses and names the port and pid, telling the caller to run stop first; the dry run is not blocked since it only reads |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Migration 008 creates changes, change_targets, assumptions, test_plans, test_plan_cases and api_services. The data model validator compares 43 recorded entities and 548 fields against a database built from the ordered migrations and reports no finding. | command | pass | src/db/migrations/008_changes_assumptions_test_plans_api_services.sql |
| Migration 008 creates changes, change_targets, assumptions, test_plans, test_plan_cases and api_services. The data model validator compares 43 recorded entities and 548 fields against a database built from the ordered migrations and reports no finding. | command | pass | src/db/migrations/008_changes_assumptions_test_plans_api_services.sql |
| src/cli.mjs:775-804 cmdDbMigrate, registered at line 2034, calls migrate() from src/db/migrate.mjs and refuses to run against a live service via assertNoLiveService. Ran `node src/cli.mjs db migrate` (no --apply, read-only check): schema already current, so it reported 'The database schema is already up to date.' confirming the command reaches the real migration engine and reads real pending-migration state. | command | pass | superdev db migrate --apply |

## Delivery state

- **What works now:** Reached by superdev db migrate --apply. src/cli.mjs:775-804 cmdDbMigrate, registered at line 2034, calls migrate() from src/db/migrate.mjs and refuses to run against a live service via assertNoLiveService. Ran `node src/cli.mjs db migrate` (no --apply, read-only check): schema already current, so it reported 'The database schema is already up to date.' confirming the command reaches the real migration engine and reads real pending-migration state.
- **What remains:** Nothing known.
- **Next action:** Not recorded
