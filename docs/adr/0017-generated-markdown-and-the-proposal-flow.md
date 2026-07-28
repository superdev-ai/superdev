# ADR-0017: Markdown is a generated projection, and a human edit becomes a proposal

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** Everything the Docs skill generates under `talks/`.
- **Supersedes:** ADR-0003 (the file-per-record project record)

## Context

Markdown is required because it is readable, reviewable, searchable and useful
to a coding agent. It must not become a second writable source of truth, which
is what happens the moment a human edit and a regeneration can disagree without
anyone noticing.

## Decision

Every generated file opens with a marker carrying the source record, the
database revision, and a hash of the body:

```
<!-- superdev:generated source=FEAT-0007 revision=42 hash=... -->
```

The hash covers the body after the marker, normalized to LF endings with
trailing whitespace stripped and exactly one terminal newline. The renderer is
deterministic: stable ordering and no timestamps inside the body, so identical
data always produces an identical hash. Without that, every regeneration would
look like a human edit.

Documents come in two modes, because treating them alike breaks one of them:

- `authored_projection` (foundations, modules, features, workflows, surfaces,
  APIs, data, integrations, jobs, roles, quality attributes, decisions). If the
  on-disk hash differs from the recorded one, Superdev raises a proposal, shows
  the difference, and does not overwrite. Accepting updates the database first,
  then regenerates. Rejecting regenerates after recording the discarded text in
  an activity event, so it stays recoverable.
- `derived_view` (the changelog and the reports). Always rewritten, carries a
  do-not-hand-edit banner, never raises a proposal. A status report whose whole
  purpose is to be current cannot be held hostage by a stray edit.

Where an edit touches prose that maps to no column, Superdev says which sections
it could not apply and leaves the file alone. It does not guess.

## Consequences

- Positive: one authority, and a human edit is never silently lost.
- Negative: an edit to an unmapped section needs a human decision.
- Neutral: the renderer's determinism is now load bearing and is validated.

## Enforcement

The Markdown validator checks every generated file for a marker, a matching
hash, and resolving links.

## Related

ADR-0015, ADR-0019.
