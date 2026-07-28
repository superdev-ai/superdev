<!-- superdev:generated source=FEAT-0064 revision=2943 hash=5e7bef08d8a1c045894158386d212682ed1f9e046d09428ad7ae4d4e5c080e2a -->
# Feature: Supersede a decision

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Decisions, Changes, and Questions
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0003 Always-answerable project state, GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Replace an earlier decision without deleting its history
- **User:** A lead who made a call that turned out wrong needs to record the new call without erasing the trail that shows what was believed before and why it changed.
- **User value:** Not recorded
- **Scope:** in: Takes the id of the decision being replaced plus a new title and decision text and creates a fresh decision row for the replacement, Links the old decision to the new one in both directions (supersedes_id and superseded_by_id) so the chain can be walked either way, Sets the old decision's status to superseded, or partially_superseded when --partial is passed with a --scopeDelta explaining what stops applying, Refuses to supersede a decision that is already superseded, naming the decision that already replaced it, so chains cannot fork; out: Does not delete or edit the original decision's content, only its status and links, so the history of what was believed stays readable, Does not decide for the user whether the change is a full or partial supersession, that judgment call is the caller's, Does not automatically re-check tasks or features that the old decision governed for consistency with the new one
- **Affected contracts:** none linked

### Primary flow

1. Run superdev decision list to find the id of the decision to replace
2. Run superdev decision supersede DEC-0001 --title "..." --decision "..." as a dry run to see the plan text
3. Re-run with --apply to record the replacement decision and mark the old one superseded
4. Run superdev decision list --all afterward to see both the old (superseded) and new decision

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev decision supersede <DECISION-id> links the old decision to its replacement and preserves both | Run superdev decision supersede <DECISION-id> and record what was observed. | Met | EV-0060 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | Both decisions remain queryable afterward: the old one keeps its original content with a superseded status and a reason, the new one stands as its own record, so the reasoning trail survives. |
| Empty States | Not Applicable | N/A - The command requires an existing decision id as its first argument; if the id does not exist it errors immediately rather than presenting an empty result, so there is no empty-list state to show. |
| Invalid Input | Applicable | Passing --partial without --scopeDelta is rejected before anything is written, because a partial supersession without a stated scope delta would leave nobody able to tell what still governs. |
| State Machine Violations | Applicable | Superseding a decision that already has a superseded_by_id fails with an error naming the existing replacement, rather than creating a second competing replacement. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2087 maps "decision supersede" to cmdDecisionSupersede (line 1488), which calls supersedeDecision from src/decisions/record.mjs. Ran `node src/cli.mjs decision supersede DEC-0001 --title "Docs skill changes" --decision "Docs skill is being replaced"` (dry run) and got "Would record \"Docs skill changes\" and mark DEC-0001 superseded. Nothing has changed. Re-run with --apply to record it." Confirmed DEC-0001 exists via `node src/cli.mjs decision list`. | command | pass | superdev decision supersede <id> |

## Delivery state

- **What works now:** Reached by superdev decision supersede <id>. src/cli.mjs line 2087 maps "decision supersede" to cmdDecisionSupersede (line 1488), which calls supersedeDecision from src/decisions/record.mjs. Ran `node src/cli.mjs decision supersede DEC-0001 --title "Docs skill changes" --decision "Docs skill is being replaced"` (dry run) and got "Would record \"Docs skill changes\" and mark DEC-0001 superseded. Nothing has changed. Re-run with --apply to record it." Confirmed DEC-0001 exists via `node src/cli.mjs decision list`.
- **What remains:** Nothing known.
- **Next action:** Not recorded
