<!-- superdev:generated source=FEAT-0082 revision=2943 hash=f77877b93e5b0c5b12051933f966b08dbc8dae2234f49fdbe63c5ec54579c164 -->
# Feature: Create a handoff before context compaction

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Preserve active task, feature, decisions, blockers, and next action before the context window compacts
- **User:** An agent whose context window is about to be compacted wants its active task, decisions, blockers and next step written down first, so the next agent picking up the session is not starting from nothing.
- **User value:** Not recorded
- **Scope:** in: Runs on Claude Code's PreCompact event and builds a handoff packet from live database records, not from the conversation transcript, Packet includes the session's objective, active task, feature, governing decisions, blocked tasks, scope changes, pending documentation and the next action, Flushes any pending touched files first, so file activity is not lost to the compaction, Writes the packet as memory entries plus a session_compacted activity event in one transaction, and updates the session's outcome and next action fields; out: Does not read or summarize the conversation transcript itself, everything comes from the database so it survives regardless of what compaction discards, Does not end the session, status becomes compacted rather than ended, so the session can continue afterward, Does not repeat the same decision, blocker, scope change or pending doc entry across multiple compactions of the same session, each is written once
- **Affected contracts:** none linked

### Primary flow

1. PreCompact event fires before Claude Code discards the transcript
2. Hook builds the packet from resumeContext, reading the live session, active task, governing decisions and blockers from the database
3. Already recorded entries from earlier compactions in the same session are filtered out to avoid duplicating them
4. Packet is persisted as memory entries and a session_compacted activity event, and a confirmation naming the entries kept and the next action is returned

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A pre-compact event produces a handoff record containing the active task and exact next action | Do it through the surface a person would use and record what was observed. | Met | EV-0096 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | A session that compacts many times only ever writes each decision, blocker, scope change and pending document entry once, tracked by source reference, so repeated compactions do not bloat memory with the same facts. |
| Empty States | Applicable | If there is no live session, or no project database exists yet, preparePacket returns null and the hook does nothing rather than opening a session it cannot attribute the packet to. |
| Limits And Quotas | Applicable | Each category of entry (decisions, blockers, scope changes, pending docs) is capped at a fixed packet limit per compaction, since the authoritative record already lives in its own table and the memory entry is only a pointer for recall. |
| Recovery | Applicable | If the session was already ended by the time PreCompact fires, the packet is not written, since there is nothing left to hand off from a session that already closed. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A handoff is written before compaction by the same path, so a session that is compacted mid work resumes with what it was doing rather than with the conversation. | manual_check | pass | src/runtime/hooks.mjs pre-compact |

## Delivery state

- **What works now:** Reached by Claude Code PreCompact event -> hooks/hooks.json -> node src/runtime/hooks.mjs pre-compact -> preCompact() -> compactSession(). hooks/hooks.json:38-48 wires PreCompact to src/runtime/hooks.mjs; src/runtime/hooks.mjs:458-467 preCompact() calls preparePacket() (builds objective, activeTaskId, decisions, blockers, scopeChanges, pendingDocumentation, nextAction, lastVerifiedResult from the live DB) then src/runtime/session.mjs:199-236 compactSession() writes work_sessions.outcome/next_action and a session_compacted activity row in one transaction.
- **What remains:** Nothing known.
- **Next action:** Not recorded
