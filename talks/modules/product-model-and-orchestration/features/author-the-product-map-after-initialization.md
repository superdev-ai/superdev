<!-- superdev:generated source=FEAT-0092 revision=3235 hash=69506e5c4f1a590bd0ce5bdbbf1f226035aefe84f7abc7f49bbe5906a7da777c -->
# Feature: Author the product map after initialization

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Add and correct goals, success criteria, milestones, exit conditions, modules and features through commands, so a project is not frozen at the shape init guessed.
- **User:** Somebody whose project has moved past what the brief said wants to add a goal, measure it, schedule work into a stage, or correct a module the brief guessed wrong, without writing to the database behind the product's back.
- **User value:** Not recorded
- **Scope:** in: Recording a goal, a success criterion with how it is measured, a milestone, an exit condition, a module and a feature, Reassigning a feature's module or milestone, Retiring a goal or milestone with a reason, keeping its history; out: Creating workflows, data entities, API operations or surfaces, which have no write path yet, Deleting anything, because history is append only
- **Affected contracts:** none linked

### Primary flow

1. Record a goal, and be told it is unmeasurable until it carries a criterion
2. Add a success criterion with how it is measured and what the target is
3. Record a milestone, and be told nothing says when it is reached
4. Add an exit condition, stored so it can carry a verdict rather than as bare text
5. Create a feature in a module, landing in draft so the depth gate still decides
6. Move a feature to the module or milestone it belongs in

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A goal recorded through the command carries success criteria that progress can count | Record a goal and a criterion, then read superdev goal show | Met | EV-0129 |
| A feature created through the command lands in draft and is refused acceptance while thin | Create one, run feature accept, and read the refusal | Met | EV-0130 |
| Moving a feature leaves its contract, tasks and evidence intact | Move one and read feature show before and after | Met | EV-0131 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Deletion Semantics | Applicable | Retiring keeps the record and its history, and stops it counting toward progress |
| Duplication | Applicable | A second goal, milestone or module with the same name is refused, naming the one that exists |
| Empty States | Applicable | A goal with no criteria reports as unmeasurable rather than met, and the command says so when recording it |
| Invalid Input | Applicable | A feature named without a module is refused, and the refusal names the command that lists them |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| In a throwaway project: goal record created GOAL-0001 and said it was unmeasurable until it carried a criterion; goal criterion added GSC-0001 with its measurement and target; the database shows the criterion unmet against the goal, which is what progress counts. | manual_check | pass | - |
| feature create drafted FEAT-0002 in MOD-0002 at microspec depth with status draft, and told the reader the depth gate would refuse acceptance until the specification was written. A second feature with the same name was refused, naming the one that existed. | manual_check | pass | - |
| feature move reassigned FEAT-0001 from MOD-0001 to MOD-0002 and the database shows the new module with the feature's name, depth and status unchanged. This very feature, FEAT-0092, was created and specified through the new commands rather than by a script. | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
