<!-- superdev:generated source=MOD-0004 revision=3969 hash=60a21c3388c30a1eb60776ac042abf6920be903ee3569242092bcb8611be5ce4 -->
# Module: Task and Implementation Lifecycle

- **Status:** Planned
- **Purpose:** Creates, assigns, starts, blocks, verifies, completes, cancels, and reopens tasks and subtasks, enforcing that implementation only proceeds against an accepted feature and contract with satisfied dependencies.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| - | Activity | Required area of the control center showing activity. Serves as a drill-down destination from Tasks. | - | Activity |
| - | Evidence | Required area of the control center showing evidence records. Serves as a drill-down destination from Tasks. | - | Evidence |
| - | Tasks | Required area of the control center for managing tasks. | - | Tasks |
| #/test-plans | Test Plans | How each feature and the product itself is verified, and whether it has run | - | Test Plans |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev derive superdev derive | Derive tasks from the accepted product model. | superdev derive |
| superdev task block <TASK-id> superdev task block <TASK-id> | Mark a task as blocked. | superdev task block <TASK-id> |
| superdev task cancel <TASK-id> superdev task cancel <TASK-id> | Cancel a task. | superdev task cancel <TASK-id> |
| superdev task claim <TASK-id> superdev task claim <TASK-id> | Claim a task for work. | superdev task claim <TASK-id> |
| superdev task complete <TASK-id> superdev task complete <TASK-id> | Mark a task complete. | superdev task complete <TASK-id> |
| superdev task create superdev task create | Create a new task. | superdev task create |
| superdev task evidence <TASK-id> superdev task evidence <TASK-id> | Attach evidence to a task. | superdev task evidence <TASK-id> |
| superdev task list superdev task list | List tasks. | superdev task list |
| superdev task release <TASK-id> superdev task release <TASK-id> | Release a claimed task. | superdev task release <TASK-id> |
| superdev task reopen <TASK-id> superdev task reopen <TASK-id> | Reopen a previously closed task. | superdev task reopen <TASK-id> |
| superdev task show <TASK-id> superdev task show <TASK-id> | Show the detail of one task. | superdev task show <TASK-id> |
| superdev task start <TASK-id> superdev task start <TASK-id> | Start work on a claimed task. | superdev task start <TASK-id> |
| superdev task unblock <TASK-id> superdev task unblock <TASK-id> | Clear a task's blocked state. | superdev task unblock <TASK-id> |
| superdev task update <TASK-id> superdev task update <TASK-id> | Update a task. | superdev task update <TASK-id> |
| superdev verify <TASK-id> superdev verify <TASK-id> | Verify a task's completion evidence. | superdev verify <TASK-id> |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| agents | owner | agents |
| branches | owner | branches |
| developers | owner | developers |
| integrations | owner | integrations |
| task_assignments | owner | task_assignments |
| task_contract_links | owner | task_contract_links |
| task_dependencies | owner | task_dependencies |
| tasks | owner | tasks |
| verification_evidence | owner | verification_evidence |

## Wiring (key actions end to end)

