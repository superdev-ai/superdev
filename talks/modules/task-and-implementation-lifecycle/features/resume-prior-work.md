<!-- superdev:generated source=FEAT-0010 revision=2943 hash=ee35f48140896a849ab4cdb97fdefb9b2dd3d2699e63b444ec23e1723221290a -->
# Feature: Resume prior work

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Reconstruct current work context from the database, repo, decisions, and memory
- **User:** A developer or agent starting a new session wants the exact context they left off with, pulled from real records rather than their own memory of what happened.
- **User value:** Not recorded
- **Scope:** in: Assembles project statement, git branch/head/dirty state, active session, developer, and agent identity into one view, Lists governing decisions currently in force and a chronological list of recent scope-change events from the events table, Lists ready tasks and names a single next action to take, With --apply, starts a new session row before assembling the same context; out: Does not read or trust conversation history or chat memory as a source, everything shown comes from the database, git, and recorded decisions, Does not resume a task automatically, it surfaces the ready tasks and next action but leaves claiming the task to a separate command, Does not modify project state unless --apply is passed, a plain run is read-only
- **Affected contracts:** none linked

### Primary flow

1. Run superdev resume at the start of a session
2. Read project statement, git state, and any active session
3. Read the governing decisions and recent scope-change events for context
4. Read the ready tasks table and the Next Action line
5. Run superdev resume --apply if a new session record should be opened

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev resume restores the active Task, Feature, and next action after a new session starts | Run superdev resume and record what was observed. | Met | EV-0046 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | Git branch and head are read live from the working tree and compared against the last recorded branch head in the database, so a dirty worktree or a head that has moved since the last recorded state is visible in the output rather than silently assumed clean. |
| Empty States | Applicable | With no ready tasks, the Ready Tasks table is empty and Next Action falls back to whatever the project's next non-task step is, such as onboarding or acceptance. |
| Multi Device Session | Applicable | The context includes developer id, agent id, and harness (for example claude-code), so a resume run identifies which developer and which agent's session it is describing when more than one could be active. |
| State Machine Violations | Applicable | Without --apply, no session is opened and the output ends with an explicit note: 'No session was started. Re-run with --apply to open one,' so a dry run cannot be mistaken for an active session. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran node src/cli.mjs resume in the repo; output included project statement, git branch/head/dirty state, and a chronological Scope Changes list (EVT-1255, EVT-1254, ...) pulled from the events table, i.e. repo + db + decisions context assembled live. | command | pass | superdev resume (COMMANDS.resume -> cmdResume in src/cli.mjs:430, using resumeContext in src/runtime/resume.mjs) |

## Delivery state

- **What works now:** Reached by superdev resume (COMMANDS.resume -> cmdResume in src/cli.mjs:430, using resumeContext in src/runtime/resume.mjs). Ran node src/cli.mjs resume in the repo; output included project statement, git branch/head/dirty state, and a chronological Scope Changes list (EVT-1255, EVT-1254, ...) pulled from the events table, i.e. repo + db + decisions context assembled live.
- **What remains:** Nothing known.
- **Next action:** Not recorded
