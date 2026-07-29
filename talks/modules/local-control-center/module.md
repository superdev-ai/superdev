<!-- superdev:generated source=MOD-0009 revision=3969 hash=c4f2f8cfb2205c75bfd1c7d395156bc0161c896f3af72af75fdbbc631d81c5df -->
# Module: Local Control Center

- **Status:** Planned
- **Purpose:** A local UI reading live data from the database that presents overview, product map, tasks, architecture, decisions, evidence, memory, activity, and an interactive blueprint canvas, and supports creating and managing tasks directly.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| - | APIs | Required area of the control center. Listed as a required area with no further content specified. Also appears as one of the entity types on the Blueprint canvas. | - | APIs |
| - | Architecture | Required area of the control center. Listed as a required area with no further content specified. | - | Architecture |
| - | Changes | Required area of the control center showing changes made. | - | Changes |
| - | Features | Required area of the control center showing product features. Serves as a drill-down destination from Goals, Milestones, and Modules. | - | Features |
| - | Goals | Required area of the control center showing product goals. | - | Goals |
| - | Integrations | Required area of the control center. Listed as a required area with no further content specified. Also appears as one of the entity types on the Blueprint canvas. | - | Integrations |
| - | Milestones | Required area of the control center showing milestones. | - | Milestones |
| - | Modules | Required area of the control center showing product modules. | - | Modules |
| - | Overview | Explain what the product is, who it is for, and what outcome it is pursuing. Show the current delivery stage, overall project progress, and current milestone progress. Show what works today, what is being built now, what is blocked, what is pending, and what should happen next. Every progress value shown must state what it counts. | - | Overview |
| #/readiness | Readiness | The production-readiness checklist, gap by gap | - | Readiness |
| - | Settings | Required area of the control center. Listed as a required area with no further content specified. | - | Settings |
| #/sync | Sync | What synchronization holds, and any conflict it could not resolve | - | Sync |
| - | UI Surfaces | Required area of the control center. Listed as a required area with no further content specified. | - | UI Surfaces |
| - | Workflows | Required area of the control center showing workflows. | - | Workflows |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev api show superdev api show | Show the API surface. | superdev api show |
| superdev init superdev init | Start a brand new product and run the structured interview that defines it. | superdev init |
| superdev readiness superdev readiness | Report where the product stands against the production readiness review, area by area. | superdev readiness |
| superdev restart superdev restart | Restart the local control center services. | superdev restart |
| superdev services superdev services | List the local control center services and their status. | superdev services |
| superdev start superdev start | Start the local control center services. | superdev start |
| superdev stop superdev stop | Stop the local control center services. | superdev stop |
| superdev ui superdev ui | Open the local control center dashboard. | superdev ui |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| surfaces | owner | surfaces |
| ui_actions | owner | ui_actions |

## Wiring (key actions end to end)

