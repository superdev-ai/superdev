<!-- superdev:generated source=FEAT-0045 revision=2943 hash=6c1c1192f9e9d7ce743806047306a7a72cc6748aa1bcd95f7e10b55de024402f -->
# Feature: Update a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Edit task fields such as description or category
- **User:** Someone refining a task's description, priority or completion criteria after the fact needs to edit those fields without accidentally moving its status.
- **User value:** Not recorded
- **Scope:** in: Updates name, description, outcome, why, priority, risk, estimate, due date, parent, completion criteria, verification requirements and affected boundaries, Refuses the call outright if no field flag is passed, Dry run by default: without --apply it prints the field values that would change and applies nothing; out: Does not move status, --status is explicitly rejected with a message pointing to task claim, block, complete or reopen instead, Does not touch the task's assignment or claim, that is a separate action, Does not validate business meaning of the new values (for example that a new due date is in the future), it stores what it is given
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task update TASK-0001 --priority high (dry run) to see the pending change
2. Add more field flags (--criterion, --verify, --due, etc) as needed in the same call
3. Re-run with --apply to persist
4. Get back the confirmation 'Updated TASK-0001'

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task update <TASK-id> persists field changes to the task | Run superdev task update <TASK-id> and record what was observed. | Met | EV-0025 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Concurrent Actions | Applicable | The underlying patch takes the task's current version unless a caller supplies one, so two overlapping edits from the CLI still serialize through the same versioned update path used everywhere else |
| Invalid Input | Applicable | Calling with no field flags at all is refused with 'Nothing to update. Pass at least one of --name, --description, --outcome...' before touching the database |
| State Machine Violations | Applicable | Passing --status is refused unconditionally, directing the caller to the dedicated lifecycle commands so status changes always leave history |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge. | command | pass | superdev task update TASK-0001 --priority high [--apply] |

## Delivery state

- **What works now:** Reached by superdev task update TASK-0001 --priority high [--apply]. src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge.
- **What remains:** Nothing known.
- **Next action:** Not recorded
