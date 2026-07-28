<!-- superdev:generated source=FEAT-0040 revision=2943 hash=c5bb713164e91616cd39c474dddbdea02e514e1f6024bfc71961de73e7c3eb19 -->
# Feature: Show API surface

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show the defined API services and operations
- **User:** A developer or coding agent about to build an endpoint needs to see every planned and specified API operation, and whether it changes state, before writing any API code.
- **User value:** Not recorded
- **Scope:** in: Runs superdev api show, read only, Returns every API operation with its style, whether it changes state, and status, Groups operations by service and shows how many operations each service has; out: Does not let a user add or edit an operation from this command, Does not call or test any operation, it only reports the recorded definition
- **Affected contracts:** none linked

### Primary flow

1. Run superdev api show
2. Read the operations table
3. Read the services block to see how operations group under each service

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev api show returns defined API services and operations | Run superdev api show and record what was observed. | Met | EV-0044 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | Zero recorded services prints a line stating every operation is loose rather than grouped under a boundary, instead of an empty services block. |
| Limits And Quotas | Applicable | The operations table caps at the first 60 rows and tells the user to pass --json to get the rest when the true count is higher, confirmed with 70 real operations. |
| Ordering | Applicable | Operations are always listed alphabetically by name regardless of which service or status they belong to, while services themselves are ordered by their own recorded sequence, so the two listings sort differently. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 1144 cmdApiShow wired in COMMANDS table at line 2072. Ran: node src/cli.mjs api show, returned 70 API operations with style, state-change flag, and status. | command | pass | superdev api show |

## Delivery state

- **What works now:** Reached by superdev api show. src/cli.mjs line 1144 cmdApiShow wired in COMMANDS table at line 2072. Ran: node src/cli.mjs api show, returned 70 API operations with style, state-change flag, and status.
- **What remains:** Nothing known.
- **Next action:** Not recorded
