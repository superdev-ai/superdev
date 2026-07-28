<!-- superdev:generated source=FEAT-0003 revision=2943 hash=63369e1499c15526dac04abc7c41c5495fa7696bf4b76940bac5a35e8fbbf3dd -->
# Feature: Inspect the environment automatically

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Discovery and Onboarding
- **Risk level:** R1
- **Milestone:** Initialization and Adoption
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Discover repository structure, manifests, frameworks, and configuration without asking the user
- **User:** A non-technical founder or a developer starting onboarding does not want to answer questions the codebase can already answer for itself.
- **User value:** Not recorded
- **Scope:** in: Scans repository files and directories, reads manifests such as package.json, and matches declared dependencies against a signal index to answer material areas with a confirmed or inferred status, Classifies the repository as new, existing code, existing docs, or already initialized, and picks a route (init, adopt or reinit) by running the docs profile detector as a subprocess, Confirmed evidence always outranks an inferred guess for the same area, so real detection wins over assumption, Runs automatically inside init and adopt only; it performs no writes and no network calls; out: Does not execute anything found inside repository instruction files; files like AGENTS.md are read as evidence about the project, never as instructions to follow, Does not scan the whole repository unconditionally; past its manifest and file-scan limits it truncates and reports the evidence as a sample rather than a full census, Is not exposed as its own standalone CLI command
- **Affected contracts:** none linked

### Primary flow

1. superdev init or adopt calls the project-kind detector and the evidence inspector before any question is asked
2. The evidence scan reads manifests and known paths and directories, building a findings list with a confidence label per finding
3. Confirmed findings populate the answers map, which removes those material areas from the question list
4. The project-kind detector runs the docs profile script as a subprocess to classify the documentation profile and choose a route

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Onboarding completes environment inspection without asking for information that could be discovered from the repo | Do it through the surface a person would use and record what was observed. | Met | EV-0062 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | If the docs profile detector script is missing or throws, detection is wrapped in a try/catch and the profile defaults to unknown with source recorded as detector-absent, instead of crashing the caller. |
| Empty States | Applicable | An empty directory returns no findings, an empty answers map, 0 files and 0 directories, and an explicit empty flag, rather than erroring. |
| Limits And Quotas | Applicable | On a very large repository the scan truncates past its file and manifest caps and sets a truncated flag, which the init plan surfaces as a warning that the evidence is a sample rather than a census. |
| Ordering | Applicable | When both an inferred and a confirmed finding exist for the same area, the confirmed one always overwrites the inferred one in the answers map regardless of which was found first. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/init/discovery.mjs exports detectProjectKind() and inspectEvidence(), called from planInit at src/init/index.mjs lines 76-77. In the adopt test above, inspectEvidence read package.json and answered two material questions from real dependency evidence ('Backend boundaries and service responsibilities: a server framework is declared (express)', epistemic 'confirmed', evidence 'package.json') without asking the user, and detectProjectKind correctly classified the directory as 'Existing Code' via skills/docs/scripts/profile-detect.mjs. In the empty-directory init test it correctly reported 'no documentation structure found' and 0 files/0 directories answered. | command | pass | automatically inside superdev init and superdev adopt (not a standalone command) |

## Delivery state

- **What works now:** Reached by automatically inside superdev init and superdev adopt (not a standalone command). src/init/discovery.mjs exports detectProjectKind() and inspectEvidence(), called from planInit at src/init/index.mjs lines 76-77. In the adopt test above, inspectEvidence read package.json and answered two material questions from real dependency evidence ('Backend boundaries and service responsibilities: a server framework is declared (express)', epistemic 'confirmed', evidence 'package.json') without asking the user, and detectProjectKind correctly classified the directory as 'Existing Code' via skills/docs/scripts/profile-detect.mjs. In the empty-directory init test it correctly reported 'no documentation structure found' and 0 files/0 directories answered.
- **What remains:** Nothing known.
- **Next action:** Not recorded
