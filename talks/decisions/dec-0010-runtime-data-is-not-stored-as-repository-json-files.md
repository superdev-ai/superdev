<!-- superdev:generated source=DEC-0010 revision=277 hash=07b4eeecabcc0861db230600c26bdb1f6a553b6167f71f0293686b0fc583b746 -->
# DEC-0010: Runtime data is not stored as repository JSON files

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

Runtime data must not be stored as repository JSON files.

## Rationale

A storage-location constraint, observable by checking whether runtime state lives in the database/cache layer instead of committed JSON in the repo.

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
