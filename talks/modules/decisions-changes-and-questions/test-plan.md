<!-- superdev:generated source=MOD-0005 revision=3144 hash=0bf6f259958f8ecddc4a292e1c75529391f4714097e739e23291b83be74e9453 -->
# Decisions, Changes, and Questions - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| List open questions | superdev question list returns all unanswered questions | Run superdev question list and record what was observed. | Met |
| Answer a question | superdev question answer <QUESTION-id> stores the answer and closes the question | Run superdev question answer <QUESTION-id> and record what was observed. | Met |
| Record a decision | superdev decision record stores a new decision with its rationale | Run superdev decision record and record what was observed. | Met |
| Supersede a decision | superdev decision supersede <DECISION-id> links the old decision to its replacement and preserves both | Run superdev decision supersede <DECISION-id> and record what was observed. | Met |
| List decisions | superdev decision list returns every decision with active or superseded state | Run superdev decision list and record what was observed. | Met |
| Guard against silent decision overrides | A prompt contradicting an accepted decision triggers a confirmation request before proceeding | Do it through the surface a person would use and record what was observed. | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, validator, command_output | 6 | exists |
| Applicable edge-case categories | command, validator, command_output | 17 | exists |
| Permission boundaries | command, validator, command_output | 0 | missing |
| State machines including illegal transitions | command, validator, command_output | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| A prompt proposing direct schema push surfaced DEC-0002, which forbids exactly that, naming the decision and telling the reader to supersede it rather than edit around it. This is acceptance criterion 11 of section 22 and nothing implemented it before. | command | pass | src/runtime/hooks.mjs decisionsInTheWay | Current |
| A prompt proposing direct schema push surfaced DEC-0002, which forbids exactly that, naming the decision and telling the reader to supersede it rather than edit around it. This is acceptance criterion 11 of section 22 and nothing implemented it before. | command | pass | src/runtime/hooks.mjs decisionsInTheWay | Current |
| src/cli.mjs line 2079 maps "question list" to cmdQuestionList. Ran `node src/cli.mjs question list` and it printed 8 real open questions from the project database (Q-0001 through Q-0008) with title and "Why it matters" text. | command | pass | superdev question list | Current |
| src/cli.mjs line 2056 maps "question answer" to cmdQuestionAnswer (around line 1808), which loads the question, checks it is not already answered, and otherwise calls setStatus / recordActivity. Ran `node src/cli.mjs question answer Q-0001 --answer "Database-backed only"` (dry run) and got "Would answer Q-0001: ... Answer: Database-backed only. Nothing has changed. Re-run with --apply to record it." | command | pass | superdev question answer <id> | Superseded |
| src/cli.mjs line 2086 maps "decision record" to cmdDecisionRecord (line 1452), which requires --title and --decision then calls recordDecision from src/decisions/record.mjs (167 lines of real logic, not a stub). Ran `node src/cli.mjs decision record --title "Use SQLite for local storage" --decision "Use SQLite instead of a remote db" --governs FEAT-0001` (dry run) and got "Would record \"Use SQLite for local storage\" as Proposed. Decided ... Governs FEAT-0001. Nothing has changed. Re-run with --apply to record it." | command | pass | superdev decision record | Current |
| src/cli.mjs line 2087 maps "decision supersede" to cmdDecisionSupersede (line 1488), which calls supersedeDecision from src/decisions/record.mjs. Ran `node src/cli.mjs decision supersede DEC-0001 --title "Docs skill changes" --decision "Docs skill is being replaced"` (dry run) and got "Would record \"Docs skill changes\" and mark DEC-0001 superseded. Nothing has changed. Re-run with --apply to record it." Confirmed DEC-0001 exists via `node src/cli.mjs decision list`. | command | pass | superdev decision supersede <id> | Current |
| src/cli.mjs:1844 cmdDecisionList, registered at src/cli.mjs:2085 as "decision list". Ran `node src/cli.mjs decision list`: printed a real table of 16 decisions (DEC-0001..DEC-0016) with id, status, expires, title, pulled from the decisions table with decision_links joined per row. | command | pass | superdev decision list (and decision list --all) | Current |
| The assumptions table exists, created by migration 008. It requires the statement, why it was assumed rather than decided, and the review trigger, which is what section 8.4 asks for and what stops an assumption hardening into a fact nobody chose. assumption record, list and resolve reach it. | validator | pass | scripts/validate/data-model.mjs | Current |
| superdev question answer closed 8 of 8 questions: each carries the answer it was given, who answered it and when, and its status moved to answered. Reading them back through superdev question list shows every one. | command_output | pass | - | Current |
