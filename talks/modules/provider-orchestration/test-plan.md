<!-- superdev:generated source=MOD-0010 revision=3058 hash=38a62a2077bb400b3a6f2a1b0d897a5f5e0c0713ddcac94d7fd135443433e85d -->
# Provider Orchestration - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| Inspect provider capability | A missing provider is reported with its purpose, impact, and installation plan before onboarding continues | Do it through the surface a person would use and record what was observed. | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command | 1 | exists |
| Applicable edge-case categories | command | 4 | exists |
| Permission boundaries | command | 0 | missing |
| State machines including illegal transitions | command | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| checkProviders() in src/init/index.mjs (lines 172-190) imports detectAll from scripts/providers/detect.mjs, a real, substantial (fail-closed, live-state-first) detection engine that queries `claude plugin list --json` with filesystem fallback and never reports a probe failure as 'ready'. Running init dry-run printed real results: 'Providers: Checked yes, Installed no, Harness claude-code, Reason: nothing was installed; an absent provider stays absent until you ask for it, Ready: superpowers, claude-mem, frontend-design, impeccable, find-skills, task-observer, envx'. | command | pass | automatically inside superdev init and superdev adopt (not a standalone command) | Current |
