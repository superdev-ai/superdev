<!-- superdev:generated source=MOD-0008 revision=4066 hash=80fafcf246fcd35787a2d4c8a81b7d66fc558b28fd96bd195aa479779853ba5a -->
# Module: Hooks and Session Continuity

- **Status:** Planned
- **Purpose:** Runs lifecycle hooks at session start, prompt submit, post tool use, pre compact, and session end to keep the active task, decisions, blockers, and next action current, with command-based fallback when hooks are unavailable.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| #/team | Team And Agents | Who and what has worked on this project, and what they hold | - | Team And Agents |

## API surface

No API operations recorded.

## Data

| Entity | Role in module | Doc |
|---|---|---|
| activity_events | owner | activity_events |
| decision_transitions | owner | decision_transitions |
| work_sessions | owner | work_sessions |

## Wiring (key actions end to end)

| Action | Path |
|---|---|
| Read a session | Team And Agents -> no handler recorded -> no side effects recorded |

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | with no project database in the directory, the hook reports no project database and tells the reader to run superdev init, rather than failing silently or crashing the session.; If there is no live session to end, preparePacket returns null and the hook does nothing, there is nothing to close.; If no project database exists yet, the hook returns immediately with no message, since there is nothing to check a claim or a decision against; If no project database exists, or the session has already ended, both hooks return an empty result immediately rather than writing a packet; coverageNote() returns null and nothing is printed when the detected harness has full hook coverage for every lifecycle point | Restore context at session start, Record session outcome at session end, Detect work that maps to no task, Hand off before context is lost, Work without hooks at all |
| Boundary Values | The touched-paths list is capped at 40 entries (MAX_TOUCHED); further distinct paths in the same window are not added but the total edit count still increments | Record what a tool run touched |
| Invalid Input | With no active session and no --session id supplied, it refuses with a named error (E_NO_ACTIVE_SESSION) telling the caller to pass --session <SES-id>, rather than ending nothing silently.; An empty prompt is still treated as product work (changesProduct defaults true when there is no text), so the warning still fires rather than being skipped on empty input | End a resumed session, Detect work that maps to no task |
| Permission Boundaries | A file path resolving outside the project root, or inside .superdev/, is silently dropped rather than recorded, since an absolute path outside the project is not this project's history | Record what a tool run touched |
| State Machine Violations | A prior bug passed the wrong argument shape to endSession so every --end run reported the session id as the literal string '[object Object]' and never actually ended anything; this is fixed and verified in an isolated scratch project, where ending printed the real session id and Status Ended.; Calling endSession on a session that already has an ended_at timestamp returns the existing session unchanged rather than writing a second close over it. | End a resumed session, Record session outcome at session end |
| Concurrent Actions | A rate limit (ACTIVITY_INTERVAL_MS, 5 minutes) means a burst of edits within the window is folded into one activity event rather than one per edit, keeping the timeline readable | Record what a tool run touched |
| Ordering | Without --apply, the command only describes what would be ended and does not touch the session row, so running --end repeatedly without --apply never changes state, only --apply does.; A decision match is checked and reported even when the prompt reads as a pure question, because reading a decision and then acting on it is the common path | End a resumed session, Detect work that maps to no task |
| Duplication | Entries already written for this session (matched by source_ref) are excluded from the next packet, so a session that compacts several times does not repeat the same blocker or decision each time | Detect work that maps to no task, Hand off before context is lost |
| Dependency Failure | if starting the session record itself fails, the hook still returns valid output, logging that the session was not recorded and pointing to superdev resume rather than aborting the whole session-start flow.; If memory consolidation throws, the error is caught and consolidation is treated as skipped, the session end itself still proceeds and writes its outcome and released claims.; skills-sh has no hook mechanism at all, so every one of the 16 lifecycle points is command-only there by design, not by gap | Restore context at session start, Record session outcome at session end, Work without hooks at all |
| Slow Paths | all work is raced against a 3500 ms budget with a synchronous write before exit, so a slow database or slow git call cannot hold the harness open past that bound. | Restore context at session start |
| Recovery | A process killed before SessionEnd fires leaves the session without an ended_at, and the product does not treat a missing SessionEnd as proof the session is still live, since hooks are never trusted as the sole evidence something happened.; SessionEnd is not guaranteed to fire on a killed process; the design deliberately does not depend on it, since the next session's start re-derives everything from the database | Record session outcome at session end, Hand off before context is lost |
| Limits And Quotas | Decisions, blockers, scope changes and pending documentation are each capped at PACKET_LIMIT entries per packet, since each is already its own authoritative record and the memory entry is only a pointer for recall | Hand off before context is lost |
| Platform Variance | codex is treated as command-driven for every lifecycle point until a first-party source confirms a trusted session-lifecycle hook fires, since only PreToolUse for shell commands has been verified there | Work without hooks at all |
| Versioning | PostToolBatch is listed as an unverified event: hooks.mjs still answers it so a harness that does emit it behaves correctly, but hooks.json does not wire it and no lifecycle point is credited to it | Work without hooks at all |
| Consistency | flushTouched() records nothing when there is no live session to attribute the work to, or no project database yet, leaving the marker file intact for the next flush attempt | Record what a tool run touched |
| Auditability | An optional --note is stored against the session end record, giving a human-readable reason for why the session closed when one is supplied. | End a resumed session |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | One live surface, Team and Agents at #/team. The module is otherwise invoked by the harness rather than opened. |
| 2 | UI composition | Filled | One area: ui/src/views/team.tsx, labelled Team And Agents, on the shared app-shell, built from the ui table, badge and tooltip primitives with components/shell/status.tsx for the live session indicator. It shows developers, agents, branches and work sessions together, because the question it answers is who and what is touching this project right now. |
| 3 | Actions | Filled | One recorded action on Team and Agents; every other trigger is a harness lifecycle event. |
| 4 | API surface | Filled | The contract is the harness hook set: session start, prompt submit, post tool use, pre compact and session end, with a command-based fallback for harnesses that support no hooks at all. |
| 5 | Data | Filled | Three entities: work sessions, decision transitions and activity events. |
| 6 | End-to-end wiring | Filled | Proven by journey: a session start restores the active task, decisions in force and blockers, and a session end records the outcome. |
| 7 | State machines | Filled | Four. A work session runs active to compacted, handed_off or ended. A branch runs active to merged or abandoned. A developer and an agent each run active to inactive. AU-002 warns that nothing in src moves a branch, so a branch stays active after it is merged and the active-branch count never falls, which is what the Team area counts. |
| 8 | Events | Filled | This module is where events are produced: every tool run records what it touched, attributed to the session that ran it and bounded by age rather than by count. |
| 9 | Edge cases | Filled | Twenty-seven across the seven features, including a harness with no hooks, work that maps to no task, and context lost before a handoff was written. |
| 10 | UI states | Filled | The five shared states in ui/src/components/shell/states.tsx: Loading, Empty, Error, Stale and Offline. Principle I of DESIGN_DIRECTION.md requires each to carry a title, an explanation of what happened and an action, so a bare spinner, a blank region or the word None is a defect. Views import these rather than writing their own. A session that has gone quiet is shown through the Stale state with when it was last seen, rather than being silently dropped from the list. |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Filled | Tailwind breakpoints, no separate mobile build. Summary tiles run one column, then sm:grid-cols-2, then lg:grid-cols-3. The shell navigation collapses behind md:hidden below md and opens as a sheet. Wide tables and diagrams scroll inside their own container so the page body never scrolls sideways. The session table drops its branch and revision columns below md and keeps who, what and when. |
| 16 | User-facing copy | Filled | The session start block names the active task, the decisions in force and the next action, and says plainly when no task is claimed. |
| 17 | URL state and deep links | Filled | Hash routing from ui/src/lib/route.ts, with no router library. The hash is #/view or #/view/record, so the view and the open record are both in the address bar and can be copied to somebody else. An unknown view falls back to overview. Filters and the selected tab are component state and deliberately not in the URL, because a stale filter in a shared link reads as missing data. A session is deep-linked as #/team/SES-0001. |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | src/runtime/hooks.test.mjs asserts the attribution rules, and the no-hooks fallback is exercised before every release. |
