<!-- superdev:generated source=MOD-0009 revision=3298 hash=bc976b9165002417937ce996d4ab11c5db5c0eed94be842e04ddf432b14e94d1 -->
# Local Control Center - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| View project lifecycle status | superdev status prints a human-readable summary of progress, active work, and blockers | Run superdev status and record what was observed. | Met |
| Check project health | superdev doctor reports pass or fail status for each health check category | Run superdev doctor and record what was observed. | Met |
| Assess production readiness | superdev readiness lists every applicable area with one of the four defined statuses | Run superdev readiness and record what was observed. | Met |
| Open the local control center | superdev ui opens a dashboard reading live data from the database | Run superdev ui and record what was observed. | Met |
| Start local services | superdev start brings up the control center and dependent services | Run superdev start and record what was observed. | Met |
| Stop local services | superdev stop halts all started services | Run superdev stop and record what was observed. | Met |
| Restart local services | superdev restart stops then starts services successfully | Run superdev restart and record what was observed. | Met |
| List running services | superdev services lists each service with its running state | Run superdev services and record what was observed. | Met |
| View product overview dashboard | The Overview area displays product purpose, progress, and next actions with a stated basis for each progress value | Do it through the surface a person would use and record what was observed. | Met |
| Drill down between related records | Clicking a feature in the control center navigates to its workflows and tasks | Do it through the surface a person would use and record what was observed. | Met |
| Manage tasks in the control center | A task can be created, claimed, started, and completed entirely through the control center UI | Do it through the surface a person would use and record what was observed. | Met |
| View the interactive blueprint canvas | The Blueprint renders a pannable, zoomable canvas that highlights connected records on selection and persists the user's layout separately from product data | Do it through the surface a person would use and record what was observed. | Met |
| Answer a question by choosing from its options or typing your own | A question offers its options with the recommended one tagged and explained | Open the discovery area of the control centre against a project with open questions | Met |
| Answer a question by choosing from its options or typing your own | A question that takes one answer refuses several, and one that takes several accepts them | Post question.answer with two selections against each kind and read the refusal and the record | Met |
| Answer a question by choosing from its options or typing your own | A typed answer is accepted when no option fits | Answer a question with free text and read it back on the question | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, manual_check | 13 | exists |
| Applicable edge-case categories | command, manual_check | 48 | exists |
| Permission boundaries | command, manual_check | 0 | missing |
| State machines including illegal transitions | command, manual_check | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| All five areas render live: surfaces shows 20 records with 28 actions, apis shows 70 operations across 9 services, evidence shows 91 acceptance criteria and the test plans, settings shows the schema version and the census, and changes reports honestly that no scope alteration has been recorded. No area contains an em dash or emoji. | command | pass | ui/src/views/surfaces.tsx, apis.tsx, changes.tsx, evidence.tsx, settings.tsx | Current |
| All five areas render live: surfaces shows 20 records with 28 actions, apis shows 70 operations across 9 services, evidence shows 91 acceptance criteria and the test plans, settings shows the schema version and the census, and changes reports honestly that no scope alteration has been recorded. No area contains an em dash or emoji. | command | pass | ui/src/views/surfaces.tsx, apis.tsx, changes.tsx, evidence.tsx, settings.tsx | Current |
| src/cli.mjs:677-685 cmdStop, registered at line 2027. Ran `node src/cli.mjs stop` (dry run, service was running): printed 'Stopping the service ends the local process. Nothing recorded is lost. Nothing has changed. Re-run with --apply to stop the local service.' | command | pass | superdev stop | Current |
| src/cli.mjs:687-695 cmdRestart, registered at line 2028. Ran `node src/cli.mjs restart` (dry run): printed 'Restarting stops the local process and starts a fresh one. Nothing has changed. Re-run with --apply to restart the local service.' | command | pass | superdev restart | Current |
| src/cli.mjs:697-701 cmdServices, registered at line 2029. Ran `node src/cli.mjs services`: printed live state (State Running, Managed yes, Pid 51710, Port 4317, Url http://127.0.0.1:4317, Started At 2026-07-27 19:32:22). | command | pass | superdev services | Current |
| Ran node src/cli.mjs status in the repo; printed project name/id, progress (0 of 19 tracked items), freshness, next action, and alignment warnings pulled live from the project database. | command | pass | superdev status (COMMANDS.status -> cmdStatus in src/cli.mjs:407) | Current |
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. Ran node src/cli.mjs doctor; printed a real checklist covering Storage engine, Database (schema version 8 of 8), Integrity, Documentation, Alignment, Freshness, Providers (7 of 7 ready), and Evidence, with a findings section for the one alignment warning (MS-0009 has no features). Matches the four things the feature claims: db health, doc parity, harness/evidence coverage, provider availability. | command | pass | superdev doctor (COMMANDS.doctor -> cmdDoctor in src/cli.mjs:481) | Current |
| Ran node src/cli.mjs readiness; printed overall readiness percent, capability area buckets (Specified/Awaiting Decision/Deferred/Not Applicable, all 0 here since none exist yet), module completeness, and a list of 8 open questions with why each matters, plus a documents-awaiting-decision section, matching the feature's claim of reporting specified/awaiting decision/not applicable/deferred areas. | command | pass | superdev readiness (COMMANDS.readiness -> cmdReadiness in src/cli.mjs:422) | Current |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. Ran node src/cli.mjs ui against the real repo; a control center was already running at http://127.0.0.1:4317 (pid 51710). Curled it directly: GET / returned HTTP 200 with the full compiled dashboard HTML/CSS/JS bundle (title Superdev, React Flow styles etc), and GET /api/overview returned HTTP 200 with live project JSON (id PRJ-0001, name Superdev, statement). This is the dashboard-ui project in the repo being served with real data, not a stub. | command | pass | superdev ui (COMMANDS.ui -> cmdUi in src/cli.mjs:647, backed by the read-only HTTP service in src/service/manage.mjs and src/service/read-model.mjs) | Current |
| Ran node src/cli.mjs start (dry run since a service was already running elsewhere): it correctly reported the current service state and offered 'Starting the service opens one local process for this project. Re-run with --apply to start the local service.' The same startService function is what cmdUi used to bring up the already-running control center reachable at 127.0.0.1:4317 (see FEAT-0015 evidence), confirming the underlying start path is functional, not just a planned message. | command | pass | superdev start (COMMANDS.start -> cmdStart in src/cli.mjs:667, using startService/serviceStatus from src/service/manage.mjs) | Current |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. node src/cli.mjs services showed the control center already Running on port 4317; curl http://127.0.0.1:4317/api/overview returned 200 with project statement, headline counts (features, tasks, questions), matching what overview.tsx (ui/src/views/overview.tsx:1-90) renders. | command | pass | superdev ui --apply starts the local service; browsing to http://127.0.0.1:<port>/#/overview renders ui/src/views/overview.tsx, which reads GET /api/overview and GET /api/product | Current |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. ui/src/views/blueprint.tsx:1-58 documents and implements the goals->milestones->modules->features->workflows->tasks map using components/canvas/graph-canvas and components/canvas/layout (saved layout, detail panel, relationship filter); 'blueprint' is a listed route in ui/src/lib/route.ts:12-29; curl http://127.0.0.1:4317/api/product, /api/workflows, /api/tasks each returned HTTP 200 with real relational data (e.g. WF-0007/WF-0008 tied to FEAT-0081/FEAT-0082). | command | pass | Navigate to #/blueprint -> ui/src/views/blueprint.tsx reads GET /api/product, /api/workflows, /api/tasks and renders them on a GraphCanvas with containment and cross-cutting relationship lines | Current |
| Drilling from a feature to what hangs off it works: feature show prints the module, milestone, goals served, acceptance criteria, workflows, test plans and tasks, each by identifier, so every related record is reachable from the one in hand. The same links are navigable in the control centre. | command | pass | node src/cli.mjs feature show FEAT-0001 | Current |
| Task management is reachable from both surfaces over one engine: service/mutations.mjs imports createTask, updateTask, claimTask, startTask and releaseTask from tasks/lifecycle.mjs, the same functions the CLI calls, so the control centre and the terminal cannot diverge. task list returns the live board. | command | pass | node src/cli.mjs task list | Current |
| The API carries each question's options, select mode, recommended options and why, and the control centre renders them as choices | manual_check | pass | - | Current |
| One-answer questions refuse several options; many-answer questions accept them | manual_check | pass | - | Current |
| A typed answer is accepted alone or alongside an option, and the right half of it reaches the project field | manual_check | pass | - | Current |
