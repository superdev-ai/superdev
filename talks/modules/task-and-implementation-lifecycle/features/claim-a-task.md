<!-- superdev:generated source=FEAT-0046 revision=2943 hash=fbc2e4a94c942216839115c28543b0d9028af50e77de21fe2111907bd4d1fb11 -->
# Feature: Claim a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Assign a task to the current developer or agent
- **User:** A developer or coding agent about to start work needs to lock a task to themselves so nobody else starts the same thing in parallel.
- **User value:** Not recorded
- **Scope:** in: Records developer, agent, branch and session against the task as a single active assignment, Resolves identity automatically from git and the running harness when no --developer or --agent is passed, Refuses a second claim while one is active, naming who holds it and since when, Refuses to claim a task that is not open work (for example complete or cancelled); out: Does not move the task's status, claiming is separate from starting it, Does not let two sessions hold the same task at once, ownership is single and enforced at the database level, not just in application logic, Does not pick which task to claim, the caller names the task id
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task claim TASK-0001 (dry run) to see who it would be claimed for
2. Re-run with --apply to record the claim
3. Read back the confirmation and the task's status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task claim <TASK-id> sets the task's assignee and enforces single ownership | Run superdev task claim <TASK-id> and record what was observed. | Met | EV-0026 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Concurrent Actions | Applicable | If two claims race, the database's unique index on active assignments lets only one through; the loser sees 'was claimed by X a moment before this claim' rather than a raw constraint error |
| Invalid Input | Applicable | An explicit --developer, --agent, --branch or --session id that does not exist in the project is refused by name rather than surfacing a foreign key error |
| Permission Boundaries | Applicable | Claiming a task already held by someone else is refused with the holder's name and the time it was assigned, with the suggestion to ask them to release it or pick up another task |
| State Machine Violations | Applicable | Claiming a task that is complete, cancelled or superseded is refused with 'is not open work. Reopen it before claiming it' |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge. | command | pass | superdev task claim TASK-0001 --developer <id> [--apply] |

## Delivery state

- **What works now:** Reached by superdev task claim TASK-0001 --developer <id> [--apply]. src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge.
- **What remains:** Nothing known.
- **Next action:** Not recorded
