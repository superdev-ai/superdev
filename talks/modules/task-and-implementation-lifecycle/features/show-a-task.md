<!-- superdev:generated source=FEAT-0043 revision=2943 hash=0758f09eca306d0b08d737071855837b740b8286589f5b3398f541176f980f15 -->
# Feature: Show a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show detail for a single task including its feature, contract, and evidence
- **User:** A developer or agent picking up a task needs the full picture before touching code: what it is for, what proves it is done, and who else has been near it.
- **User value:** Not recorded
- **Scope:** in: Prints the task row itself: status, priority, description, expected outcome, why it is needed, Shows the feature it belongs to, its completion criteria and verification requirements, Lists contract links, dependencies, subtasks, current assignment and holder, and the last 10 evidence and status history entries; out: Does not let you change anything from here, it is read only, Does not compute whether the task is actually done, it just shows recorded evidence and history for a person to judge
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task show TASK-0001
2. Read status, feature link, and the plain-language why and expected outcome
3. Check the assignment field to see who currently holds it, if anyone
4. Scan the last evidence and status history entries for what has already happened

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task show <TASK-id> returns the task's full record | Run superdev task show <TASK-id> and record what was observed. | Met | EV-0023 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Data Migration States | Not Applicable | N/A - The record is read directly from the tasks table as it stands now, there is no versioned or migrated view to be stale against |
| Empty States | Applicable | A task with no active assignment shows assignment as null rather than a stale or fabricated holder; one with no evidence or history rows returns empty lists for those sections instead of erroring |
| Invalid Input | Applicable | Passing an id that does not exist prints 'There is no task <id>. Run task list to see what exists.' rather than a raw database error |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran `node src/cli.mjs task show TASK-0001`, returned full detail: status, priority, feature link (FEAT-0006), why needed, expected outcome, completion criteria, verification requirements, implements links (ENT-0037), claim state, verification history, from src/cli.mjs:893 cmdTaskShow. | command | pass | superdev task show TASK-0001 |

## Delivery state

- **What works now:** Reached by superdev task show TASK-0001. Ran `node src/cli.mjs task show TASK-0001`, returned full detail: status, priority, feature link (FEAT-0006), why needed, expected outcome, completion criteria, verification requirements, implements links (ENT-0037), claim state, verification history, from src/cli.mjs:893 cmdTaskShow.
- **What remains:** Nothing known.
- **Next action:** Not recorded
