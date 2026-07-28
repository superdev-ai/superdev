<!-- superdev:generated source=FEAT-0035 revision=2943 hash=b89ebc966e70380b0fec493ae53f17e985113b18d6f2e2a963d3129bf02c2627 -->
# Feature: Accept a feature

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Mark a feature specification as accepted and ready for implementation
- **User:** A developer or engineering lead who believes a feature's spec is complete wants to mark it accepted so its tasks can be derived, or be told plainly what is still missing if it is not.
- **User value:** Not recorded
- **Scope:** in: checks the feature's declared depth requirements and refuses with a message naming every missing requirement if any are unmet, whether or not --apply is given, when every requirement is met but --apply is not given, shows a preview naming what would be accepted, with --apply and every requirement met, sets the feature's status to accepted, which is the gate derive checks before turning a feature's spec into tasks; out: does not accept a feature piecemeal, all requirements for the declared depth must be met at once, does not itself create any tasks, accepting only unlocks derive to do that separately
- **Affected contracts:** none linked

### Primary flow

1. run superdev feature accept FEAT-0001 without --apply
2. if requirements are missing, read the message naming each one and exits 1
3. record the missing requirements, or lower the feature's declared depth to match what it actually has
4. re-run with --apply once every requirement is met to set the feature to accepted

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev feature accept <FEATURE-id> marks the feature accepted and unlocks its tasks | Run superdev feature accept <FEATURE-id> and record what was observed. | Met | EV-0039 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Concurrent Actions | Applicable | the acceptance gate is re-checked inside the same transaction that applies it, so if the recorded requirements change between the initial check and --apply, the accept fails again naming whatever is now missing instead of accepting a feature that stopped qualifying |
| Duplication | Not Applicable | N/A - accepting an already-accepted feature simply re-runs the same requirement check and re-applies the same status, there is no duplicate record created |
| Invalid Input | Applicable | any unmet requirement causes an error naming all of them together and exits 1, even when --apply was not passed, since acceptance is checked before the apply flag is considered |
| State Machine Violations | Applicable | acceptance only ever moves a feature's status to accepted, it does not touch tasks directly, so a feature can be accepted with zero tasks until derive is run against it separately |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/cli.mjs line 1967-1982 cmdFeatureAccept wired in COMMANDS table at line 2089, delegates to acceptFeature in src/features/acceptance.mjs. Ran: node src/cli.mjs feature accept FEAT-0001 (no --apply), returned a clear readiness report naming the 4 of 6 missing requirements and instructing to record them or lower depth. | command | pass | superdev feature accept <FEAT-id> |

## Delivery state

- **What works now:** Reached by superdev feature accept <FEAT-id>. src/cli.mjs line 1967-1982 cmdFeatureAccept wired in COMMANDS table at line 2089, delegates to acceptFeature in src/features/acceptance.mjs. Ran: node src/cli.mjs feature accept FEAT-0001 (no --apply), returned a clear readiness report naming the 4 of 6 missing requirements and instructing to record them or lower depth.
- **What remains:** Nothing known.
- **Next action:** Not recorded
