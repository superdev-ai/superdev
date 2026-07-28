<!-- superdev:generated source=FEAT-0030 revision=2943 hash=3611de1ebfe0ff10f766b626fec19fba3275dd0be9cd58ab7db36f85686ab416 -->
# Feature: List milestones

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all milestones
- **User:** A PM or engineering lead surveying overall delivery shape wants one table of every milestone with how many features are scheduled into it and its status.
- **User value:** Not recorded
- **Scope:** in: lists every milestone with id, name, scheduled feature count, and status, orders milestones by their defined sequence; out: does not show which specific features are scheduled into each milestone, that detail is in milestone show, does not compute or forecast a completion date for any milestone
- **Affected contracts:** none linked

### Primary flow

1. run superdev milestone list
2. read the table of milestone id, name, feature count, and status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev milestone list returns every defined milestone | Run superdev milestone list and record what was observed. | Met | EV-0034 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | no milestones recorded prints 'Nothing recorded yet for milestones.' |
| Invalid Input | Not Applicable | N/A - the list command takes no id or filter argument, so there is no bad input to validate |
| Ordering | Applicable | milestones are listed in their defined sequence then id, not alphabetically or by feature count, so the table order matches the product roadmap order rather than any column shown |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2064 maps 'milestone list' to cmdMilestoneList. Ran `node src/cli.mjs milestone list`, printed a table of 9 milestones with feature counts and status. | command | pass | superdev milestone list |

## Delivery state

- **What works now:** Reached by superdev milestone list. src/cli.mjs:2064 maps 'milestone list' to cmdMilestoneList. Ran `node src/cli.mjs milestone list`, printed a table of 9 milestones with feature counts and status.
- **What remains:** Nothing known.
- **Next action:** Not recorded
