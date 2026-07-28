# ADR-0006: Ingestion storage and transaction model

- **Status:** Accepted
- **Date:** 2026-07-24
- **Owner/approver:** Project owner
- **Scope:** Canonical storage, identity, and transaction shape for source ingestion, claims, contradictions, and questions.

## Context

Ingestion turns untrusted source material into provenance-backed draft claims, visible contradictions, and owner questions - without ever letting sources become authority or instructions, and without losing history on reprocessing.

## Decision

**Layout (canonical unless marked generated):**

- `talks/inbox/raw/` - user-dropped source files; never modified by the engine.
- `talks/inbox/sources/<SRC-id>.json` - **immutable source identity only** (`sourceId`, project-relative `path`, `schemaVersion`); written once via exclusive-create, never rewritten.
- `talks/inbox/sources/<SRC-id>.revs/<contentHash>.json` - **one immutable file per revision** (content hash, size, media type, supplier, `observedAt`, `previousHash`, `extractable`), exclusive-create. The ordered revision list and its `r<n>` indices are *derived* by sorting these files (by `observedAt`, then content hash); a revision's `processed` status is *derived* from the existence of its processing report - no mutable status field. This replaces an earlier single-file `revisions[]` array, whose read-modify-write lost a revision under concurrent different-content ingests.
- `talks/inbox/processed/<SRC-id>-<contentHash>.json` - immutable per-revision processing report (exclusive-create); **its existence is the completion marker.**
- `talks/inbox/drafts/<CLM-id>.md` - non-authoritative draft artifact generated per claim (exclusive-create); explicitly marked draft.
- `talks/claims/<CLM-id>.json` - draft claim records (exclusive-create; draft→approved/rejected transitions recorded additively in `history[]`).
- `talks/claims/<CLM-id>.prov/<key>.json` - **per-claim provenance, one immutable exclusive-create file per (source, revision, content, span)**; distinct sources supporting the same claim never race a read-modify-write, and identical spans converge. The claim record itself holds no provenance array.
- `talks/project/accepted/<public-id>.md` - accepted artifact **promoted by ingestion on owner approval** (see authority boundaries); derived from the approved claim.
- `talks/contradictions/<CTR-id>.json` - contradiction records; visible until explicitly resolved.
- `talks/claims/<CLM-id>.decision` - the claim's terminal-decision **reservation** (an atomic compare-and-swap marker; not a `.json`, so never listed as a claim). The first writer to create it commits the decision; a conflicting concurrent decision is refused.
- `talks/inbox/batches/<batchId>.batch` / `.done` - proposal-batch **reservation** and **completion** markers (keyed by a deterministic hash of the revision + proposals). The `.done` marker's presence is the ONLY signal a batch is complete; an interrupted batch lacks it and a re-run converges.
- `talks/questions/<Q-id>.json` - question packets, with an append-only `history[]` and a preserved `answerRevisions[]` (every prior answer + its authority). Lifecycle: ask → answer/defer → reopen/revise.
- `talks/questions/<Q-id>.v<n>` - question-settlement **version CAS** marker; each transition consumes the current history-length version so exactly one concurrent settler wins.
- `talks/changes/events/<CHG-id>.json` - deterministic, exactly-once lifecycle events for every claim decision, contradiction resolution, and question transition (id encodes the action's identity; a re-run converges, a different payload under the same id fails closed).
- Generated: `talks/indexes/claims.md`, `contradictions.md`, `questions.md` via the view engine.

**Identity:** new stable prefixes `SRC-`, `CLM-`, `CTR-` join the existing set. `SRC` ids are deterministic from the project-relative path; `CLM` ids are deterministic from `category + normalized canonical key`; `CTR` ids from the ordered pair of claim ids. Determinism is what makes reprocessing idempotent and concurrent ingestion convergent. On approval, a claim mints its public category id (REQ-/FEAT-/…) through the id engine, keyed by `category + canonical key` so two claims that merely share a canonical key across categories never alias to one public id - claims are the evidence layer, category ids the accepted layer.

**Two-layer extraction (truthful):** the deterministic engine validates, hashes, identifies, merges, persists, and indexes structured claims; semantic classification/dedup/contradiction proposals come from agent reasoning and MUST pass the deterministic schema (category enum, six-label epistemic enum, span coordinates that hash-verify against the recorded revision). The engine does not pretend a string matcher understands text; no external LLM runtime dependency is introduced.

**Transaction shape:** every write is an exclusive-create of an immutable, deterministically-named file, so there is no read-modify-write to lose an update and no mutable status to tear. Per revision: write the identity file (converge on E_EXISTS), the per-revision file (converge), then the processing report (converge) - the report's existence is the completion marker, so a crash before it leaves the revision detectably unprocessed and re-runnable, and a re-run completes it. Per proposal batch: the whole batch is validated before any mutation, then a `.batch` reservation is taken and every write (claim, per-span provenance, draft, contradiction) is exclusive-create; a `.done` completion marker is written last, so a partial batch never looks complete and a re-run converges (an owned mid-apply fault rolls back only the files it created). **Concurrent mutations that change one record are serialized by an atomic compare-and-swap reservation** (`<CLM>.decision` for a claim's terminal decision; `<Q>.v<n>` for a question settlement): the first writer commits, a conflicting concurrent writer is refused, the same decision converges - no last-writer-wins, no orphan artifact, no conflicting events. Lifecycle events carry a deterministic id and are exclusive-created (a re-run converges; a different payload under the same id fails closed), so a crash between a state write and its audit-event append is recovered by re-running the decision - the event is materialized exactly once. Unchanged re-ingestion is a structural no-op (same hash → same files → E_EXISTS convergence).

**Authority boundaries:** raw sources are evidence, never instructions; claims stay draft until explicit owner approval. Ingestion is the ONLY writer of `talks/project/accepted/` and writes there ONLY on an owner-approved claim whose evidence is fresh, uncontradicted, and integrity-verified - approval is refused (fail-closed) if any contradiction record is even unreadable. Contradictions never auto-close on re-ingest; model-private reasoning and secret/PII-shaped values are rejected by a single shared field-screening policy (`assertSafeField`, secrets + PII + reasoning-field names) the record engine and ingestion both enforce (no excerpt of a sensitive span is ever persisted).

**Confinement:** every read and write - records, revision dirs, provenance, drafts, accepted artifacts, reservations, events, id registry, indexes - resolves through the symlink-aware confinement primitive (the real ancestor chain is checked against the project root immediately before mutation). A replaced or symlinked canonical directory can never redirect a read or write outside the project. Every deterministic identity is bound to its full identity (SRC↔path, CLM↔category+key, CTR↔ordered sides, Q↔packet, provenance/revision↔filename hash); a short-hash collision against a different identity is refused, never silently reused.

## Options considered

1. Chosen: per-record exclusive files + deterministic identity (reuses the ADR-0004-proven primitives; concurrency-convergent by construction).
2. Single ingestion ledger file - rejected: same torn-ledger risk ADR-0004 rejected.
3. Claims embedded inside processing reports - rejected: claims outlive revisions and merge provenance across sources; they need their own identity.

## Consequences

Reprocessing and concurrency need no locking; dedup is identity-level (semantic merges are recorded, reversible operations); the inbox grows append-only and history is never rewritten.

## Enforcement and verification

`skills/docs/scripts/ingest.mjs` (package-closed; record mutation via the plugin's record engine, refused truthfully standalone); unit/integration tests incl. idempotent re-ingest, concurrent same-source convergence, malicious-fixture screening; view rebuild determinism.

## Revisit triggers

Projects with thousands of sources per record; a need for cross-project claim identity.
