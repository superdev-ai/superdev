<!-- superdev:generated source=DEC-0014 revision=277 hash=54a7e79a1b6edb70b244e4eb36b23f012c1ffc00c5c0aa529f9e3d2f902bf94f -->
# DEC-0014: Runtime state and generated artifacts stay out of Git

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

Runtime state, generated caches, backups, and event streams must not pollute the Git repository.

## Rationale

Stated as a direct rule on what belongs in version control, observable by inspecting the repository for absence of these artifact types.

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
