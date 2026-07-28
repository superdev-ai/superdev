# ADR-0018: One progress implementation, imported in process

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** Every number Superdev reports about completeness.
- **Supersedes:** ADR-0009

## Context

Progress previously lived in three places that could disagree: a counting engine,
a write-back reconciler, and a freshness layer, with the cloud view free to
compute a fourth answer. The brief requires that progress be identical in the
CLI and the interface.

Two ways to satisfy that are wrong. Making the CLI call the service over HTTP
fails when the service is down, and the CLI has to work alone. Materializing a
progress column creates staleness with no owner.

## Decision

`src/progress/index.mjs` is a pure read module over an open database handle. The
CLI imports it in process. The service route is a thin wrapper around the same
function. There is one implementation, so parity is structural rather than
asserted.

Rules the module enforces, each of which was a real failure before:

- Only applicable components count. A component applies when its total is above
  zero, so a backend feature with no interface does not sit at five of six
  forever.
- A record with no declared completion contract returns `measurable: false` and
  a null percentage. Never zero, never one hundred. The interface prints "Not
  measurable", which is the honest answer.
- Every value carries its completed count, total count, what counts, what
  remains, source revision and freshness. A bare percentage is not valid output.
- Cancelled and superseded work leaves the totals but stays visible in history.
- Evidence older than thirty days is stale, which is not the same as satisfied.

## Consequences

- Positive: the CLI and the interface cannot drift, and every number can explain
  itself.
- Negative: progress is computed per read rather than cached. Measured cost is
  well inside a single database open.
- Neutral: a future remote view must call this module rather than reimplement it.

## Enforcement

A validator computes progress in process and compares it against the service
response for the same project.

## Related

ADR-0014, ADR-0015.
