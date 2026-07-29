<!-- superdev:generated source=FEAT-0102 revision=3983 hash=327cf77daf61876fa6dda316580500cefa80716bade4b08faed518c7d13be350 -->
# Feature: Settle a module completeness step

- **Status:** Accepted
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Readiness scores every module against a twenty step checklist, and init writes those two hundred and twenty rows as open. Nothing in the product could move one, so the whole component read zero and could never read anything else.
- **User:** As somebody specifying a module, I can record that a step is specified with what was specified, or that it does not apply to this module with the reason.
- **User value:** Not recorded
- **Scope:** in: Filling a step with a summary; marking a step not applicable with a reason; refusing either without its sentence; listing what a module still owes.; out: Deriving a step from other records. Whether a step is specified is a judgement about a module, not a count of rows.
- **Affected contracts:** none linked

### Primary flow

1. Read what a module still owes with superdev module show.
2. Decide, per step, whether it is specified for this module or does not apply to it.
3. Record it with superdev module step for a specified step, or superdev module not-applicable for one that does not apply.
4. Readiness recounts the component on the next read.

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A step moves from open to filled with a summary, and readiness counts it as done. | Checked by hand against the running product. | Met | EV-0178 |
| A step marked not applicable requires a reason and leaves the readiness total rather than counting against it. | Checked by hand against the running product. | Met | EV-0179 |
| Both refuse an empty sentence, so a step cannot be closed by declaring it closed. | Checked by hand against the running product. | Met | EV-0180 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | A step number outside one to twenty is refused rather than inserted. |
| Empty States | Applicable | A module carrying no checklist at all, which module rename already seeds on demand. |
| Invalid Input | Applicable | Marking not applicable with no reason, and filling with no summary, both refuse. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| On a disposable project, filling step 1 moved it from Open to Specified and the readiness component moved from 0 of 20 to 1 of 19. | manual_check | pass | - |
| Marking Internationalization not applicable dropped the readiness total from 20 to 19 rather than counting the step against it. | manual_check | pass | - |
| Filling with no summary, marking not applicable with no reason, and filling with whitespace all refused with a sentence naming what was missing; a step number of 21 refused with the range. | manual_check | pass | - |
| All eleven modules settled against their own records: 113 steps specified, 64 marked not applicable with a reason, 43 left honestly open. Readiness moved from 0 of 220 to 113 of 156. | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
