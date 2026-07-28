# ADR-0009: Derived views converge at project boundaries

> **Superseded by ADR-0018.** Progress is one pure module the CLI imports in process and the service wraps, so convergence is structural rather than something that has to be reconciled.
>
> The body below is left exactly as it was. History is not rewritten here; a
> decision that was true when it was made stays readable as what was decided.


**Status:** Accepted
**Date:** 2026-07-26
**Owner/approver:** Superdev maintainers
**Extends:** ADR-0007; it does not change canonical storage authority

## Context

ADR-0007 established `talks/` as the canonical project record and made both the
SQLite projection and generated dashboard disposable. The first implementation
correctly rebuilt SQLite when status was requested, but dashboard generation was
a separate command. Lifecycle hooks marked `.superdev/dirty` after edits without
repairing either derived view.

That separation created an observable product failure: canonical task and
feature records could be current while an already-open dashboard still showed
an older state. Correctness depended on an agent remembering an additional
dashboard command after every relevant change.

## Decision criteria

- Canonical project records remain the only source of truth.
- A user asking for status receives synchronized SQLite and dashboard views.
- Applied project-map mutations do not need a remembered follow-up step.
- Direct edits converge automatically where the harness exposes a suitable
  lifecycle event.
- Refresh work is bounded and cannot block ordinary development when it fails.
- The portable dashboard remains one self-contained file with no server or
  runtime dependency.

## Options considered

**A. Keep explicit dashboard generation only.** Rejected. It makes freshness a
prompt-discipline concern and reproduces the failure this decision addresses.

**B. Make the browser read SQLite directly.** Rejected. A self-contained
`file://` page cannot safely and portably query a local SQLite file, and doing so
would make a disposable cache appear authoritative.

**C. Add a permanent local web server.** Deferred to a live collaborative
product surface. Requiring a server would remove the dashboard's useful
single-file, offline, shareable property.

**D. Reconcile both derived views at project boundaries and supported batch
hooks.** Chosen.

## Decision

SQLite and the HTML dashboard are sibling projections of the same canonical
status shape:

1. Every applied `project` mutation refreshes SQLite and regenerates the
   dashboard.
2. Every `project status` request reconciles both views before returning.
3. Explicit `project dashboard` uses the same reconciliation path and may open
   the resulting file.
4. In Claude Code, `PostToolBatch` performs one bounded refresh when a batch
   directly edits canonical product, decision, or change records. It does not
   rebuild once per edit.
5. On harnesses without an equivalent file-edit event, the status boundary is
   the portable fallback.

The dashboard embeds the canonical graph fingerprint captured at generation
time. The plugin compares that value with the current graph to detect stale,
missing, or unreadable snapshots. The page labels itself as a static snapshot;
its control reloads the latest generated file but does not claim to query live
storage.

Hook refresh is fail-quiet and confined to `.superdev/`. A failure leaves the
dirty marker intact so the next status or dashboard command retries from
canonical records. A concurrent edit cannot be erased accidentally: the marker
is cleared only when it is unchanged from the start of the refresh.

## Consequences

- SQLite and the dashboard are current after normal product-map operations.
- Asking “what is the project status?” also repairs out-of-band record edits.
- Claude Code direct canonical edits converge once per tool batch.
- Static dashboards are still snapshots. Real-time multi-user updates belong to
  a server-backed consumer of the same status contract.
- Refresh adds bounded local work at meaningful project boundaries; it does not
  add network calls, runtime dependencies, or per-keystroke regeneration.

## Verification

- `tests/integration/derived-view-freshness.test.mjs` - mutation-time refresh,
  status-time healing, canonical batch-edit convergence, and unrelated-edit
  isolation.
- `tests/integration/dashboard-render.test.mjs` - embedded status integrity,
  fingerprint-safe generation, self-contained output, and the wired snapshot
  reload control.
- `tests/integration/sqlite-rebuild.test.mjs` - projection freshness and
  canonical reconstruction.
- `claude plugin validate --strict .` - lifecycle declaration validity.

## Revisit triggers

- A harness exposes a reliable cross-tool transaction boundary that can replace
  its explicit status fallback.
- Incremental projection updates become necessary for project size or latency.
- A live server-backed dashboard is introduced; it must consume the shared
  status contract without replacing `talks/` as authority.