| Action | Path |
|---|---|
| Adding Dependencies | Tasks -> no handler recorded -> no side effects recorded |
| Adding Evidence | Tasks -> no handler recorded -> no side effects recorded |
| Adding Subtasks | Tasks -> no handler recorded -> no side effects recorded |
| Assigning developers and agents | Tasks -> no handler recorded -> no side effects recorded |
| Blocking Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Cancelling Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Categorizing Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Claiming Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Completing Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Creating Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Deleting, only when safe and allowed by history policy | Tasks -> no handler recorded -> no side effects recorded |
| Editing Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Filtering by Feature, status, category, owner, branch, and milestone | Tasks -> no handler recorded -> no side effects recorded |
| Reopening Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Starting Tasks | Tasks -> no handler recorded -> no side effects recorded |
| Record a run carried out by hand | Test Plans -> no handler recorded -> no side effects recorded |
| Run a plan | Test Plans -> no handler recorded -> no side effects recorded |

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | With zero accepted features or a feature that needs no new tasks, it prints 'Deriving every accepted feature: 0 tasks to create, 0 to update, 0 to supersede' and does nothing on --apply.; With no ready tasks, the Ready Tasks table is empty and Next Action falls back to whatever the project's next non-task step is, such as onboarding or acceptance.; A milestone with no features assigned still appears in the milestones table but is flagged elsewhere (via doctor's alignment warnings) as having no features, plan itself just shows it with its status and no feature rows.; No task matching the current filter prints a plain no-task-matches-that-filter line instead of an empty table.; A task with no active assignment shows assignment as null rather than a stale or fabricated holder; one with no evidence or history rows returns empty lists for those sections instead of erroring; A task created with no --link at all is allowed to land in draft; the dry-run preview shows Implements as 'nothing yet'; Releasing with no --reason is accepted, the activity summary falls back to a generic 'Assignment on <id> released' note; a task with no stated verification requirement and no evidence at all is still refused, with a message that nothing shows it is done, so an empty contract cannot complete for free.; running derive against this project's own feature set, which is currently all draft, correctly reports 0 tasks to create, 0 to update and 0 to supersede for every feature, since none are accepted yet.; a project with no current evidence returns all-zero counts across every column and exits 0.; When no project database exists yet at the session's working directory, the hook returns immediately with no warning, since there is nothing to check a task against. | Derive initial implementation tasks, Resume prior work, Produce a delivery plan, List tasks, Show a task, Create a task, Release a task, Complete a task, Derive tasks from the product model, Verify a task, Detect unlinked work at prompt time |
| Boundary Values | An empty prompt is treated as changing the product by default, so the warning path still runs rather than silently passing an empty string through the question check.; A file path outside the project root, or one starting with the project's own runtime state directory, is dropped rather than recorded, since it either belongs to a different project or is Superdev's own bookkeeping. | Detect unlinked work at prompt time, Track touched files during work |
| Invalid Input | Passing the feature id as --feature=X instead of positionally is refused with a UsageError explaining that as a flag it is read as a value, not a positional id, and every accepted feature would be derived instead of one.; An unrecognized --status value is not validated against known statuses, it is just used directly in the filter, so it silently returns zero rows rather than erroring with the list of valid statuses.; Passing an id that does not exist prints 'There is no task <id>. Run task list to see what exists.' rather than a raw database error; Missing --feature or --name throws a usage error naming exactly which flag is missing, before any database write; Calling with no field flags at all is refused with 'Nothing to update. Pass at least one of --name, --description, --outcome...' before touching the database; An explicit --developer, --agent, --branch or --session id that does not exist in the project is refused by name rather than surfacing a foreign key error; Calling task block without --reason is refused with 'A blocked task needs the reason it is blocked, in plain language, so the next person can unblock it'; unblocking an id that does not exist returns a not-found error naming the id and suggesting how to find the real one, before any status logic runs.; a --result outside pass, fail or inconclusive is rejected immediately with the three valid values named, before any database write.; omitting --reason is refused before the transition runs, with a message that a cancelled task needs the reason so nobody re-derives the same work by accident.; omitting --reason is refused before the transition runs, since reopening finished work needs a stated reason.; passing the feature id as --feature instead of positional is refused outright, naming the correct form, because reading it as a flag value would silently derive every accepted feature instead of one.; a recorded command using shell punctuation, an unlisted flag, or any script other than this project's own is refused up front with a stated reason instead of being executed, for example written for a shell, so it cannot run without one, or node may only run this project's own scripts.; A prompt that matches neither a recognized question pattern nor a recognized change verb is treated as work rather than silently passed, since an unrecognized instruction is judged more likely to be a change than a question.; An identifier that is not an evidence record is refused by name, and a reason is required | Derive initial implementation tasks, List tasks, Show a task, Create a task, Update a task, Claim a task, Block a task, Unblock a task, Record task evidence, Cancel a task, Reopen a task, Derive tasks from the product model, Verify a task, Detect unlinked work at prompt time, Supersede a piece of evidence that no longer applies |
| Permission Boundaries | Claiming a task already held by someone else is refused with the holder's name and the time it was assigned, with the suggestion to ask them to release it or pick up another task | Claim a task, Unblock a task, Cancel a task |
| State Machine Violations | Without --apply, no session is opened and the output ends with an explicit note: 'No session was started. Re-run with --apply to open one,' so a dry run cannot be mistaken for an active session.; If --status is set to anything other than draft, the task still must satisfy the same transition rules a later status-move would require (for example implementing something), or the create call fails with the same explained refusal; Passing --status is refused unconditionally, directing the caller to the dedicated lifecycle commands so status changes always leave history; Claiming a task that is complete, cancelled or superseded is refused with 'is not open work. Reopen it before claiming it'; Starting a task whose current status does not allow a move to in_progress (for example one already complete) is refused, naming the statuses actually reachable from where it is; Releasing a task with no active assignment is refused with 'is not claimed by anyone, so there is nothing to release'; Blocking a task whose current status has no allowed path to blocked (per the transition table) is refused naming the reachable statuses, even though the reason has already been recorded as a memory; unblocking a task that is not currently blocked is refused with a message naming its real status: it is <status>, not blocked, so there is nothing to unblock.; completing a task that states one verification requirement but carries zero passing results is refused with the exact counts and the requirement text, and exits 1.; a task that is already complete or superseded cannot move to cancelled, since neither of those statuses lists cancelled among its allowed next states.; reopening a task that is already open (ready, in progress, blocked, and so on) is refused with a message that it is already open and there is nothing to reopen.; a task already complete, cancelled or superseded is never rewritten even if the derived text changed; only a contract-link change on that terminal task produces a new follow-on task.; If a task is claimed but its status is anything other than in_progress, the session is treated as not covering the work, and the warning still fires naming that task and telling the reader to move it to in progress first.; A task already superseded cannot be merged again, and a merge into a cancelled task is refused | Derive initial implementation tasks, Resume prior work, Produce a delivery plan, Create a task, Update a task, Claim a task, Start a task, Release a task, Block a task, Unblock a task, Complete a task, Cancel a task, Reopen a task, Derive tasks from the product model, Detect unlinked work at prompt time, Merge a duplicate task into the one that keeps the work |
| Concurrent Actions | The underlying patch takes the task's current version unless a caller supplies one, so two overlapping edits from the CLI still serialize through the same versioned update path used everywhere else; If two claims race, the database's unique index on active assignments lets only one through; the loser sees 'was claimed by X a moment before this claim' rather than a raw constraint error; A burst of edits in quick succession all merge into the same marker file entry and produce a single flushed event once the interval elapses, rather than one event per edit. | Update a task, Claim a task, Track touched files during work |
| Ordering | Milestones and modules are printed in a fixed recorded order (MS-0001 through MS-0009 as stored), not resorted by status or progress, so the same run always produces the same ordering.; the default target is read from the task's own status history: if the status right before it was blocked was in_progress, in_review or verifying it returns there, otherwise it defaults to ready.; the default destination depends on which terminal state the task was in: complete returns to in_progress, cancelled returns to ready, and --to overrides either default.; re-derivation matches existing tasks to plan items by their contract links, preferring open tasks over finished ones and parents over children, so running derive again after tasks have moved converges instead of creating duplicates. | Produce a delivery plan, Unblock a task, Reopen a task, Derive tasks from the product model |
| Duplication | Deriving twice does not duplicate tasks: the second run reports 0 to create and instead reports updates or supersessions for anything that already exists from the first run.; Starting a task that is already in_progress is a no-op, the move function returns the task unchanged when the target status equals the current one; recording a second passing result against a criterion that is already met writes the new evidence row but does not move the criterion's evidence pointer off the first passing row, since the update only fires when the criterion was not already met.; A link or dependency the survivor already has is not added twice; A record already superseded is refused rather than superseded twice | Derive initial implementation tasks, Start a task, Record task evidence, Merge a duplicate task into the one that keeps the work, Supersede a piece of evidence that no longer applies |
| Network Failure | N/A - The hook writes to a local marker file and local database only, there is no network call in this path to fail. | Track touched files during work |
| Dependency Failure | A --feature id that does not exist in the project is refused with 'Feature <id> does not exist. Create or accept the feature specification before creating work against it'; Starting a task with still-open blocking dependencies is allowed but recorded as an activity event listing which blockers were still open at the time; observed directly in this project's own database: one evidence row had node src/cli.mjs verify itself recorded as its check command; re-running it spawned the verify command again as a subprocess, which recursively spawned further copies of itself until each hit its own timeout, and the outer report correctly classified the whole thing as could not run, an error, rather than a pass or fail, and did not crash. | Create a task, Start a task, Verify a task |
| Data Migration States | N/A - The record is read directly from the tasks table as it stands now, there is no versioned or migrated view to be stale against | Show a task |
| Recovery | verified from both terminal states in this project: a completed task reopened back to in_progress, and a cancelled task reopened back to ready, each confirmed by task show afterward.; apply only marks evidence stale when the re-run actually fails; a command that could not run at all leaves that evidence's current status untouched, since an unrunnable check says nothing about whether the product itself is still correct.; If no live session exists when a flush is attempted, nothing is recorded to the database but the marker file is left untouched, so the paths survive to be picked up and flushed once a session resumes. | Reopen a task, Verify a task, Track touched files during work |
| Limits And Quotas | The --limit flag is clamped between 1 and 1000 and defaults to 200, so a value of 0 or a huge number is silently corrected rather than rejected, confirmed by passing --limit 0 and getting exactly 1 row back. | List tasks |
| Multi Device Session | The context includes developer id, agent id, and harness (for example claude-code), so a resume run identifies which developer and which agent's session it is describing when more than one could be active. | Resume prior work |
| Deletion Semantics | cancelling never removes the task, its evidence or its links, and the state is not final in the database sense, reopen can bring the same task back. | Cancel a task |
| Consistency | Git branch and head are read live from the working tree and compared against the last recorded branch head in the database, so a dirty worktree or a head that has moved since the last recorded state is visible in the output rather than silently assumed clean.; The Deriving Would count reflects live comparison against already-created tasks, so if every accepted feature already has its derived tasks, it correctly reports 0 to create rather than recounting features that already have work.; a fail recorded against a criterion that a previous pass had marked met clears that met status and its evidence pointer, so a regression retracts the earlier claim rather than leaving two contradictory records.; open subtasks, failing evidence and unmet acceptance criteria are each checked independently, and if more than one applies the refusal message concatenates all of them rather than only reporting the first problem found. | Resume prior work, Produce a delivery plan, Record task evidence, Complete a task |
| Auditability | The release writes an activity event even though task_assignments carries no version column, so the hand-back is still visible in history despite bypassing the normal versioned update path; The block reason is written as a memory entry linked to the task before the status move is attempted, so a refused transition still leaves the reason discoverable; every recorded result, whether pass, fail or inconclusive, is written as its own activity entry naming the task and the summary, so the history shows what was claimed and when regardless of outcome.; completion is only remembered as a confirmed moment after the database transaction commits, so nothing is recorded as finished that did not actually get written. | Release a task, Block a task, Record task evidence, Complete a task |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | Three live surfaces: Tasks, Evidence and Test Plans. The Activity surface is retired. |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Filled | Seventeen recorded actions, fifteen on Tasks covering claim, start, block, unblock, release, evidence, complete, cancel, reopen and merge, and two on Test Plans. |
| 4 | API surface | Filled | Fifteen operations covering the whole task lifecycle, plus derive and verify. |
| 5 | Data | Filled | Nine entities: tasks, their dependencies, contract links and assignments, plus developers, agents, branches, integrations and verification evidence. |
| 6 | End-to-end wiring | Filled | Proven by journey: a task derived from an accepted feature is claimed, started, evidenced and completed, and each move appears in the control centre without a reload. |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Filled | Every lifecycle move appends an activity event and a status history row, which is why a status can only move through its own command. |
| 9 | Edge cases | Filled | Seventy-eight across the twenty-two features, including a task that implements nothing, a blocked dependency, a superseded piece of evidence and a duplicate merged into another. |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Filled | Every refusal names the missing part and the command that supplies it, including the refusal to start a task that implements nothing. |
| 17 | URL state and deep links | Open | Not recorded |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | Eight recorded test plans, plus the assertion suite and the release conditions re-run before every release. |
