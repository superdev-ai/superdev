# ADR-0002: One repository, three distribution surfaces

- **Status:** Accepted
- **Date:** 2026-07-23
- **Owner/approver:** Project owner
- **Scope:** Repository layout, packaging, and the compatibility constraints every skill must satisfy.

## Context

Superdev targets Claude Code (plugin), Codex (plugin), and skills.sh-compatible standalone skill installation. Maintaining three repositories or three copies of the skill tree would guarantee drift.

## Evidence

Verified 2026-07-23 against installed CLIs and primary documentation:

- Claude Code 2.1.218 discovers `.claude-plugin/plugin.json` and `skills/<name>/SKILL.md`; validates with `claude plugin validate [--strict]`; loads locally with `--plugin-dir`.
- Codex 0.144.1 discovers `.codex-plugin/plugin.json` with the same component conventions (`skills/`, `agents/`, `hooks.json`, `.mcp.json`) and installs via marketplace snapshots (`codex plugin add <plugin>@<marketplace>`).
- The Agent Skills specification requires `skills/<dir>/SKILL.md` where frontmatter `name` equals the directory name, `description` ≤ 1024 characters, and recommends bodies under 500 lines with references one level deep.
- Both plugin caches copy plugin contents; runtime references outside the plugin root fail after installation.

**Epistemic status:** Confirmed at the versions above.

## Options considered

1. **One repository, one shared `skills/` tree, thin per-surface manifests** - chosen.
2. Three repositories (one per surface) - rejected: guaranteed content drift, triple maintenance, no single source of truth.
3. One repository with per-surface forked skill trees - rejected: same drift problem inside one repo.
4. Generated per-surface builds from a neutral source format - rejected for now: a build step contradicts ADR-0001's no-build principle and no surface currently requires divergent content; revisit if surface constraints ever conflict.

## Decision

One canonical repository containing a single `skills/` tree consumed by all three surfaces, plus two thin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`). Every skill satisfies the strictest constraint across all surfaces:

- frontmatter `name` equals the skill directory name;
- `description` ≤ 1024 characters, written with concrete trigger phrases;
- body ≤ 500 lines, imperative, with supporting material in one-level-deep references;
- no runtime reference outside the repository root (portable into either plugin cache).

Shared contracts live in top-level `references/`; skills may point to them **only** under plugin distribution. Standalone (skills.sh) installs of a single skill carry a stated limitation: full operation expects the Superdev plugin context.

> **Partially superseded by [ADR-0008](0008-standalone-skills-package.md) (2026-07-25)** - standalone skills.sh packaging is no longer deferred. A generated, drift-checked `superdev` package now carries the orchestrator, the Docs capability and the runtime, and operates with no repository present. The rest of this record still stands.

## Consequences

- No per-surface forks of skill content.
- Cross-skill shared references are a stated standalone-install limitation until packaging resolves it (tracked in `references/platform-capabilities.md`).

## Risks

Platform schema drift between surfaces; mitigated by re-verification before each release and by the platform capability matrix.

## Enforcement and verification

Validation entry point checks the constraint set above for every skill; manifest validation runs on both plugin manifests; a static scan rejects `../` escapes from the repository root in any manifest or hook.

## Revisit triggers

A surface adds a conflicting requirement; standalone skill demand justifies per-skill resource bundling.
