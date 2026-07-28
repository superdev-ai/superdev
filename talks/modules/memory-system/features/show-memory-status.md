<!-- superdev:generated source=FEAT-0071 revision=2943 hash=5305715ea8c428523632f630daeabbf885f69763b53afba951a8b3ffcffe2ff3 -->
# Feature: Show memory status

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Report overall memory system health and size
- **User:** A developer or agent wants a quick read on how big the memory system has grown and whether it is actually being used for recall, without digging into the database directly.
- **User value:** Not recorded
- **Scope:** in: counts total memories, live (non-superseded) memories, and superseded ones, reports how many live memories are indexed for lexical search versus not, breaks memories down by kind and by epistemic status, states plainly whether semantic (embedding-based) retrieval is in use; out: does not run consolidation or fix anything it reports as wrong, that is a separate command (memory consolidate --apply), does not show individual memory contents, only counts and categories, does not decide whether semantic retrieval should be turned on, only reports the current state
- **Affected contracts:** none linked

### Primary flow

1. run superdev memory status
2. read Held, Current, Superseded and Findable-by-search counts
3. read the by-kind and by-epistemic-status breakdowns
4. read the retrieval stages list and the semantic-retrieval note

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev memory status reports counts by type and epistemic status | Run superdev memory status and record what was observed. | Met | EV-0083 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | when live memories exist but have no search terms, the command surfaces the exact count not indexed for search and tells the reader to run memory consolidate --apply to fix it, rather than silently under-reporting recall coverage. |
| Dependency Failure | Applicable | when no embeddings are stored, semantic retrieval is reported as not in use with the reason (no provider decision made yet), rather than a generic unavailable message. |
| Empty States | Applicable | on a fresh project with zero memories, all counts print as 0 and the byKind/byStatus blocks are omitted since their arrays are empty; the report still prints cleanly with no error. |
| Versioning | Not Applicable | N/A - the report reads current live data on each call; there is no versioned snapshot of memory status to reconcile. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Memory status reports counts by kind and epistemic state, how many entries are findable by search, and says plainly that semantic retrieval is not in use and would be a bounded scan rather than indexed vector search, which section 15.11 requires. | command | pass | src/memory/consolidate.mjs |
| Memory status reports counts by kind and epistemic state, how many entries are findable by search, and says plainly that semantic retrieval is not in use and would be a bounded scan rather than indexed vector search, which section 15.11 requires. | command | pass | src/memory/consolidate.mjs |
| src/cli.mjs:1223 cmdMemoryStatus calls memoryStatus() from src/memory/consolidate.mjs. Ran `node src/cli.mjs memory status`: printed an accurate real report (Held 0, Current 0, Superseded 0, Findable by search 0 of 0, Links to records 0, plus a note that semantic retrieval is not in use per an open decision). This correctly reflects the live, empty memory_entries table. | command | pass | superdev memory status |

## Delivery state

- **What works now:** Reached by superdev memory status. src/cli.mjs:1223 cmdMemoryStatus calls memoryStatus() from src/memory/consolidate.mjs. Ran `node src/cli.mjs memory status`: printed an accurate real report (Held 0, Current 0, Superseded 0, Findable by search 0 of 0, Links to records 0, plus a note that semantic retrieval is not in use per an open decision). This correctly reflects the live, empty memory_entries table.
- **What remains:** Nothing known.
- **Next action:** Not recorded
