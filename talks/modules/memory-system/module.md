<!-- superdev:generated source=MOD-0007 revision=2942 hash=f8ece1feb5ba031594b60574ae2ea18461e7c87f4cd482376f22382d5cf4182c -->
# Module: Memory System

- **Status:** Planned
- **Purpose:** Captures, verifies, retrieves, and consolidates short-term and long-term memory such as decisions, learned facts, blockers, and handoffs, so context survives across sessions and agent handoffs.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| - | Memory | Required area of the control center showing memory records. | - | Memory |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev memory consolidate superdev memory consolidate | Consolidate memory records. | superdev memory consolidate |
| superdev memory search "<topic>" superdev memory search "<topic>" | Search memory records for a topic. | superdev memory search "<topic>" |
| superdev memory show <MEMORY-id> superdev memory show <MEMORY-id> | Show the detail of one memory record. | superdev memory show <MEMORY-id> |
| superdev memory status superdev memory status | Report memory system status. | superdev memory status |
| superdev memory supersede <MEMORY-id> superdev memory supersede <MEMORY-id> | Supersede a memory record. | superdev memory supersede <MEMORY-id> |
| superdev memory verify <MEMORY-id> superdev memory verify <MEMORY-id> | Verify a memory record. | superdev memory verify <MEMORY-id> |
| superdev resume superdev resume | Reconstruct current work from the database, repository, decisions, evidence, and verified memory. | superdev resume |
| superdev resume --end superdev resume --end | Close out the current session: record its outcome, release or retain the task assignment, update task state and revision, consolidate short term memory, and record the handoff. | superdev resume --end |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| memory_embeddings | owner | memory_embeddings |
| memory_entries | owner | memory_entries |
| memory_links | owner | memory_links |
| memory_search_terms | owner | memory_search_terms |

## Wiring (key actions end to end)

No actions recorded, so no end-to-end path can be asserted.

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | When nothing in memory_entries matches the search text, the command returns "Nothing recorded matches \"<text>\"." instead of an empty table or an error.; A memory with no links prints no 'It concerns' section at all rather than an empty bulleted list.; A memory with no links and no verification evidence to check against falls back to unverifiable rather than being reported as verified by default.; On a project with zero memory entries, the dry run reports every count as 0 and states nothing has changed, rather than erroring on an empty table.; on a fresh project with zero memories, all counts print as 0 and the byKind/byStatus blocks are omitted since their arrays are empty; the report still prints cleanly with no error.; If there is no live session, or no project database exists yet, preparePacket returns null and the hook does nothing rather than opening a session it cannot attribute the packet to. | Search memory, Show a memory, Verify a memory, Consolidate memory, Supersede a memory, Show memory status, Create a handoff before context compaction |
| Invalid Input | Calling the command with no search text at all is rejected with a usage error telling the caller to say what to look for, before any query runs.; Requesting a memory id that does not exist refuses cleanly with "There is no memory <id>." and exit code 2, rather than crashing or returning empty fields.; Verifying an id that does not exist in memory_entries refuses with "Memory <id> does not exist." and a non-zero exit, rather than producing a fabricated verdict.; Omitting --by is rejected with a usage error asking which memory replaces it, before anything runs, whether or not --apply is passed. | Search memory, Show a memory, Verify a memory, Supersede a memory |
| State Machine Violations | A memory already marked superseded is expected to short-circuit toward a non-verified verdict via its superseded_by field before the linked-record comparison even runs. | Verify a memory |
| Ordering | Results are not returned in insertion order, they are reordered by the scorer's combined term-coverage, recency-half-life, and kind or status weighting, so the most relevant entry can outrank a more recent one. | Search memory |
| Duplication | Duplicate memories are merged rather than one being silently dropped, so the merge count reflects entries actually consolidated, not just deleted.; A session that compacts many times only ever writes each decision, blocker, scope change and pending document entry once, tracked by source reference, so repeated compactions do not bloat memory with the same facts. | Consolidate memory, Create a handoff before context compaction |
| Dependency Failure | when no embeddings are stored, semantic retrieval is reported as not in use with the reason (no provider decision made yet), rather than a generic unavailable message. | Show memory status |
| Data Migration States | A project whose work sessions have never ended or compacted has zero rows in memory_entries, so every search returns the no-match message, not because search is broken but because nothing has been written to memory yet.; In a project where no memory has ever been written, every id lookup hits the not-found path since the underlying table is empty, which is expected given the write path only fires on session compact or end. | Search memory, Show a memory |
| Recovery | If the session was already ended by the time PreCompact fires, the packet is not written, since there is nothing left to hand off from a session that already closed. | Create a handoff before context compaction |
| Limits And Quotas | Each category of entry (decisions, blockers, scope changes, pending docs) is capped at a fixed packet limit per compaction, since the authoritative record already lives in its own table and the memory entry is only a pointer for recall. | Create a handoff before context compaction |
| Versioning | N/A - the report reads current live data on each call; there is no versioned snapshot of memory status to reconcile. | Show memory status |
| Deletion Semantics | A superseded memory is still fully shown, its content and links intact, with the superseding memory's id displayed rather than the record being hidden or removed.; Noise entries are discarded outright (not just marked), while dangling links pointing at deleted targets are removed separately, so the report distinguishes discarded content from cleaned-up references.; Superseding keeps the old memory fully intact and queryable, since the design intent stated in the plan text is that a memory believed and later found wrong is worth knowing, not worth losing. | Show a memory, Consolidate memory, Supersede a memory |
| Consistency | When a linked task, feature, or decision has moved on since the memory recorded its fingerprint or version, the mismatch drives the verdict toward contradicted or needs_review rather than a stale verified result.; Contradicting memories are both retained with the earlier one flagged contradicted, so consolidation never quietly erases a belief that later evidence disagreed with.; when live memories exist but have no search terms, the command surfaces the exact count not indexed for search and tells the reader to run memory consolidate --apply to fix it, rather than silently under-reporting recall coverage. | Verify a memory, Consolidate memory, Show memory status |
| Auditability | The dry run and applied run both name which memory is being replaced and which replaces it, so the plan text alone documents the change before it is committed. | Supersede a memory |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Open | Not recorded |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Open | Not recorded |
| 4 | API surface | Open | Not recorded |
| 5 | Data | Open | Not recorded |
| 6 | End-to-end wiring | Open | Not recorded |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Open | Not recorded |
| 9 | Edge cases | Open | Not recorded |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Open | Not recorded |
| 12 | Accessibility | Open | Not recorded |
| 13 | Internationalization | Open | Not recorded |
| 14 | Feature flags | Open | Not recorded |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Open | Not recorded |
| 17 | URL state and deep links | Open | Not recorded |
| 18 | Performance | Open | Not recorded |
| 19 | Discoverability and SEO | Open | Not recorded |
| 20 | Compliance and product tests | Open | Not recorded |
