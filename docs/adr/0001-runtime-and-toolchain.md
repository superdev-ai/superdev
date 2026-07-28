# ADR-0001: Runtime and toolchain - Node.js ESM, node:test, zero runtime dependencies

> **Superseded by ADR-0013.** Its zero-runtime-dependency clause is superseded: Superdev now carries one runtime dependency, the storage engine. Everything else here, Node and ESM and no build step for the plugin runtime, still holds. The node:test clause is superseded by ADR-0019, which removes the plugin test suite entirely.
>
> The body below is left exactly as it was. History is not rewritten here; a
> decision that was true when it was made stays readable as what was decided.


- **Status:** Accepted
- **Date:** 2026-07-23
- **Owner/approver:** Project owner
- **Scope:** All deterministic scripts, validators, and tests shipped in this repository.

## Context

Superdev ships deterministic tooling (validators, scanners, record engines, packaging checks) that must run identically on macOS, Linux, and Windows, from paths containing spaces, inside three different distribution surfaces (Claude Code plugin cache, Codex plugin cache, standalone skill installs). Anything the tooling depends on becomes a supply-chain and portability liability for every user.

## Evidence

- Claude Code and Codex both execute plugin scripts with whatever runtime the host machine provides; Node.js is the only runtime already required by the target agent CLIs themselves.
- Plugin caches copy files; they do not run package installs. A `node_modules/` dependency would require a network install step plugins cannot safely perform at session start.
- `node:test`, `node:fs`, `node:path`, `node:crypto`, and `node:child_process` cover every planned deterministic component.

**Epistemic status:** Confirmed for the platforms verified at the date above; revisit if a target harness drops Node availability.

## Decision criteria

Cross-platform behavior, zero install step, no supply-chain surface, no build step, testability with built-in tooling.

## Options considered

1. **Node.js ≥ 20, ESM JavaScript, `node:test`, zero runtime dependencies** - chosen.
2. TypeScript with a runner (`tsx`/`ts-node`) - rejected: adds a dependency and a network-fetch step; type safety is recoverable via JSDoc + `// @ts-check` without a toolchain.
3. Bun/Deno - rejected: not guaranteed present on user machines.
4. Shell scripts - rejected: not Windows-safe; fragile with paths containing spaces.
5. Python - rejected: second runtime assumption on top of the Node-based agent CLIs.

## Decision

All shipped scripts are plain ESM JavaScript executed by Node.js ≥ 20 with no runtime dependencies. Tests use `node:test`. Type checking may use JSDoc annotations with editor-level checking. Dev-only tooling may be added later as `devDependencies` if it never becomes a runtime requirement.

## Consequences

- Every script must run via `node <script>` with no install step.
- No transpilation; source is what executes.
- Scripts must be tested on paths containing spaces (release gate).

## Risks

Node major-version drift; mitigated by `engines` field and CI checks on supported versions.

## Enforcement and verification

`package.json` declares `"type": "module"` and `engines.node >= 20`. The validation entry point fails if any `dependencies` entry appears in `package.json` or any shipped script imports outside `node:` builtins and repo-relative files.

## Revisit triggers

A target harness stops guaranteeing Node ≥ 20; a deterministic component provably cannot be built on builtins alone.
