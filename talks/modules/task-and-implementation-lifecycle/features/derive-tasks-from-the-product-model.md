<!-- superdev:generated source=FEAT-0055 revision=2943 hash=3c0be5bb341ee82eca18ba8e89bd4dd204ede696c0beb33b0591dd43680e9fcb -->
# Feature: Derive tasks from the product model

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Generate new tasks from accepted features and workflows
- **User:** A lead or agent who just accepted a feature specification needs the tasks that implement it created automatically, instead of transcribing the spec into tasks by hand.
- **User value:** Not recorded
- **Scope:** in: reads one accepted feature, or every accepted feature, and computes the task set its workflow steps, actions, entities and decisions imply, creates tasks the spec declares that no existing task covers, updates the wording and contract links of open (non-terminal) tasks whose derived text changed, and marks a task superseded when every contract row it implemented was removed from the spec, refuses ambiguity between the positional feature id and a --feature flag, since reading it as a flag would silently derive every accepted feature instead of the one named; out: does not derive anything from a feature that is not accepted, draft features are refused with a stated reason, does not rewrite a task that is already complete, cancelled or superseded, only a changed contract link on a terminal task produces a new follow-on task, does not decide priority or ordering of the derived work relative to other tasks in the project
- **Affected contracts:** none linked

### Primary flow

1. run superdev derive (every accepted feature) or superdev derive FEATURE-id (one feature) as a dry run
2. read the count of tasks to create, update and supersede, and the named list
3. re-run with --apply
4. the derivation finished summary and feature show FEATURE-id confirm the new or updated tasks

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev derive creates tasks linked to accepted features that lack coverage | Run superdev derive and record what was observed. | Met | EV-0077 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | running derive against this project's own feature set, which is currently all draft, correctly reports 0 tasks to create, 0 to update and 0 to supersede for every feature, since none are accepted yet. |
| Invalid Input | Applicable | passing the feature id as --feature instead of positional is refused outright, naming the correct form, because reading it as a flag value would silently derive every accepted feature instead of one. |
| Ordering | Applicable | re-derivation matches existing tasks to plan items by their contract links, preferring open tasks over finished ones and parents over children, so running derive again after tasks have moved converges instead of creating duplicates. |
| State Machine Violations | Applicable | a task already complete, cancelled or superseded is never rewritten even if the derived text changed; only a contract-link change on that terminal task produces a new follow-on task. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:1652 cmdDerive calls deriveTasks/deriveAll (src/tasks/derive.mjs:947,953), registered as "derive" (src/cli.mjs:2032). deriveAll filters to `status = 'accepted'` (src/tasks/derive.mjs:955) and loadSpec refuses non-accepted features (src/tasks/derive.mjs:657-662), which is why dry runs against the project's own (all-draft) feature set correctly reported 0 to create. Flipping one feature's status to accepted and re-running proved real creation: `node src/cli.mjs derive FEAT-0009` reported "1 task to create" and `node src/cli.mjs derive FEAT-0009 --apply` printed "Derivation finished: 1 created, 0 updated, 0 superseded."; `feature show FEAT-0009` afterward listed the new TASK-0005 in Ready status. | command | pass | superdev derive [FEATURE-id] (with --apply) |

## Delivery state

- **What works now:** Reached by superdev derive [FEATURE-id] (with --apply). src/cli.mjs:1652 cmdDerive calls deriveTasks/deriveAll (src/tasks/derive.mjs:947,953), registered as "derive" (src/cli.mjs:2032). deriveAll filters to `status = 'accepted'` (src/tasks/derive.mjs:955) and loadSpec refuses non-accepted features (src/tasks/derive.mjs:657-662), which is why dry runs against the project's own (all-draft) feature set correctly reported 0 to create. Flipping one feature's status to accepted and re-running proved real creation: `node src/cli.mjs derive FEAT-0009` reported "1 task to create" and `node src/cli.mjs derive FEAT-0009 --apply` printed "Derivation finished: 1 created, 0 updated, 0 superseded."; `feature show FEAT-0009` afterward listed the new TASK-0005 in Ready status.
- **What remains:** Nothing known.
- **Next action:** Not recorded
