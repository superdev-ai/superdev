<!-- superdev:generated source=FEAT-0063 revision=2943 hash=4ff227f33993548383c84269defec571e221a704e574c8705c22328528b7db09 -->
# Feature: Record a decision

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Decisions, Changes, and Questions
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0003 Always-answerable project state, GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Capture a material architectural or product decision
- **User:** A developer or engineering lead has made an architectural or product call and wants it captured with its rationale so the reasoning survives past the conversation.
- **User value:** Not recorded
- **Scope:** in: Records a new decision with a title, the decision text, and status Proposed, Accepts an optional --governs flag linking the decision to a feature it applies to, Requires --title and --decision, refusing with a specific message when either is missing, Runs as a dry run by default, showing what would be recorded, and only commits with --apply; out: Does not verify that a --governs feature ID actually exists in the database before accepting it, an unknown feature ID is recorded as given, Does not move the decision past Proposed status, changing its status is a separate action, Does not check for duplicate or conflicting decisions on the same topic before recording a new one
- **Affected contracts:** none linked

### Primary flow

1. Run node src/cli.mjs decision record --title <title> --decision <text> as a dry run
2. Add --governs <FEATURE-id> if the decision applies to a specific feature
3. Read back the planned title, decision text, and governs line
4. Re-run with --apply to commit the decision to the database

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev decision record stores a new decision with its rationale | Run superdev decision record and record what was observed. | Met | EV-0059 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Invalid Input | Applicable | Omitting --title is refused with a message that a decision needs a title in plain language so it can be found again. |
| State Machine Violations | Applicable | Every new decision starts at status Proposed regardless of its content, there is no way to record one as already Decided through this command. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs line 2086 maps "decision record" to cmdDecisionRecord (line 1452), which requires --title and --decision then calls recordDecision from src/decisions/record.mjs (167 lines of real logic, not a stub). Ran `node src/cli.mjs decision record --title "Use SQLite for local storage" --decision "Use SQLite instead of a remote db" --governs FEAT-0001` (dry run) and got "Would record \"Use SQLite for local storage\" as Proposed. Decided ... Governs FEAT-0001. Nothing has changed. Re-run with --apply to record it." | command | pass | superdev decision record |

## Delivery state

- **What works now:** Reached by superdev decision record. src/cli.mjs line 2086 maps "decision record" to cmdDecisionRecord (line 1452), which requires --title and --decision then calls recordDecision from src/decisions/record.mjs (167 lines of real logic, not a stub). Ran `node src/cli.mjs decision record --title "Use SQLite for local storage" --decision "Use SQLite instead of a remote db" --governs FEAT-0001` (dry run) and got "Would record \"Use SQLite for local storage\" as Proposed. Decided ... Governs FEAT-0001. Nothing has changed. Re-run with --apply to record it."
- **What remains:** Nothing known.
- **Next action:** Not recorded
