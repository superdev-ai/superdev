<!-- superdev:generated source=FEAT-0086 revision=2943 hash=8520a03db69d2e73bf56c2db5b2ce75a9cd2b909eb314c724140b3951f17fdb3 -->
# Feature: Manage tasks in the control center

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Create, edit, assign, and progress tasks visually without the CLI
- **User:** A developer or product owner working a task wants to create, claim, start, block and complete it by clicking buttons in the control center instead of typing CLI commands.
- **User value:** Not recorded
- **Scope:** in: New task button opens a create form that fires the task.create mutation, Per-task action row exposes claim, release, start, review, verify, pause, block, complete, reopen, cancel, add subtask, link a contract and edit, each a single keyboard shortcut, Every action posts to /api/mutations, which runs the same ACTIONS handlers the CLI uses against the real database, A failed mutation surfaces the service's refusal code and message inline rather than swallowing it; out: Does not let a task complete while it has open subtasks or missing evidence: the service refuses with a coded error the UI displays, Does not silently reopen or cancel a task: both actions require the user to type a reason before the request is sent, Does not decide which task to work on next; it only acts on the task already selected
- **Affected contracts:** none linked

### Primary flow

1. Open the Tasks view and select a task, or click New task
2. Fill the form (create) or pick an action from the row (claim, start, block, complete, etc.)
3. The action posts a task.* mutation to /api/mutations
4. On success the row updates and a confirmation is shown; on refusal the error code and message are shown instead

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A task can be created, claimed, started, and completed entirely through the control center UI | Do it through the surface a person would use and record what was observed. | Met | EV-0090 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | Reopening or cancelling a finished task requires a reason string, which the service stores so the next reader knows why a completed task came back |
| Invalid Input | Applicable | task.update is refused with E_INVALID_PAYLOAD when the edit form submits no changed fields at all |
| Network Failure | Applicable | When postMutation throws something other than an ApiError, the UI falls back to a generic message telling the user to check the service log and try again |
| State Machine Violations | Applicable | Completing a task with open subtasks or missing evidence is refused server-side (E_OPEN_SUBTASKS and similar) and the UI shows the refusal rather than pretending it succeeded |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Task management is reachable from both surfaces over one engine: service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from tasks/lifecycle.mjs, the same functions the CLI calls, so the control centre and the terminal cannot diverge. task list returns the live board. | command | pass | node src/cli.mjs task list |

## Delivery state

- **What works now:** Reached by Tasks view -> New task button / per-task action row -> POST /api/mutations with a task.* action. ui/src/components/tasks/filters.tsx:181 'New task' button opens the create form which fires the 'task.create' action (ui/src/components/tasks/actions.tsx:736); actions.tsx:136-226 defines claim, release, start, review, verify, pause, block, complete, reopen, cancel, subtask, link, edit actions, each calling postMutation() (ui/src/lib/api.ts:216-226) to POST /api/mutations/{action,payload}; the server-side ACTIONS table (src/service/mutations.mjs:706 onward) implements task.create, task.update, task.claim, task.release, task.block etc. against the real DB.
- **What remains:** Nothing known.
- **Next action:** Not recorded
