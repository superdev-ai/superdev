<!-- superdev:generated source=FEAT-0097 revision=3438 hash=a87008ee11de4be8f4f3b40311a252a9c7530147dcc4645139b28ef05e2ee84a -->
# Feature: Supersede a piece of evidence that no longer applies

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Let a single stale evidence record be retired with a reason, so a check whose command has moved stops reporting a permanent failure on a healthy project
- **User:** Somebody whose check moved, who re-recorded the evidence against the new path, and now has one row failing forever on a healthy project
- **User value:** Not recorded
- **Scope:** in: Retiring one evidence record with a reason, leaving the original and its reason in history, Recomputing the acceptance criterion the retired evidence was the proof for, Saying so when new evidence covers a criterion an earlier record already covers; out: Deleting an evidence record, because what was observed and when is the point of keeping it, Retiring evidence automatically when a command stops resolving, since a broken check is a fact worth seeing
- **Affected contracts:** none linked

### Primary flow

1. Verify reports a check that no longer passes because its command moved
2. The reader supersedes that record with the reason it no longer applies
3. It leaves the verify tally, shows as superseded, and the criterion falls back to any other current proof

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A superseded record leaves the verify tally and says it is superseded | Supersede a record and run verify and task show | Met | EV-0151 |
| The criterion it proved falls back to other current evidence, or to unmet | Supersede the only proof of a met criterion and read the criterion | Met | EV-0152 |
| Recording evidence for a criterion that already has some says so, and names the command | Record two pieces of evidence for one criterion and read the second one's output | Met | EV-0153 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | A record already superseded is refused rather than superseded twice |
| Invalid Input | Applicable | An identifier that is not an evidence record is refused by name, and a reason is required |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A superseded record leaves the verification tally and keeps its command and reason | manual_check | pass | - |
| A criterion falls back to other current proof, or to unmet | manual_check | pass | - |
| Recording evidence for a criterion that already has some says so and names the command | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
