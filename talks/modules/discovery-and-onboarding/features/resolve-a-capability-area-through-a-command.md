<!-- superdev:generated source=FEAT-0094 revision=3298 hash=7cb77ecf0268bba7816293614d3b3ad7272a4921625e0879ea75f30b32f63955 -->
# Feature: Resolve a capability area through a command

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Discovery and Onboarding
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Let a readiness area be specified or recorded as not applicable, and stop an area being left awaiting a decision that nobody was asked about
- **User:** Somebody whose readiness checklist carries a High warning telling them to raise a question or record an area as not applicable, when neither is a command that exists
- **User value:** Not recorded
- **Scope:** in: A command that specifies a readiness area with the choice made and what evidences it, A command that records an area as not applicable, with the reason, Settling the purpose area from the project statement, since supplying one is what suppresses its question; out: Inventing a question for an area the material catalogue does not cover, because those areas are seeded deferred by design, A general editor for every capability area column
- **Affected contracts:** none linked

### Primary flow

1. The readiness checklist names an area awaiting a decision
2. The reader specifies it with the choice they made, or records it as not applicable with a reason
3. The area leaves awaiting_decision and the warning clears

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A capability area can be specified by command, and the warning clears | Run superdev capability specify against an area doctor is warning about, then doctor again | Met | EV-0135 |
| A capability area can be recorded as not applicable with a reason | Run superdev capability not-applicable and read the area back | Met | EV-0136 |
| An area is never left awaiting a decision with no question raised | Initialize with a project statement supplied, which is the case that produced it, and read the readiness areas | Met | EV-0137 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | An area already settled is refused, naming the state it is in |
| Invalid Input | Applicable | An id that is not a capability area is refused by name, and not-applicable without a reason is refused |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| capability specify settled the area doctor was warning about, and the warning cleared | manual_check | pass | - |
| capability not-applicable records a reason, and refuses without one | manual_check | pass | - |
| No area is left awaiting a decision with no question raised | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
