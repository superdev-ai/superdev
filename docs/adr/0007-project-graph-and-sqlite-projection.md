# ADR-0007: The project graph and its SQLite projection

> **Superseded by ADR-0013.** The database is no longer a disposable projection rebuilt from JSON files: it is the authority, and there are no JSON files to rebuild it from. The generic node table and its JSON field bag are replaced by typed normalized tables.
>
> The body below is left exactly as it was. History is not rewritten here; a
> decision that was true when it was made stays readable as what was decided.


**Status:** Accepted
**Date:** 2026-07-25
**Owner/approver:** Superdev maintainers

## Context

Superdev needs to answer questions about a project that are inherently
relational: what does this feature depend on, what is blocked by what, which
tasks trace to which goal, what changed since the last milestone, and what did
the project look like a week ago. It must answer them fast enough to regenerate
a dashboard on demand, and it must keep working when the storage acceleration is
unavailable.

Two constraints shaped the decision:

1. The canonical record must stay human-readable, diffable and
   version-controlled. A project's history is the user's, and it must survive
   Superdev being uninstalled.
2. The package targets Node >= 20 with zero runtime dependencies. `node:sqlite`
   first appeared in Node 22.5 and is still flagged experimental; adding
   `better-sqlite3` or a WASM build would introduce native compilation,
   packaging and licensing burden for a query cache.

## Decision criteria

- Losing the database must cost the user nothing.
- The same status must be produced with or without SQLite.
- No new runtime dependency, and no silent increase in the Node requirement.
- Adding an entity type must not require a schema migration per type.
- The model must support later visualization work without a data rewrite.

## Options considered

**A. Canonical files only, no projection.** Simplest, zero portability risk.
Rejected: every status generation re-reads and re-derives the whole project, and
there is no query surface for a future canvas to page against.

**B. SQLite as the source of truth.** Fast and relational. Rejected outright: it
makes the project record a binary blob, undiffable, unmergeable, and lost when
the file corrupts. It also inverts the ownership model - the user's history
would live in Superdev's cache.

**C. Canonical files with a derived SQLite projection, feature-detected.**
Chosen.

**D. Add `better-sqlite3`.** Rejected: a native dependency for a rebuildable
cache is not a trade worth making, and it would break the zero-dependency
install on any platform without a prebuilt binary.

## Decision

The canonical source of truth is one human-readable JSON file per node under
`talks/product/`. A **derived** SQLite projection lives at
`.superdev/superdev.db`, is git-ignored, and is disposable by construction.

The backend is chosen by **feature detection at runtime**, never by a version
string: `node:sqlite` is imported, its `DatabaseSync` API is exercised against an
in-memory database, and only a probe that fully succeeds enables acceleration.
Anything else falls back to the **direct** backend, which answers the identical
queries straight from canonical records. The direct path is a first-class
implementation, not a panic fallback - which is what makes the fallback correct
rather than degraded.

The projection stores a node/edge core (`nodes`, `links`, `status_history`,
`record_revisions`, `metadata`) with typed **views** over it (`features`,
`goals`, `feature_dependencies`, …). Views rather than one table per type: the
query surface reads the same, while adding an entity type stays a table entry in
the model rather than a migration.

Integrity properties: foreign keys enforced, projection writes wrapped in a
single transaction, a bounded busy timeout so concurrent agents wait rather than
fail, and a content fingerprint over all canonical records so a stale projection
is **detected** rather than trusted.

The `engines` field stays `>=20`. It is not raised, because the direct backend
makes SQLite genuinely optional.

## Observable rationale

A projection that can be deleted at any moment forces the canonical records to be
complete, which is the property that actually protects the user. The delete-and-
rebuild test is therefore not an edge case - it is the load-bearing guarantee,
and it asserts logical identity of the entire status object.

Suppressing the `ExperimentalWarning` is scoped to the single probe import.
A project-status command that printed a Node warning on every run would push
users to disable the feature entirely.

## Consequences

- Status is correct on every supported runtime; only speed differs.
- The doctor reports whether acceleration is active, and why not when it is not.
- `.superdev/` is git-ignored; the database, WAL, SHM and generated dashboard
  are never committed.
- A future infinite-canvas UI can page against the projection without any change
  to the canonical model.
- Cost: the projection must be invalidated correctly. Mitigated by fingerprinting
  every canonical record rather than trusting mtimes.

## Verification

- `tests/integration/sqlite-rebuild.test.mjs` - delete-and-rebuild identity,
  stale detection, corrupt-database replacement, foreign-key enforcement, view
  resolution, migration ordering, and identical status across both backends.
- `tests/integration/journeys.test.mjs` - the stale-state recovery journey.

## Revisit triggers

- `node:sqlite` becomes stable across every supported Node version - revisit
  whether the direct backend can be simplified (it should still be kept).
- The projection exceeds what a single-file SQLite database serves comfortably.
- A canvas UI needs incremental updates rather than full rebuilds.
