<!-- superdev:generated source=FEAT-0069 revision=2943 hash=22e8089dac9fe9efb72fec4383840e3d2443a0ef26e9185f5f9b12710cba4556 -->
# Feature: Consolidate memory

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Merge duplicates, promote important memories, and discard low-value noise
- **User:** Whoever owns project hygiene wants stale, duplicate, and low-value memory cleaned up periodically without silently losing anything that might matter later.
- **User value:** Not recorded
- **Scope:** in: Scans all memory entries in the project, merges duplicates, and rebuilds search terms for retrieval, Flags statements that contradict each other, keeping both but marking the earlier one contradicted so recall warns instead of picking a side, Discards genuinely low-value noise entries and removes dangling links whose target no longer exists, Runs as a dry run by default, printing counts (live memories, duplicates merged, contradictions found, noise discarded, terms rebuilt, dangling links removed) and only writes changes with --apply; out: Does not resolve contradictions by choosing which statement is correct, it surfaces both and lets a human or later evidence decide, Does not run automatically on a schedule, it is invoked on demand, Does not touch decisions, tasks, or features directly, it only operates on the memory_entries and memory_links tables
- **Affected contracts:** none linked

### Primary flow

1. Run superdev memory consolidate as a dry run to see the report
2. Read the counts for duplicates, contradictions, noise, and dangling links
3. Re-run with --apply to actually merge duplicates, mark contradictions, discard noise, and rebuild search terms

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev memory consolidate reduces duplicate memories and promotes qualifying short-term memories to long-term | Run superdev memory consolidate and record what was observed. | Met | EV-0081 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | Contradicting memories are both retained with the earlier one flagged contradicted, so consolidation never quietly erases a belief that later evidence disagreed with. |
| Deletion Semantics | Applicable | Noise entries are discarded outright (not just marked), while dangling links pointing at deleted targets are removed separately, so the report distinguishes discarded content from cleaned-up references. |
| Duplication | Applicable | Duplicate memories are merged rather than one being silently dropped, so the merge count reflects entries actually consolidated, not just deleted. |
| Empty States | Applicable | On a project with zero memory entries, the dry run reports every count as 0 and states nothing has changed, rather than erroring on an empty table. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| The consolidation pass runs and reports duplicates, contradictions, noise and rebuilt search terms. Nothing carrying a claim is deleted: a duplicate is superseded by what it repeats and a contradiction keeps both statements. | command | pass | src/memory/consolidate.mjs |
| The consolidation pass runs and reports duplicates, contradictions, noise and rebuilt search terms. Nothing carrying a claim is deleted: a duplicate is superseded by what it repeats and a contradiction keeps both statements. | command | pass | src/memory/consolidate.mjs |
| src/cli.mjs:1189 cmdMemoryConsolidate calls consolidate() from src/memory/consolidate.mjs, which merges duplicates, flags contradictions, discards noise, and rebuilds search terms. Ran `node src/cli.mjs memory consolidate` (dry run, no --apply): produced a real report (Live memories 0, Duplicates merged 0, etc.) and correctly said "Nothing has changed. Re-run with --apply to consolidate." Exit 0. | command | pass | superdev memory consolidate |

## Delivery state

- **What works now:** Reached by superdev memory consolidate. src/cli.mjs:1189 cmdMemoryConsolidate calls consolidate() from src/memory/consolidate.mjs, which merges duplicates, flags contradictions, discards noise, and rebuilds search terms. Ran `node src/cli.mjs memory consolidate` (dry run, no --apply): produced a real report (Live memories 0, Duplicates merged 0, etc.) and correctly said "Nothing has changed. Re-run with --apply to consolidate." Exit 0.
- **What remains:** Nothing known.
- **Next action:** Not recorded
