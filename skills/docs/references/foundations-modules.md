# Foundations and Module Inventory

## Foundations (`assets/templates/foundations.md`)

The accepted base every other artifact builds on. Sections: **product** (what it is, for whom, the problem, explicit non-goals) · **users and roles** (actors and their goals; role list feeds the permission matrices) · **scope** (in/out for the current horizon, with the out-list as discipline) · **architecture** (per `assets/templates/architecture.md`: system shape, boundaries, key flows, diagram inventory per `diagrams.md`) · **stack** (capability slots - delivery, persistence, API style, async, auth, environment - each filled by the active fragment with its evidence; no vendor appears without evidence or decision) · **design direction** (pointer to the project's design system if one exists; UI depth belongs to the ui skill) · **glossary** (project vocabulary; one meaning per term).

Foundations claims carry epistemic labels; greenfield foundations are drafts until accepted; brownfield foundations are built via `reverse-engineer.md` with inferred claims marked.

## Module inventory (`assets/templates/module-inventory.md`)

The registry that makes module docs discoverable and orphans detectable:

| Module | Purpose | Primary users | Owns (data/surfaces) | Status | Doc root |

Rules:
- Every module folder under the profile's modules root appears here; folders present but unregistered are **orphans** (validation reports them distinctly - they are either registered, archived, or deliberate exclusions listed in the adapter).
- Status reflects reality: `planned` / `in-progress` / `implemented` / `deprecated`; `implemented` requires parity validation to have passed at least once.
- Cross-module ownership disputes resolve here (one owner per entity/surface), during the reconciliation pass of `module-decomposition.md`.
