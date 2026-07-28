<!-- superdev:generated source=FEAT-0062 revision=3144 hash=440345941d91b72445fc0bf2476d5ea7308ac40d9ae96e7ca9ea90d75f6a4d02 -->
# Feature: Answer a question

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Decisions, Changes, and Questions
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0003 Always-answerable project state, GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Record the answer to a material open question
- **User:** A developer or product owner has decided the answer to an open question and wants it recorded so the question stops blocking work.
- **User value:** Not recorded
- **Scope:** in: Records a free-text answer against a specific open question by ID and closes it to answered status, Refuses if the question ID does not exist or if it has already been answered, showing the existing answer in that case, Runs as a dry run by default, showing what would be recorded, and only commits with --apply; out: Does not let an answered question be re-answered or edited through this command, once answered it is refused with the existing answer shown, Does not validate the content of the answer beyond requiring non-empty text, Does not automatically resolve tasks or decisions that were blocked on the question, closing the question is a separate step from acting on it
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs question list to find the question ID and its recommendation if any
2. Run node src/cli.mjs question answer <id> --answer "<text>" as a dry run to see the planned answer
3. Re-run with --apply to record the answer and mark the question answered

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev question answer <QUESTION-id> stores the answer and closes the question | Run superdev question answer <QUESTION-id> and record what was observed. | Met | EV-0128 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | Missing --answer text is refused with a message that an answer needs text, before touching the database. |
| State Machine Violations | Applicable | Answering a question that is already answered is refused with an E_ALREADY_ANSWERED error that includes the existing answer, rather than overwriting it. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2056 maps "question answer" to cmdQuestionAnswer (around line 1808), which loads the question, checks it is not already answered, and otherwise calls setStatus / recordActivity. Ran `node src/cli.mjs question answer Q-0001 --answer "Database-backed only"` (dry run) and got "Would answer Q-0001: ... Answer: Database-backed only. Nothing has changed. Re-run with --apply to record it." | command | pass | superdev question answer <id> |
| superdev question answer closed 8 of 8 questions: each carries the answer it was given, who answered it and when, and its status moved to answered. Reading them back through superdev question list shows every one. | command_output | pass | - |

## Delivery state

- **What works now:** Reached by superdev question answer <id>. src/cli.mjs line 2056 maps "question answer" to cmdQuestionAnswer (around line 1808), which loads the question, checks it is not already answered, and otherwise calls setStatus / recordActivity. Ran `node src/cli.mjs question answer Q-0001 --answer "Database-backed only"` (dry run) and got "Would answer Q-0001: ... Answer: Database-backed only. Nothing has changed. Re-run with --apply to record it."
- **What remains:** Nothing known.
- **Next action:** Not recorded
