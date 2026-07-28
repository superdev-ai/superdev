<!-- superdev:generated source=FEAT-0061 revision=2984 hash=9930c1d3226dc230429cdfc682dc4163b2096af75372f4ab26f307f78f777851 -->
# Feature: List open questions

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Decisions, Changes, and Questions
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0003 Always-answerable project state, GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show unanswered material questions blocking work
- **User:** A product owner or developer wants to see what unresolved questions are blocking decisions before starting new work.
- **User value:** Not recorded
- **Scope:** in: Lists every open question from the project database with its ID, title, and why it matters, Reports a total count of open questions at the top, Reads directly from the database, so the list always reflects current state; out: Does not list answered questions, only open ones show up in this view, Does not let the user answer or edit a question from this command, that requires question answer, Does not rank or prioritize questions, they are shown in the order stored
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs question list
2. Read the total count of open questions
3. Read each question's ID, title, and why it matters
4. Pick one and follow up with question answer <id>

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev question list returns all unanswered questions | Run superdev question list and record what was observed. | Met | EV-0057 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | With exactly one open question, the header still reads Questions (1) and prints that single entry, no special-casing to singular text. |
| Consistency | Not Applicable | N/A - The list is read directly from the database on each run, so it cannot show a stale count relative to the questions table. |
| Empty States | Applicable | If every question in the database has been answered, question list would report a count of 0 with no entries printed, since only open questions are shown. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2079 maps "question list" to cmdQuestionList. Ran `node src/cli.mjs question list` and it printed 8 real open questions from the project database (Q-0001 through Q-0008) with title and "Why it matters" text. | command | pass | superdev question list |
| The assumptions table exists, created by migration 008. It requires the statement, why it was assumed rather than decided, and the review trigger, which is what section 8.4 asks for and what stops an assumption hardening into a fact nobody chose. assumption record, list and resolve reach it. | validator | pass | scripts/validate/data-model.mjs |

## Delivery state

- **What works now:** Reached by superdev question list. src/cli.mjs line 2079 maps "question list" to cmdQuestionList. Ran `node src/cli.mjs question list` and it printed 8 real open questions from the project database (Q-0001 through Q-0008) with title and "Why it matters" text.
- **What remains:** Nothing known.
- **Next action:** Not recorded
