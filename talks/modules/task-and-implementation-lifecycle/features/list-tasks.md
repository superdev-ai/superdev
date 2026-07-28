<!-- superdev:generated source=FEAT-0042 revision=2943 hash=9a5a60f69ead57def0ae27685a56f33ba05656489b40fbbbd29a6521f12ff6d0 -->
# Feature: List tasks

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all tasks and their state
- **User:** A developer resuming after time away needs to see what work is still open, in a stable order, without wading through every task that was ever closed.
- **User value:** Not recorded
- **Scope:** in: Runs superdev task list, read only, defaults to open tasks only, oldest first, Supports --status and --feature to narrow which tasks are returned, and --all to include closed and done tasks too, Supports --limit to cap how many rows come back; out: Does not let the user create, claim, or change a task from this command, those are separate task create, task claim, and task start commands, Does not decide which task to work on next, it only lists what is open
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task list to see open tasks with id, status, priority, feature, and name
2. Add --status, --feature, or --all to change which tasks are included
3. Add --limit to cap the row count if narrowing further

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task list returns every task with status | Run superdev task list and record what was observed. | Met | EV-0022 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | No task matching the current filter prints a plain no-task-matches-that-filter line instead of an empty table. |
| Invalid Input | Applicable | An unrecognized --status value is not validated against known statuses, it is just used directly in the filter, so it silently returns zero rows rather than erroring with the list of valid statuses. |
| Limits And Quotas | Applicable | The --limit flag is clamped between 1 and 1000 and defaults to 200, so a value of 0 or a huge number is silently corrected rather than rejected, confirmed by passing --limit 0 and getting exactly 1 row back. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran `node src/cli.mjs task list`, got 4 open tasks (TASK-0001..TASK-0004) with id, status, priority, feature, name, sourced from src/cli.mjs:864 cmdTaskList querying the tasks table. | command | pass | superdev task list |

## Delivery state

- **What works now:** Reached by superdev task list. Ran `node src/cli.mjs task list`, got 4 open tasks (TASK-0001..TASK-0004) with id, status, priority, feature, name, sourced from src/cli.mjs:864 cmdTaskList querying the tasks table.
- **What remains:** Nothing known.
- **Next action:** Not recorded
