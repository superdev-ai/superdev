<!-- superdev:generated source=FEAT-0054 revision=2943 hash=8efaede706b116905b4847a45c8ff66cb1289a909aed785eab234e5beda5efa5 -->
# Feature: Reopen a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Return a completed or cancelled task to active status
- **User:** A developer or lead who completed or cancelled a task too early, or whose decision reversed, needs to bring it back to active work with a stated reason.
- **User value:** Not recorded
- **Scope:** in: moves a complete task back to in_progress or a cancelled task back to ready by default, or to an explicit status named with --to, requires a reason, always recorded, since the record already said the work was finished, clears the completed_at or cancelled_at timestamp as part of the same transition; out: does not restore the released claim, the task comes back unclaimed and must be claimed again, does not re-check whether the evidence that justified the original completion still holds, does not allow reopening a task that is already open, that is refused as nothing to reopen
- **Affected contracts:** none linked

### Primary flow

1. run superdev task reopen TASK-id --reason "..." as a dry run
2. re-run with --apply
3. task show confirms the task is active again in the expected status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task reopen <TASK-id> restores the task to an active state | Run superdev task reopen <TASK-id> and record what was observed. | Met | EV-0076 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | omitting --reason is refused before the transition runs, since reopening finished work needs a stated reason. |
| Ordering | Applicable | the default destination depends on which terminal state the task was in: complete returns to in_progress, cancelled returns to ready, and --to overrides either default. |
| Recovery | Applicable | verified from both terminal states in this project: a completed task reopened back to in_progress, and a cancelled task reopened back to ready, each confirmed by task show afterward. |
| State Machine Violations | Applicable | reopening a task that is already open (ready, in progress, blocked, and so on) is refused with a message that it is already open and there is nothing to reopen. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:1637 cmdTaskReopen calls reopenTask (src/tasks/lifecycle.mjs:513), registered as "task reopen" (src/cli.mjs:2050). Verified from both terminal states: reopening the just-completed TASK-0001 (`task reopen TASK-0001 --reason "acceptance criterion regressed" --apply`) returned it to In Progress; reopening the just-cancelled TASK-0002 (`task reopen TASK-0002 --reason "decision reversed, resuming work" --apply`) returned it to Ready. Both status changes confirmed with `task show`. | command | pass | superdev task reopen <TASK-id> --reason "<text>" --apply |

## Delivery state

- **What works now:** Reached by superdev task reopen <TASK-id> --reason "<text>" --apply. src/cli.mjs:1637 cmdTaskReopen calls reopenTask (src/tasks/lifecycle.mjs:513), registered as "task reopen" (src/cli.mjs:2050). Verified from both terminal states: reopening the just-completed TASK-0001 (`task reopen TASK-0001 --reason "acceptance criterion regressed" --apply`) returned it to In Progress; reopening the just-cancelled TASK-0002 (`task reopen TASK-0002 --reason "decision reversed, resuming work" --apply`) returned it to Ready. Both status changes confirmed with `task show`.
- **What remains:** Nothing known.
- **Next action:** Not recorded
