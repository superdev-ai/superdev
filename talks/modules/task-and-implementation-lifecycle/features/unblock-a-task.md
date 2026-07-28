<!-- superdev:generated source=FEAT-0050 revision=2943 hash=24927be8417835f413586a20c6cd28ddad0818382bba979bda51580827f79e7f -->
# Feature: Unblock a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Clear a blocker and resume eligibility for work
- **User:** An engineer who has cleared whatever was stopping a task needs to put it back in the active queue without hand-editing its status.
- **User value:** Not recorded
- **Scope:** in: moves a blocked task back to ready, or to whatever status it held before it was blocked, in one recorded transition, lets the caller name an explicit target status with --to instead of the inferred one, looks up the most recent status-history entry that led into blocked to decide the default return status, clears the blocked state as part of the same transition, confirmed by task show afterward; out: does not check whether the blocker is actually resolved, it trusts whoever runs the command, does not re-claim the task for anyone, only the status changes, does not touch subtasks or dependent tasks, only the one task named
- **Affected contracts:** none linked

### Primary flow

1. run superdev task unblock TASK-id as a dry run to see the status it would return to
2. re-run with --apply
3. superdev task show TASK-id confirms Status: Ready (or the earlier in-progress status) with the blocked reason cleared

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task unblock <TASK-id> clears blocked status | Run superdev task unblock <TASK-id> and record what was observed. | Met | EV-0072 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | unblocking an id that does not exist returns a not-found error naming the id and suggesting how to find the real one, before any status logic runs. |
| Ordering | Applicable | the default target is read from the task's own status history: if the status right before it was blocked was in_progress, in_review or verifying it returns there, otherwise it defaults to ready. |
| Permission Boundaries | Not Applicable | N/A - the CLI layer has no authenticated user or role model; any actor label passed on the command line is accepted, so there is no permission check to violate here. |
| State Machine Violations | Applicable | unblocking a task that is not currently blocked is refused with a message naming its real status: it is <status>, not blocked, so there is nothing to unblock. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:1072 cmdTaskUnblock calls unblockTask (src/tasks/lifecycle.mjs:408), registered as "task unblock" (src/cli.mjs:2043). After blocking TASK-0001 above, ran `node src/cli.mjs task unblock TASK-0001 --apply`, which printed "TASK-0001 is Ready again." and `task show TASK-0001` confirmed Status: Ready with the blocked-reason field cleared. | command | pass | superdev task unblock <TASK-id> --apply |

## Delivery state

- **What works now:** Reached by superdev task unblock <TASK-id> --apply. src/cli.mjs:1072 cmdTaskUnblock calls unblockTask (src/tasks/lifecycle.mjs:408), registered as "task unblock" (src/cli.mjs:2043). After blocking TASK-0001 above, ran `node src/cli.mjs task unblock TASK-0001 --apply`, which printed "TASK-0001 is Ready again." and `task show TASK-0001` confirmed Status: Ready with the blocked-reason field cleared.
- **What remains:** Nothing known.
- **Next action:** Not recorded
