<!-- superdev:generated source=FEAT-0049 revision=2943 hash=1c7b9ca8542d7027254692058abc36442b9834f03bd53bf8334f36a80274ac8b -->
# Feature: Block a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Record that a task cannot proceed and why
- **User:** A developer stuck on a task, waiting on a dependency or a decision from someone else, needs to say so on the record rather than leaving the task silently stalled.
- **User value:** Not recorded
- **Scope:** in: Moves the task to blocked and requires a plain-language --reason, refusing the call without one, Records the reason as a memory entry before attempting the status move, so the reason survives even if the transition itself is refused, Applies only with --apply; without it, task block still enforces the reason requirement but performs no database write; out: Does not decide what unblocks the task, that is a separate task unblock command, Does not stop the clock or reassign the task, the existing claim if any is untouched, Does not accept a block with no reason under any circumstance, unlike release which allows an empty reason
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task block TASK-0001 --reason "waiting on design review" --apply
2. Command records the reason as a memory, then moves the task's status to Blocked
3. Confirmation prints 'TASK-0001 is Blocked. The reason is on the record.'
4. Run superdev task show TASK-0001 to see Status: Blocked and the recorded reason

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task block <TASK-id> sets blocked status with a recorded reason | Run superdev task block <TASK-id> and record what was observed. | Met | EV-0071 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | The block reason is written as a memory entry linked to the task before the status move is attempted, so a refused transition still leaves the reason discoverable |
| Invalid Input | Applicable | Calling task block without --reason is refused with 'A blocked task needs the reason it is blocked, in plain language, so the next person can unblock it' |
| State Machine Violations | Applicable | Blocking a task whose current status has no allowed path to blocked (per the transition table) is refused naming the reachable statuses, even though the reason has already been recorded as a memory |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:1626 cmdTaskBlock calls blockTask (src/tasks/lifecycle.mjs:399), registered as "task block" in COMMANDS (src/cli.mjs:2049). Ran against a scratch copy of the project's own dogfood database: `node src/cli.mjs task block TASK-0001 --reason "waiting on design review" --apply` printed "TASK-0001 is Blocked. The reason is on the record." and `task show TASK-0001` afterward showed Status: Blocked, Blocked because: waiting on design review. | command | pass | superdev task block <TASK-id> --reason "<text>" --apply |

## Delivery state

- **What works now:** Reached by superdev task block <TASK-id> --reason "<text>" --apply. src/cli.mjs:1626 cmdTaskBlock calls blockTask (src/tasks/lifecycle.mjs:399), registered as "task block" in COMMANDS (src/cli.mjs:2049). Ran against a scratch copy of the project's own dogfood database: `node src/cli.mjs task block TASK-0001 --reason "waiting on design review" --apply` printed "TASK-0001 is Blocked. The reason is on the record." and `task show TASK-0001` afterward showed Status: Blocked, Blocked because: waiting on design review.
- **What remains:** Nothing known.
- **Next action:** Not recorded
