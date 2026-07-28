<!-- superdev:generated source=FEAT-0083 revision=2943 hash=1e7ab46d7aff555d1166a6427141990bfae588a7d130a430fd11cacaa260c91b -->
# Feature: Record session outcome at session end

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Capture the observable outcome of a session and consolidate short-term memory into durable records
- **User:** A developer or agent ending a work session wants the observable outcome captured and the session properly closed, so the next person or agent knows what happened and which tasks are free again.
- **User value:** Not recorded
- **Scope:** in: Runs on Claude Code's SessionEnd event, flushes any pending touched files, and runs memory consolidation before closing, Sets the session's outcome from the last verified result or the session's stated objective if no verified result exists, Updates work_sessions to status ended with its outcome and next action, releases any task claims the session held, and records a session_ended activity event, Reports back how many claims were released and a summary of memory consolidation, duplicates merged, contradictions marked and noise discarded; out: Does not depend on this hook actually firing, since SessionEnd is not guaranteed on a killed process, so session-start re-derives state from records rather than trusting it ran, Does not block the close if memory consolidation fails, that step is best effort and failure never prevents the session record from being written, Does not choose what the next session should do, it only records the outcome and next action already known to the database
- **Affected contracts:** none linked

### Primary flow

1. Claude Code fires SessionEnd for the active session
2. Hook builds the same handoff packet used for compaction, flushes touched files, and attempts memory consolidation
3. endSession writes status ended, the outcome and next action, releases task claims, and records a session_ended activity event
4. A confirmation is returned naming claims released, memory consolidation counts, and the recorded next action

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Ending a session produces a recorded outcome and updated task and branch state | Do it through the surface a person would use and record what was observed. | Met | EV-0097 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | If memory consolidation throws, the error is caught and consolidation is treated as skipped, the session end itself still proceeds and writes its outcome and released claims. |
| Empty States | Applicable | If there is no live session to end, preparePacket returns null and the hook does nothing, there is nothing to close. |
| Recovery | Applicable | A process killed before SessionEnd fires leaves the session without an ended_at, and the product does not treat a missing SessionEnd as proof the session is still live, since hooks are never trusted as the sole evidence something happened. |
| State Machine Violations | Applicable | Calling endSession on a session that already has an ended_at timestamp returns the existing session unchanged rather than writing a second close over it. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Session end records the observable outcome, updates the task and branch, consolidates memory and writes the handoff, and resume reads that back. Verified by running resume, which reconstructed the working state from the database alone. | command | pass | node src/cli.mjs resume |

## Delivery state

- **What works now:** Reached by Claude Code SessionEnd event -> hooks/hooks.json -> node src/runtime/hooks.mjs session-end -> sessionEnd() -> endSession(). hooks/hooks.json:49-59 wires SessionEnd; src/runtime/hooks.mjs:476-489 sessionEnd() sets outcome from lastVerifiedResult or the session objective and calls src/runtime/session.mjs:291-332 endSession(), which updates work_sessions (status='ended', outcome, next_action), releases task claims, and records a session_ended activity event -- consolidating short-term state into durable rows.
- **What remains:** Nothing known.
- **Next action:** Not recorded
