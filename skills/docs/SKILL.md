---
name: docs
description: Superdev's first-party documentation engine. Use for documenting or specifying a project ("document this project", "write the spec for X", "give me a complete Markdown summary"), classifying a project or discovering/clarifying requirements ("what questions should we answer before building?"), defining features, pages, UI actions, APIs, schemas, workflows, jobs, permissions, observability, compliance, NFRs, or test plans, ingesting source material ("process these notes/requirements"), reverse-engineering docs from code, initializing or adopting documentation without restructuring it, computing change impact, syncing docs after code changes, creating or superseding ADRs, validating documentation ("check docs against code", "find drift"), or generating doc indexes. Profile-aware - works with the talks/ default, module-based docs, legacy flat docs, or a custom structure through an adapter, never duplicating an existing source of truth.
---

# Docs Engine - Router

Classify the operation, load only the reference it needs, run deterministic scripts for fragile work. Reference and asset paths below are relative to this skill directory. **Script invocation:** in plugin mode run scripts as `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/<name>.mjs"` - never as a bare relative path, whose meaning would depend on the current working directory. On a standalone skill install (no plugin root), resolve `scripts/`, `references/`, and `assets/` relative to the directory containing this SKILL.md.

## Writing style, always

Superdev never generates or persists the em dash character (U+2014) or emoji.
Use a period, comma, colon, semicolon, parentheses, or a simple hyphen instead.

This binds everything Superdev writes: documentation, record descriptions, ADRs
and change records, dashboard copy, generated Markdown, generated source
comments, summaries, reports, templates, and commit messages it drafts. It also
binds text taken from a provider: sanitize it or ask for a compliant rewrite
before storing or displaying it.

Enforcement is real, not advisory. Canonical record and operational state writes
are checked and refused with the exact file, record and field
(`E_STYLE_EM_DASH`, `E_STYLE_EMOJI`). Run the style scanner (`node "${CLAUDE_PLUGIN_ROOT}/scripts/style/style.mjs" scan`)
to check a tree, and `fix --apply` to rewrite existing content. Never delete a
sentence to satisfy the rule; rewrite its punctuation.

## Always first

1. **Profile:** read `talks/project.yaml` (documentation adapter) if present; otherwise run `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/profile-detect.mjs" --root <project>` and report its evidence and confidence - never silently guess. Profiles: `references/profiles.md`.
2. **State and decisions:** read `talks/state/` and active decisions if present; surface conflicts before mutating anything.
3. **Authority:** current-state docs vs immutable history vs recall follow `${CLAUDE_PLUGIN_ROOT}/references/operating-model.md` §5. Epistemic labels per `${CLAUDE_PLUGIN_ROOT}/references/evidence-and-risk.md` §1. Record schemas (activity events, session summaries, decision fields) per `${CLAUDE_PLUGIN_ROOT}/references/project-record.md` §6.

## Operation router

| Requested operation | Load |
|---|---|
| Initialize documentation / adopt existing docs | `references/initialize-adopt.md` |
| Ingest source material (engine-backed) | `references/ingestion.md` |
| Classify project / discover or clarify requirements | `references/discovery.md` |
| Cited Markdown project summary | `references/summarize.md` |
| Foundations / module inventory | `references/foundations-modules.md` |
| Define a feature (pick spec depth) | `references/spec-depths.md` |
| Deep module decomposition | `references/module-decomposition.md` |
| Pages, UI surfaces, action/state inventories | `references/surfaces-and-actions.md` |
| APIs / data and schema | `references/apis-and-data.md` |
| Workflows, state machines, async jobs, webhooks | `references/workflows-and-jobs.md` |
| Roles/permissions, observability, compliance, NFRs, test plans | `references/quality-attributes.md` |
| Create or supersede an ADR | `references/adr-authoring.md` |
| Reverse-engineer existing code | `references/reverse-engineer.md` |
| Change impact / doc sync / drift report / indexes | `references/change-tracking.md` |
| Validate structure, links, or implementation parity | `references/validation.md` |

