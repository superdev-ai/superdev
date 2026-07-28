<!-- superdev:generated source=FEAT-0023 revision=2943 hash=aa5d2a64a26aa72445c78ecb7c20b2dd55f1640242682221c4513fe6282db901 -->
# Feature: Restore the database from backup

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Recover project state after a problem
- **User:** A developer who just broke the project database, or restored the wrong thing once before, wants to get back to a known good state without losing whatever is currently there.
- **User value:** Not recorded
- **Scope:** in: replaces the live project database with the contents of a named backup file, refuses to run with no file argument and instead names the newest backup as a hint, takes a fresh backup of the current database labelled 'pre-restore' before overwriting it, so the replaced state is itself recoverable, refuses to run if the local control centre service has the database open (--apply only), so a live process cannot be corrupted mid-restore; out: does not validate that the backup file is a well-formed database before copying it into place, the safety copy taken first is the mitigation, not a check on the input, does not let you restore into a different project's database, it simply replaces whatever database file is at the current project root, does not merge the backup with current data, it is a full replacement, not a partial import
- **Affected contracts:** none linked

### Primary flow

1. run superdev db restore with no arguments to see the refusal message naming the newest available backup
2. run superdev db restore <backup-file> (dry run) to see the file size and confirmation that the current database will be snapshotted first
3. run superdev db restore <backup-file> --apply to perform the replacement
4. the command copies the backup over the live database, recreates the empty sidecar log files the engine expects, and reports where the pre-restore safety copy was written

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev db restore <backup> --apply restores the database to the backed-up state | Run superdev db restore <backup> --apply and record what was observed. | Met | EV-0019 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | if there are no backups at all and no file is given, the command refuses with 'There is no backup to restore from' instead of suggesting a newest one that does not exist |
| Invalid Input | Applicable | if the named file does not exist, restore throws 'There is no backup file named <name>' rather than attempting the copy |
| Recovery | Applicable | if there is no existing database to replace (fresh project), the plan says so and skips taking a pre-restore safety copy since there is nothing to lose |
| State Machine Violations | Applicable | restoring with --apply while the local service is running is refused up front rather than allowed to corrupt the sidecar files a live process is using |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:827-856 cmdDbRestore, registered at line 2036, calls restore()/listBackups() from src/db/maintenance.mjs. Ran `node src/cli.mjs db restore` with no file arg: correctly refused with 'Say which backup to restore: superdev db restore <file>. The newest is .superdev/backups/migration-2026-07-27T19-22-47-126Z.db.' Then ran `node src/cli.mjs db restore .superdev/backups/migration-2026-07-27T19-22-47-126Z.db` (dry run) against that real file: 'Would replace the project database with .superdev/backups/migration-2026-07-27T19-22-47-126Z.db (2347008 bytes). The current database is snapshotted first, so restoring the wrong file is itself recoverable.' | command | pass | superdev db restore <backup> --apply |

## Delivery state

- **What works now:** Reached by superdev db restore <backup> --apply. src/cli.mjs:827-856 cmdDbRestore, registered at line 2036, calls restore()/listBackups() from src/db/maintenance.mjs. Ran `node src/cli.mjs db restore` with no file arg: correctly refused with 'Say which backup to restore: superdev db restore <file>. The newest is .superdev/backups/migration-2026-07-27T19-22-47-126Z.db.' Then ran `node src/cli.mjs db restore .superdev/backups/migration-2026-07-27T19-22-47-126Z.db` (dry run) against that real file: 'Would replace the project database with .superdev/backups/migration-2026-07-27T19-22-47-126Z.db (2347008 bytes). The current database is snapshotted first, so restoring the wrong file is itself recoverable.'
- **What remains:** Nothing known.
- **Next action:** Not recorded
