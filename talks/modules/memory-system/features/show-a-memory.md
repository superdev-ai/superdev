<!-- superdev:generated source=FEAT-0067 revision=2943 hash=d77530e436879d0458c875fea41ddba3701aa53ecd7b3a7bbb368cec47256b7e -->
# Feature: Show a memory

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show a single memory's content, type, and epistemic status
- **User:** A developer or agent recalling a specific memory by id wants its full content, not just a search snippet, along with how confident the project is in it.
- **User value:** Not recorded
- **Scope:** in: Takes a memory id and returns its title, kind, epistemic status, recorded date, source reference, and full content, Shows whether the memory has been superseded, and by which memory, or 'Still current' if not, Lists what the memory concerns via memory_links (which tasks, features, or decisions it relates to and how), Always closes with a reminder that memory is recall, not authority, and should be checked against current state before acting on it; out: Does not verify the memory against current specifications or code, that is a separate command (memory verify), Does not show related memories or search results, only the one requested, Does not allow editing or deleting the memory from this command
- **Affected contracts:** none linked

### Primary flow

1. Run superdev memory search or otherwise learn a memory's id
2. Run superdev memory show <MEM-id>
3. Read the memory's kind, epistemic status, source, and supersession state
4. Read the linked tasks, features, or decisions it concerns and the full content

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev memory show <MEMORY-id> returns the full memory record | Run superdev memory show <MEMORY-id> and record what was observed. | Met | EV-0087 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Data Migration States | Applicable | In a project where no memory has ever been written, every id lookup hits the not-found path since the underlying table is empty, which is expected given the write path only fires on session compact or end. |
| Deletion Semantics | Applicable | A superseded memory is still fully shown, its content and links intact, with the superseding memory's id displayed rather than the record being hidden or removed. |
| Empty States | Applicable | A memory with no links prints no 'It concerns' section at all rather than an empty bulleted list. |
| Invalid Input | Applicable | Requesting a memory id that does not exist refuses cleanly with "There is no memory <id>." and exit code 2, rather than crashing or returning empty fields. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| memory show returned the entry with its kind, how well it is known, when it was recorded, its source event and whether it is superseded, then the warning that memory is recall and not authority. Output began: Task TASK-0016 moved to complete MEM-0001 ------------------------------------------ Kind Outcome How well known Confirmed Recorded 2026-07-27T20:20:49.701Z Source EVT-1985 Superseded by Still current Task TASK-0016 moved to complete It concerns ----------- - feature FEAT-0015 (concerns) - task TASK-0016 (concerns) Memory is recall, not authority. Check it against the current specification, decisions and evidence before acting on it. | command | pass | node src/cli.mjs memory show MEM-0001 |

## Delivery state

- **What works now:** Reached by superdev memory show <MEM-id>. src/cli.mjs:1149 cmdMemoryShow reads memory_entries plus memory_links and renders kind, epistemic status, source, supersession and content via shared R.* renderers already proven correct elsewhere (decision list). Ran `node src/cli.mjs memory show MEM-9999` (no such memory exists yet in this DB): correctly refused with "There is no memory MEM-9999." exit 2, rather than crashing. Success path is unexercised only because no memory has been written yet (see FEAT-0066 note on the write path).
- **What remains:** Nothing known.
- **Next action:** Not recorded
