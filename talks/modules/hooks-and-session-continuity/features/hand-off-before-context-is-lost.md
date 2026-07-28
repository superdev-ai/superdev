<!-- superdev:generated source=FEAT-0090 revision=2943 hash=3af11a6c3ffb0530cb57e8b5cd6f9d9dc9054f0dd1a513b4bb8b09e5755ca7b2 -->
# Feature: Hand off before context is lost

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Before a context compaction, write a handoff carrying the active task, feature, governing decisions, blockers, verification state and the exact next action.
- **User:** A developer or agent about to lose context to a compaction wants the active task, governing decisions, blockers and the exact next action written down so the next session can pick up without re-deriving it.
- **User value:** Not recorded
- **Scope:** in: PreCompact hook builds a packet (objective, active task, feature, git state, next action, decisions in force, blockers, scope changes, pending documentation) and writes it to memory_entries before the transcript compacts, SessionEnd hook builds the same packet, additionally consolidates short-term memory, closes the session, releases task claims, and records the outcome, Deduplicates by source_ref across repeated compactions in the same session so the same blocker or decision is not copied into memory twice, Forces a flush of any touched-file marker before writing the packet, so pending file activity is not lost at the boundary; out: Does not run when there is no live session or no project database yet; preparePacket() returns null and the hook is a no-op, Does not guarantee SessionEnd fires on a killed process; the next session's resume rebuilds context from records rather than trusting the hook ran, Does not decide what the next action should be; it copies the next action already recorded on the active task rather than inferring one
- **Affected contracts:** none linked

### Primary flow

1. A context compaction or normal session end occurs in Claude Code
2. hooks.json routes it to preCompact() or sessionEnd() in hooks.mjs
3. preparePacket() reads resumeContext() and assembles the capped, deduplicated packet
4. compactSession() or endSession() writes the packet as memory_entries rows and updates work_sessions; sessionEnd() also releases claims and reports how many

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A compaction is survived with the next action intact. | Exercise it in a real session and record what was observed. | Met | EV-0095 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | Entries already written for this session (matched by source_ref) are excluded from the next packet, so a session that compacts several times does not repeat the same blocker or decision each time |
| Empty States | Applicable | If no project database exists, or the session has already ended, both hooks return an empty result immediately rather than writing a packet |
| Limits And Quotas | Applicable | Decisions, blockers, scope changes and pending documentation are each capped at PACKET_LIMIT entries per packet, since each is already its own authoritative record and the memory entry is only a pointer for recall |
| Recovery | Applicable | SessionEnd is not guaranteed to fire on a killed process; the design deliberately does not depend on it, since the next session's start re-derives everything from the database |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| The pre compact hook runs and persists the session state before context is lost, carrying the active task, the governing decisions, the blockers, the verification state and the exact next action. | manual_check | pass | src/runtime/hooks.mjs pre-compact |

## Delivery state

- **What works now:** Reached by A context compaction or normal session end in Claude Code. hooks/hooks.json:38-48 wires PreCompact to `node src/runtime/hooks.mjs pre-compact`, and hooks/hooks.json:49-59 wires SessionEnd to `... session-end`, both landing in preCompact()/sessionEnd() in src/runtime/hooks.mjs:458-489.. Ran the real path on a scratch copy of the repo (its own .superdev db). preparePacket() (src/runtime/hooks.mjs:499-561) builds objective, active task, feature, git state, next action, decisions in force, blockers, scope changes and pending documentation from resumeContext(), each capped and deduplicated by source_ref. compactSession() (src/runtime/session.mjs:199-227) and persistWorkingState() (src/runtime/session.mjs:498-560) write each of those as memory_entries rows and update work_sessions. Executed: echo '{"cwd":"<scratch>"}' \| node src/runtime/hooks.mjs pre-compact -> got {"systemMessage":
- **What remains:** Nothing known.
- **Next action:** Not recorded
