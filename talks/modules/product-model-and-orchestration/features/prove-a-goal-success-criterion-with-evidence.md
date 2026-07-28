<!-- superdev:generated source=FEAT-0098 revision=3481 hash=fb8a39c615c19e28e0f7128ab6602b0dbd7c70837f5183e71c27337700c90cb0 -->
# Feature: Prove a goal success criterion with evidence

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Let a measured outcome be recorded as met by evidence, so goal criteria stop being a permanent zero and progress stops understating a project
- **User:** Somebody who has verified four of their five goal criteria against a running product and cannot record any of them, while progress reports forty percent
- **User value:** Not recorded
- **Scope:** in: Evidence that targets a goal success criterion, marking it met on a pass and unmet on a failure, Marking a milestone exit condition met, with the reading that decided it, Refusing an identifier the write cannot store, in the plan, with a sentence rather than a driver error; out: Deriving a goal criterion from the acceptance criteria of the features serving it, because a goal can be served by finished features and still not be reached
- **Affected contracts:** none linked

### Primary flow

1. The reader verifies a measured outcome against the running product
2. They record evidence against the goal criterion
3. The criterion is met, the goal counts it, and progress stops understating the project

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Evidence against a goal success criterion is stored and marks it met | Record passing evidence against a GSC id and read the criterion and the goal | Met | EV-0155 |
| A milestone exit condition can be marked met with its reading | Mark a condition met and read the milestone back | Met | EV-0156 |
| An identifier the write cannot store is refused in the plan, naming what it is and what to do | Plan evidence against an identifier of the wrong kind | Met | EV-0157 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | An identifier that is neither an acceptance criterion nor a goal criterion is refused before anything is written |
| State Machine Violations | Applicable | Failing evidence takes a met goal criterion back to unmet |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Evidence against a goal success criterion is stored and marks it met, and a failure takes it back | manual_check | pass | - |
| A milestone condition can be marked met with the reading that decided it | manual_check | pass | - |
| An unstorable identifier is refused in the plan, and a driver failure is now a sentence | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
