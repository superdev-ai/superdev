# ADR-0003: `talks/` v1 - the durable project record

> **Superseded by ADR-0015 and ADR-0017.** The file-per-record talks/ tree it specifies no longer exists. The database is the authority and Markdown is a generated projection. The adoption principles and the stable id prefixes survive, and are restated in references/project-record.md.
>
> The body below is left exactly as it was. History is not rewritten here; a
> decision that was true when it was made stays readable as what was decided.


- **Status:** Accepted
- **Date:** 2026-07-23
- **Owner/approver:** Project owner
- **Scope:** Structure and authority rules of the per-project record Superdev maintains inside user projects.

## Context

Agentic project failures concentrate in lost decisions, spec/code/docs divergence, and unresumable sessions. Superdev's answer is a durable, file-based, human-readable project record living in the user's repository under `talks/`. It must serve both brand-new projects and existing projects that already have documentation conventions.

## Decision criteria

Separation of raw evidence from accepted truth; immutable history; resumability; machine state distinct from prose; no duplicate sources of truth when adopting existing docs; schema versioned independently of the plugin.

## Decision

Adopt the `talks/` v1 structure specified in `references/talks-schema.md`, with these load-bearing boundaries:

- **`inbox/raw` vs `inbox/processed`** - raw evidence is never authority; processing produces drafts requiring approval.
- **`project/`** - accepted current-state specifications (foundations, modules, shared).
- **`decisions/`** - ADRs with full lifecycle including partial supersession; never rewritten to hide history.
- **`changes/`** - immutable change events; human-readable changelog views are generated.
- **`sessions/`, `questions/`, `evidence/`** - session continuity, open questions, retained evidence.
- **`state/`** - machine state: project state, capability lock, docs state, schema version.
- **`indexes/`** - generated, rebuildable, carrying regeneration markers.

For existing projects, `talks/project.yaml` records a documentation adapter (canonical docs root, profile, ownership map, exclusions); Superdev creates only the minimal control layer and never maintains two editable copies of one specification.

The `talks/` schema is versioned in `state/schema-version.json`, independently of the plugin version, with migrations that dry-run, back up, and report.

## Options considered

1. File-based `talks/` record in the user repo - chosen: reviewable, diffable, survives any harness.
2. External database/service - rejected: violates local-first expectations, adds runtime infrastructure.
3. Reusing an existing memory plugin as the record - rejected: recall caches are not authority; they compress and lose provenance.

## Consequences

Users can read, diff, and version their entire project record; Superdev tooling must guard concurrency (immutable events, collision-safe appends).

## Risks

Structure may prove heavy for small projects. **Revisit trigger:** end-to-end testing shows initialization friction; simplify while preserving the seven boundaries above.

## Enforcement and verification

Deterministic init/adopt scripts; unit and integration tests for idempotent init, adoption without duplication, event immutability, index rebuild reproducibility; schema-migration tests including idempotency.
