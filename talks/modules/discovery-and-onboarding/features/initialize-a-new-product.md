<!-- superdev:generated source=FEAT-0001 revision=2943 hash=2fbbf1fbb7361811e79540ccd7b68f7ad8401dc552859ba2aa3fc6b3824a608e -->
# Feature: Initialize a new product

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Discovery and Onboarding
- **Risk level:** R1
- **Milestone:** Initialization and Adoption
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Guide product definition from scratch for an empty repository or idea
- **User:** A founder or developer starting from an empty repo or a bare idea wants a guided walkthrough that turns that idea into a structured product database, without anything being written until they approve it.
- **User value:** Not recorded
- **Scope:** in: Dry-run plan (superdev init) that detects project kind, inspects repo evidence, checks provider readiness, and lists material questions each with a recommended default, Applying with --apply creates .superdev/superdev.db and writes the foundation documents (talks/foundations/product.md, stack.md, talks/changes/changelog.md), Re-running is safe: an already-initialized project is reported as already there rather than recreated, Seeds capability areas, stack slots and task categories inside one transaction when applied; out: Does not install any provider or plugin, even ones reported as missing, Does not initialize over a repository that already has documentation; that route is refused in favor of adopt unless the caller explicitly passes --adopt, Does not invent goals or features on its own; only converts candidates the concept map actually produced from the stated idea, sources or evidence
- **Affected contracts:** none linked

### Primary flow

1. Run superdev init --root <dir> --idea "..." without --apply
2. Review the printed detection, evidence, provider readiness and material questions with recommendations
3. Re-run the same command with --apply to create the database and write the foundation documents
4. Run superdev status --root <dir> to confirm the new project appears with real progress and freshness data

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Running superdev init on an empty repository produces an accepted product foundation | Run superdev init and record what was observed. | Met | EV-0061 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | If provider detection throws, checkProviders catches it and returns checked:false with a reason string, so the rest of the plan still completes instead of the whole command crashing. |
| Duplication | Applicable | Re-running init on an already-initialized project finds the existing project row and reports steps like capability-area seeding as already done rather than creating duplicate rows. |
| Empty States | Applicable | On a directory with nothing in it, evidence inspection reports 0 files and 0 directories answered, and the concept map records an explicit unknown for every area instead of guessing. |
| State Machine Violations | Applicable | If the repo already has detected documentation, the route is 'adopt' and applyInit throws InitError E_EXISTING_DOCS refusing to initialize over it, unless the caller passes --adopt. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:304 cmdInit calls planInit/applyInit from src/init/index.mjs. Ran `node src/cli.mjs init --root <dir> --idea "A test product for feature evaluation"` in a scratch dir: printed full detection, evidence, provider check, 10 material questions, and a 16-step plan ending 'Nothing has changed. Re-run with --apply to create the project.' Then ran the same command with --apply: it created .superdev/superdev.db, .superdev/superdev.db-log/-wal, and wrote talks/foundations/product.md, talks/foundations/stack.md, talks/changes/changelog.md. A following `superdev status --root <dir>` showed the new project 'Test Init (PRJ-0001)' with real progress and freshness data. | command | pass | superdev init (plan), superdev init --apply (create) |

## Delivery state

- **What works now:** Reached by superdev init (plan), superdev init --apply (create). src/cli.mjs:304 cmdInit calls planInit/applyInit from src/init/index.mjs. Ran `node src/cli.mjs init --root <dir> --idea "A test product for feature evaluation"` in a scratch dir: printed full detection, evidence, provider check, 10 material questions, and a 16-step plan ending 'Nothing has changed. Re-run with --apply to create the project.' Then ran the same command with --apply: it created .superdev/superdev.db, .superdev/superdev.db-log/-wal, and wrote talks/foundations/product.md, talks/foundations/stack.md, talks/changes/changelog.md. A following `superdev status --root <dir>` showed the new project 'Test Init (PRJ-0001)' with real progress and freshness data.
- **What remains:** Nothing known.
- **Next action:** Not recorded
