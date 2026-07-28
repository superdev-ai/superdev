<!-- superdev:generated source=DEC-0020 revision=3142 hash=4b4e9afc279a623b1aaea8f272301976e058e1d40cfcf3ec9eb4630916c5190f -->
# DEC-0020: Semantic retrieval would be a bounded local scan, and is described as one

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

DEC-TBD-004 in section 23 of the requirements document, raised as Q-0004. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

If embeddings are ever enabled, retrieval over them is a bounded local scan. No vector capable database and no remote vector service is added. Every description of semantic retrieval says bounded scan and never indexed vector search.

## Rationale

A second storage engine contradicts the single database authority in DEC-0014, and a remote service breaks the local first promise in NFR-001. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0004. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

superdev memory status states in plain words that semantic retrieval is not in use and would be a bounded scan.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
