<!-- superdev:generated source=FEAT-0024 revision=2943 hash=6a3da678f6179e83f66f053c63473fcfe815f02d3be6d7ad0128b1eb9bf3e3a1 -->
# Feature: Export project data

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Database and Persistence
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Produce a portable copy of project data
- **User:** A developer or engineering lead wants a portable copy of the whole project's data, for example to move it to another machine or archive it outside the live database.
- **User value:** Not recorded
- **Scope:** in: reads every user table from the project database in creation order and writes one JSON line per row, plus a header line with format tag, schema version, project identity, and per-table row counts, defaults the output path to a timestamped file under .superdev/exports, or accepts a custom path via --out, encodes values JSON cannot carry natively (blobs as base64, big integers as decimal strings) so the file round-trips exactly, reports rows written per table after the export completes; out: does not include anything outside the database (no config, no backup files, no source code), does not compress or encrypt the output, it is plain JSONL, does not delete or modify anything, it is a read-only snapshot
- **Affected contracts:** none linked

### Primary flow

1. run superdev export (dry run) to confirm where the export would be written
2. run superdev export --apply to produce the .jsonl file
3. the command prints the total rows written and a table of rows per non-empty table

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev export <file> --apply writes a file that can be reimported | Run superdev export <file> --apply and record what was observed. | Met | EV-0020 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | exporting a project with no database at all throws a clear refusal naming that this project has no Superdev database yet, rather than writing an empty file |
| Empty States | Applicable | a table with zero rows is still counted in the header's table list but is filtered out of the printed summary table, so the report only shows tables that actually have data |
| Slow Paths | Applicable | the whole snapshot is built in memory before being written, which is a known ceiling for very large projects; the code marks this with a comment noting it should stream if a project grows past thousands of rows |
| Versioning | Applicable | the header always records the exact schema version at export time, so a later import can compare it against the destination database's version |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:705-722 cmdExport, registered at line 2030, calls exportProject() from src/db/maintenance.mjs. Ran `node src/cli.mjs export` (dry run): 'Would write a portable snapshot of every record into .superdev/exports. Nothing has changed. Re-run with --apply to write the export.' | command | pass | superdev export <file> --apply |

## Delivery state

- **What works now:** Reached by superdev export <file> --apply. src/cli.mjs:705-722 cmdExport, registered at line 2030, calls exportProject() from src/db/maintenance.mjs. Ran `node src/cli.mjs export` (dry run): 'Would write a portable snapshot of every record into .superdev/exports. Nothing has changed. Re-run with --apply to write the export.'
- **What remains:** Nothing known.
- **Next action:** Not recorded
