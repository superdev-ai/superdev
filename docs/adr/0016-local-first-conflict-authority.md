# ADR-0016: Superdev decides conflicts, the sync transport never does

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** Future remote synchronization. No transport is wired in this rebuild.

## Context

The owner asked for Turso partly for cloud compatibility. Turso ships
`@tursodatabase/sync`, which gives a local file with explicit `push()` and
`pull()` against Turso Cloud, works offline with `bootstrapIfEmpty: false`, and
is currently marked beta.

Its conflict strategy is last-push-wins. The brief requires the opposite: a
differing remote version must create a visible conflict and must never silently
overwrite local data. These cannot both be true.

## Evidence

Turso documentation states the sync SDK uses last-push-wins and that a synced
database file should only be accessed through the sync SDK. Cloud implementation
is explicitly out of scope for this rebuild, and no credentials are available.

## Decision

Conflict authority stays in Superdev. The `sync_peers` and `sync_conflicts`
tables and the `version` columns are the mechanism; a differing remote version
creates a `sync_conflicts` row that surfaces in the control center and blocks
nothing silently.

`@tursodatabase/sync` is not wired in this rebuild. When it is adopted later it
is transport only: Superdev compares local, remote and last-synced versions
before anything is applied, exactly as the existing conflict preflight already
does. Last-push-wins is never allowed to arbitrate.

## Options considered

1. **Application-level conflict tables, sync unwired** - chosen.
2. Wire the sync SDK now behind configuration - rejected: needs credentials, is
   out of scope, and inherits last-push-wins.
3. Adopt last-push-wins - rejected: it silently overwrites local work, the one
   outcome the brief names as never acceptable.

## Consequences

- Positive: the local model stays the authority; adopting a transport later
  changes no identities.
- Negative: Superdev carries conflict machinery that nothing exercises yet.
- Neutral: the note that a synced file must only be opened through the sync SDK
  becomes a constraint to honour if that transport is adopted.

## Enforcement

The schema keeps project identity, event identity, actor identity, versions,
conflicts and sync cursors so a transport can be added without replacing the
local model.

## Related

ADR-0013, ADR-0015.
