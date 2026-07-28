<!-- superdev:generated source=FEAT-0020 revision=2943 hash=5c14d6382e2169250cd4c6c68c542063d6db7961e76419fba9733ff2394754e7 -->
# Feature: Check database status

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Report whether the local database is accessible and at the expected schema version
- **User:** A developer or agent resuming work wants to confirm the local database is reachable, on the right schema version, and not silently corrupted before trusting anything else it reports.
- **User value:** Not recorded
- **Scope:** in: Reports the current schema version against the latest available migration and how many are pending, Runs an integrity check against the actual database file and reports Sound or Damaged, Detects drift: an applied migration missing from the migrations directory, or one whose file changed after it was applied, Lists row counts for every table that currently holds at least one row; out: Does not fix anything it finds; a damaged database or pending migrations are reported only, not repaired here, Does not require the local service to be stopped; this check only reads, Does not list tables with zero rows in the row-count table, to keep the output to what actually has data
- **Affected contracts:** none linked

### Primary flow

1. Run superdev db status
2. Command reads the schema version and diffs it against the migrations directory
3. Runs an integrity check against the database file
4. Reports version, pending count, integrity, drift and non-zero row counts per table
5. Exits non-zero if integrity failed or drift was found, so the check can gate scripts

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev db status returns accessibility and schema version | Run superdev db status and record what was observed. | Met | EV-0016 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | the exit code reflects actual health, zero only when integrity is sound and no drift exists, so other tooling can gate on it without parsing text |
| Data Migration States | Applicable | pending migration count and drift (an applied migration whose file changed or disappeared) are reported as two separate signals rather than folded into one |
| Empty States | Applicable | if the directory has no Superdev database yet, it prints that this directory has no database yet and to run init, and exits 1, instead of a blank status table |
| Versioning | Applicable | schema version is reported as current-of-latest against the migrations directory on disk, so a directory with newer migration files than the database immediately shows a version gap |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:740-773 cmdDbStatus, registered at line 2033. Ran `node src/cli.mjs db status`: printed Schema version 8 of 8, Pending migrations 0, Integrity Sound, Drift None, plus full row-count table across 29 tables. | command | pass | superdev db status |

## Delivery state

- **What works now:** Reached by superdev db status. src/cli.mjs:740-773 cmdDbStatus, registered at line 2033. Ran `node src/cli.mjs db status`: printed Schema version 8 of 8, Pending migrations 0, Integrity Sound, Drift None, plus full row-count table across 29 tables.
- **What remains:** Nothing known.
- **Next action:** Not recorded
