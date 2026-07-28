<!-- superdev:generated source=DEC-0011 revision=277 hash=e002cb336ec6c4cf57327e51a80f47d9b92688025a5ad010842a16aedb17914c -->
# DEC-0011: Unindexed semantic search must be reported as a bounded scan, not indexed vector search

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner or approver:** docs/prd.md
- **Scope:** project
- **Supersedes:** none
- **Superseded by:** none
- **Partially supersedes:** none
- **Expiry:** none
- **Last verified:** see the generation marker at the top of this file.

## Context

No context recorded.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

If the local engine has no vector index, Superdev must report that semantic retrieval uses a bounded scan and must not describe the scan as indexed vector search.

## Rationale

A truth-in-reporting constraint on the memory/retrieval feature, observable in the language Superdev uses when describing its own search capability.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

No verification recorded.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
