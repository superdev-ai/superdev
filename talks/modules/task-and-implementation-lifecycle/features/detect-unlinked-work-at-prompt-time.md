<!-- superdev:generated source=FEAT-0078 revision=2943 hash=98220ef44b2a4031b044be47c91127c3472860f996ad61deb86382ff356c89ae -->
# Feature: Detect unlinked work at prompt time

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Notice when a user request has no corresponding task and prompt for one to be created
- **User:** A coding agent working inside a session wants to be stopped before it changes the product with no task tracking the work, rather than finding out after the fact that the change was never recorded.
- **User value:** Not recorded
- **Scope:** in: Runs on every prompt submit and checks whether a task is already claimed and in progress, Classifies the prompt as a question or as work that changes the product using verb and phrasing patterns, Injects a warning naming the missing task and the steps to find or create one, link it, and claim it, Stays silent once a task is claimed and in progress, and on prompts it reads as questions; out: Does not block or refuse the prompt, it only injects a warning the agent reads before acting, Does not create or claim a task itself, the reader has to run the follow up commands, Does not understand the request semantically, the question and change detection is pattern based on the wording
- **Affected contracts:** none linked

### Primary flow

1. User or agent submits a prompt describing new work
2. Hook checks activeSession for a claimed, in_progress task
3. If none is claimed and the prompt matches a change verb rather than a question, a warning is generated
4. Warning is injected into context telling the agent to find or create a task, link it, and claim it before proceeding

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Submitting a prompt describing new work with no matching task triggers a reminder to create and link a task | Do it through the surface a person would use and record what was observed. | Met | EV-0069 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | An empty prompt is treated as changing the product by default, so the warning path still runs rather than silently passing an empty string through the question check. |
| Empty States | Applicable | When no project database exists yet at the session's working directory, the hook returns immediately with no warning, since there is nothing to check a task against. |
| Invalid Input | Applicable | A prompt that matches neither a recognized question pattern nor a recognized change verb is treated as work rather than silently passed, since an unrecognized instruction is judged more likely to be a change than a question. |
| State Machine Violations | Applicable | If a task is claimed but its status is anything other than in_progress, the session is treated as not covering the work, and the warning still fires naming that task and telling the reader to move it to in progress first. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. hooks/hooks.json:15-24 wires UserPromptSubmit to src/runtime/hooks.mjs user-prompt-submit. userPromptSubmit() (src/runtime/hooks.mjs:203-229) checks activeSession for a claimed, in_progress task; if the prompt matches asksForProductWork() (a change verb, not a question) and no task is claimed, it injects a warning to find or create a task. Ran `echo '{"cwd":"...","prompt":"add a new button to the dashboard"}' \| node src/runtime/hooks.mjs user-prompt-submit` and got 'Superdev: no task is claimed in this session. Before product-changing work: find or create the task...'. A control question ('what is the status of the project') correctly produced {} (no warning). | command | pass | UserPromptSubmit hook (hooks/hooks.json) running node src/runtime/hooks.mjs user-prompt-submit |

## Delivery state

- **What works now:** Reached by UserPromptSubmit hook (hooks/hooks.json) running node src/runtime/hooks.mjs user-prompt-submit. hooks/hooks.json:15-24 wires UserPromptSubmit to src/runtime/hooks.mjs user-prompt-submit. userPromptSubmit() (src/runtime/hooks.mjs:203-229) checks activeSession for a claimed, in_progress task; if the prompt matches asksForProductWork() (a change verb, not a question) and no task is claimed, it injects a warning to find or create a task. Ran `echo '{"cwd":"...","prompt":"add a new button to the dashboard"}' \| node src/runtime/hooks.mjs user-prompt-submit` and got 'Superdev: no task is claimed in this session. Before product-changing work: find or create the task...'. A control question ('what is the status of the project') correctly produced {} (no warning).
- **What remains:** Nothing known.
- **Next action:** Not recorded
