<!-- superdev:generated source=FEAT-0099 revision=3537 hash=6ead2b77ec918da0df824056e8518410f971603bb61ab6888f7471c75112e537 -->
# Feature: Refuse a record type the interface shows and nothing can write

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Packaging and Distribution
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Fail the build when a record type the interface renders or the depth gate requires has no write path, so a whole area of the record cannot silently be unfillable
- **User:** Whoever ships the next version, who cannot be expected to remember which of forty record types has an author and which does not
- **User value:** Not recorded
- **Scope:** in: Checking every record type the depth gate requires against the commands that can write it, Checking every record type an interface area renders against the same, Naming the record type, where it is required, and that nothing writes it; out: Guessing whether a record type ought to exist, since the depth gate and the interface already say which ones matter
- **Affected contracts:** none linked

### Primary flow

1. The validator reads what the depth gate requires and what the interface renders
2. It finds which of those record types any command can create
3. It fails the build for each one that nothing can write, naming it

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A record type the depth gate requires with no writer fails the build | Run the validator against the current tree and read what it names | Met | EV-0158 |
| Adding a writer clears that finding without editing the validator | Add a write path and re-run it | Met | EV-0159 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | A record type deliberately written only by init is named as such rather than counted as missing |
| Versioning | Applicable | A record type added to the depth gate later is picked up without editing the validator |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| The validator names every record type the product asks for and cannot write | manual_check | pass | - |
| Adding a write path clears the finding without editing the validator | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
