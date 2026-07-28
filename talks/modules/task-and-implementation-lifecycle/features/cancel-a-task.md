<!-- superdev:generated source=FEAT-0053 revision=2943 hash=5f3e15b7cf99230d797aa90ac93364a9dfc4db00f005448ff8e87ca3e954854e -->
# Feature: Cancel a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Close a task that will not be completed
- **User:** A developer or lead who decides a task will not be finished needs to close it out with a stated reason instead of leaving it open or silently dropping it.
- **User value:** Not recorded
- **Scope:** in: moves an open task to cancelled, requiring a reason every time, releases the active claim on the task as part of the same transaction, the move is written into the same status-history trail as every other transition, not a special case; out: does not delete the task record, its evidence or its history, cancellation is a status change, not a removal, does not allow cancelling from every status, a task already complete or superseded cannot be cancelled, does not enforce any particular wording or length on the reason, plain text is accepted as is
- **Affected contracts:** none linked

### Primary flow

1. run superdev task cancel TASK-id --reason "..." as a dry run
2. re-run with --apply, which prints that the task is cancelled
3. task show confirms Status: Cancelled

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task cancel <TASK-id> marks the task cancelled and preserves history | Run superdev task cancel <TASK-id> and record what was observed. | Met | EV-0075 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Deletion Semantics | Applicable | cancelling never removes the task, its evidence or its links, and the state is not final in the database sense, reopen can bring the same task back. |
| Invalid Input | Applicable | omitting --reason is refused before the transition runs, with a message that a cancelled task needs the reason so nobody re-derives the same work by accident. |
| Permission Boundaries | Not Applicable | N/A - there is no authenticated role check at this layer, the actor recorded is a free-text label supplied on the command line. |
| State Machine Violations | Applicable | a task that is already complete or superseded cannot move to cancelled, since neither of those statuses lists cancelled among its allowed next states. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:1601 cmdTaskCancel calls cancelTask (src/tasks/lifecycle.mjs:530), registered as "task cancel" (src/cli.mjs:2047). Ran `node src/cli.mjs task cancel TASK-0002 --reason "superseded by a different approach" --apply`, which printed "TASK-0002 is cancelled." and `task show TASK-0002` confirmed Status: Cancelled. | command | pass | superdev task cancel <TASK-id> --reason "<text>" --apply |

## Delivery state

- **What works now:** Reached by superdev task cancel <TASK-id> --reason "<text>" --apply. src/cli.mjs:1601 cmdTaskCancel calls cancelTask (src/tasks/lifecycle.mjs:530), registered as "task cancel" (src/cli.mjs:2047). Ran `node src/cli.mjs task cancel TASK-0002 --reason "superseded by a different approach" --apply`, which printed "TASK-0002 is cancelled." and `task show TASK-0002` confirmed Status: Cancelled.
- **What remains:** Nothing known.
- **Next action:** Not recorded
