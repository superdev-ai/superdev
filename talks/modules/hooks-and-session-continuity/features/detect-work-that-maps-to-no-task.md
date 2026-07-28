<!-- superdev:generated source=FEAT-0088 revision=3312 hash=071d646f8cd957877269668d8aa409488052adc10d122320b2e876103564ed6c -->
# Feature: Detect work that maps to no task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** On a user prompt, notice when the requested work has no task behind it and say so, rather than letting an agent start unmapped work.
- **User:** A developer or agent typing a prompt that describes new work wants Superdev to notice, before any code changes, that nothing tracks this work yet.
- **User value:** Not recorded
- **Scope:** in: Classifies each submitted prompt by verb: a change verb (build, add, fix, update, etc.) counts as product work, a question verb (what, is, show, etc.) does not, Checks the active session for a task that is claimed and in progress; skips the warning entirely when one exists, When no task is claimed, injects a message naming the missing steps: find or create the task, link a feature, claim it, move it to in progress, Separately scans accepted and time-boxed decisions for shared subject words with the prompt, and surfaces up to three matching decisions so a request cannot quietly override one; out: Does not block the prompt or the agent from proceeding; it only injects a warning into context, since P-010 forbids any required behavior depending on a hook firing, Does not create a task itself; task creation stays a command the agent or user runs, Does not detect an actual conflict between the prompt and a decision, only that both mention the same subject; it asks the reader to check
- **Affected contracts:** none linked

### Primary flow

1. A user or agent submits a prompt in Claude Code
2. The UserPromptSubmit hook runs hooks.mjs user-prompt-submit
3. asksForProductWork() classifies the prompt; decisionsInTheWay() checks for related accepted decisions
4. If work is implied and no task is active, or a decision matches, the hook returns a context message naming what to do next

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| The hook fires on a prompt describing untracked work and names the missing task. | Exercise it in a real session and record what was observed. | Met | EV-0093 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Not Applicable | N/A - The hook runs once per prompt submission and does not accumulate state across prompts, so there is no duplicate-warning case to suppress |
| Empty States | Applicable | If no project database exists yet, the hook returns immediately with no message, since there is nothing to check a claim or a decision against |
| Invalid Input | Applicable | An empty prompt is still treated as product work (changesProduct defaults true when there is no text), so the warning still fires rather than being skipped on empty input |
| Ordering | Applicable | A decision match is checked and reported even when the prompt reads as a pure question, because reading a decision and then acting on it is the common path |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A prompt asking for product changing work with no task claimed produced the warning naming what to do: find or create the task, link it to a feature and a contract, check the decisions in force, claim it, then move it to in progress. A prompt that only asks a question produces nothing, so the warning stays worth reading. | manual_check | pass | src/runtime/hooks.mjs user-prompt-submit |
| Claiming a task now points the session at it, so work under a claim stops being reported as untracked | manual_check | pass | - |

## Delivery state

- **What works now:** Reached by Claude Code UserPromptSubmit event -> hooks/hooks.json -> node src/runtime/hooks.mjs user-prompt-submit -> userPromptSubmit(). hooks/hooks.json:15-25 wires UserPromptSubmit to src/runtime/hooks.mjs; src/runtime/hooks.mjs:191-201 asksForProductWork() classifies the prompt by verb (build/add/fix/etc vs a question), and userPromptSubmit() (hooks.mjs:203-229) checks activeSession() for a claimed, in-progress task, emitting 'Superdev: no task is claimed in this session.' plus the required steps (find/create task, link feature, claim, move to in progress) when there is none -- matching the module comment referencing 'brief section 13' and the untracked-work marker written by noteUntrackedWork() (hooks.mjs:253-275).
- **What remains:** Nothing known.
- **Next action:** Not recorded
