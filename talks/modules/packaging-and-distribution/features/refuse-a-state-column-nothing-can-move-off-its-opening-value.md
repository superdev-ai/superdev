<!-- superdev:generated source=FEAT-0103 revision=4091 hash=2dca42103b913975edf0e3c24de4db2e60a70acb32fcef96af4f46c9af1c9e25 -->
# Feature: Refuse a state column nothing can move off its opening value

- **Status:** Accepted
- **Depth:** Microspec
- **Module:** Packaging and Distribution
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Refuse an enumerated state column that nothing in the product can move off the value it opens at, so a column cannot pretend to be a state machine.
- **User:** A maintainer adding a table wants the build to tell them a status column has no writer, rather than finding out when a report reads nought of two hundred and can read nothing else.
- **User value:** Not recorded
- **Scope:** in: Every enumerated state or status column, read from the migration SQL, The three ways a column moves: setStatus, a direct update, and a patch that names it, A column the creator computes, which is chosen rather than frozen; out: Columns that are enumerated but are not states, such as spec depth or risk level, Judging whether a transition is correct, which is a person's job
- **Affected contracts:** none linked

### Primary flow

1. Read every surviving table from the migrations in file order
2. Keep the enumerated columns named like a state with more than one allowed value
3. Ask whether anything under src can move each one
4. Warn for a column recorded in IMMOVABLE with what goes wrong, and fail for one that is not

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A state column with no writer and no recorded reason fails the build:Remove an entry from IMMOVABLE and confirm the run reports an error | Checked by hand against the running product. | Unmet | - |
| A column the creator computes is not reported:Confirm source material screening and non-functional requirement status are absent from the findings | Checked by hand against the running product. | Unmet | - |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Data Migration States | Applicable | A table rebuilt by a later migration is read from its last definition, and one dropped is not read at all |
| Empty States | Applicable | A project whose migrations define no enumerated state column produces no findings |
| State Machine Violations | Applicable | A column enumerated with a single allowed value is a constant, not a state, and is skipped |

### Test evidence

No verification evidence recorded.

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
