<!-- superdev:generated source=FEAT-0096 revision=3408 hash=713cf62b6ac15618f3633f75bb27a1f97c843cc944682e12a15e2730e09e2614 -->
# Feature: Merge a duplicate task into the one that keeps the work

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Fold a duplicate task into the canonical one, carrying everything it owns across, so a duplicate stops splitting evidence and progress without anything being deleted
- **User:** Somebody who derived or created the same task twice and now has two records competing for the same evidence, splitting progress and leaving both looking half done
- **User value:** Not recorded
- **Scope:** in: Moving contract links, dependencies in both directions, evidence, memory entries, recorded changes and child tasks onto the task that is kept, Marking the duplicate superseded and recording which task replaced it, so a reader who finds the old identifier is not lost, Showing exactly what would move before anything moves; out: Deleting a task, because history is append only and a deleted task takes its evidence and its reasons with it, Merging history or claims, which belong to the moment and the person they happened to, Guessing which of two tasks is the duplicate
- **Affected contracts:** none linked

### Primary flow

1. The reader names the duplicate and the task that keeps the work
2. Superdev lists what would move and refuses anything that would lose something
3. With apply, everything moves, the duplicate becomes superseded and points at the survivor
4. Progress and evidence count once, against the task that is kept

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Everything a duplicate owns ends up on the task that is kept | Merge a task carrying evidence, links, dependencies and a child, then read both tasks back | Met | EV-0148 |
| The duplicate is superseded and names its survivor rather than disappearing | Read the merged task and find the identifier it points at | Met | EV-0149 |
| A merge that would lose something is refused by name | Try merging a task into itself, into a task in another project, and while somebody else holds it | Met | EV-0150 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | A link or dependency the survivor already has is not added twice |
| State Machine Violations | Applicable | A task already superseded cannot be merged again, and a merge into a cancelled task is refused |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A duplicate's evidence, contract links and child tasks end up on the task that is kept | manual_check | pass | - |
| The duplicate is superseded, keeps its history, and names the task that replaced it | manual_check | pass | - |
| Every merge that would lose something is refused by name | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
