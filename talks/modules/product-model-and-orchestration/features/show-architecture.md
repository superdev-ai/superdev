<!-- superdev:generated source=FEAT-0038 revision=2943 hash=aacf9ac4280a44c2e35fa269d780a9f8f120364a1ef443be2bd822200340543e -->
# Feature: Show architecture

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show the accepted technical architecture for the product
- **User:** A developer or engineering lead joining a project needs one shot picture of the accepted runtime pieces, how they connect, and what modules exist before touching any code.
- **User value:** Not recorded
- **Scope:** in: Runs superdev architecture show, read only, Returns runtime pieces with where each runs and what file or evidence backs it, Returns the connections between pieces with their protocol, Returns the module list and the configured integrations; out: Does not let the user propose or change an architecture decision here, that goes through decision record, Does not verify that the running codebase still matches what is recorded
- **Affected contracts:** none linked

### Primary flow

1. Run superdev architecture show
2. Read the runtime pieces table
3. Read the connections list, the module list, and the integrations block

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev architecture show returns the recorded architecture decisions | Run superdev architecture show and record what was observed. | Met | EV-0042 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | The view reflects the last accepted architecture record, not a live scan of the code, so it can silently diverge from what the codebase actually does if a change was made outside the recorded decision flow. |
| Empty States | Applicable | Each of the four sections, pieces, connections, modules, integrations, prints its own none-recorded line independently if that section is empty, rather than one blanket empty message for the whole command. |
| Ordering | Applicable | Pieces and modules are ordered by their recorded sequence then id, while connections print in the order the edges were recorded, so the two lists are not sorted the same way. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 1140 cmdArchitectureShow wired in COMMANDS table at line 2070. Ran: node src/cli.mjs architecture show, returned 9 runtime pieces, 9 connections, and 11 modules of the accepted architecture. | command | pass | superdev architecture show |

## Delivery state

- **What works now:** Reached by superdev architecture show. src/cli.mjs line 1140 cmdArchitectureShow wired in COMMANDS table at line 2070. Ran: node src/cli.mjs architecture show, returned 9 runtime pieces, 9 connections, and 11 modules of the accepted architecture.
- **What remains:** Nothing known.
- **Next action:** Not recorded
