<!-- superdev:generated source=FEAT-0033 revision=2943 hash=c92dfbbb3165493691612ae6351245c69c261bd1b44cac27ae11c6d6c0221d4e -->
# Feature: Show a feature

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show detail for a single feature
- **User:** A developer or coding agent about to work on a feature wants its full record in one place: purpose, who it serves, acceptance criteria, and what tasks already exist against it.
- **User value:** Not recorded
- **Scope:** in: looks up one feature by id and shows status, declared spec depth, module, milestone, and goals served, shows purpose and the recorded user statement, lists acceptance criteria with met or unmet status, and any workflows, test plans, or tasks tied to the feature; out: does not show the feature's scope-in, scope-out, or edge-case records, that depth detail lives in feature depth, does not let a reader edit any field, this is read only
- **Affected contracts:** none linked

### Primary flow

1. run superdev feature show FEAT-0001
2. read status, depth, module, milestone, and goals served
3. read purpose and who wants it
4. read acceptance criteria, then any workflows, test plans, and tasks

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev feature show <FEATURE-id> returns the feature's full record | Run superdev feature show <FEATURE-id> and record what was observed. | Met | EV-0037 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Not Applicable | N/A - this is a single fixed-shape record lookup, there is no list size or range to hit |
| Empty States | Applicable | a feature with no user statement recorded shows 'Who wants it: Not recorded'; one with no acceptance criteria shows 'None, so nothing says what done means.'; one with no tasks shows 'None derived yet.' |
| Invalid Input | Applicable | an unknown feature id prints 'There is no feature FEAT-9999.' and exits 1; omitting the id prints 'Say which feature: superdev feature show <FEAT-id>.' and exits 2 |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 1131-1134 cmdFeatureShow wired in COMMANDS table at line 2067. Ran: node src/cli.mjs feature show FEAT-0001, returned full detail (status, depth, module, milestone, goals, purpose, acceptance criteria, tasks). Ran with bad id FEAT-9999, got clean error 'There is no feature FEAT-9999.' exit 1. | command | pass | superdev feature show <FEAT-id> |

## Delivery state

- **What works now:** Reached by superdev feature show <FEAT-id>. src/cli.mjs line 1131-1134 cmdFeatureShow wired in COMMANDS table at line 2067. Ran: node src/cli.mjs feature show FEAT-0001, returned full detail (status, depth, module, milestone, goals, purpose, acceptance criteria, tasks). Ran with bad id FEAT-9999, got clean error 'There is no feature FEAT-9999.' exit 1.
- **What remains:** Nothing known.
- **Next action:** Not recorded