Cross-cutting method references (loaded by the above, or directly when the task is exactly this): `references/edge-cases.md`, `references/diagrams.md`, `references/profiles.md`.

## Deterministic scripts (run these; do not improvise their jobs)

- `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/profile-detect.mjs" --root <project> [--json] [--out <file>]` - profile evidence + confidence.
- `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/validate-docs.mjs" --root <project> [--profile <id>] [--baseline <file>] [--json] [--out <file>]` - structure, links, content rules; stable finding codes; writes nothing without `--out`.
- `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/template-lint.mjs" [--dir <path>] [--json]` - checks templates and fragments against known vendor/latency/region/regime/env-var patterns (a denylist scan: catches known violations, does not prove absence).

Templates live in `assets/templates/` (universal, provider-neutral). Capability fragments live in `assets/fragments/` and activate **only** on detected code/configuration evidence or an accepted decision - never by default; the fragment inventory and activation rules are in `references/capability-fragments.md`. Fragment activation is recorded with its evidence.

## Mutation and approval rules

- Drafts before acceptance: generated or ingested content is a draft until the user approves it; accepted specs change only with approval.
- No silent edits. Exceptions (still logged at the next checkpoint): typo fixes and user-facing copy corrections that change no meaning.
- Consequential generation (new doc set, restructure, migration) requires explicit confirmation of the exact plan first.
- Existing documentation is adopted through the profile adapter - never moved, rewritten, or duplicated without a separately approved migration.
- History is immutable: superseded content gets status and banner, never deletion or rewriting; drift is marked (`Contradicted`/`Drift`), never silently resolved.
- Change tracking is always on: after any accepted mutation, follow `references/change-tracking.md` (identify → classify → confirm → rewrite → record → ADR-if-architectural → re-verify).

## Record-engine commands (durable state, events, sessions, indexes)

The record engine is live - use it, never hand-assemble record files: `node "${CLAUDE_PLUGIN_ROOT}/scripts/talks/<cmd>.mjs"` where `<cmd>` is `init`/`adopt` (plan by default, `--apply` to write), `state` (get/set), `events` (append/list/verify - immutable, collision-safe), `session` (append/list - whitelisted fields only), `index` (rebuild/check - deterministic generated views incl. claims/contradictions/questions), `ownership` (validate/match/reverse), `migrate` (inspect/plan/apply/restore), `id` (mint/validate), `questions` (add/list/answer/defer - durable owner-question packets), `risk` (score - deterministic R0–R4 tiering; `gate` - enforces a tier's required artifacts by reading real records), `decisions` (ADR lifecycle, conflict search, declined-dependency check), `impact` (diff-to-impact analysis), `sync` (drift/plan/apply), `complete` (executable completion gate). Ingestion runs through `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/ingest.mjs"` (inventory/ingest/propose/approve/reject/resolve/verify/list).

## Pre-delivery verification checklist (every Docs operation, before claiming done)

1. Profile respected - no structure imposed from a different profile; no duplicate source of truth created.
2. Every load-bearing claim labeled and cited (file paths for code-derived claims).
3. No invented stack specifics: vendors, frameworks, budgets, regions, and compliance scopes appear only from evidence or accepted decisions.
4. Links resolve (`validate-docs.mjs` per the script rule above); touched specs pass parity checks where implementation exists.
5. Mutations approved, drafts marked as drafts, history untouched, drift marked not erased.
6. Change-tracking artifacts updated or explicitly reported pending; nothing claimed complete with required sync missing.
7. Model-private reasoning absent - observable rationale only.

*Standalone install note: this skill's own `references/`, `scripts/`, and `assets/` travel with it. The shared contracts under `${CLAUDE_PLUGIN_ROOT}/references/` ship with the Superdev plugin; on a standalone single-skill install state which shared contract was unavailable.*
