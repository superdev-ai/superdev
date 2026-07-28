<!-- superdev:generated source=FEAT-0011 revision=2943 hash=0f1ceb95fc6d2aef619c67e22bdb9dfe0a4d37f467c7e15f85fa43bf2c592da8 -->
# Feature: End a resumed session

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Explicitly close out a resumed work session
- **User:** A developer or agent who opened a session with resume wants to formally close it out so the record reflects that work stopped, rather than leaving it dangling.
- **User value:** Not recorded
- **Scope:** in: Ends the active session, or a named one via --session <SES-id>, recording an Ended status and an Ended At timestamp, Accepts an optional --note to record why the session ended, Defaults to a dry run describing what would happen, and only writes the end state when --apply is passed, Refuses to run when there is no active session and no --session id was given, naming the exact flag needed; out: Does not resume or reopen a session, ending is one-directional; reopening a task is a separate, task-level command, Does not require --session, it resolves the live active session automatically when the flag is omitted, Does not end sessions belonging to a different project, it only operates on the current project's root
- **Affected contracts:** none linked

### Primary flow

1. Have an active session open (started via superdev resume --apply)
2. Run superdev resume --end to see the dry-run description of what ending it would do
3. Run superdev resume --end --apply to actually close the session
4. Read the confirmation showing the session id, Status Ended, and Ended At

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev resume --end records session end and updates state | Run superdev resume --end and record what was observed. | Met | EV-0047 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | An optional --note is stored against the session end record, giving a human-readable reason for why the session closed when one is supplied. |
| Invalid Input | Applicable | With no active session and no --session id supplied, it refuses with a named error (E_NO_ACTIVE_SESSION) telling the caller to pass --session <SES-id>, rather than ending nothing silently. |
| Ordering | Applicable | Without --apply, the command only describes what would be ended and does not touch the session row, so running --end repeatedly without --apply never changes state, only --apply does. |
| State Machine Violations | Applicable | A prior bug passed the wrong argument shape to endSession so every --end run reported the session id as the literal string '[object Object]' and never actually ended anything; this is fixed and verified in an isolated scratch project, where ending printed the real session id and Status Ended. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. A code comment at src/cli.mjs:438-441 documents that this path was previously broken (endSession's id argument was passed an options object, so every --end run reported 'Session [object Object] does not exist'). Verified the fix is live and not just claimed: in an isolated scratch project (scratchpad/testproj, deleted after), ran `resume --apply` (started SES-0002), then `resume --end --apply`, which printed 'Session ended' with Id SES-0002, Status Ended, Ended At populated. No commands with --apply were run against the actual ~/Projects/Personal/superdev repository. | command | pass | superdev resume --end --apply (COMMANDS.resume -> cmdResume end-branch in src/cli.mjs:430-451, calling endSession in src/runtime/session.mjs:291) |

## Delivery state

- **What works now:** Reached by superdev resume --end --apply (COMMANDS.resume -> cmdResume end-branch in src/cli.mjs:430-451, calling endSession in src/runtime/session.mjs:291). A code comment at src/cli.mjs:438-441 documents that this path was previously broken (endSession's id argument was passed an options object, so every --end run reported 'Session [object Object] does not exist'). Verified the fix is live and not just claimed: in an isolated scratch project (scratchpad/testproj, deleted after), ran `resume --apply` (started SES-0002), then `resume --end --apply`, which printed 'Session ended' with Id SES-0002, Status Ended, Ended At populated. No commands with --apply were run against the actual ~/Projects/Personal/superdev repository.
- **What remains:** Nothing known.
- **Next action:** Not recorded
