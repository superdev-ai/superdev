<!-- superdev:generated source=FEAT-0041 revision=2943 hash=89f77397a02dcc25198e8e300e6ad6c749ee4b78af9977f881d2b0355d285562 -->
# Feature: List integrations

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all external integrations the product depends on
- **User:** A founder or PM deciding what to configure before go live needs to see every integration this product depends on and exactly what happens if it stays unconfigured.
- **User value:** Not recorded
- **Scope:** in: Runs superdev integration list, read only, Returns each integration with its configured and verified status, Shows the recorded fallback behavior for what happens when an integration is absent, for the integrations that have one recorded; out: Does not configure, connect, or verify an integration itself, Does not install anything on the user's behalf
- **Affected contracts:** none linked

### Primary flow

1. Run superdev integration list
2. Read the table of integrations with configured and verified status
3. Read the what happens when one is absent block for the recorded fallback behavior

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev integration list returns every defined integration | Run superdev integration list and record what was observed. | Met | EV-0021 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | Configured and verified are the last recorded status, not a live check performed at list time, so an integration could actually be working or broken differently from what the tag shows. |
| Empty States | Applicable | Zero recorded integrations prints the shared nothing-to-show message instead of an empty table. |
| Limits And Quotas | Applicable | The fallback-behavior block only prints the first 8 integrations that have failure behavior recorded, alphabetically by name, confirmed with 13 total integrations in the table but only 8 shown in that block; the rest are only visible through --json. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran `node src/cli.mjs integration list` in ~/Projects/Personal/superdev, got a real 13-row table (INT-0001..INT-0013) with configured/verified status and per-integration fallback behavior, backed by src/cli.mjs:1145 cmdIntegrationList calling productMap().integrationList against the live project DB. | command | pass | superdev integration list |

## Delivery state

- **What works now:** Reached by superdev integration list. Ran `node src/cli.mjs integration list` in ~/Projects/Personal/superdev, got a real 13-row table (INT-0001..INT-0013) with configured/verified status and per-integration fallback behavior, backed by src/cli.mjs:1145 cmdIntegrationList calling productMap().integrationList against the live project DB.
- **What remains:** Nothing known.
- **Next action:** Not recorded
