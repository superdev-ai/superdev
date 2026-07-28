<!-- superdev:generated source=FEAT-0019 revision=2943 hash=5512d205de75aa72fd60b435eb1f88c22bc468e047b08a4e1a88d040d087c470 -->
# Feature: List running services

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show which local services are active
- **User:** A developer or coding agent working across several project checkouts wants to see the actual running state of the local service for the current project, not guess from a stale terminal.
- **User value:** Not recorded
- **Scope:** in: Confirms liveness with an actual HTTP GET of /health rather than trusting a pid file or lock file alone, Reports one of several real states (running, stopped, starting, stale, foreign), not just a running/not-running boolean, Shows pid, port, host, url, version and when the process started for a running service, Points to the log file path so a problem can be investigated further; out: Does not list services for other projects on the machine; a cross-project registry exists on disk but this command only reports the current project's directory, Does not start, stop or repair anything; it only reports what it finds, Does not distinguish partial degradation; a service either answers /health as itself or it does not
- **Affected contracts:** none linked

### Primary flow

1. Run superdev services from inside the project directory
2. Command reads the local lock file, if any
3. It sends a GET /health to the recorded port to confirm the process answering is actually this project's service
4. Prints state, pid, port, url, version and start time based on what actually answered

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev services lists each service with its running state | Run superdev services and record what was observed. | Met | EV-0015 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | if something answers on the recorded port but its project root or instance token do not match, it is reported as foreign rather than claimed as this project's service |
| Empty States | Applicable | when nothing is running, the command prints state Stopped with the explanation that no service is running for this project |
| State Machine Violations | Applicable | a leftover lock file with no live process behind it reports as stale rather than as running, so a crashed process does not read as healthy |
| Time | Applicable | a lock with no port yet is read as starting for the first 20 seconds after it was created, and as stale beyond that, using the recorded start timestamp |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:697-701 cmdServices, registered at line 2029. Ran `node src/cli.mjs services`: printed live state (State Running, Managed yes, Pid 51710, Port 4317, Url http://127.0.0.1:4317, Started At 2026-07-27 19:32:22). | command | pass | superdev services |

## Delivery state

- **What works now:** Reached by superdev services. src/cli.mjs:697-701 cmdServices, registered at line 2029. Ran `node src/cli.mjs services`: printed live state (State Running, Managed yes, Pid 51710, Port 4317, Url http://127.0.0.1:4317, Started At 2026-07-27 19:32:22).
- **What remains:** Nothing known.
- **Next action:** Not recorded
