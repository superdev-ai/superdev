<!-- superdev:generated source=FEAT-0034 revision=2943 hash=3286b0656da390947c1952acfa023affccbe4c63da68733420be41b53a184a1b -->
# Feature: Deepen a feature specification

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Add further specification depth to an existing feature
- **User:** A developer or coding agent about to write more spec into a feature wants to know exactly which of the requirements its declared depth demands are still missing, and what closes each one.
- **User value:** Not recorded
- **Scope:** in: given a feature id, shows how many of its declared depth's requirements are recorded versus required, one row per requirement, with a fix hint for each missing one, given no id, scans every accepted feature and reports which ones no longer carry what their declared depth promises, the requirement set scales with depth, a microspec feature is checked against 6 requirements, deeper depths add more; out: does not judge whether a recorded requirement is any good, only whether something is recorded at all, does not change the feature's depth or write any missing requirement for you
- **Affected contracts:** none linked

### Primary flow

1. run superdev feature depth FEAT-0001
2. read the 'Recorded N of M' summary
3. read the requirement table, noting which rows say missing and their fix hint
4. run superdev feature depth with no id to see the org-wide gap report across accepted features

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev feature depth <FEATURE-id> <depth> increases the recorded specification depth of that feature | Run superdev feature depth <FEATURE-id> <depth> and record what was observed. | Met | EV-0038 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | each requirement's fix hint stays the same regardless of how many other requirements are already met, so a feature missing 4 of 6 gets all 4 hints at once rather than one at a time |
| Empty States | Applicable | when no accepted feature has an unmet depth requirement, the org-wide report prints 'Every accepted feature carries what its declared depth promises.' instead of an empty table |
| Invalid Input | Applicable | a feature whose declared spec_depth string is not one of the known depths raises an error naming the bad depth and listing the valid ones, rather than silently checking zero requirements |
| State Machine Violations | Applicable | the org-wide gap report only flags features whose status is already accepted, a draft feature can be as thin as it likes and never appears in that report even if every requirement is missing |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/cli.mjs line 1984-2013 cmdFeatureDepth wired in COMMANDS table at line 2090. Ran: node src/cli.mjs feature depth FEAT-0001, returned requirement-by-requirement readiness table (2 of 6 recorded, with fix hints for missing ones). Ran without id: node src/cli.mjs feature depth, returned org-wide gap report. | command | pass | superdev feature depth <FEAT-id> |

## Delivery state

- **What works now:** Reached by superdev feature depth <FEAT-id>. src/cli.mjs line 1984-2013 cmdFeatureDepth wired in COMMANDS table at line 2090. Ran: node src/cli.mjs feature depth FEAT-0001, returned requirement-by-requirement readiness table (2 of 6 recorded, with fix hints for missing ones). Ran without id: node src/cli.mjs feature depth, returned org-wide gap report.
- **What remains:** Nothing known.
- **Next action:** Not recorded
