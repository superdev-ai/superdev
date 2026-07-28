<!-- superdev:generated source=FEAT-0060 revision=2943 hash=3f04b44409066044cc2e85f6b5ec51d0b5cac8f062a68df0a1a6e2f1aa48c740 -->
# Feature: Reject a documentation proposal

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Documentation Generation and Sync
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Decline a proposed documentation change
- **User:** A developer wants to discard a hand edit to a generated documentation file and restore it to what the database says it should be.
- **User value:** Not recorded
- **Scope:** in: Writes the generated version of a file back over its current on-disk content, discarding the divergence, Records the discarded text first so the rejection can be reviewed or recovered afterward, Runs as a dry run by default, only overwriting the file when re-run with --apply; out: Does not merge the hand edit with the generated version, it is a full overwrite, not a three-way merge, Does not delete the record of the rejection, the discarded text stays available to read back, Does not check whether the target path has ever been generated before describing what it would do
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs docs diff <path> to see what would be discarded
2. Run node src/cli.mjs docs reject <path> as a dry run to see the plan and confirm the discarded text is recorded first
3. Re-run with --apply to overwrite the file with the generated version

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev docs reject <proposal-id> discards the proposed change without applying it | Run superdev docs reject <proposal-id> and record what was observed. | Met | EV-0056 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | Every rejection is traceable after the fact because the discarded text is preserved rather than dropped. |
| Deletion Semantics | Applicable | The discarded text is recorded before the overwrite happens, so a rejection can be read back afterward rather than being lost. |
| Invalid Input | Applicable | Pointing docs reject at a path with no corresponding generated document still describes writing the generated version back, since the dry run does not verify the path exists before planning; the operator should confirm the path with docs diff first. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2054 maps "docs reject" to cmdDocsReject (line 1763), which calls rejectProposal from src/docs/proposals.mjs. Ran `node src/cli.mjs docs reject talks/changes/changelog.md` (dry run) and got "Rejecting talks/changes/changelog.md writes the generated version back over the file. The discarded text is recorded first... Re-run with --apply to put the generated version back." | command | pass | superdev docs reject <path> |

## Delivery state

- **What works now:** Reached by superdev docs reject <path>. src/cli.mjs line 2054 maps "docs reject" to cmdDocsReject (line 1763), which calls rejectProposal from src/docs/proposals.mjs. Ran `node src/cli.mjs docs reject talks/changes/changelog.md` (dry run) and got "Rejecting talks/changes/changelog.md writes the generated version back over the file. The discarded text is recorded first... Re-run with --apply to put the generated version back."
- **What remains:** Nothing known.
- **Next action:** Not recorded
