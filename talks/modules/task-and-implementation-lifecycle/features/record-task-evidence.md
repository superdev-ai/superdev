<!-- superdev:generated source=FEAT-0051 revision=2943 hash=c8ccfc7c5b76888ce581250cbc78d999fd991ec720513a49515a2007d6d6ce9d -->
# Feature: Record task evidence

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Attach verification evidence to a task
- **User:** A developer or agent who just ran a check needs to attach what was actually observed to a task, so completion can be gated on real evidence instead of a claim.
- **User value:** Not recorded
- **Scope:** in: records a summary, a result of pass, fail or inconclusive, and optionally the command that produced it, against a task, when a --criterion id is given, a passing result marks that acceptance criterion met, and a later failing result flips it back to unmet, every evidence write is a new row plus an activity entry, so nothing overwrites a previous claim; out: does not run the check itself, it only records a result someone else already produced (superdev verify re-runs it later), does not require an acceptance criterion, evidence can be attached to a task with no criterion named, does not verify that the recorded command actually produced the claimed result at write time
- **Affected contracts:** none linked

### Primary flow

1. run superdev task evidence TASK-id --summary "..." --result pass --command "..." as a dry run
2. re-run with --apply, which prints the new evidence id recorded against the task
3. superdev task show TASK-id (or task complete) confirms the evidence is attached and any linked criterion is met

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev task evidence <TASK-id> stores evidence linked to the task | Run superdev task evidence <TASK-id> and record what was observed. | Met | EV-0073 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | every recorded result, whether pass, fail or inconclusive, is written as its own activity entry naming the task and the summary, so the history shows what was claimed and when regardless of outcome. |
| Consistency | Applicable | a fail recorded against a criterion that a previous pass had marked met clears that met status and its evidence pointer, so a regression retracts the earlier claim rather than leaving two contradictory records. |
| Duplication | Applicable | recording a second passing result against a criterion that is already met writes the new evidence row but does not move the criterion's evidence pointer off the first passing row, since the update only fires when the criterion was not already met. |
| Invalid Input | Applicable | a --result outside pass, fail or inconclusive is rejected immediately with the three valid values named, before any database write. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. src/cli.mjs:1560 cmdTaskEvidence calls attachEvidence (src/tasks/lifecycle.mjs:546), registered as "task evidence" (src/cli.mjs:2046). Ran `node src/cli.mjs task evidence TASK-0001 --summary "Ran validate-all --only data-model, no findings" --command "node scripts/validate/validate-all.mjs --only data-model" --result pass --apply`, which printed "EV-0001 recorded against TASK-0001: ..." and a subsequent `task complete` on the same task confirmed the evidence had been attached to the acceptance criterion. | command | pass | superdev task evidence <TASK-id> --summary "<text>" --result pass\|fail\|inconclusive --apply |

## Delivery state

- **What works now:** Reached by superdev task evidence <TASK-id> --summary "<text>" --result pass\|fail\|inconclusive --apply. src/cli.mjs:1560 cmdTaskEvidence calls attachEvidence (src/tasks/lifecycle.mjs:546), registered as "task evidence" (src/cli.mjs:2046). Ran `node src/cli.mjs task evidence TASK-0001 --summary "Ran validate-all --only data-model, no findings" --command "node scripts/validate/validate-all.mjs --only data-model" --result pass --apply`, which printed "EV-0001 recorded against TASK-0001: ..." and a subsequent `task complete` on the same task confirmed the evidence had been attached to the acceptance criterion.
- **What remains:** Nothing known.
- **Next action:** Not recorded
