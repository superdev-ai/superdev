# ADR-0013: Turso is the sole storage engine, and Superdev accepts one runtime dependency

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** All Superdev storage. Supersedes the zero-runtime-dependency clause of ADR-0001 and the disposable-projection model of ADR-0007.
- **Supersedes:** ADR-0007 (in full), ADR-0001 (dependency clause only)

## Context

The rebuild makes the database the authority for project and execution state
rather than a disposable projection rebuilt from JSON files. The owner directed
that the engine be Turso, for local use with cloud compatibility, vector search,
asynchronous design, and concurrent writes.

Superdev previously shipped zero runtime dependencies, feature-detecting
`node:sqlite`. That promise is stated in ADR-0001, advertised in the README, and
enforced by the `DEP-001` validator, which fails on any `dependencies` key.
Adopting Turso overturns it, so the change is recorded rather than assumed.

## Evidence

Measured on darwin arm64, Node 22.23.1, against `@tursodatabase/database` 0.7.1:

- The database file carries the `SQLite format 3` header, so it stays inspectable
  by ordinary SQLite tooling.
- Foreign keys, `ON DELETE CASCADE`, `CHECK` constraints, and triggers using
  `RAISE(ABORT, ...)` are all enforced.
- `PRAGMA user_version` reads and writes, so ordered migrations work.
- `PRAGMA integrity_check` returns `ok`.
- `vector32()` and `vector_distance_cos()` work; `libsql_vector_idx` does not
  exist at this version, so vector recall is a bounded brute force scan.
- `WITH RECURSIVE` is not supported at this version.
- The installed prebuild is 15 MB for one platform.

**Epistemic status:** Confirmed by execution on the target platform at the date
above. The engine is pre-1.0; revisit on each minor release.

## Decision criteria

Authority rather than projection; one engine rather than two; local operation
with no credentials; a path to cloud that does not require replacing the local
model; honest reporting of what the engine cannot do.

## Options considered

1. **`@tursodatabase/database`, installed into the plugin directory** - chosen.
   The user's project gains no dependency and no `node_modules`. The plugin
   installs its own dependency on first use or through `superdev doctor`.
2. `@libsql/client` - rejected: mature and already used by the sibling cloud
   project, but it is the previous generation and does not offer the engine
   features the owner asked for.
3. Vendoring prebuilt native binaries into the repository - rejected: tens of
   megabytes of committed binaries across six platform pairs, and it fights the
   binary-file and package-inventory validators.
4. Requiring the user to install the engine themselves - rejected: contradicts
   the promise that consumer projects install nothing.
5. Keeping `node:sqlite` as a degraded fallback - rejected: two engines means two
   dialect surfaces (vector columns and `BEGIN CONCURRENT` have no `node:sqlite`
   equivalent) and reintroduces exactly the "different result in different
   consumers" failure this rebuild exists to correct.

## Decision

`@tursodatabase/database` is the only storage engine. The plugin declares it as
its own runtime dependency and installs it into the plugin directory. There is
no fallback engine. When the engine is absent, `superdev doctor` says so plainly
and gives the single command that fixes it; nothing silently degrades.

## Consequences

- Positive: one authority, one dialect, vector recall available, a file format
  that ordinary SQLite tools can still read.
- Negative: Superdev is no longer dependency-free. First run needs network once.
  The sole storage authority is a pre-1.0 package.
- Neutral: `DEP-001` becomes a named allowlist rather than a blanket refusal.

## Risks

The engine is pre-1.0 and could change behavior between minor versions. Mitigated
by the SQLite-compatible file format (data is recoverable with other tooling), by
portable JSONL export and import, and by rolling local backups.

## Enforcement

`scripts/validate/` checks that `package.json` declares only allowlisted runtime
dependencies, and that the engine version is pinned.

## Verification

Every claim above was established by running the engine on the target platform.
The full set of measurements, including the concurrency behaviour this design
turns on, is recorded in ADR-0014.

## Revisit triggers

Engine reaches 1.0; `libsql_vector_idx` ships; recursive CTEs ship; cross-process
concurrent writes ship; the owner asks to wire cloud sync.

## Related

ADR-0001, ADR-0007, ADR-0014, ADR-0015.
