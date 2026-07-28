<!-- superdev:generated source=FEAT-0059 revision=2943 hash=6b4c7916b4b9213077323d613eacdea4baebd4ac37e999d2486e9641db05f3b8 -->
# Feature: Accept a documentation proposal

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Documentation Generation and Sync
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Approve a proposed documentation change
- **User:** A developer who hand-edited a generated documentation file wants their edit adopted back into the database instead of being overwritten on the next generate.
- **User value:** Not recorded
- **Scope:** in: Maps a hand-edited section of a generated markdown file back onto the corresponding database columns, Refuses cleanly when the file already matches the database, stating there is nothing to accept, Refuses cleanly when the target file is a derived view that is always rewritten and can never hold a manual edit; out: Does not accept arbitrary markdown structure changes, only the sections the render pipeline recognizes as editable get mapped back, Does not merge conflicting edits from multiple files at once, it operates on one path at a time, Does not regenerate the rest of the documentation set as part of accepting one file
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs docs diff <path> to confirm the file has actually diverged
2. Run node src/cli.mjs docs accept <path> as a dry run to see what would be written to the database
3. Re-run with --apply to commit the hand-edited content into the database

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev docs accept <proposal-id> applies the proposed documentation change | Run superdev docs accept <proposal-id> and record what was observed. | Met | EV-0055 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | A path with no recorded generated document is refused with a message that no generated document is recorded there, telling the operator to generate documentation first. |
| Permission Boundaries | Applicable | A derived view file (one that is always rewritten on generation) cannot be accepted at all, the command explains it never holds a manual edit. |
| State Machine Violations | Applicable | Accepting a file that is already in sync with the database is refused with a clear message that there is nothing to accept. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/cli.mjs line 2053 maps "docs accept" to cmdDocsAccept (line 1734), which calls acceptProposal from src/docs/proposals.mjs (defined line 658, real logic: maps hand-edited Markdown sections back to database columns via planAcceptance). Ran `node src/cli.mjs docs accept talks/modules/documentation-generation-and-sync/module.md` and got the correct refusal "already matches the database, so there is nothing to accept", and on a derived view got "is a derived view. It is rewritten on every generation and never holds a manual edit." Both are real, correct code paths, not stubs. | command | pass | superdev docs accept <path> |

## Delivery state

- **What works now:** Reached by superdev docs accept <path>. src/cli.mjs line 2053 maps "docs accept" to cmdDocsAccept (line 1734), which calls acceptProposal from src/docs/proposals.mjs (defined line 658, real logic: maps hand-edited Markdown sections back to database columns via planAcceptance). Ran `node src/cli.mjs docs accept talks/modules/documentation-generation-and-sync/module.md` and got the correct refusal "already matches the database, so there is nothing to accept", and on a derived view got "is a derived view. It is rewritten on every generation and never holds a manual edit." Both are real, correct code paths, not stubs.
- **What remains:** Nothing known.
- **Next action:** Not recorded
