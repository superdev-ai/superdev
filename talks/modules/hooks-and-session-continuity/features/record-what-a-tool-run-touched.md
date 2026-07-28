<!-- superdev:generated source=FEAT-0089 revision=2943 hash=b63320ebd1843c4fcda19798170e640ecfddba20a9111a5ef701fcd756503337 -->
# Feature: Record what a tool run touched

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Hooks and Session Continuity
- **Risk level:** R1
- **Milestone:** Real Project Dogfooding
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** After a tool runs, record the files the active task touched and mark the documentation they affect as possibly stale, without writing an event per edit.
- **User:** A developer or agent editing files during a session wants those edits attributed to the active task without a database write firing on every single keystroke-sized change.
- **User value:** Not recorded
- **Scope:** in: PostToolUse hook (matching Write, Edit, MultiEdit, NotebookEdit) appends each edited file's project-relative path to a touched.json marker, Deduplicates paths and caps the marker list at 40 entries, Flushes the marker into a single activity_events row at most once per 5-minute interval, describing which directories changed rather than listing every file, When no task is claimed, records a separate 'untracked work' marker instead, so the gap between what was built and what is tracked stays visible; out: Does not write one event per edit; a burst of many edits inside the interval produces one event on the next flush, Does not record edits outside the project root or inside .superdev/'s own runtime state, both are dropped before they reach the marker, Does not decide whether the edited file makes any given generated document actually wrong, only flags it as possibly stale for a human to check with docs diff
- **Affected contracts:** none linked

### Primary flow

1. Write, Edit, MultiEdit or NotebookEdit runs during a session
2. The PostToolUse hook calls postToolUse(), which resolves the file path and calls markTouched()
3. markTouched() appends the path to touched.json, deduplicated and capped
4. flushTouched() writes one activity_events row if the interval has elapsed or a batch boundary forces it, then clears the marker

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Files touched by a task appear against it, and one session does not produce one event per edit. | Exercise it in a real session and record what was observed. | Met | EV-0094 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | The touched-paths list is capped at 40 entries (MAX_TOUCHED); further distinct paths in the same window are not added but the total edit count still increments |
| Concurrent Actions | Applicable | A rate limit (ACTIVITY_INTERVAL_MS, 5 minutes) means a burst of edits within the window is folded into one activity event rather than one per edit, keeping the timeline readable |
| Consistency | Applicable | flushTouched() records nothing when there is no live session to attribute the work to, or no project database yet, leaving the marker file intact for the next flush attempt |
| Permission Boundaries | Applicable | A file path resolving outside the project root, or inside .superdev/, is silently dropped rather than recorded, since an absolute path outside the project is not this project's history |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| An edit is recorded against the active task and marked at a controlled frequency rather than one event per keystroke. With no task claimed it leaves a single rate limited marker saying the product changed while nothing tracked it, so the gap is visible in the record rather than invisible. | manual_check | pass | src/runtime/hooks.mjs post-tool-use |

## Delivery state

- **What works now:** Reached by Editing a file with Write, Edit, MultiEdit or NotebookEdit during a live session. Claude Code's PostToolUse hook (hooks/hooks.json:26-37, matcher Write\|Edit\|MultiEdit\|NotebookEdit) runs `node src/runtime/hooks.mjs post-tool-use`, which calls postToolUse() in src/runtime/hooks.mjs:277-292.. Traced and executed the real path on a scratch copy of the project (own .superdev db, not the live repo db). postToolUse() calls markTouched() (src/runtime/hooks.mjs:346-367), which appends the file's project-relative path to .superdev/runtime/touched.json. Ran: echo '{"cwd":"<scratch>","tool_name":"Write","tool_input":{"file_path":"<scratch>/src/foo.mjs"}}' \| node src/runtime/hooks.mjs post-tool-use, then read touched.json and saw {"paths":["src/cli.mjs","src/foo.mjs"],"total":4,...}. flushTouched() (src/runtime/hooks.mjs:405-437) is rate-limited to one activity_events row per ACTIVITY_INTE
- **What remains:** Nothing known.
- **Next action:** Not recorded