| Action | Path |
|---|---|
| Open a capability area | Readiness -> no handler recorded -> no side effects recorded |
| Read a conflict | Sync -> no handler recorded -> no side effects recorded |

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | On a project with no accepted features or no activity yet, progress reads 0 of N tracked items done and the Next section would name onboarding or acceptance as the next step instead of a task.; With no alignment warnings and no stale documents, Alignment and Freshness both report Pass and the Findings section is simply absent.; With every capability area answered or marked not applicable, all four buckets can read 0 and the report states plainly that every area has been answered or recorded as not applicable, rather than leaving the buckets ambiguous.; if the directory has no Superdev project yet, dashboard API calls return an error telling the user to run init, rather than an empty or broken page; when nothing is running, the command prints state Stopped with the explanation that no service is running for this project; When the service answers but no project exists yet on the machine, the page shows an empty state telling the reader to run setup, instead of rendering a blank or broken briefing.; RecordLinks renders a plain sentence supplied by the caller (the 'empty' prop) instead of an empty list when a record has no related records to link to; With no goals, milestones, modules, features, workflows or tasks yet, the canvas shows 'There is no product to map yet' with an explanation and buttons to Discovery or Overview instead of a blank canvas; A project with nothing recorded shows what to record rather than an empty chart | View project lifecycle status, Check project health, Assess production readiness, Open the local control center, List running services, View product overview dashboard, Drill down between related records, View the interactive blueprint canvas, See the shape of the project at a glance |
| Boundary Values | Alignment warnings are grouped and counted by severity (High, Medium, Low) so a project with many High findings is visually distinguishable from one with only Low ones, not just a flat count.; Doctor exits with status 1 whenever at least one check reports Problem, and exits 0 only when every check passes, so a calling hook or script can branch on exit code without parsing text.; Overall readiness can reach a high percent (for example 97 percent) while open questions remain unanswered, because the percent is computed from tracked items done versus total, and open questions are reported separately rather than being averaged into a single blended score that would hide them. | View project lifecycle status, Check project health, Assess production readiness |
| Invalid Input | parseHash falls back to the default view (overview) when the hash names a view not in the VIEWS list, and rewrites the address bar to the normalized hash rather than leaving a broken-looking URL; task.update is refused with E_INVALID_PAYLOAD when the edit form submits no changed fields at all; An option that is not one of the question's own is refused, and an empty answer is refused | Drill down between related records, Manage tasks in the control center, Answer a question by choosing from its options or typing your own |
| Permission Boundaries | a request addressed under a non-loopback host, or an API call from another origin, gets a 403 with an explanation instead of being served; a service on the port that belongs to a different project is refused rather than signalled, since it is not this project's process to stop | Open the local control center, Stop local services |
| State Machine Violations | if a lock file already shows a start in progress, a second start call reports that state back instead of racing a second process; stopping a service that is already stopped returns an already-stopped result rather than an error; restarting when nothing was running just starts fresh, because the stop step reports a no-op success instead of erroring; a leftover lock file with no live process behind it reports as stale rather than as running, so a crashed process does not read as healthy; Completing a task with open subtasks or missing evidence is refused server-side (E_OPEN_SUBTASKS and similar) and the UI shows the refusal rather than pretending it succeeded; A question already answered is refused rather than answered twice | Start local services, Stop local services, Restart local services, List running services, Manage tasks in the control center, Answer a question by choosing from its options or typing your own |
| Concurrent Actions | if a service is already running when ui is run again, it reports the existing address and pid instead of starting a second process | Open the local control center |
| Network Failure | When the overview request fails and is detected as offline, the page shows an offline state with a reconnect action rather than a generic error; other failures show a retryable error state instead.; When postMutation throws something other than an ApiError, the UI falls back to a generic message telling the user to check the service log and try again; An offline or failed read shows the Offline or ErrorState component with a reconnect action, rather than a canvas that silently shows stale or partial data | View product overview dashboard, Manage tasks in the control center, View the interactive blueprint canvas |
| Dependency Failure | Providers are reported as a ready count out of the total configured (for example 7 of 7), so a missing or misconfigured provider shows up as a fraction less than the total rather than a generic failure.; if the configured port is already held by an unrelated program or a different project's Superdev service, the state is reported as foreign rather than silently binding elsewhere; if the port is already held by a different project's Superdev service, start refuses with a foreign-service error naming the port; if the port is held by a different project's service, the stop step's foreign-service error is swallowed but the following start step hits the same foreign-port condition and fails with the same explanation; if something answers on the recorded port but its project root or instance token do not match, it is reported as foreign rather than claimed as this project's service; If only the milestone read fails while the overview read succeeds, just that one section shows an inline retryable error, the rest of the briefing still renders from the overview payload that did load. | Check project health, Open the local control center, Start local services, Restart local services, List running services, View product overview dashboard |
| Slow Paths | if the spawned process never answers /health within 15 seconds, start fails and points to the tail of the log file instead of hanging indefinitely; if the process is still answering /health after the 10 second shutdown window, stop reports failure and names the pid to kill directly rather than waiting longer; the start step still enforces its own 15 second /health timeout for the new process, so a restart whose new process never comes up fails rather than hanging | Start local services, Stop local services, Restart local services |
| Time | a lock with no port yet is read as starting for the first 20 seconds after it was created, and as stale beyond that, using the recorded start timestamp | List running services |
| Recovery | a lock file left over from a service that never finished starting (older than the 20 second grace window) is treated as stale and cleared automatically on the next start; a stale or still-starting lock with no live process behind it is cleared as a side effect of running stop, since there is nothing to signal; a stale lock left from a service that never finished starting is cleared during the stop step, the same as running stop alone, before the start step begins | Start local services, Stop local services, Restart local services |
| Multi Device Session | Because the full state (view plus record) lives in the URL hash, a link copied out of the address bar and opened elsewhere reproduces the same selection; Saved node positions live in this browser's local storage under a key scoped to the blueprint canvas, so a different browser or device sees the default layout, not this one's arrangement | Drill down between related records, View the interactive blueprint canvas |
| Platform Variance | Below tablet width the charts stack and stay readable rather than shrinking to illegibility | See the shape of the project at a glance |
| Deletion Semantics | N/A - The router does not know a record was deleted; it hands the id to the destination view, which is responsible for showing a not-found state if the record is gone | Drill down between related records |
| Consistency | When generated documentation was built from an older database revision, status flags it directly under Freshness as a documentation-behind-revision warning rather than staying silent about the mismatch.; A feature marked implemented but with an unmet acceptance criterion or an open task is flagged High severity, because the status and the underlying record disagree and one of them is wrong.; The page states explicitly when the database revision and the last event sequence disagree, meaning the rendered briefing is behind the live database, and a stale banner with a refresh action is shown.; Because the view reads three separate endpoints, it merges their freshness timestamps into one reading and shows Stale if any one of the three is behind, rather than quietly displaying the newest source next to an older one | View project lifecycle status, Check project health, View product overview dashboard, View the interactive blueprint canvas |
| Auditability | Every number shown (progress, freshness, warnings) is read live from the project database at report time and stamped with the revision and generated-at time, so two runs a minute apart can legitimately disagree.; Each open question lists a 'why it matters' line naming the specific feature it blocks, so a reader can trace an unresolved question back to the concrete capability waiting on it.; Reopening or cancelling a finished task requires a reason string, which the service stores so the next reader knows why a completed task came back | View project lifecycle status, Assess production readiness, Manage tasks in the control center |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | Ten live surfaces from Overview through Settings, Sync and Readiness; four are retired. Release condition 26 refuses a recorded surface that does not match the shipped route table. |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Open | Not recorded |
| 4 | API surface | Filled | Eight operations, plus the read model behind the control centre: one GET per view, one POST to /api/mutations with allowlisted actions, and a server-sent event stream at /api/events. |
| 5 | Data | Filled | Two entities, surfaces and their actions, which is the record of the interface itself. |
| 6 | End-to-end wiring | Filled | Proven by journey: a task created in the interface is written through /api/mutations and appears in every other open view over the event stream without a reload. |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Filled | Every mutation appends an activity event and is pushed to open clients over server-sent events, which is what keeps two views of the same record from disagreeing. |
| 9 | Edge cases | Filled | Fifty-one across the fourteen features, including a port already in use, a database that moved underneath an open client, and a mutation the allowlist refuses. |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Filled | Governed by the design direction: every number declares what it counts, with no naked figure and no naked percentage, and status is carried by glyph and label before colour. |
| 17 | URL state and deep links | Filled | Every view is a hash route, so each is deep linkable and survives a reload, and release condition 26 holds the recorded surfaces to the shipped route table. |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | 124 assertions including the state token mapping, eight validators, twenty-six release conditions, and a build check that the interface ships as one self-contained file. |
