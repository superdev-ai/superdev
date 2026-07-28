<!-- superdev:generated source=DEC-0021 revision=3142 hash=124b8ee220ba906a7ef082e34bd771187235eb3419b1d8978fe0e86579aba4ea -->
# DEC-0021: What memory keeps and what it lets go

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

DEC-TBD-005 in section 23 of the requirements document, raised as Q-0005. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

Anything carrying a claim is kept indefinitely: a decision, a learned fact, an outcome, a blocker, an open question. An unlinked session summary is discarded after 30 days. A superseded memory is never deleted, only marked with what replaced it. Deletion by the owner removes the entry and its links in one transaction.

## Rationale

Keeping everything degrades recall as noise accumulates, and ageing everything out loses the decisions that are the point of long-term memory. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0005. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

superdev memory consolidate applies the rule and reports what it kept and what it discarded, and superdev memory status counts superseded entries that are still readable.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
