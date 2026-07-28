# ADR-0014: Read-only readers, short exclusive writes, bounded retry

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** Every process that opens the Superdev database: CLI, lifecycle hooks, and the local service.

## Context

Superdev is a multi-process system. The CLI, Claude Code lifecycle hooks, and a
long-lived local HTTP service all need the same database. The naive arrangement,
where the service holds a connection open for its lifetime, would make every CLI
command and every hook fail while the service is running.

## Evidence

Measured against `@tursodatabase/database` 0.7.1 on the target platform:

- A default `connect()` takes an exclusive process-level lock for the entire
  connection lifetime. A second process cannot open the file at all, for reading
  or writing, while that lock is held.
- `connect(path, { readonly: true })` bypasses the lock completely. Readers
  succeed while a writer holds the file.
- The option name is lower-case `readonly`. Passing `readOnly` silently takes the
  write path and blocks. This is a real trap and is asserted against in code.
- `connect()` on a held lock fails after 0 ms. It never waits, so the caller has
  to retry.
- Open plus query plus close costs 0.3 ms median, 1.0 ms worst of twelve.
- 300 inserts inside one transaction, including open and close, costs 3 ms.
- Under heavy contention a retry loop acquired the lock within 667 ms.
- `BEGIN CONCURRENT` works only under `PRAGMA journal_mode = mvcc`, and only
  between connections inside a single process.
- A readonly connection is pinned to the snapshot it held when it opened. It
  never observes another process's later commits. Measured: a long-lived
  readonly handle reported zero rows across two external commits while a fresh
  handle on the same file reported two. Every query still succeeds, so the
  staleness is invisible.
- `PRAGMA data_version` returns undefined on this engine, so the usual
  cross-process change counter is unavailable.

**Epistemic status:** Confirmed by execution.

## Decision criteria

The local service must never lock out the CLI or a hook. Hooks must finish well
inside a five second budget. No write may be silently lost.

## Options considered

1. **Read-only readers plus short exclusive writes with bounded retry** - chosen.
2. Service owns the only connection, CLI and hooks talk to it over HTTP -
   rejected: correctness would then depend on a running service, and the brief
   requires the CLI to work on its own.
3. A separate advisory lock file coordinating all processes - rejected: the
   engine already provides the lock; a second one would only add a way to
   disagree with it.

## Decision

- Every read opens with `{ readonly: true }`. Readers never block and are never
  blocked.
- Every write opens exclusively, runs exactly one transaction, and closes
  immediately. The lock is held for single-digit milliseconds.
- Write connections are wrapped in bounded retry with jitter, because the engine
  fails fast rather than waiting.
- `journal_mode = mvcc` is set once at creation and persists in the file header.
- The local service performs all of its reads read-only, so it can stay up
  indefinitely without holding the write lock.
- No connection is ever cached or pooled. Every read opens, queries and closes.
  This is not an oversight to be optimized later; a pooled readonly handle would
  serve permanently stale data with no error to reveal it.
- Change detection polls `SELECT max(sequence) FROM activity_events` on a fresh
  readonly connection, roughly once a second, because `PRAGMA data_version` is
  unavailable. Every mutation writes an activity event, so that maximum is an
  accurate change signal, and it doubles as the resumable server-sent-events
  cursor the interface needs. Watching the database file instead would not work:
  commits land in the write-ahead log and the main file does not move.

## Consequences

- Positive: the service, the CLI, and hooks coexist. Hook cost is roughly 0.3 ms
  against a five second budget.
- Negative: cross-process concurrent writes do not exist at this engine version.
  Writes serialize. This is stated honestly rather than implied away.
- Neutral: every write path is explicitly transactional, which the brief requires
  anyway.

## Risks

A pathological writer holding a transaction open would stall other writers.
Mitigated by the rule that a write connection is opened, used, and closed inside
one function, never handed to a caller.

## Enforcement

The connection module is the only place `connect()` is called. It exposes exactly
two entry points, a read helper and a write-transaction helper, and asserts the
lower-case `readonly` spelling.

## Verification

The journey runs the service and the CLI at the same time and mutates from both.

## Revisit triggers

The engine gains cross-process concurrent writes or a waiting lock acquisition.

## Related

ADR-0013, ADR-0015.
