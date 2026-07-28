<!-- superdev:generated source=FEAT-0080 revision=2943 hash=aad2f68ddaa04ba2ba4baed61f5a5e2ebf4b4ac26607c8cba48239986ff29f69 -->
# Feature: Track touched files during work

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Record which files were touched by the active task as work happens
- **User:** A developer or agent mid task wants every file they edit to be picked up automatically as part of that task's record, without having to manually log what they touched.
- **User value:** Not recorded
- **Scope:** in: Fires after every Write, Edit, MultiEdit or NotebookEdit tool call and records the file path touched, Persists touched paths to a runtime marker file, deduplicated and capped, tied to the session since it started, Writes one code_changed activity event describing the files and directories touched, rate limited to roughly one per 5 minutes or per batch, Attributes the event to the active session and its claimed task when one exists; out: Does not record every single edit as its own event, edits are batched into one summary event per interval, Does not track file touches from tools outside the matched set, other tool calls are invisible to this feature, Does not attribute anything when there is no live session, the marker file is kept so the next session can pick it up instead
- **Affected contracts:** none linked

### Primary flow

1. Agent or developer edits a file with a matched tool
2. Hook resolves the file to a project relative path and appends it to the touched marker file
3. Hook checks whether the activity interval has elapsed or a batch forced a flush
4. If so, one code_changed activity event is written naming the files and directories changed, tied to the active session and task

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| After edits during an active task, the task's file list includes the touched files | Do it through the surface a person would use and record what was observed. | Met | EV-0070 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | A file path outside the project root, or one starting with the project's own runtime state directory, is dropped rather than recorded, since it either belongs to a different project or is Superdev's own bookkeeping. |
| Concurrent Actions | Applicable | A burst of edits in quick succession all merge into the same marker file entry and produce a single flushed event once the interval elapses, rather than one event per edit. |
| Network Failure | Not Applicable | N/A - The hook writes to a local marker file and local database only, there is no network call in this path to fail. |
| Recovery | Applicable | If no live session exists when a flush is attempted, nothing is recorded to the database but the marker file is left untouched, so the paths survive to be picked up and flushed once a session resumes. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. hooks/hooks.json:26-36 wires PostToolUse (matcher Write\|Edit\|MultiEdit\|NotebookEdit) to src/runtime/hooks.mjs post-tool-use. postToolUse() (src/runtime/hooks.mjs:277-292) calls markTouched() to persist the file path to .superdev/runtime/touched.json and flushTouched() to write a code_changed activity event tied to the active session (rate-limited to one event per 5 minutes or per batch). Ran `echo '{"cwd":"...","tool_name":"Write","tool_input":{"file_path":".../src/cli.mjs"}}' \| node src/runtime/hooks.mjs post-tool-use` against the live project and confirmed .superdev/runtime/touched.json updated to {"paths":["src/cli.mjs"],"total":3,...}. | command | pass | PostToolUse hook (hooks/hooks.json) running node src/runtime/hooks.mjs post-tool-use after Write/Edit/MultiEdit/NotebookEdit |

## Delivery state

- **What works now:** Reached by PostToolUse hook (hooks/hooks.json) running node src/runtime/hooks.mjs post-tool-use after Write/Edit/MultiEdit/NotebookEdit. hooks/hooks.json:26-36 wires PostToolUse (matcher Write\|Edit\|MultiEdit\|NotebookEdit) to src/runtime/hooks.mjs post-tool-use. postToolUse() (src/runtime/hooks.mjs:277-292) calls markTouched() to persist the file path to .superdev/runtime/touched.json and flushTouched() to write a code_changed activity event tied to the active session (rate-limited to one event per 5 minutes or per batch). Ran `echo '{"cwd":"...","tool_name":"Write","tool_input":{"file_path":".../src/cli.mjs"}}' \| node src/runtime/hooks.mjs post-tool-use` against the live project and confirmed .superdev/runtime/touched.json updated to {"paths":["src/cli.mjs"],"total":3,...}.
- **What remains:** Nothing known.
- **Next action:** Not recorded
