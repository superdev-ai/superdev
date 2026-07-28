<!-- superdev:generated source=DEC-0018 revision=3142 hash=1c6037e3cf589e9a854ee49b61700f84806050d1b22cdd009279a0e202f461de -->
# DEC-0018: The threshold that would let Claude Mem be dropped

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner or approver:** the project owner, through the standing instruction not to defer
- **Scope:** project PRJ-0001
- **Supersedes:** none
- **Superseded by:** none
- **Partially supersedes:** none
- **Expiry:** none
- **Last verified:** see the generation marker at the top of this file.

## Context

DEC-TBD-002 in section 23 of the requirements document, raised as Q-0002. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

Claude Mem stays a transitional provider until the benchmark reports recall of 0.90 or better and mean reciprocal rank of 0.75 or better over at least 200 memories. All three conditions must hold in the same run.

## Rationale

Section 15.12 says Claude Mem remains optional until parity is demonstrated, and parity cannot be demonstrated against a threshold nobody has written down. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0002. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

superdev memory benchmark prints all three numbers. Today they are recall 0.85, ranking 0.70 over 79 entries, so the gate is real rather than a rubber stamp.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
