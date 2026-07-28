<!-- superdev:generated source=FEAT-0005 revision=2943 hash=327fcac974aba3ee41ba50a3c17b0858eb8b5bb2f86de38877548bdb86ec47e2 -->
# Feature: Present the product map for acceptance

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Discovery and Onboarding
- **Risk level:** R1
- **Milestone:** Initialization and Adoption
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Give the owner a full summary of the proposed product before implementation begins
- **User:** A founder or product owner wants to see the full proposed product, every open question and its recommended default, before anything gets written to the database.
- **User value:** Not recorded
- **Scope:** in: The no-apply plan returns the complete presentation: detection, evidence, provider readiness, every material question with its recommendation, alternatives and deferral consequence, seed counts, and the full step-by-step action table, The presentation step is coded literally as the point where nothing has been stored yet; applying is a separate, later call, Ends with an explicit statement that nothing has changed and the plan must be re-run with --apply to create the project; out: Does not accept or record any answer during the dry run; answering happens as a separate step, Does not write anything to disk or database, not even a record of having been shown, Does not re-present a from-scratch plan on an already-initialized project; instead it reports what already exists and what is still missing
- **Affected contracts:** none linked

### Primary flow

1. Run superdev init (or adopt) with no --apply flag
2. Read the printed detection, evidence, provider readiness, and each question's recommendation, alternatives and deferral consequence
3. Read the ordered action table showing what would be created versus what is already done
4. Decide to accept by re-running with --apply, or supply more input such as --idea or --sources and re-plan first

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Owner is shown summary, goals, milestones, modules, features, workflows, architecture, and open questions and must accept or request changes | Do it through the surface a person would use and record what was observed. | Met | EV-0064 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | Planning against an already-initialized project detects the existing project row and adds a warning that the plan will report what is present and create only what is missing, instead of presenting a fresh-start plan. |
| Empty States | Applicable | When no idea and no source material are supplied and no project exists yet, the plan adds a warning that the concept map will consist mostly of explicit unknowns. |
| State Machine Violations | Applicable | When documentation already exists, the plan's route is adopt and a warning names the detected documentation profile, telling the reader that init is refused here in favor of adopt. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/init/index.mjs line 176 literally codes step 12 as: `case 12: return willDo("this plan is the presentation; applyInit stores nothing until it is called")`. The dry-run output produced by init (no --apply) is exactly that presentation: full detection, evidence, provider readiness, every material question with recommendation/alternatives/deferral consequence, counts of what will be created, and a 16-step action table, ending 'Nothing has changed. Re-run with --apply to create the project.' This is the same object returned to a caller before any database write happens. | command | pass | superdev init or superdev adopt run without --apply |

## Delivery state

- **What works now:** Reached by superdev init or superdev adopt run without --apply. src/init/index.mjs line 176 literally codes step 12 as: `case 12: return willDo("this plan is the presentation; applyInit stores nothing until it is called")`. The dry-run output produced by init (no --apply) is exactly that presentation: full detection, evidence, provider readiness, every material question with recommendation/alternatives/deferral consequence, counts of what will be created, and a 16-step action table, ending 'Nothing has changed. Re-run with --apply to create the project.' This is the same object returned to a caller before any database write happens.
- **What remains:** Nothing known.
- **Next action:** Not recorded
