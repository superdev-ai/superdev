<!-- superdev:generated source=FEAT-0044 revision=2943 hash=1374595401a6f9cdfa12be1f4919f3cd8400a34ed747b829131094e5fd4f468d -->
# Feature: Create a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Add a new unit of implementation work linked to a feature
- **User:** A PM or lead breaking a feature into work needs to spin up a new task tied to that feature without it floating unlinked.
- **User value:** Not recorded
- **Scope:** in: Requires --feature and --name; refuses to create a task without a feature id or an outcome-stating name, Accepts outcome, why, completion criteria, verification requirements, priority, risk, category, estimate, due date, parent task, dependencies, and contract links in one call, Lands the task in draft by default, or moves it straight to another status such as in_progress in the same call if requested, Dry run by default: without --apply it prints what would be created and changes nothing; out: Does not create the feature it points at, the feature must already exist, Does not let a task skip having a real feature parent, that link is mandatory, Does not decide priority, category or estimate for you, all optional fields default to plain values (priority normal, no estimate) rather than being inferred
- **Affected contracts:** none linked

### Primary flow

1. Run superdev task create --feature FEAT-0006 --name "..." (dry run) to preview the task and its outcome
2. Add --outcome, --why, --criterion or --link as needed to attach the contract
3. Re-run with --apply once the preview looks right
4. Get back the new task id and its landing status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task create produces a new task linked to a feature | Run superdev task create and record what was observed. | Met | EV-0024 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | A --feature id that does not exist in the project is refused with 'Feature <id> does not exist. Create or accept the feature specification before creating work against it' |
| Empty States | Applicable | A task created with no --link at all is allowed to land in draft; the dry-run preview shows Implements as 'nothing yet' |
| Invalid Input | Applicable | Missing --feature or --name throws a usage error naming exactly which flag is missing, before any database write |
| State Machine Violations | Applicable | If --status is set to anything other than draft, the task still must satisfy the same transition rules a later status-move would require (for example implementing something), or the create call fails with the same explained refusal |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge. | command | pass | superdev task create --feature <id> --name <name> [--apply] |

## Delivery state

- **What works now:** Reached by superdev task create --feature <id> --name <name> [--apply]. src/service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from ../tasks/lifecycle.mjs, the same module the CLI calls. One engine, two surfaces, so there is no second code path to diverge.
- **What remains:** Nothing known.
- **Next action:** Not recorded
