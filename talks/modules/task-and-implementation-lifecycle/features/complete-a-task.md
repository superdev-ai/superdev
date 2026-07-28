<!-- superdev:generated source=FEAT-0052 revision=3072 hash=daf87d97f7855b4eb0983ae24d7237f11f01ab4bd59bb031b4c04180f3f271f7 -->
# Feature: Complete a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Mark a task done once acceptance criteria and verification are satisfied
- **User:** A developer or lead wants to close out a task only once its acceptance criteria are actually proven, not just when the work feels done.
- **User value:** Not recorded
- **Scope:** in: moves a task to complete only when no subtask is still open, no current evidence is failing, every stated verification requirement has its own passing evidence, and every acceptance criterion it verifies is met, releases the active claim on the task as part of the same transaction, when several conditions are unmet at once, names all of them in a single combined refusal instead of stopping at the first; out: does not re-run the recorded check commands itself, that is a separate command (superdev verify), does not cascade through subtasks, each one must be individually completed or cancelled first, does not protect the completion afterward if evidence later goes stale, that is left to reopen and re-verification
- **Affected contracts:** none linked

### Primary flow

1. run superdev task complete TASK-id as a dry run to see the completion rule stated back
2. attach passing evidence for every stated requirement via task evidence
3. superdev task complete TASK-id --apply prints that the task is complete and its claim was released
4. task show confirms Status: Complete

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task complete <TASK-id> only succeeds when acceptance criteria and evidence are recorded | Run superdev task complete <TASK-id> and record what was observed. | Met | EV-0074 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | completion is only remembered as a confirmed moment after the database transaction commits, so nothing is recorded as finished that did not actually get written. |
| Consistency | Applicable | open subtasks, failing evidence and unmet acceptance criteria are each checked independently, and if more than one applies the refusal message concatenates all of them rather than only reporting the first problem found. |
| Empty States | Applicable | a task with no stated verification requirement and no evidence at all is still refused, with a message that nothing shows it is done, so an empty contract cannot complete for free. |
| State Machine Violations | Applicable | completing a task that states one verification requirement but carries zero passing results is refused with the exact counts and the requirement text, and exits 1. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:1613 cmdTaskComplete calls completeTask (src/tasks/lifecycle.mjs:497), registered as "task complete" (src/cli.mjs:2048). Verified both halves of the contract: (1) refusal - `task complete TASK-0001 --apply` before evidence existed returned exit 1 with "TASK-0001 states 1 verification requirement and carries 0 passing results ... Run the rest and attach the evidence."; (2) success - after attaching passing evidence and moving the task to In Progress (`task start`), `task complete TASK-0001 --apply` printed "TASK-0001 is complete and its claim was released." and `task show` confirmed Status: Complete. | command | pass | superdev task complete <TASK-id> --apply |
| Completion is refused while a covering plan has no passing run: the lifecycle journey in a throwaway project hit the refusal, and E_TEST_PLAN_UNSATISFIED names the plan and the command that runs it. | manual_check | pass | - |
| All eight accepted test plans carry a passing run: three from running their own command, five from journeys carried out and recorded with what was observed. | manual_check | pass | - |

## Delivery state

- **What works now:** Reached by superdev task complete <TASK-id> --apply. src/cli.mjs:1613 cmdTaskComplete calls completeTask (src/tasks/lifecycle.mjs:497), registered as "task complete" (src/cli.mjs:2048). Verified both halves of the contract: (1) refusal - `task complete TASK-0001 --apply` before evidence existed returned exit 1 with "TASK-0001 states 1 verification requirement and carries 0 passing results ... Run the rest and attach the evidence."; (2) success - after attaching passing evidence and moving the task to In Progress (`task start`), `task complete TASK-0001 --apply` printed "TASK-0001 is complete and its claim was released." and `task show` confirmed Status: Complete.
- **What remains:** Nothing known.
- **Next action:** Not recorded
