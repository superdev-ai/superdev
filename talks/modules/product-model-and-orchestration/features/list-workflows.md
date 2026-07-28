<!-- superdev:generated source=FEAT-0036 revision=2943 hash=5cdc3f298a8028394311354b427a5b57b1cc65a4ab614f9c45d133fd8af2f3ca -->
# Feature: List workflows

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all defined workflows
- **User:** An engineering lead or developer picking up a project needs to see every defined workflow at a glance before drilling into any one of them.
- **User value:** Not recorded
- **Scope:** in: Runs superdev workflow list, read only, no flags to change anything, Returns a table of every workflow with id, name, step count, and status, Orders workflows by id; out: Does not show the individual steps of a workflow, that is workflow show, Does not filter the list by status or by the feature a workflow serves
- **Affected contracts:** none linked

### Primary flow

1. Run superdev workflow list
2. Read the table of all workflows with their step counts and status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev workflow list returns every defined workflow | Run superdev workflow list and record what was observed. | Met | EV-0040 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | There is no row cap or pagination on this list, unlike some other product-map views, so every recorded workflow prints in one table regardless of count. |
| Empty States | Applicable | If no workflows are recorded, the command prints a plain nothing-to-show message instead of an empty table. |
| Ordering | Applicable | Rows are always ordered by workflow id, not by status or how recently a workflow was defined. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 1135 cmdWorkflowList wired in COMMANDS table at line 2068. Ran: node src/cli.mjs workflow list, returned a table of 9 workflows with id, name, step count, status. | command | pass | superdev workflow list |

## Delivery state

- **What works now:** Reached by superdev workflow list. src/cli.mjs line 1135 cmdWorkflowList wired in COMMANDS table at line 2068. Ran: node src/cli.mjs workflow list, returned a table of 9 workflows with id, name, step count, status.
- **What remains:** Nothing known.
- **Next action:** Not recorded
