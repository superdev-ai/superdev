<!-- superdev:generated source=DEC-0024 revision=3142 hash=8fe7098dfc9609f685dd374330378658efaf38621dbda269ade8eaa120aac5ef -->
# DEC-0024: How a remote copy is encrypted and who holds the key

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

DEC-TBD-008 in section 23 of the requirements document, raised as Q-0008. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

Everything that leaves the machine is encrypted with AES-256-GCM under a key the project owner holds, generated locally and never transmitted. The remote copy is unreadable without it. Losing the key costs the remote copy and nothing else, because the local database remains authoritative under DEC-0014. Recovery is the local backup, not the remote.

## Rationale

A service held key means the service can read everything, which section 18 would have to authorize explicitly, and transport encryption alone leaves project text readable at rest by whoever holds the storage. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0008. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

A bundle written to a remote is unreadable as text, and a pull with the wrong key is refused with a plain message rather than producing corrupt records.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
