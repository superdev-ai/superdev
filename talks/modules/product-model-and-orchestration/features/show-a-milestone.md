<!-- superdev:generated source=FEAT-0031 revision=2943 hash=c1f5f5c117009cae5de19bef79f2f1f69fdb661da715510e0f50e9497f87f1fc -->
# Feature: Show a milestone

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show detail for a single milestone
- **User:** An engineering lead scoping a milestone wants to open it and see what it delivers, its exit conditions, and exactly which features are scheduled into it with their current status.
- **User value:** Not recorded
- **Scope:** in: looks up one milestone by id and shows status, its delivers text, and a completed-versus-scheduled feature count, lists exit conditions for the milestone, lists every feature scheduled into the milestone with its own status; out: does not let a reader add, remove, or reschedule features into the milestone, this is read only, does not compute a completion date, only a count of complete versus scheduled features
- **Affected contracts:** none linked

### Primary flow

1. run superdev milestone show MS-0001
2. read status, delivers text, and the 'N of M complete' scheduled-feature count
3. read the exit conditions
4. read the list of scheduled features with status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev milestone show <MILESTONE-id> returns the milestone's full record | Run superdev milestone show <MILESTONE-id> and record what was observed. | Met | EV-0035 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | the completed count only counts features whose status is complete, delivered, or implemented, so a feature that is in progress or blocked counts as not complete even if work on it has started |
| Empty States | Applicable | no exit conditions recorded prints 'None recorded, so nothing says when this is reached.'; no features scheduled prints 'Nothing is scheduled into it.' |
| Invalid Input | Applicable | an unknown milestone id prints 'There is no milestone MS-9999.' and exits 1; omitting the id prints 'Say which milestone: superdev milestone show <MS-id>.' and exits 2 |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2065 maps 'milestone show' to cmdMilestoneShow. Ran `node src/cli.mjs milestone show MS-0001`, printed status, delivers text, scheduled feature completion count, exit conditions, and a list of 29 scheduled features. | command | pass | superdev milestone show <MILESTONE-id> |

## Delivery state

- **What works now:** Reached by superdev milestone show <MILESTONE-id>. src/cli.mjs:2065 maps 'milestone show' to cmdMilestoneShow. Ran `node src/cli.mjs milestone show MS-0001`, printed status, delivers text, scheduled feature completion count, exit conditions, and a list of 29 scheduled features.
- **What remains:** Nothing known.
- **Next action:** Not recorded
