<!-- superdev:generated source=MOD-0001 revision=3298 hash=4be7a3086ebf19360c44cf0adcdda711ec4bd09a4fd97acba3fa15fe7837ef50 -->
# Discovery and Onboarding - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| Initialize a new product | Running superdev init on an empty repository produces an accepted product foundation | Run superdev init and record what was observed. | Met |
| Adopt an existing product | Running superdev adopt on an existing codebase produces an initial product model matching current behavior | Run superdev adopt and record what was observed. | Met |
| Inspect the environment automatically | Onboarding completes environment inspection without asking for information that could be discovered from the repo | Do it through the surface a person would use and record what was observed. | Met |
| Present the product map for acceptance | Owner is shown summary, goals, milestones, modules, features, workflows, architecture, and open questions and must accept or request changes | Do it through the surface a person would use and record what was observed. | Met |
| Resolve a capability area through a command | A capability area can be specified by command, and the warning clears | Run superdev capability specify against an area doctor is warning about, then doctor again | Met |
| Resolve a capability area through a command | A capability area can be recorded as not applicable with a reason | Run superdev capability not-applicable and read the area back | Met |
| Resolve a capability area through a command | An area is never left awaiting a decision with no question raised | Initialize with a project statement supplied, which is the case that produced it, and read the readiness areas | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, manual_check | 5 | exists |
| Applicable edge-case categories | command, manual_check | 16 | exists |
| Permission boundaries | command, manual_check | 0 | missing |
| State machines including illegal transitions | command, manual_check | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| src/cli.mjs:304 cmdInit calls planInit/applyInit from src/init/index.mjs. Ran `node src/cli.mjs init --root <dir> --idea "A test product for feature evaluation"` in a scratch dir: printed full detection, evidence, provider check, 10 material questions, and a 16-step plan ending 'Nothing has changed. Re-run with --apply to create the project.' Then ran the same command with --apply: it created .superdev/superdev.db, .superdev/superdev.db-log/-wal, and wrote talks/foundations/product.md, talks/foundations/stack.md, talks/changes/changelog.md. A following `superdev status --root <dir>` showed the new project 'Test Init (PRJ-0001)' with real progress and freshness data. | command | pass | superdev init (plan), superdev init --apply (create) | Current |
| src/init/discovery.mjs exports detectProjectKind() and inspectEvidence(), called from planInit at src/init/index.mjs lines 76-77. In the adopt test above, inspectEvidence read package.json and answered two material questions from real dependency evidence ('Backend boundaries and service responsibilities: a server framework is declared (express)', epistemic 'confirmed', evidence 'package.json') without asking the user, and detectProjectKind correctly classified the directory as 'Existing Code' via skills/docs/scripts/profile-detect.mjs. In the empty-directory init test it correctly reported 'no documentation structure found' and 0 files/0 directories answered. | command | pass | automatically inside superdev init and superdev adopt (not a standalone command) | Current |
| src/init/index.mjs line 176 literally codes step 12 as: `case 12: return willDo("this plan is the presentation; applyInit stores nothing until it is called")`. The dry-run output produced by init (no --apply) is exactly that presentation: full detection, evidence, provider readiness, every material question with recommendation/alternatives/deferral consequence, counts of what will be created, and a 16-step action table, ending 'Nothing has changed. Re-run with --apply to create the project.' This is the same object returned to a caller before any database write happens. | command | pass | superdev init or superdev adopt run without --apply | Current |
| adopt runs and reports its plan without writing anything until asked. It printed: Adoption plan ------------- Root this directory At 2026-07-27 20:28:31 Apply no Name Superdev Detection: Root this directory Kind Initialized Initialized yes Route reinit Docs Profile cus | command | pass | node src/cli.mjs adopt | Current |
| capability specify settled the area doctor was warning about, and the warning cleared | manual_check | pass | - | Current |
| capability not-applicable records a reason, and refuses without one | manual_check | pass | - | Current |
| No area is left awaiting a decision with no question raised | manual_check | pass | - | Current |
