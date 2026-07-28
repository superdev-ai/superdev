<!-- superdev:generated source=FEAT-0032 revision=2943 hash=5716cf9f84fadcc4f7d3c2673f777059ce6232c9c4135d6213dc59d326e5bb82 -->
# Feature: List features

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all features in the product model
- **User:** A developer or engineering lead wants a full inventory of every feature in the product model, filterable by module or status, to see what exists and how deep its written spec is.
- **User value:** Not recorded
- **Scope:** in: lists every feature with id, name, module, declared spec depth, acceptance-criteria-met count, and status, narrows the list with --module <id> or --status <value>, orders the list by feature id; out: does not show a feature's full detail such as purpose, flow, or edge cases, only the summary row, does not filter by spec depth or by whether depth requirements are met
- **Affected contracts:** none linked

### Primary flow

1. run superdev feature list
2. optionally add --module <id> or --status <value> to narrow the table
3. read the id, name, module, depth, criteria-met, and status columns

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev feature list returns every defined feature | Run superdev feature list and record what was observed. | Met | EV-0036 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Not Applicable | N/A - the table already covers the full range from zero rows to the current 91-feature scale through the empty_states path, there is no separate size limit or pagination behavior |
| Empty States | Applicable | no features match the given filters prints 'Nothing recorded yet for features.' |
| Invalid Input | Applicable | the --status filter is matched case-sensitively against the raw stored value, so --status Implemented (capitalized, matching what the table displays) returns nothing while --status implemented (the actual stored casing) returns the expected rows, with no error either way |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2066 maps 'feature list' to cmdFeatureList. Ran `node src/cli.mjs feature list`, printed a table of 91 features with id, name, module, depth, criteria-met, and status columns. | command | pass | superdev feature list |

## Delivery state

- **What works now:** Reached by superdev feature list. src/cli.mjs:2066 maps 'feature list' to cmdFeatureList. Ran `node src/cli.mjs feature list`, printed a table of 91 features with id, name, module, depth, criteria-met, and status columns.
- **What remains:** Nothing known.
- **Next action:** Not recorded
