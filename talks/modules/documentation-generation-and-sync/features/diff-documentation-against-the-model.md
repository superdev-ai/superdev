<!-- superdev:generated source=FEAT-0058 revision=2943 hash=9030f497884c3fbe71c7dce1521c3d7d6613c8be601c49eae06f385f5fadf163 -->
# Feature: Diff documentation against the model

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Documentation Generation and Sync
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show where generated documentation and the product model have diverged
- **User:** A developer wants to check, before generating or accepting anything, exactly which documentation files have drifted from the database and how much.
- **User value:** Not recorded
- **Scope:** in: Compares every generated document against the current database and reports whether the whole set is in sync, Accepts an optional path argument to check a single file and shows its status, plus lines added and removed, Reports a total count of files checked when run with no path; out: Does not write or modify any file, it is read-only in both the whole-project and single-file forms, Does not explain why a file diverged (for example whether it was hand-edited or the model changed), only that it differs, Does not offer to accept or reject the difference itself, that requires docs accept or docs reject
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs docs diff with no arguments to check the whole project
2. Read the summary: in sync or a count of files that differ, out of the total checked
3. Run node src/cli.mjs docs diff <path> for a single file to see its status and line-level change count
4. Follow up with docs accept or docs reject on any file that has diverged

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev docs diff lists differences between current docs and current records | Run superdev docs diff and record what was observed. | Met | EV-0054 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | A single file with zero differences reports Status In Sync with Changed 0 lines added, 0 removed rather than omitting the change line. |
| Empty States | Applicable | When nothing has diverged, the whole-project run prints exactly one line: every generated document matches the database, plus the total files checked. |
| Invalid Input | Applicable | A path that does not correspond to any recorded generated document is reported as not applicable rather than silently returning in sync. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2052 maps "docs diff" to cmdDocsDiff (line 1713), which calls detectProposals or diffProposal from src/docs/proposals.mjs. Ran `node src/cli.mjs docs diff` and got "Every generated document matches the database. 295 files checked." Ran `node src/cli.mjs docs diff talks/modules/documentation-generation-and-sync/module.md` and got a per-file report: "Status In Sync, Changed 0 lines added, 0 removed." | command | pass | superdev docs diff [path] |

## Delivery state

- **What works now:** Reached by superdev docs diff [path]. src/cli.mjs line 2052 maps "docs diff" to cmdDocsDiff (line 1713), which calls detectProposals or diffProposal from src/docs/proposals.mjs. Ran `node src/cli.mjs docs diff` and got "Every generated document matches the database. 295 files checked." Ran `node src/cli.mjs docs diff talks/modules/documentation-generation-and-sync/module.md` and got a per-file report: "Status In Sync, Changed 0 lines added, 0 removed."
- **What remains:** Nothing known.
- **Next action:** Not recorded
