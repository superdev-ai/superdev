<!-- superdev:generated source=MOD-0005 revision=3969 hash=fdb89af2633ec08c98b93b3d8b84cca482b585e96cd7eed96f36ef9c1e23e84e -->
# Module: Decisions, Changes, and Questions

- **Status:** Planned
- **Purpose:** Records, supersedes, and applies architectural and product decisions, tracks accepted scope changes, and manages unresolved questions and their assumptions.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| - | Blueprint | Provides an interactive relationship canvas covering Product, Goals, Milestones, Modules, Features, Workflows, Tasks, Integrations, APIs, Schemas, and Decisions. | - | Blueprint |
| - | Decisions | Required area of the control center showing decisions made. Also appears as one of the entity types on the Blueprint canvas. | - | Decisions |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev decision list superdev decision list | List decisions. | superdev decision list |
| superdev decision record superdev decision record | Record a new decision. | superdev decision record |
| superdev decision supersede <DECISION-id> superdev decision supersede <DECISION-id> | Supersede an existing decision. | superdev decision supersede <DECISION-id> |
| superdev question answer <QUESTION-id> superdev question answer <QUESTION-id> | Answer an open question. | superdev question answer <QUESTION-id> |
| superdev question list superdev question list | List open questions. | superdev question list |
| superdev sync --dry-run superdev sync --dry-run | Preview what a synchronization would change without applying it. | superdev sync --dry-run |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| applied_migrations | owner | applied_migrations |
| assumptions | owner | assumptions |
| decisions | owner | decisions |
| questions | owner | questions |

## Wiring (key actions end to end)

| Action | Path |
|---|---|
| Automatic organization by relationship | Blueprint -> no handler recorded -> no side effects recorded |
| Connected-path highlighting | Blueprint -> no handler recorded -> no side effects recorded |
| Deselecting on empty-canvas click | Blueprint -> no handler recorded -> no side effects recorded |
| Dragging | Blueprint -> no handler recorded -> no side effects recorded |
| Fullscreen | Blueprint -> no handler recorded -> no side effects recorded |
| Network highlighting | Blueprint -> no handler recorded -> no side effects recorded |
| Opening the selected record | Blueprint -> no handler recorded -> no side effects recorded |
| Pan | Blueprint -> no handler recorded -> no side effects recorded |
| Persisting user layout separately from product truth | Blueprint -> no handler recorded -> no side effects recorded |
| Relationship filters | Blueprint -> no handler recorded -> no side effects recorded |
| Search | Blueprint -> no handler recorded -> no side effects recorded |
| Selection | Blueprint -> no handler recorded -> no side effects recorded |
| Zoom | Blueprint -> no handler recorded -> no side effects recorded |

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | If every question in the database has been answered, question list would report a count of 0 with no entries printed, since only open questions are shown.; When no decision has been recorded yet, the command returns "No decision has been recorded yet." instead of an empty table.; A prompt shorter than 12 characters is skipped entirely, since too short a prompt cannot carry enough real subject words to match safely. | List open questions, Supersede a decision, List decisions, Guard against silent decision overrides |
| Boundary Values | With exactly one open question, the header still reads Questions (1) and prints that single entry, no special-casing to singular text.; A decision with no expiry date shows a blank expiry cell rather than a placeholder value or an error.; Exactly one shared subject word between prompt and decision is treated as coincidence and produces no warning, the floor is two shared words. | List open questions, List decisions, Guard against silent decision overrides |
| Invalid Input | Missing --answer text is refused with a message that an answer needs text, before touching the database.; Omitting --title is refused with a message that a decision needs a title in plain language so it can be found again.; Passing --partial without --scopeDelta is rejected before anything is written, because a partial supersession without a stated scope delta would leave nobody able to tell what still governs. | Answer a question, Record a decision, Supersede a decision |
| State Machine Violations | Answering a question that is already answered is refused with an E_ALREADY_ANSWERED error that includes the existing answer, rather than overwriting it.; Every new decision starts at status Proposed regardless of its content, there is no way to record one as already Decided through this command.; Superseding a decision that already has a superseded_by_id fails with an error naming the existing replacement, rather than creating a second competing replacement. | Answer a question, Record a decision, Supersede a decision |
| Ordering | This check runs even on prompts classified as questions, since a decision already in force is worth surfacing even when the phrasing reads as a question rather than a command. | Guard against silent decision overrides |
| Duplication | When more than three decisions match, only the three with the most shared words are shown, so the warning stays short rather than listing every decision in a broad subject area. | Guard against silent decision overrides |
| Limits And Quotas | The 'What they govern' breakdown only covers the first 8 decisions in the list even if more are returned, to keep the summary short. | List decisions |
| Versioning | Without --all, superseded and deprecated decisions drop out of the list entirely once replaced, so the default view always reflects only what currently governs, not the full history. | List decisions |
| Consistency | N/A - The list is read directly from the database on each run, so it cannot show a stale count relative to the questions table. | List open questions |
| Auditability | Both decisions remain queryable afterward: the old one keeps its original content with a superseded status and a reason, the new one stands as its own record, so the reasoning trail survives. | Supersede a decision |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | Two live surfaces: Decisions, and the Blueprint canvas where the architecture is laid out. |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Filled | Thirteen recorded actions on Blueprint covering laying out and opening records; Decisions is a read surface where every write is a command. |
| 4 | API surface | Filled | Six operations: listing and answering questions, recording, superseding and listing decisions, and the sync dry run. |
| 5 | Data | Filled | Four entities: questions, assumptions, decisions and applied migrations. |
| 6 | End-to-end wiring | Filled | Proven by journey: a decision recorded by command appears on the Blueprint and in the decisions in force that every session is handed. |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Filled | Decisions leave a transition row as well as an activity event, so superseding preserves the original and its reason rather than rewriting it. |
| 9 | Edge cases | Filled | Nineteen across the six features, including a decision superseded by one that contradicts it and an assumption that outlived what it assumed. |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Filled | A superseded decision reads with its replacement named, which is what makes a correction different from a rewrite of the past. |
| 17 | URL state and deep links | Open | Not recorded |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | FEAT-0079 guards against silent decision overrides, and the decisions in force are re-read at the start of every session. |
