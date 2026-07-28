<!-- superdev:generated source=FEAT-0057 revision=2943 hash=f361d4624b88c73733cde94075b5ac1e39cbf2462acc94bf7f57af9e563fd166 -->
# Feature: Generate documentation

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Documentation Generation and Sync
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Produce documentation artifacts from the current product model
- **User:** A developer or agent wants the written documentation to reflect the current state of the database without hand-editing markdown files one by one.
- **User value:** Not recorded
- **Scope:** in: Regenerates documentation files (module pages, feature pages, data pages, changelog) from the current project database, Reports counts: how many files need writing, how many are already correct, how many are held back because of a hand edit, Lists the specific files it would write and any files that are no longer applicable and would be removed, Runs as a dry run by default and only writes files when re-run with --apply; out: Does not touch files that carry a hand edit it cannot reconcile, those are counted as held back rather than overwritten, Does not decide what content goes into the database, it only renders what is already recorded, Does not open or display the generated files, it only reports the plan
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs docs generate without --apply
2. Read the summary line: files to write, files already correct, files held back by a hand edit
3. Read the list of files that would be written and the list of files no longer applicable
4. Re-run with --apply to actually write the changes

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev docs generate produces updated documentation files from current records | Run superdev docs generate and record what was observed. | Met | EV-0053 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Deletion Semantics | Applicable | Files that no longer correspond to any current record are reported under No longer applicable rather than deleted immediately, giving the operator visibility before anything is removed. |
| Dependency Failure | Not Applicable | N/A - Generation reads only from the local project database, there is no external service call that can fail. |
| Empty States | Applicable | When every generated file already matches the database and nothing is obsolete, the counts show 0 to write and the full count already correct, with no file lists printed. |
| State Machine Violations | Applicable | A file that has been hand-edited since it was generated is not silently overwritten, it is counted as held back by a hand edit and left alone until the conflict is resolved through docs diff/accept/reject. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2051 maps "docs generate" to cmdDocsGenerate, which calls generate() from src/docs/render.mjs. Ran `node src/cli.mjs docs generate` (dry run) and it printed "1 file to write, 290 already correct, 0 held back by a hand edit" with a list of files and skipped ones, ending "Re-run with --apply to write them." | command | pass | superdev docs generate |

## Delivery state

- **What works now:** Reached by superdev docs generate. src/cli.mjs line 2051 maps "docs generate" to cmdDocsGenerate, which calls generate() from src/docs/render.mjs. Ran `node src/cli.mjs docs generate` (dry run) and it printed "1 file to write, 290 already correct, 0 held back by a hand edit" with a list of files and skipped ones, ending "Re-run with --apply to write them."
- **What remains:** Nothing known.
- **Next action:** Not recorded
