<!-- superdev:generated source=MOD-0007 revision=4066 hash=e88e71b8359d7380cd2320055106ecdb2c4f20c235d151624f71b9266e7281a8 -->
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
| #/activity | Activity And Memory | What happened, newest first, and what earlier sessions recorded | - | Activity And Memory |
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

| Action | Path |
|---|---|
| Open a memory | Activity And Memory -> no handler recorded -> no side effects recorded |
| Search the timeline | Activity And Memory -> no handler recorded -> no side effects recorded |

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
| 1 | Pages and surfaces | Filled | One live surface, Activity and Memory at #/activity. The standalone Memory surface is retired. |
| 2 | UI composition | Filled | One area: ui/src/views/activity.tsx, labelled Activity And Memory, on the shared app-shell. It is built from the ui primitives with the shell figures for the counts, and shows the activity log and the memory entries against one timeline, because a memory without the work it came from is unreadable. |
| 3 | Actions | Filled | Two recorded actions on Activity and Memory; searching, verifying, consolidating and superseding are commands. |
| 4 | API surface | Filled | Eight operations: resume and resume --end, memory search, show, verify, consolidate, supersede and status. |
| 5 | Data | Filled | Four entities: memory entries, the links between them, their search terms and their optional embeddings. |
| 6 | End-to-end wiring | Filled | Proven by journey: a memory written in one session is retrieved by search in the next, and a handoff survives context compaction. |
| 7 | State machines | Filled | Two. A memory entry's epistemic status is one of confirmed, inferred, assumed, unknown, contradicted or declined, opening at inferred, and consolidation is what moves it. An embedding runs pending to ready, stale or failed. AU-002 warns that nothing in src moves an embedding, because no embedding worker ships yet, so a queued embedding stays pending and the column is the contract that one will fill. |
| 8 | Events | Filled | Consolidation and verification append activity events, and superseding leaves the original readable with its replacement named. |
| 9 | Edge cases | Filled | Twenty-eight across the seven features, including unverified agent output offered as fact, a memory that contradicts an accepted decision, and embeddings being unavailable. |
| 10 | UI states | Filled | The five shared states in ui/src/components/shell/states.tsx: Loading, Empty, Error, Stale and Offline. Principle I of DESIGN_DIRECTION.md requires each to carry a title, an explanation of what happened and an action, so a bare spinner, a blank region or the word None is a defect. Views import these rather than writing their own. A project whose memory has not been consolidated yet shows Empty naming what consolidates it, not a spinner. |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Filled | Tailwind breakpoints, no separate mobile build. Summary tiles run one column, then sm:grid-cols-2, then lg:grid-cols-3. The shell navigation collapses behind md:hidden below md and opens as a sheet. Wide tables and diagrams scroll inside their own container so the page body never scrolls sideways. The timeline goes from two columns to one below md, keeping the time gutter inline rather than dropping it. |
| 16 | User-facing copy | Filled | A memory reads with how it was verified, so an unverified claim is never presented as a settled one. |
| 17 | URL state and deep links | Filled | Hash routing from ui/src/lib/route.ts, with no router library. The hash is #/view or #/view/record, so the view and the open record are both in the address bar and can be copied to somebody else. An unknown view falls back to overview. Filters and the selected tab are component state and deliberately not in the URL, because a stale filter in a shared link reads as missing data. A memory entry is deep-linked as #/activity/MEM-0001. |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | Retrieval is targeted rather than whole-database, which NFR-0003 requires, and the handoff path is exercised before every release. |
