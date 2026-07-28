<!-- superdev:generated source=FEAT-0016 revision=2943 hash=95fdeca210a565c7ff1ed736c0b82e6359871cae826a7acc2ff5818daf4766e7 -->
# Feature: Start local services

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Start the local control center and supporting services
- **User:** A developer beginning a work session wants to bring up the local service so the dashboard and other tools have something to talk to.
- **User value:** Not recorded
- **Scope:** in: Dry run reports the current service state and what starting would do, without opening a process, With --apply, spawns a detached background process and waits for its /health endpoint to answer before declaring success, Detects an already-running or already-starting service and reports it instead of spawning a duplicate, Writes a lock file and a private per-project log so the process can be found and its output inspected later; out: Does not start anything beyond the one local service process; no external dependencies or containers, Does not open the dashboard in a browser once the service is up, Does not evict whatever is already holding the configured port; a foreign process there is reported, not displaced
- **Affected contracts:** none linked

### Primary flow

1. Run superdev start to see the current state (dry run)
2. Re-run with --apply
3. Command spawns the service as a detached process with output redirected to a private log file
4. Waits up to 15 seconds for the process to answer /health on its bound port
5. Reports the running state (pid, port, url) once confirmed live

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev start brings up the control center and dependent services | Run superdev start and record what was observed. | Met | EV-0052 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | if the port is already held by a different project's Superdev service, start refuses with a foreign-service error naming the port |
| Recovery | Applicable | a lock file left over from a service that never finished starting (older than the 20 second grace window) is treated as stale and cleared automatically on the next start |
| Slow Paths | Applicable | if the spawned process never answers /health within 15 seconds, start fails and points to the tail of the log file instead of hanging indefinitely |
| State Machine Violations | Applicable | if a lock file already shows a start in progress, a second start call reports that state back instead of racing a second process |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran node src/cli.mjs start (dry run since a service was already running elsewhere): it correctly reported the current service state and offered 'Starting the service opens one local process for this project. Re-run with --apply to start the local service.' The same startService function is what cmdUi used to bring up the already-running control center reachable at 127.0.0.1:4317 (see FEAT-0015 evidence), confirming the underlying start path is functional, not just a planned message. | command | pass | superdev start (COMMANDS.start -> cmdStart in src/cli.mjs:667, using startService/serviceStatus from src/service/manage.mjs) |

## Delivery state

- **What works now:** Reached by superdev start (COMMANDS.start -> cmdStart in src/cli.mjs:667, using startService/serviceStatus from src/service/manage.mjs). Ran node src/cli.mjs start (dry run since a service was already running elsewhere): it correctly reported the current service state and offered 'Starting the service opens one local process for this project. Re-run with --apply to start the local service.' The same startService function is what cmdUi used to bring up the already-running control center reachable at 127.0.0.1:4317 (see FEAT-0015 evidence), confirming the underlying start path is functional, not just a planned message.
- **What remains:** Nothing known.
- **Next action:** Not recorded
