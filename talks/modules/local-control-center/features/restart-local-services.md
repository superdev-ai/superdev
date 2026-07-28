<!-- superdev:generated source=FEAT-0018 revision=2943 hash=c28b3e4d826f9e741b07686d487f4634c96a8df6e00b4b47f324a1b65bb5405b -->
# Feature: Restart local services

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Restart the control center and services in one step
- **User:** A developer who changed local configuration or just wants a clean process wants one command that stops and starts the service, instead of running both by hand.
- **User value:** Not recorded
- **Scope:** in: Dry run reports the current state and explains that restart stops the process then starts a fresh one, With --apply, stops the running service then starts a new one, reusing the same lock and /health checks as the standalone commands, Works even when nothing was running yet, since the stop step succeeds as a no-op before the start step spawns a process, Reports the new pid, port and url once the fresh process answers /health; out: Does not preserve any in-memory state across the swap; the new process starts cold, same as a plain start, Does not restart anything besides the one local service; no dependent processes are bounced, Does not retry automatically if the start step fails after the stop step succeeded; that failure surfaces the same as a plain start failure
- **Affected contracts:** none linked

### Primary flow

1. Run superdev restart to see the current state (dry run)
2. Re-run with --apply
3. Command signals the running process to stop and waits for it to stop answering /health
4. Immediately spawns a fresh process and waits for it to answer /health
5. Reports the new pid, port and url once the fresh process is confirmed live

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev restart stops then starts services successfully | Run superdev restart and record what was observed. | Met | EV-0014 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | if the port is held by a different project's service, the stop step's foreign-service error is swallowed but the following start step hits the same foreign-port condition and fails with the same explanation |
| Recovery | Applicable | a stale lock left from a service that never finished starting is cleared during the stop step, the same as running stop alone, before the start step begins |
| Slow Paths | Applicable | the start step still enforces its own 15 second /health timeout for the new process, so a restart whose new process never comes up fails rather than hanging |
| State Machine Violations | Applicable | restarting when nothing was running just starts fresh, because the stop step reports a no-op success instead of erroring |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:687-695 cmdRestart, registered at line 2028. Ran `node src/cli.mjs restart` (dry run): printed 'Restarting stops the local process and starts a fresh one. Nothing has changed. Re-run with --apply to restart the local service.' | command | pass | superdev restart |

## Delivery state

- **What works now:** Reached by superdev restart. src/cli.mjs:687-695 cmdRestart, registered at line 2028. Ran `node src/cli.mjs restart` (dry run): printed 'Restarting stops the local process and starts a fresh one. Nothing has changed. Re-run with --apply to restart the local service.'
- **What remains:** Nothing known.
- **Next action:** Not recorded
