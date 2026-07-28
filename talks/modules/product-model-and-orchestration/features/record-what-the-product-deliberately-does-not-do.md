<!-- superdev:generated source=FEAT-0093 revision=3235 hash=2554edf6fa3b526acf6a6bc56179095f72a4f2b0354e64560d42835af3bf7cfd -->
# Feature: Record what the product deliberately does not do

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Give non-goals and project scope a write path, so a deliberate exclusion is distinguishable from an oversight
- **User:** Somebody whose brief listed what the product will not do, and who was then told by the generated foundations that none was declared
- **User value:** Not recorded
- **Scope:** in: Converting a brief's out-of-scope section into project scope records during init, A scope command that records, lists and removes in-scope, out-of-scope and non-goal statements after init; out: Feature-level scope, which feature specify already records, Rolling feature scope up into project scope, because the two answer different questions
- **Affected contracts:** none linked

### Primary flow

1. A brief lists what the product will not do under Out of scope
2. Init converts each of those into a project scope record, keeping the provenance
3. The generated product foundations list them as non-goals
4. Anything decided later is added with superdev scope record

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A brief's out-of-scope section reaches the generated foundations | Initialize from a brief with an Out of scope section and read talks/foundations/product.md | Met | EV-0132 |
| Scope can be recorded, listed and removed after init | Run superdev scope record, scope list and scope remove against a project | Met | EV-0133 |
| A hand edit to the Non-goals section is refused by naming the command that writes it | Edit the section in a generated document and run superdev docs accept | Met | EV-0134 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | A statement already recorded is refused, naming the record and the direction it was recorded as |
| Empty States | Applicable | With nothing recorded, scope list says what a non-goal is for and gives the command that records one |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A brief's out-of-scope line reached the generated Non-goals section, with its provenance | manual_check | pass | - |
| Scope was recorded, listed and removed through the CLI on a real project | manual_check | pass | - |
| A hand edit to Non-goals is refused with the command that writes it | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
