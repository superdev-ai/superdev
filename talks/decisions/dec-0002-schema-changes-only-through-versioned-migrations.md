<!-- superdev:generated source=DEC-0002 revision=277 hash=00e1d48f9d47e7830ce24051062e344e43c8b96a3ce34a07318ee164b065ec82 -->
# DEC-0002: Schema changes only through versioned migrations

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

All schema changes must use versioned migrations. Direct schema push commands must not be used.

## Rationale

The command surface only exposes 'superdev db migrate --apply' style commands, not a schema push command, so the only observable path to changing the schema is a migration.

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
