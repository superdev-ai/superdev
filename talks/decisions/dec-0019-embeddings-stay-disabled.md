<!-- superdev:generated source=DEC-0019 revision=3142 hash=b9a2998e25305c8bececd36b3105d69ac10fc13ed4353899b7651522f0686e51 -->
# DEC-0019: Embeddings stay disabled

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

DEC-TBD-003 in section 23 of the requirements document, raised as Q-0003. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

No embedding provider is used. Retrieval is structured links, deterministic filters and a lexical index. Embeddings are reconsidered only when a benchmark shows what they would add.

## Rationale

Section 15.11 permits embeddings only when benchmarks show a meaningful improvement, and nothing has been measured that they would improve on. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0003. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

Token reduction is already 0.98 and recall 0.85 with no embeddings. Of 40 benchmark questions 6 missed, so the ceiling on the improvement is about 15 percent of recall.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
