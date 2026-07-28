<!-- superdev:generated source=FEAT-0073 revision=2943 hash=d216d23f7ccfc1c033c74b44ced8fd40bad40715da734015a17a1e3916bfc123 -->
# Feature: Show cloud sync status

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Packaging and Distribution
- **Risk level:** R1
- **Milestone:** Cloud Preparation
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Report whether cloud sync is connected and current
- **User:** A developer or agent wants to check, in a script or by eye, whether the project has any live cloud sync peer before deciding whether to rely on cloud state.
- **User value:** Not recorded
- **Scope:** in: queries the sync_peers table and reports the real peer count, reports connected as false and lists the three blocking decisions, confirms local functionality does not depend on cloud (localWorksWithoutIt: true), supports --json for scripting, exits 0 since this is a status read not an action; out: does not attempt to establish or repair a connection, only reports, does not distinguish why a peer might be stale versus never connected, since peers is always the raw sync_peers row count, does not poll or refresh state over time, only the state at the moment the command runs
- **Affected contracts:** none linked

### Primary flow

1. run superdev cloud status --json
2. read connected (always false today) and peers (live table count)
3. read blockedBy for the three open decisions
4. read localWorksWithoutIt to confirm nothing local is degraded by this

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev cloud status reports connection and sync state | Run superdev cloud status and record what was observed. | Met | EV-0067 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Not Applicable | N/A - this is a pure read with no side effects, so there is nothing to audit beyond the query itself. |
| Consistency | Applicable | connected is hardcoded false regardless of the peer count, so a nonzero peers count (if one ever existed from prior schema use) would not be reported as connected; the two fields are independent, not derived from each other. |
| Dependency Failure | Applicable | if the sync_peers table query fails for any reason, the count falls back to 0 rather than surfacing a raw database error to the caller. |
| Empty States | Applicable | with no sync_peers rows at all (the normal state today), peers prints as 0 rather than erroring or omitting the field. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:1421-1435 cmdCloudStatus queries sync_peers and returns connected:false with the blocking decisions. Ran `node src/cli.mjs cloud status --json` in the repo (which has a live .superdev/superdev.db): exit 0, printed {"connected":false,"peers":0,"blockedBy":["DEC-TBD-006","DEC-TBD-007","DEC-TBD-008"],"localWorksWithoutIt":true}. The command is registered at src/cli.mjs:2057 ("cloud status": cmdCloudStatus). It truthfully reports the real (permanently disconnected) status end to end. | command | pass | superdev cloud status |

## Delivery state

- **What works now:** Reached by superdev cloud status. src/cli.mjs:1421-1435 cmdCloudStatus queries sync_peers and returns connected:false with the blocking decisions. Ran `node src/cli.mjs cloud status --json` in the repo (which has a live .superdev/superdev.db): exit 0, printed {"connected":false,"peers":0,"blockedBy":["DEC-TBD-006","DEC-TBD-007","DEC-TBD-008"],"localWorksWithoutIt":true}. The command is registered at src/cli.mjs:2057 ("cloud status": cmdCloudStatus). It truthfully reports the real (permanently disconnected) status end to end.
- **What remains:** Nothing known.
- **Next action:** Not recorded
