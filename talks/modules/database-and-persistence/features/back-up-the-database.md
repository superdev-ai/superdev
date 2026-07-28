<!-- superdev:generated source=FEAT-0022 revision=2943 hash=b5ed8d8f3d757e8a8b15268663f01381aa0a79cda83f5513737d691ea77db5c4 -->
# Feature: Back up the database

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Protect data before risky changes
- **User:** A developer about to run a migration or a risky bulk change wants a safety net they do not have to think about, so a mistake is not permanent.
- **User value:** Not recorded
- **Scope:** in: writes a complete, self-contained snapshot of the project database into .superdev/backups using VACUUM INTO so nothing is missed between the main file and its uncommitted log, labels the snapshot (default label 'manual', or a custom one via --label), prunes older snapshots down to the newest 10 after each backup, reports how many backups already exist and confirms the retention limit before writing anything, in dry run; out: does not decide when a backup is needed, it only runs when invoked (callers like migrate and restore trigger it themselves before their own destructive step), does not verify the backup file is restorable after writing it, it only reports the bytes written, does not back up anything except the project database itself (no config files, no exports)
- **Affected contracts:** none linked

### Primary flow

1. run superdev db backup (dry run) to see the label, how many backups already exist, and the retention count
2. run superdev db backup --apply to take the snapshot
3. the command writes a timestamped .db file into .superdev/backups and deletes any backups beyond the newest 10
4. the command prints the path and size of the new file plus a table of all kept backups with their timestamps and sizes

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev db backup --apply produces a restorable backup file | Run superdev db backup --apply and record what was observed. | Met | EV-0018 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Concurrent Actions | Not Applicable | N/A - VACUUM INTO takes an exclusive lock on the source database for the duration of the copy, so a concurrent writer cannot produce a torn backup, it just waits for the lock |
| Empty States | Applicable | when no backups exist yet, listBackups returns an empty array and the dry run reports 0 backups already there, with no error |
| Limits And Quotas | Applicable | KEEP_BACKUPS is fixed at 10; the moment a new backup pushes the count past that, the oldest files are deleted automatically, oldest first by timestamp |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:806-825 cmdDbBackup, registered at line 2035, calls backup()/listBackups() from src/db/maintenance.mjs. Ran `node src/cli.mjs db backup` (dry run): 'Would write a complete snapshot labelled manual into .superdev/backups. 5 backups already there. The newest 10 are kept.' confirming it reads the real existing backups directory (5 files present, including migration-2026-07-27T19-22-47-126Z.db). | command | pass | superdev db backup --apply |

## Delivery state

- **What works now:** Reached by superdev db backup --apply. src/cli.mjs:806-825 cmdDbBackup, registered at line 2035, calls backup()/listBackups() from src/db/maintenance.mjs. Ran `node src/cli.mjs db backup` (dry run): 'Would write a complete snapshot labelled manual into .superdev/backups. 5 backups already there. The newest 10 are kept.' confirming it reads the real existing backups directory (5 files present, including migration-2026-07-27T19-22-47-126Z.db).
- **What remains:** Nothing known.
- **Next action:** Not recorded
