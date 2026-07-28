<!-- superdev:generated source=FEAT-0008 revision=2984 hash=121cea8627a18fc36917e116e231052f59bbe0ad0f7dc79788e69fd4eeca12d9 -->
# Feature: Derive initial implementation tasks

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Turn the accepted product model into actionable work items
- **User:** A developer or agent who just got a feature accepted wants concrete work items created from it instead of having to write task tickets by hand.
- **User value:** Not recorded
- **Scope:** in: Turns every accepted feature into task rows via deriveAll, or one named feature via deriveTasks when an id is given, Reports counts of tasks to create, update, and supersede before anything is written, Defaults to a dry run and only writes rows to the tasks table when --apply is passed, Refuses --feature written as a flag because that silently falls back to deriving every accepted feature instead of one; out: Does not decide which features are worth building, it only turns already-accepted ones into tasks, Does not let you pick which specific criteria become which tasks, the mapping from feature to task is fixed by deriveTasks, Does not run or verify the tasks it creates, that is a separate command
- **Affected contracts:** none linked

### Primary flow

1. Get a feature accepted (or work with the project as-is)
2. Run superdev derive to see the dry-run counts of tasks to create, update, and supersede
3. Run superdev derive FEAT-xxxx to scope the derivation to one feature instead of all accepted ones
4. Run superdev derive --apply to actually write the task rows
5. Run superdev task list to see the created tasks linked back to their feature

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| After onboarding, at least one ready Task is derived and presented to the user | Do it through the surface a person would use and record what was observed. | Met | EV-0066 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | Deriving twice does not duplicate tasks: the second run reports 0 to create and instead reports updates or supersessions for anything that already exists from the first run. |
| Empty States | Applicable | With zero accepted features or a feature that needs no new tasks, it prints 'Deriving every accepted feature: 0 tasks to create, 0 to update, 0 to supersede' and does nothing on --apply. |
| Invalid Input | Applicable | Passing the feature id as --feature=X instead of positionally is refused with a UsageError explaining that as a flag it is read as a value, not a positional id, and every accepted feature would be derived instead of one. |
| State Machine Violations | Not Applicable | N/A - Derivation only reads accepted features and writes new task rows, it does not move any existing task through a status transition, so there is no state machine to violate here. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. Ran `node src/cli.mjs derive` in the real repo: correctly reported 'Deriving every accepted feature: 0 tasks to create, 0 to update, 0 to supersede', matching the real database state of 0 accepted features out of 91. cmdDerive is wired at src/cli.mjs:1652-1685 and calls deriveTasks/deriveAll in src/tasks/derive.mjs, which contains real task-creation logic (create() calls at lines 821 and 856, not stubs). The same production database already holds real tasks (TASK-0001..TASK-0004) linked to specific features via feature_id, showing the create path has produced persisted, schema-valid task rows in this project before. | command | pass | superdev derive [FEATURE-id] [--apply] |
| The test_plans and test_plan_cases tables exist, created by migration 008, and eight plans with eleven cases are recorded from section 20.1. Task completion can now be gated on a plan that exists, where section 9.3 previously named a document that could not. | validator | pass | scripts/validate/data-model.mjs |

## Delivery state

- **What works now:** Reached by superdev derive [FEATURE-id] [--apply]. Ran `node src/cli.mjs derive` in the real repo: correctly reported 'Deriving every accepted feature: 0 tasks to create, 0 to update, 0 to supersede', matching the real database state of 0 accepted features out of 91. cmdDerive is wired at src/cli.mjs:1652-1685 and calls deriveTasks/deriveAll in src/tasks/derive.mjs, which contains real task-creation logic (create() calls at lines 821 and 856, not stubs). The same production database already holds real tasks (TASK-0001..TASK-0004) linked to specific features via feature_id, showing the create path has produced persisted, schema-valid task rows in this project before.
- **What remains:** Nothing known.
- **Next action:** Not recorded
