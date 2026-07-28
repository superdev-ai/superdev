<!-- superdev:generated source=DEC-0017 revision=3142 hash=558a8977043bff77186e6a46422fb8cf4f7be764f074fece3203bd311ea5b4e4 -->
# DEC-0017: Long-term memory stays database backed

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

DEC-TBD-001 in section 23 of the requirements document, raised as Q-0001. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

Memory remains entirely database backed. Every memory is a row linked to the records it concerns, and retrieval is structured filters plus a lexical index. No compiled knowledge layer is maintained above it.

## Rationale

A second maintained layer can fall out of step with the database, which principle P-005 exists to prevent, and DEC-0014 makes the local database authoritative. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0001. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

Retrieval quality is measured rather than assumed: superdev memory benchmark reports recall, precision, ranking and token reduction over the memories themselves. A compiled layer is reconsidered only when that measurement stops improving with the corpus.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
