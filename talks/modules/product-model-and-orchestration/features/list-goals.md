<!-- superdev:generated source=FEAT-0028 revision=2943 hash=34dcb92753fecba1830d9fa34cb510d0b865e37334e95d117b29f852cca56c97 -->
# Feature: List goals

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all product goals
- **User:** A founder or PM wants a one-glance view of the product's high level goals and how much of each is actually proven done.
- **User value:** Not recorded
- **Scope:** in: lists every goal with its id, name, count of features linked to it, and how many of its success criteria are met versus total, orders goals by their defined sequence, is read only, no flags; out: does not show the goal's individual success criteria or which features satisfy them, that is goal show, does not compute or infer a goal's completion, only counts criteria already marked met elsewhere, does not let you create or edit goals
- **Affected contracts:** none linked

### Primary flow

1. run superdev goal list
2. read the printed table: each row shows goal id, name, linked feature count, and criteria met out of total

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev goal list returns every defined goal | Run superdev goal list and record what was observed. | Met | EV-0032 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | a goal with zero success criteria defined shows '0 of 0' met rather than an error or a percentage, since the count is a plain ratio of rows |
| Consistency | Applicable | feature and criteria-met counts are computed live from their linking tables on every call, so the numbers always reflect current state, not a cached total |
| Empty States | Applicable | if no goals are recorded yet, prints 'Nothing recorded yet for goals' instead of an empty table |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2062 maps 'goal list' to cmdGoalList. Ran `node src/cli.mjs goal list`, printed a table of 5 goals with feature counts and criteria-met counts. | command | pass | superdev goal list |

## Delivery state

- **What works now:** Reached by superdev goal list. src/cli.mjs:2062 maps 'goal list' to cmdGoalList. Ran `node src/cli.mjs goal list`, printed a table of 5 goals with feature counts and criteria-met counts.
- **What remains:** Nothing known.
- **Next action:** Not recorded
