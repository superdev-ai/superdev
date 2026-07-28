# ADR-0005: Command surface - twelve namespaced entry skills, router-first

- **Status:** Accepted
- **Date:** 2026-07-23
- **Owner/approver:** Project owner
- **Scope:** The set of user-invocable entry skills and the consolidation policy governing them.

## Context

Users should not memorize commands: the main router must detect intent from natural language ("What does this project do?", "Add team invitations", "Continue where we stopped"). Explicit commands exist as accelerators and for deterministic invocation. Command proliferation is a real failure mode; so is one enormous skill.

## Decision

Ship twelve entry skills, namespaced by the plugin (`/superdev:<skill>`):

| Skill | Owns |
|---|---|
| `project` | Intent routing, orientation, project Q&A - the default entry |
| `init` | Initialize `talks/` or adopt an existing project |
| `doctor` | Dependencies, capability readiness, project health |
| `docs` | Documentation operations router (ingest, spec, summarize, validate, maintain) |
| `feature` | Add or materially change product behavior via risk-proportionate specs |
| `decision` | Inspect, create, supersede, or revisit decisions |
| `sync` | Compute and apply code/docs/change-record synchronization |
| `status` | Current state, active work, drift, decisions, blockers |
| `resume` | Reconstruct the next actionable state in a fresh session |
| `debug` | Route through systematic debugging with project context |
| `review` | Spec-compliance review, then code-quality review |
| `ui` | Route UI work through design and hardening providers with a full UI contract |

**Consolidation analysis performed:**

- `status` vs `resume`: same state engine, different deliverables (report vs reconstructed working context). Kept separate; both delegate to shared scripts. Revisit if usage shows one subsuming the other.
- `sync` vs `docs`: `sync` is diff-driven (code changed → what must follow); `docs` is operation-driven (author/validate/ingest). Kept separate for trigger clarity; both use the same impact scripts.
- `feature` vs `project`: routing lives in `project`; `feature` owns the spec-gate workflow. A feature request typed to `project` routes to `feature` - one implementation, two entries.

## Consequences

Each skill stays lean (≤ 500 lines) and loads shared contracts from `references/` on demand; no skill duplicates another's workflow; the router never requires a command to be typed.

## Enforcement and verification

Skill-lint enforces size and frontmatter rules today. Behavioral trigger tests (natural-language prompts per intent class) and a routing-convergence test arrive with the behavioral-testing phase; until they exist, this ADR's routing claims are verified manually.

## Revisit triggers

Two entries proving near-identical in real transcripts; a new intent class emerging that no entry owns.
