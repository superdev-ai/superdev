<!-- superdev:generated source=FEAT-0037 revision=2943 hash=0787b8805d63734e50b91a28aa90fda80e97b51590174334a039474662ef4471 -->
# Feature: Show a workflow

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show detail for a single workflow including its steps
- **User:** An implementer about to build a feature tied to a workflow needs the exact ordered steps and what done looks like for each one, not just a summary line.
- **User value:** Not recorded
- **Scope:** in: Runs superdev workflow show <id> for one workflow, Returns status, linked feature, trigger, and completion condition, Returns every step in sequence with its expected outcome and, where recorded, what to do on failure, Gives a clean one-line error for an id that does not exist; out: Does not let the user edit, add, or reorder steps from this command, Does not check whether a real task actually followed these steps
- **Affected contracts:** none linked

### Primary flow

1. Run superdev workflow show WF-0001
2. Read status, linked feature, trigger, and completion condition
3. Read each numbered step with its expected outcome and failure note

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev workflow show <WORKFLOW-id> returns the workflow's steps and behavior | Run superdev workflow show <WORKFLOW-id> and record what was observed. | Met | EV-0041 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | A workflow that exists but has zero steps recorded prints a direct warning that following it proves nothing, instead of showing an empty steps list. |
| Invalid Input | Applicable | An id that matches no workflow throws a clean error naming the id, and the command exits non-zero rather than printing a partial or blank record. |
| Ordering | Applicable | Steps always print in their recorded sequence number, not insertion order, so a step added out of order still lands in the right place. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 1136-1139 cmdWorkflowShow wired in COMMANDS table at line 2069. Ran: node src/cli.mjs workflow show WF-0001, returned full detail including status, feature, trigger, completion condition, and all 11 numbered steps with expected outcomes and failure notes. Bad id WF-9999 gave clean error. | command | pass | superdev workflow show <WF-id> |

## Delivery state

- **What works now:** Reached by superdev workflow show <WF-id>. src/cli.mjs line 1136-1139 cmdWorkflowShow wired in COMMANDS table at line 2069. Ran: node src/cli.mjs workflow show WF-0001, returned full detail including status, feature, trigger, completion condition, and all 11 numbered steps with expected outcomes and failure notes. Bad id WF-9999 gave clean error.
- **What remains:** Nothing known.
- **Next action:** Not recorded
