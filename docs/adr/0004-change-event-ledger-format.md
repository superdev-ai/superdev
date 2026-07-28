# ADR-0004: Change-event ledger format

- **Status:** Accepted
- **Date:** 2026-07-24 (proposed 2026-07-23; accepted on spike evidence)
- **Owner/approver:** Project owner
- **Scope:** Physical storage format for immutable change events under `talks/changes/`.

## Context

Change events must be append-only, immutable, concurrency-safe (two agent sessions may write near-simultaneously), and rebuildable into human-readable views. The format decision was deferred until a concurrency spike produced evidence.

## Decision criteria (defined before testing)

C1 exactly-once survival under concurrent writers · C2 induced identical candidate-ID collisions never overwrite · C3 no torn canonical record · C4 deterministic view rebuild · C5 recoverable generated view · C6 acceptable behavior at larger volume · C7 cross-platform-safe filenames and atomic primitives.

## Options considered and evidence

Spike: `tests/integration/event-format-spike.test.mjs` - 4 concurrent OS processes × 25 events each, all deriving candidate IDs from one identical base stamp (collisions induced by design), plus a 2,000-event volume run.

1. **One immutable file per event (exclusive `wx` create, retry-with-suffix on collision)** - measured: 100/100 records survived exactly once; real collisions occurred and never overwrote; zero torn records; view rebuild byte-identical across runs; 2,000 events read back complete and ordered; filenames `[A-Za-z0-9._-]` only. `O_EXCL` semantics are guaranteed by the OS on every target platform.
2. **Single concurrency-safe JSONL ledger (`O_APPEND`)** - measured clean on the local filesystem (no torn lines), **rejected for canonical storage**: `O_APPEND` write atomicity is size- and platform-dependent with no cross-platform guarantee, and a single torn line corrupts the entire ledger file - a failure mode option 1 structurally cannot have.
3. **Per-event canonical files + generated JSONL/changelog views** - option 1's guarantees for the canonical layer; fast-scan and human-readable needs served by disposable views proven deterministic and recoverable (C4/C5).

## Decision

**Option 3.** Canonical: one immutable JSON file per event at `talks/changes/events/<eventId>.json`, written with exclusive creation; collision on candidate ID resolves by suffixing, never overwriting. Generated: JSONL and changelog views under `talks/changes/` and `talks/indexes/`, regeneration-marked, rebuilt deterministically from the canonical files, never authoritative.

## Consequences

- Every event write is collision-safe by construction; no locking protocol needed.
- Bulk reads scan a directory (measured acceptable at 2,000 events); the generated JSONL view serves fast-path consumers and is disposable.
- Event mutation has no engine path: no update operation exists. `verify` detects torn records, filename/id mismatches, duplicates, and schema violations; it does not detect a schema-valid manual edit - the record's git history is the tamper evidence for that class.

## Failure modes and recovery

Crash mid-write leaves only a temp file or a complete canonical file (exclusive create + fsync + close); temp residue is ignored by readers and cleaned by rebuild. A corrupted or deleted generated view is rebuilt from canonical files (`index` command).

## Enforcement and verification

`scripts/talks/events.mjs` (exclusive create, validation, no mutation path); `scripts/talks/index.mjs` (deterministic rebuild); spike + engine concurrency tests in CI.

## Revisit triggers

Canonical event counts routinely exceeding tens of thousands per project; a target platform without reliable `O_EXCL`.
