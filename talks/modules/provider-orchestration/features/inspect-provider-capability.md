<!-- superdev:generated source=FEAT-0004 revision=2943 hash=dd566ce2e8e84ec59e983e873c8b66c119f1dfdca1848dc6056d7bae9bc7d3ac -->
# Feature: Inspect provider capability

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Provider Orchestration
- **Risk level:** R1
- **Milestone:** Provider Orchestration
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Check whether specialist providers are installed, invocable, and trusted before relying on them
- **User:** A PM or engineering lead wants to know, before relying on a specialist provider such as superpowers or claude-mem, whether it is actually installed and invocable, not just assumed to be.
- **User value:** Not recorded
- **Scope:** in: Queries the live plugin listing for the current harness, with a filesystem fallback, for every provider in the known registry, Fails closed: any probe failure such as bad JSON, a missing entry, a disabled plugin, a policy block, or an incompatible version is reported as not ready, never silently upgraded to ready, Distinguishes a provider being ready in general from being invocable in the current harness, listing ready-but-unreachable providers separately, Runs automatically inside init and adopt, and is also reachable through the doctor path; out: Does not install, enable or configure any provider on the user's behalf, Does not override a policy block or re-enable a disabled plugin, Is not a standalone CLI subcommand of its own; it is only reached through init, adopt or doctor
- **Affected contracts:** none linked

### Primary flow

1. superdev init calls the provider check, which loads the provider detection module
2. That module queries the live plugin listing (or its filesystem fallback) and evaluates each known provider's state
3. The result reports ready versus missing providers plus a reason string, printed inside the init dry-run output

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A missing provider is reported with its purpose, impact, and installation plan before onboarding continues | Do it through the surface a person would use and record what was observed. | Met | EV-0063 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | If the live plugin listing command is unavailable or returns unparseable JSON, that failure is caught and returned as a not-ok result, and the affected provider is then reported as not ready rather than assumed ready. |
| Empty States | Applicable | When none of the known providers is ready, the ready list is empty and the plan step reports 0 ready and the rest as not installed, using the same reporting sentence as any other count rather than a special error path. |
| Permission Boundaries | Applicable | A provider blocked by policy is reported with a message telling the user to resolve it with their administrator; Superdev never overrides the block itself. |
| Versioning | Applicable | When an installed provider's live version is below its required minimum, it is reported as installed but incompatible, with a remediation message naming the needed update. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| checkProviders() in src/init/index.mjs (lines 172-190) imports detectAll from scripts/providers/detect.mjs, a real, substantial (fail-closed, live-state-first) detection engine that queries `claude plugin list --json` with filesystem fallback and never reports a probe failure as 'ready'. Running init dry-run printed real results: 'Providers: Checked yes, Installed no, Harness claude-code, Reason: nothing was installed; an absent provider stays absent until you ask for it, Ready: superpowers, claude-mem, frontend-design, impeccable, find-skills, task-observer, envx'. | command | pass | automatically inside superdev init and superdev adopt (not a standalone command) |

## Delivery state

- **What works now:** Reached by automatically inside superdev init and superdev adopt (not a standalone command). checkProviders() in src/init/index.mjs (lines 172-190) imports detectAll from scripts/providers/detect.mjs, a real, substantial (fail-closed, live-state-first) detection engine that queries `claude plugin list --json` with filesystem fallback and never reports a probe failure as 'ready'. Running init dry-run printed real results: 'Providers: Checked yes, Installed no, Harness claude-code, Reason: nothing was installed; an absent provider stays absent until you ask for it, Ready: superpowers, claude-mem, frontend-design, impeccable, find-skills, task-observer, envx'.
- **What remains:** Nothing known.
- **Next action:** Not recorded
