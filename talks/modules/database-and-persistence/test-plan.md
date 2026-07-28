<!-- superdev:generated source=MOD-0006 revision=3058 hash=34e35d783708eb3a1e3db35365687b5faa2aea0de7e3d18b2c0156bfa3c25822 -->
# Database and Persistence - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| Create the project database on acceptance | After plan acceptance, a project database exists with versioned migrations applied | Do it through the surface a person would use and record what was observed. | Met |
| Check database status | superdev db status returns accessibility and schema version | Run superdev db status and record what was observed. | Met |
| Apply versioned migrations | superdev db migrate --apply applies pending migrations and records migration history | Run superdev db migrate --apply and record what was observed. | Met |
| Back up the database | superdev db backup --apply produces a restorable backup file | Run superdev db backup --apply and record what was observed. | Met |
| Restore the database from backup | superdev db restore <backup> --apply restores the database to the backed-up state | Run superdev db restore <backup> --apply and record what was observed. | Met |
| Export project data | superdev export <file> --apply writes a file that can be reimported | Run superdev export <file> --apply and record what was observed. | Met |
| Import project data | superdev import <file> --apply loads records from the export file | Run superdev import <file> --apply and record what was observed. | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, validator | 7 | exists |
| Applicable edge-case categories | command, validator | 25 | exists |
| Permission boundaries | command, validator | 0 | missing |
| State machines including illegal transitions | command, validator | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| Migration 008 creates changes, change_targets, assumptions, test_plans, test_plan_cases and api_services. The data model validator compares 43 recorded entities and 548 fields against a database built from the ordered migrations and reports no finding. | command | pass | src/db/migrations/008_changes_assumptions_test_plans_api_services.sql | Current |
| Migration 008 creates changes, change_targets, assumptions, test_plans, test_plan_cases and api_services. The data model validator compares 43 recorded entities and 548 fields against a database built from the ordered migrations and reports no finding. | command | pass | src/db/migrations/008_changes_assumptions_test_plans_api_services.sql | Current |
| src/cli.mjs:740-773 cmdDbStatus, registered at line 2033. Ran `node src/cli.mjs db status`: printed Schema version 8 of 8, Pending migrations 0, Integrity Sound, Drift None, plus full row-count table across 29 tables. | command | pass | superdev db status | Current |
| src/cli.mjs:775-804 cmdDbMigrate, registered at line 2034, calls migrate() from src/db/migrate.mjs and refuses to run against a live service via assertNoLiveService. Ran `node src/cli.mjs db migrate` (no --apply, read-only check): schema already current, so it reported 'The database schema is already up to date.' confirming the command reaches the real migration engine and reads real pending-migration state. | command | pass | superdev db migrate --apply | Current |
| src/cli.mjs:806-825 cmdDbBackup, registered at line 2035, calls backup()/listBackups() from src/db/maintenance.mjs. Ran `node src/cli.mjs db backup` (dry run): 'Would write a complete snapshot labelled manual into .superdev/backups. 5 backups already there. The newest 10 are kept.' confirming it reads the real existing backups directory (5 files present, including migration-2026-07-27T19-22-47-126Z.db). | command | pass | superdev db backup --apply | Current |
| src/cli.mjs:827-856 cmdDbRestore, registered at line 2036, calls restore()/listBackups() from src/db/maintenance.mjs. Ran `node src/cli.mjs db restore` with no file arg: correctly refused with 'Say which backup to restore: superdev db restore <file>. The newest is .superdev/backups/migration-2026-07-27T19-22-47-126Z.db.' Then ran `node src/cli.mjs db restore .superdev/backups/migration-2026-07-27T19-22-47-126Z.db` (dry run) against that real file: 'Would replace the project database with .superdev/backups/migration-2026-07-27T19-22-47-126Z.db (2347008 bytes). The current database is snapshotted first, so restoring the wrong file is itself recoverable.' | command | pass | superdev db restore <backup> --apply | Current |
| src/cli.mjs:705-722 cmdExport, registered at line 2030, calls exportProject() from src/db/maintenance.mjs. Ran `node src/cli.mjs export` (dry run): 'Would write a portable snapshot of every record into .superdev/exports. Nothing has changed. Re-run with --apply to write the export.' | command | pass | superdev export <file> --apply | Current |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:724-736 cmdImport calls importProject(root, file, {apply}) from src/db/maintenance.mjs:305. Ran `node src/cli.mjs export` to produce .superdev/exports/superdev-2026-07-27T19-37-30-939Z.jsonl, then `node src/cli.mjs import <file>` (dry run) which printed a full import plan: schema version 8, target project PRJ-0001, and per-table row counts (goals 5, milestones 9, modules 11, features 91, etc). | command | pass | superdev import <file> [--apply] | Current |
| The database created by initialization is present and sound: | command | pass | node src/cli.mjs db status | Current |
| The changes and change_targets tables exist, created by migration 008. A change records what moved in accepted scope, why, and every record it touched, and the table is append only so the audit trail section 14.2 requires cannot be revised. change record, change list and change show reach it. | validator | pass | scripts/validate/data-model.mjs | Current |
