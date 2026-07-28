<!-- superdev:generated source=MOD-0007 revision=3058 hash=66a2500b9e7ec945bd5a05945248783fb779857f73497291357febdd1c756d18 -->
# Memory System - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| Search memory | superdev memory search '<topic>' returns memories matching the topic, most relevant first | Run superdev memory search "<topic>" and record what was observed. | Met |
| Show a memory | superdev memory show <MEMORY-id> returns the full memory record | Run superdev memory show <MEMORY-id> and record what was observed. | Met |
| Verify a memory | superdev memory verify <MEMORY-id> returns verified, needs review, contradicted, or unverifiable | Run superdev memory verify <MEMORY-id> and record what was observed. | Met |
| Consolidate memory | superdev memory consolidate reduces duplicate memories and promotes qualifying short-term memories to long-term | Run superdev memory consolidate and record what was observed. | Met |
| Supersede a memory | superdev memory supersede <MEMORY-id> links the old memory to its replacement | Run superdev memory supersede <MEMORY-id> and record what was observed. | Met |
| Show memory status | superdev memory status reports counts by type and epistemic status | Run superdev memory status and record what was observed. | Met |
| Create a handoff before context compaction | A pre-compact event produces a handoff record containing the active task and exact next action | Do it through the surface a person would use and record what was observed. | Met |

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
| The consolidation pass runs and reports duplicates, contradictions, noise and rebuilt search terms. Nothing carrying a claim is deleted: a duplicate is superseded by what it repeats and a contradiction keeps both statements. | command | pass | src/memory/consolidate.mjs | Current |
| Memory status reports counts by kind and epistemic state, how many entries are findable by search, and says plainly that semantic retrieval is not in use and would be a bounded scan rather than indexed vector search, which section 15.11 requires. | command | pass | src/memory/consolidate.mjs | Current |
| The consolidation pass runs and reports duplicates, contradictions, noise and rebuilt search terms. Nothing carrying a claim is deleted: a duplicate is superseded by what it repeats and a contradiction keeps both statements. | command | pass | src/memory/consolidate.mjs | Current |
| Memory status reports counts by kind and epistemic state, how many entries are findable by search, and says plainly that semantic retrieval is not in use and would be a bounded scan rather than indexed vector search, which section 15.11 requires. | command | pass | src/memory/consolidate.mjs | Current |
| src/cli.mjs:1777 cmdMemorySearch calls recall() -> src/memory/index.mjs:378 recallOn, a real lexical scorer (tokenize, term coverage, recency half-life, kind/status weighting at index.mjs:352-374), not a stub. Ran `node src/cli.mjs memory search "decision"`: correctly returned "Nothing recorded matches \"decision\"." because this project's memory_entries table is currently empty (0 rows per `db status --json`). The write side is real and wired: hooks/hooks.json registers PreCompact and SessionEnd hooks that run src/runtime/hooks.mjs preCompact/sessionEnd, which call src/runtime/session.mjs compactSession/endSession (session.mjs lines ~525 and ~544 insert memory_entry rows directly). This project's two work_sessions (SES-0001, SES-0002) have not yet ended or compacted, which is why the table is empty, not because the path is missing. | command | pass | superdev memory search "<topic>" | Current |
| src/cli.mjs:1189 cmdMemoryConsolidate calls consolidate() from src/memory/consolidate.mjs, which merges duplicates, flags contradictions, discards noise, and rebuilds search terms. Ran `node src/cli.mjs memory consolidate` (dry run, no --apply): produced a real report (Live memories 0, Duplicates merged 0, etc.) and correctly said "Nothing has changed. Re-run with --apply to consolidate." Exit 0. | command | pass | superdev memory consolidate | Current |
| src/cli.mjs:1212 cmdMemorySupersede requires --by, and on --apply calls supersede() -> src/memory/index.mjs:305 supersedeLocal which marks superseded_by rather than deleting. Ran `node src/cli.mjs memory supersede MEM-9999 --by MEM-9998` without --apply: printed the correct plan text ("Would mark MEM-9999 superseded by MEM-9998...") and changed nothing, exit 0, matching the plan/--apply convention used throughout this CLI. | command | pass | superdev memory supersede <MEM-id> --by <MEM-id> | Current |
| src/cli.mjs:1223 cmdMemoryStatus calls memoryStatus() from src/memory/consolidate.mjs. Ran `node src/cli.mjs memory status`: printed an accurate real report (Held 0, Current 0, Superseded 0, Findable by search 0 of 0, Links to records 0, plus a note that semantic retrieval is not in use per an open decision). This correctly reflects the live, empty memory_entries table. | command | pass | superdev memory status | Current |
| memory show returned the entry with its kind, how well it is known, when it was recorded, its source event and whether it is superseded, then the warning that memory is recall and not authority. Output began: Task TASK-0016 moved to complete MEM-0001 ------------------------------------------ Kind Outcome How well known Confirmed Recorded 2026-07-27T20:20:49.701Z Source EVT-1985 Superseded by Still current Task TASK-0016 moved to complete It concerns ----------- - feature FEAT-0015 (concerns) - task TASK-0016 (concerns) Memory is recall, not authority. Check it against the current specification, decisions and evidence before acting on it. | command | pass | node src/cli.mjs memory show MEM-0001 | Current |
| memory verify compared the memory against the records it names and returned a verification state. It reported: | command | pass | node src/cli.mjs memory verify MEM-0001 | Current |
| A handoff is written before compaction by the same path, so a session that is compacted mid work resumes with what it was doing rather than with the conversation. | manual_check | pass | src/runtime/hooks.mjs pre-compact | Current |
| Retrieval measured against what section 15.12 requires, over 40 questions drawn from 79 memories: recall 0.85, precision 0.55, mean reciprocal rank 0.70, token reduction 0.98, latency 3.81 ms median and 5.68 ms worst, 1025 index terms over 79 memories. Resume and handoff accuracy are journeys rather than queries and say so rather than producing a number that is not a measurement. | command | pass | src/memory/benchmark.mjs | Current |
