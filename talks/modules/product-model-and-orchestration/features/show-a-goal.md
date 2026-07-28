<!-- superdev:generated source=FEAT-0029 revision=2943 hash=675961f3b900689b026eb487a2f8afdd7aea57444c5ba05f644b375f25acb6c6 -->
# Feature: Show a goal

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show detail for a single goal
- **User:** A product owner checking whether a goal is on track wants to open that one goal and see its status, its success criteria, and which real features actually serve it.
- **User value:** Not recorded
- **Scope:** in: looks up one goal by id and prints its status, outcome description, and why it matters, lists the goal's success criteria with met or unmet status, target, and how each is measured, lists every feature linked to the goal along with that feature's own status; out: does not judge or recompute whether a success criterion is met, it only displays whatever status is already recorded, does not show which milestone or task is currently driving progress toward the goal, only the linked features
- **Affected contracts:** none linked

### Primary flow

1. run superdev goal show GOAL-0001
2. read the status, outcome, and why-it-matters block
3. read the success criteria list with met or unmet and target
4. read the list of features serving the goal with their status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev goal show <GOAL-id> returns the goal's full record | Run superdev goal show <GOAL-id> and record what was observed. | Met | EV-0033 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Not Applicable | N/A - this is a single fixed-shape record lookup with no size limit or pagination to hit |
| Empty States | Applicable | a goal with no success criteria prints 'Nothing measurable is recorded, so nothing can show whether this goal was reached.'; a goal with no linked features prints 'None, so nothing being built moves this goal.' |
| Invalid Input | Applicable | an unknown goal id prints 'There is no goal GOAL-9999.' and exits 1; omitting the id prints 'Say which goal: superdev goal show <GOAL-id>.' and exits 2 |
| Ordering | Applicable | success criteria are always returned ordered by their recorded sequence, and served features ordered by feature id, so repeated calls show the same order |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2063 maps 'goal show' to cmdGoalShow. Ran `node src/cli.mjs goal show GOAL-0001`, printed status, outcome, why it matters, success criteria (2, both Unmet with target text), and list of 33 serving features. | command | pass | superdev goal show <GOAL-id> |

## Delivery state

- **What works now:** Reached by superdev goal show <GOAL-id>. src/cli.mjs:2063 maps 'goal show' to cmdGoalShow. Ran `node src/cli.mjs goal show GOAL-0001`, printed status, outcome, why it matters, success criteria (2, both Unmet with target text), and list of 33 serving features.
- **What remains:** Nothing known.
- **Next action:** Not recorded
