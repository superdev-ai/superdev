<!-- superdev:generated source=DEC-0022 revision=3142 hash=c47167774c4b0b5125442cf8a4a36695263fa5b222b8c1660558cb8fa271debe -->
# DEC-0022: How synchronization works

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

DEC-TBD-006 in section 23 of the requirements document, raised as Q-0006. Section 23 left it open and says it must be completed before the corresponding features are accepted.

## Evidence

- None recorded.

## Decision criteria

- None recorded.

## Options considered

None recorded.

## Decision

Local first, with the local database always authoritative. A record carries an optimistic version; a push that would overwrite a record changed since the last sync is refused and recorded as a conflict rather than applied. Conflicts are resolved deliberately, keeping local, keeping remote, or merging field by field, and the resolution is recorded. An assignment is held by a lease naming its holder and its expiry, so a second machine claiming the same task is refused with the name of the holder. Work made offline queues in order and replays on the next sync. Append only history never merges: it concatenates by sequence and is never rewritten. The transport is an adapter, and the only one implemented is a directory on this machine, so nothing is sent anywhere until a hosted transport is deliberately added.

## Rationale

Last writer wins loses a concurrent edit silently, which contradicts the honesty this product is built on, and a conflict free replicated type is a large amount of machinery for a product that runs on one machine today. Decided by the agent on the owner's standing instruction not to defer any feature, using the recommendation already recorded against Q-0006. Supersede it with superdev decision supersede to change it; the chain keeps what it replaced.

## Consequences

- Positive: none recorded
- Negative: none recorded
- Neutral: none recorded

## Risks

- None recorded.

## Enforcement

- Not enforced anywhere, which makes this a preference rather than a decision.

## Verification

Two copies of the same project synchronize through a directory, a concurrent edit to the same record is refused and recorded as a conflict, and superdev sync --resolve settles it and replays the queue.

## Revisit triggers

- None recorded.

## Related

Nothing linked.

## History

No transitions recorded.
