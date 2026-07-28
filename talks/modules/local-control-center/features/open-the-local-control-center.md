<!-- superdev:generated source=FEAT-0015 revision=2943 hash=db1925f167f69f17d7ff8298bfd94d7385a928fad4f6b9c76b1d37f6cd722122 -->
# Feature: Open the local control center

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Give the user a visual dashboard over live product and task data
- **User:** A founder or PM who is not comfortable reading CLI text wants a visual view of the project's live status without learning commands.
- **User value:** Not recorded
- **Scope:** in: Starts the local HTTP service if one is not already running, or reports the one already running, Serves the compiled dashboard bundle (React app, project overview, tasks, decisions, workflows and more) over plain HTTP on loopback, Backs the page with a read-only JSON API that reads the live database on every request, not a cached snapshot, Restricts every request to loopback addressing and every API call to same-origin, refusing anything else with 403; out: Does not open a browser tab itself; it reports the address and pid and leaves opening it to the user, Does not create a project; if the directory has no Superdev project yet, the API returns an error pointing to init instead of blank data, Does not answer on any network interface other than loopback, so it cannot be reached from another machine
- **Affected contracts:** none linked

### Primary flow

1. Run superdev ui
2. Command checks whether a service is already running for this project
3. If not, it starts one and waits for /health to answer before returning
4. Reports the address and process id once the service is confirmed live
5. Opening that address in a browser loads the dashboard, which calls the read-only API for live data

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev ui opens a dashboard reading live data from the database | Run superdev ui and record what was observed. | Met | EV-0051 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Concurrent Actions | Applicable | if a service is already running when ui is run again, it reports the existing address and pid instead of starting a second process |
| Dependency Failure | Applicable | if the configured port is already held by an unrelated program or a different project's Superdev service, the state is reported as foreign rather than silently binding elsewhere |
| Empty States | Applicable | if the directory has no Superdev project yet, dashboard API calls return an error telling the user to run init, rather than an empty or broken page |
| Permission Boundaries | Applicable | a request addressed under a non-loopback host, or an API call from another origin, gets a 403 with an explanation instead of being served |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| All five areas render live: surfaces shows 20 records with 28 actions, apis shows 70 operations across 9 services, evidence shows 91 acceptance criteria and the test plans, settings shows the schema version and the census, and changes reports honestly that no scope alteration has been recorded. No area contains an em dash or emoji. | command | pass | ui/src/views/surfaces.tsx, apis.tsx, changes.tsx, evidence.tsx, settings.tsx |
| All five areas render live: surfaces shows 20 records with 28 actions, apis shows 70 operations across 9 services, evidence shows 91 acceptance criteria and the test plans, settings shows the schema version and the census, and changes reports honestly that no scope alteration has been recorded. No area contains an em dash or emoji. | command | pass | ui/src/views/surfaces.tsx, apis.tsx, changes.tsx, evidence.tsx, settings.tsx |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. Ran node src/cli.mjs ui against the real repo; a control center was already running at http://127.0.0.1:4317 (pid 51710). Curled it directly: GET / returned HTTP 200 with the full compiled dashboard HTML/CSS/JS bundle (title Superdev, React Flow styles etc), and GET /api/overview returned HTTP 200 with live project JSON (id PRJ-0001, name Superdev, statement). This is the dashboard-ui project in the repo being served with real data, not a stub. | command | pass | superdev ui (COMMANDS.ui -> cmdUi in src/cli.mjs:647, backed by the read-only HTTP service in src/service/manage.mjs and src/service/read-model.mjs) |

## Delivery state

- **What works now:** Reached by superdev ui (COMMANDS.ui -> cmdUi in src/cli.mjs:647, backed by the read-only HTTP service in src/service/manage.mjs and src/service/read-model.mjs). Ran node src/cli.mjs ui against the real repo; a control center was already running at http://127.0.0.1:4317 (pid 51710). Curled it directly: GET / returned HTTP 200 with the full compiled dashboard HTML/CSS/JS bundle (title Superdev, React Flow styles etc), and GET /api/overview returned HTTP 200 with live project JSON (id PRJ-0001, name Superdev, statement). This is the dashboard-ui project in the repo being served with real data, not a stub.
- **What remains:** Nothing known.
- **Next action:** Not recorded
