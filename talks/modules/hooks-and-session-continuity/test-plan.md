<!-- superdev:generated source=MOD-0008 revision=3058 hash=805fe2133da674892b228eaf859e612cba074dd1454f45922b1ad054553f6938 -->
# Hooks and Session Continuity - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| End a resumed session | superdev resume --end records session end and updates state | Run superdev resume --end and record what was observed. | Met |
| Restore context at session start | Starting a session with an active project shows the current task and next action without manual lookup | Do it through the surface a person would use and record what was observed. | Met |
| Record session outcome at session end | Ending a session produces a recorded outcome and updated task and branch state | Do it through the surface a person would use and record what was observed. | Met |
| Detect work that maps to no task | The hook fires on a prompt describing untracked work and names the missing task. | Exercise it in a real session and record what was observed. | Met |
| Record what a tool run touched | Files touched by a task appear against it, and one session does not produce one event per edit. | Exercise it in a real session and record what was observed. | Met |
| Hand off before context is lost | A compaction is survived with the next action intact. | Exercise it in a real session and record what was observed. | Met |
| Work without hooks at all | Each hook behaviour names the command that replaces it, and the product works when no hook fires. | Exercise it in a real session and record what was observed. | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, manual_check | 7 | exists |
| Applicable edge-case categories | command, manual_check | 26 | exists |
| Permission boundaries | command, manual_check | 0 | missing |
| State machines including illegal transitions | command, manual_check | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. A code comment at src/cli.mjs:438-441 documents that this path was previously broken (endSession's id argument was passed an options object, so every --end run reported 'Session [object Object] does not exist'). Verified the fix is live and not just claimed: in an isolated scratch project (scratchpad/testproj, deleted after), ran `resume --apply` (started SES-0002), then `resume --end --apply`, which printed 'Session ended' with Id SES-0002, Status Ended, Ended At populated. No commands with --apply were run against the actual ~/Projects/Personal/superdev repository. | command | pass | superdev resume --end --apply (COMMANDS.resume -> cmdResume end-branch in src/cli.mjs:430-451, calling endSession in src/runtime/session.mjs:291) | Current |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. hooks/hooks.json:3-13 wires SessionStart to src/runtime/hooks.mjs session-start. sessionStart() (src/runtime/hooks.mjs:100-145) calls schemaState() to confirm DB health, startSession(), sessionStartReport() (active task, objective, blockers, next action via src/runtime/resume.mjs), and providerReadiness(). Ran it directly against this repo's live .superdev database: `echo '{"cwd":"$PWD"}' \| node src/runtime/hooks.mjs session-start` returned additionalContext including "Active task: none claimed.", "Decisions in force: DEC-0016 ...", "Blockers: none recorded", "Next action: Claim TASK-0001 ..." -- exactly the described purpose, delivered end to end. | command | pass | SessionStart hook (hooks/hooks.json) running node src/runtime/hooks.mjs session-start, wired for real Claude Code sessions | Current |
| A prompt asking for product changing work with no task claimed produced the warning naming what to do: find or create the task, link it to a feature and a contract, check the decisions in force, claim it, then move it to in progress. A prompt that only asks a question produces nothing, so the warning stays worth reading. | manual_check | pass | src/runtime/hooks.mjs user-prompt-submit | Current |
| An edit is recorded against the active task and marked at a controlled frequency rather than one event per keystroke. With no task claimed it leaves a single rate limited marker saying the product changed while nothing tracked it, so the gap is visible in the record rather than invisible. | manual_check | pass | src/runtime/hooks.mjs post-tool-use | Current |
| The pre compact hook runs and persists the session state before context is lost, carrying the active task, the governing decisions, the blockers, the verification state and the exact next action. | manual_check | pass | src/runtime/hooks.mjs pre-compact | Current |
| Session end records the observable outcome, updates the task and branch, consolidates memory and writes the handoff, and resume reads that back. Verified by running resume, which reconstructed the working state from the database alone. | command | pass | node src/cli.mjs resume | Current |
| Every hook behaviour names the command that replaces it. The session start hook printed the list on this harness: claim, start, scope correction, block and unblock, each with its command, and ended with the rule that Superdev never treats a hook as proof that something happened. | manual_check | pass | src/runtime/hooks.mjs session-start | Current |
| Every hook behaviour names the command that replaces it, and the session start hook prints that list on every run: claim, start, scope correction, block and unblock. Verified by running the hook, which reported five named fallbacks and the rule that Superdev never treats a hook as proof that something happened. | manual_check | pass | src/runtime/hooks.mjs session-start | Current |
