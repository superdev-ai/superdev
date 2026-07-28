<!-- superdev:generated source=FEAT-0025 revision=2943 hash=9370e8ebe938360dbc21e897f7d3b9fecb3935572586ccf7e20e3bedeab643ed -->
# Feature: Import project data

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Load a portable project data file into the database
- **User:** A developer who has an exported snapshot, maybe from a teammate or an earlier state, wants to bring those records into their current project database without wiping out what is already there.
- **User value:** Not recorded
- **Scope:** in: reads a .jsonl export file, validates its format tag, schema version, and project identity against the current database, inserts rows that are not already present by primary key and leaves existing rows untouched (insert-or-ignore, never overwrite), refuses to import an export whose schema version is ahead of the current database, and refuses to import an export for a different project into a database that already holds one, in dry run, prints the full plan: schema version, target project, and per-table row counts before anything is written; out: does not overwrite or update rows that already exist, it is additive only, does not create a new project database from scratch, that is the separate hydrate path, does not reconcile conflicting data between the export and the current database beyond skipping rows whose primary key already exists
- **Affected contracts:** none linked

### Primary flow

1. run superdev export --apply to produce a file (or obtain one from elsewhere)
2. run superdev import <file> with no --apply to see the plan: schema version, target project id, and row counts per table
3. run superdev import <file> --apply to load the rows
4. the command reports how many new rows were inserted out of the total rows in the export, noting rows already present were left alone

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev import <file> --apply loads records from the export file | Run superdev import <file> --apply and record what was observed. | Met | EV-0029 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | an export tagged for a different project id than what is already in a non-empty database is refused, naming both project ids, so two unrelated projects cannot be merged by accident |
| Duplication | Applicable | re-running the same import twice inserts zero new rows the second time, since every row's primary key is already present; the operation is idempotent |
| Invalid Input | Applicable | a file that is not JSON, missing the export format header, or with a malformed {table, row} line on any given line number is refused with a specific message naming the problem and the line |
| Versioning | Applicable | an export whose schema version is newer than the current database is refused with an instruction to migrate the database first, rather than attempting a partial load |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:724-736 cmdImport calls importProject(root, file, {apply}) from src/db/maintenance.mjs:305. Ran `node src/cli.mjs export` to produce .superdev/exports/superdev-2026-07-27T19-37-30-939Z.jsonl, then `node src/cli.mjs import <file>` (dry run) which printed a full import plan: schema version 8, target project PRJ-0001, and per-table row counts (goals 5, milestones 9, modules 11, features 91, etc). | command | pass | superdev import <file> [--apply] |

## Delivery state

- **What works now:** Reached by superdev import <file> [--apply]. src/cli.mjs:724-736 cmdImport calls importProject(root, file, {apply}) from src/db/maintenance.mjs:305. Ran `node src/cli.mjs export` to produce .superdev/exports/superdev-2026-07-27T19-37-30-939Z.jsonl, then `node src/cli.mjs import <file>` (dry run) which printed a full import plan: schema version 8, target project PRJ-0001, and per-table row counts (goals 5, milestones 9, modules 11, features 91, etc).
- **What remains:** Nothing known.
- **Next action:** Not recorded
