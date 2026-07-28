<!-- superdev:generated source=FEAT-0077 revision=2943 hash=dfe89ababcd797abdf4ec4df4596cd06673a5d8aba908976689b0dece6a38b65 -->
# Feature: Restore context at session start

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Automatically confirm database health and show the active task, objective, blockers, and next action when a session begins
- **User:** A developer or agent resuming work after time away wants the session to open already knowing the database is healthy, what task is active, and what to do next, without running any lookup commands themselves.
- **User value:** Not recorded
- **Scope:** in: confirms database schema health before anything else runs, registers the session (developer, agent, branch, worktree) and rejoins a live session rather than opening a duplicate, reports the active task, objective, decisions in force, blockers, and next action, reports provider readiness and any harness lifecycle coverage gaps; out: does not migrate or repair the database itself if schema state is bad, it reports the problem and names the command to run, does not claim a task on the agent's behalf, it only reports what is already claimed or suggests the next claim action, does not run unbounded work, everything is raced against a fixed time budget so a slow database can never hold the session open
- **Affected contracts:** none linked

### Primary flow

1. a session starts and the harness fires SessionStart, which runs node src/runtime/hooks.mjs session-start
2. schema health is checked first; a missing or corrupt database stops here with a remedy line
3. the session is registered or rejoined, and any assignment already held is reported
4. the active task, objective, decisions, blockers, and next action print via the session-start report
5. provider readiness and any harness coverage gaps print last

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Starting a session with an active project shows the current task and next action without manual lookup | Do it through the surface a person would use and record what was observed. | Met | EV-0068 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | if starting the session record itself fails, the hook still returns valid output, logging that the session was not recorded and pointing to superdev resume rather than aborting the whole session-start flow. |
| Empty States | Applicable | with no project database in the directory, the hook reports no project database and tells the reader to run superdev init, rather than failing silently or crashing the session. |
| Slow Paths | Applicable | all work is raced against a 3500 ms budget with a synchronous write before exit, so a slow database or slow git call cannot hold the harness open past that bound. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. hooks/hooks.json:3-13 wires SessionStart to src/runtime/hooks.mjs session-start. sessionStart() (src/runtime/hooks.mjs:100-145) calls schemaState() to confirm DB health, startSession(), sessionStartReport() (active task, objective, blockers, next action via src/runtime/resume.mjs), and providerReadiness(). Ran it directly against this repo's live .superdev database: `echo '{"cwd":"$PWD"}' \| node src/runtime/hooks.mjs session-start` returned additionalContext including "Active task: none claimed.", "Decisions in force: DEC-0016 ...", "Blockers: none recorded", "Next action: Claim TASK-0001 ..." -- exactly the described purpose, delivered end to end. | command | pass | SessionStart hook (hooks/hooks.json) running node src/runtime/hooks.mjs session-start, wired for real Claude Code sessions |

## Delivery state

- **What works now:** Reached by SessionStart hook (hooks/hooks.json) running node src/runtime/hooks.mjs session-start, wired for real Claude Code sessions. hooks/hooks.json:3-13 wires SessionStart to src/runtime/hooks.mjs session-start. sessionStart() (src/runtime/hooks.mjs:100-145) calls schemaState() to confirm DB health, startSession(), sessionStartReport() (active task, objective, blockers, next action via src/runtime/resume.mjs), and providerReadiness(). Ran it directly against this repo's live .superdev database: `echo '{"cwd":"$PWD"}' \| node src/runtime/hooks.mjs session-start` returned additionalContext including "Active task: none claimed.", "Decisions in force: DEC-0016 ...", "Blockers: none recorded", "Next action: Claim TASK-0001 ..." -- exactly the described purpose, delivered end to end.
- **What remains:** Nothing known.
- **Next action:** Not recorded
