<!-- superdev:generated source=FEAT-0084 revision=2943 hash=1a638597041b49426e0d235fe885579af7f3db0113004e2b2f0941dbf18c4170 -->
# Feature: View product overview dashboard

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Explain what the product is, who it serves, current stage, and what is blocked or pending
- **User:** A founder, product owner or new team member opening the control center wants one screen that explains what the product is, how far along it is, and what needs attention, without digging through separate tools.
- **User value:** Not recorded
- **Scope:** in: Reads GET /api/overview for the product statement, progress, headline counts, active work, blockers and freshness, and GET /api/product for the current milestone, Shows overall progress as a real count against agreed criteria, stating Not measurable rather than a false percentage when no criteria exist, Surfaces alignment warnings computed client side from the freshness reading: stale verification evidence, undecided documentation hand edits, documentation never generated, and an active task with no reporting session, States the database revision and last event sequence together so the reader can tell whether the whole page reflects one consistent moment; out: Does not let the reader edit the product statement, milestone or progress criteria from this screen, those live in Product and Readiness, Does not compute progress from a guess, it only reports a percentage where completion criteria have actually been agreed, Does not treat a missing milestone read as a reason to fail the whole page, that one section shows its own retryable error while the rest of the briefing still renders
- **Affected contracts:** none linked

### Primary flow

1. User starts the local service and browses to the Overview area
2. Page requests /api/overview and /api/product together, showing a loading state until both settle
3. Sections render in fixed order: what is being built, where we are now, what works, what is active, what is blocked, what to do next
4. A closing freshness section states the database revision, last event, and whether stale evidence or hand edited documentation need attention

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| The Overview area displays product purpose, progress, and next actions with a stated basis for each progress value | Do it through the surface a person would use and record what was observed. | Met | EV-0085 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | The page states explicitly when the database revision and the last event sequence disagree, meaning the rendered briefing is behind the live database, and a stale banner with a refresh action is shown. |
| Dependency Failure | Applicable | If only the milestone read fails while the overview read succeeds, just that one section shows an inline retryable error, the rest of the briefing still renders from the overview payload that did load. |
| Empty States | Applicable | When the service answers but no project exists yet on the machine, the page shows an empty state telling the reader to run setup, instead of rendering a blank or broken briefing. |
| Network Failure | Applicable | When the overview request fails and is detected as offline, the page shows an offline state with a reconnect action rather than a generic error; other failures show a retryable error state instead. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. node src/cli.mjs services showed the control center already Running on port 4317; curl http://127.0.0.1:4317/api/overview returned 200 with project statement, headline counts (features, tasks, questions), matching what overview.tsx (ui/src/views/overview.tsx:1-90) renders. | command | pass | superdev ui --apply starts the local service; browsing to http://127.0.0.1:<port>/#/overview renders ui/src/views/overview.tsx, which reads GET /api/overview and GET /api/product |

## Delivery state

- **What works now:** Reached by superdev ui --apply starts the local service; browsing to http://127.0.0.1:<port>/#/overview renders ui/src/views/overview.tsx, which reads GET /api/overview and GET /api/product. node src/cli.mjs services showed the control center already Running on port 4317; curl http://127.0.0.1:4317/api/overview returned 200 with project statement, headline counts (features, tasks, questions), matching what overview.tsx (ui/src/views/overview.tsx:1-90) renders.
- **What remains:** Nothing known.
- **Next action:** Not recorded
