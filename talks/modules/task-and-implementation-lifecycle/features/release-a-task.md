<!-- superdev:generated source=FEAT-0048 revision=2943 hash=e12b84960183b4ca6313f0afca7e2145ee94f0b0184797346134eb4fb62a3000 -->
# Feature: Release a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Give up an assignment on a task without completing it
- **User:** A developer who can no longer continue a task needs to hand it back without pretending the work is finished or losing its status.
- **User value:** Not recorded
- **Scope:** in: Ends the active assignment on a task, freeing it to be claimed again, Leaves the task's status untouched, only the claim ends, Accepts an optional --reason that is recorded against the release event, Dry run by default: without --apply nothing changes; out: Does not change the task's status, a released task stays exactly where it was, Does not reassign the task to anyone else, it just clears the current holder, Does not require a reason, releasing with no --reason is accepted
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task release TASK-0001 (dry run) to preview the hand-back
2. Add --reason if there is one worth recording
3. Re-run with --apply to clear the assignment
4. Get back confirmation that the task is free to be claimed again, still at its prior status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task release <TASK-id> clears the current assignment | Run superdev task release <TASK-id> and record what was observed. | Met | EV-0028 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | The release writes an activity event even though task_assignments carries no version column, so the hand-back is still visible in history despite bypassing the normal versioned update path |
| Empty States | Applicable | Releasing with no --reason is accepted, the activity summary falls back to a generic 'Assignment on <id> released' note |
| State Machine Violations | Applicable | Releasing a task with no active assignment is refused with 'is not claimed by anyone, so there is nothing to release' |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge. | command | pass | superdev task release TASK-0001 --reason <text> [--apply] |

## Delivery state

- **What works now:** Reached by superdev task release TASK-0001 --reason <text> [--apply]. src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge.
- **What remains:** Nothing known.
- **Next action:** Not recorded
