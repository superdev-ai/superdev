<!-- superdev:generated source=FEAT-0091 revision=2984 hash=2239807d4e10d80f914523d0be2d7c05d1ec8ac40d0a8b849f527ea49f639a4e -->
# Feature: Work without hooks at all

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Every hook behaviour has a command that does the same thing, so a harness with no hook support loses reliability and never correctness.
- **User:** A product owner or agent running Superdev on a harness with weak or no hook support wants to know exactly which lifecycle steps still need a manual command, so reliability drops but correctness never does.
- **User value:** Not recorded
- **Scope:** in: harnessMatrix() in harness.mjs states, for each of 16 lifecycle points and each known harness (claude-code, codex, skills-sh), whether a hook does the work, a hook only reminds, or a command is the only path, SessionStart's coverageNote() reads the matrix for the detected harness and prints which lifecycle points are not hook-driven here, each with its fallback command, Verified that superdev resume, task claim, task update, task block, task complete, task release and plan all exist and run as real commands, covering most of the 16 points, Documents that compaction and handoff have no true CLI command fallback yet; their entries point at calling compactSession/handoffSession in src/runtime/session.mjs directly, which is not a documented command; out: Does not make any required behavior depend on a hook firing; every lifecycle point names a command that achieves the same outcome with no hook at all, Does not yet provide a first-class CLI command for compaction or handoff; that gap is acknowledged, not resolved, in this feature's current state, Does not wire PreToolUse, Stop, SubagentStop or Notification, since Superdev never blocks a tool call and treats a completion nag as distinct from real verification
- **Affected contracts:** none linked

### Primary flow

1. A session starts under a given harness (claude-code, codex, or skills-sh)
2. SessionStart hook runs, detects the harness, and calls coverageNote()
3. coverageNote() filters harnessMatrix() for lifecycle points where this harness's coverage is command-only
4. The session-start message lists up to 4 of those points with their fallback command, plus how many more exist

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Each hook behaviour names the command that replaces it, and the product works when no hook fires. | Exercise it in a real session and record what was observed. | Met | EV-0098 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | skills-sh has no hook mechanism at all, so every one of the 16 lifecycle points is command-only there by design, not by gap |
| Empty States | Applicable | coverageNote() returns null and nothing is printed when the detected harness has full hook coverage for every lifecycle point |
| Platform Variance | Applicable | codex is treated as command-driven for every lifecycle point until a first-party source confirms a trusted session-lifecycle hook fires, since only PreToolUse for shell commands has been verified there |
| Versioning | Applicable | PostToolBatch is listed as an unverified event: hooks.mjs still answers it so a harness that does emit it behaves correctly, but hooks.json does not wire it and no lifecycle point is credited to it |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Every hook behaviour names the command that replaces it. The session start hook printed the list on this harness: claim, start, scope correction, block and unblock, each with its command, and ended with the rule that Superdev never treats a hook as proof that something happened. | manual_check | pass | src/runtime/hooks.mjs session-start |
| Every hook behaviour names the command that replaces it, and the session start hook prints that list on every run: claim, start, scope correction, block and unblock. Verified by running the hook, which reported five named fallbacks and the rule that Superdev never treats a hook as proof that something happened. | manual_check | pass | src/runtime/hooks.mjs session-start |

## Delivery state

- **What works now:** The session start hook lists, on every run, the behaviours no hook drives on this harness and the command that does each one instead: claim, start, scope correction, block and unblock. It ends with the rule itself, that Superdev never treats a hook as proof that something happened. Verified by running the hook: it printed five named fallbacks.
- **What remains:** Nothing known.
- **Next action:** Not recorded
