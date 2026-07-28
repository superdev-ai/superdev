<!-- superdev:generated source=FEAT-0047 revision=2943 hash=d7a01ac01915702e9eafc10bac53b9b40c7dd0324491b1d798f27c63cbeaf52b -->
# Feature: Start a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Mark a claimed task as in progress and record the work session and branch
- **User:** A developer who has claimed a task needs to record that active work has begun and get a branch tied to it.
- **User value:** Not recorded
- **Scope:** in: Moves the task from its current open status to in_progress through the same governed status machine, Checks the task's declared blocking dependencies and, if any are still open, records that the task was started anyway rather than refusing, Dry run by default: without --apply nothing moves; out: Does not require the task to be claimed first at the command level, though in practice work normally claims before starting, Does not stop you from starting a task with open blockers, it logs the decision instead of enforcing the graph, Does not create the branch, it records whatever branch id the session already resolved
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task start TASK-0001 (dry run) to preview the move to In Progress
2. Re-run with --apply to commit the transition
3. Get back the confirmation 'TASK-0001 is In Progress'

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task start <TASK-id> moves the task to in progress and records a branch | Run superdev task start <TASK-id> and record what was observed. | Met | EV-0027 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | Starting a task with still-open blocking dependencies is allowed but recorded as an activity event listing which blockers were still open at the time |
| Duplication | Applicable | Starting a task that is already in_progress is a no-op, the move function returns the task unchanged when the target status equals the current one |
| State Machine Violations | Applicable | Starting a task whose current status does not allow a move to in_progress (for example one already complete) is refused, naming the statuses actually reachable from where it is |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge. | command | pass | superdev task start TASK-0001 [--apply] |

## Delivery state

- **What works now:** Reached by superdev task start TASK-0001 [--apply]. src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge.
- **What remains:** Nothing known.
- **Next action:** Not recorded
