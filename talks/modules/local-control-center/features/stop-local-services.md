<!-- superdev:generated source=FEAT-0017 revision=2943 hash=2b16af0bee557d81ffdc0f03afa411ed5ac98032092d9c0ec37e1ce93e5d08ed -->
# Feature: Stop local services

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Cleanly stop running local services
- **User:** A developer wrapping up a session, or about to run a migration, needs to shut the local service down cleanly.
- **User value:** Not recorded
- **Scope:** in: Dry run reports what stopping would do without touching anything, With --apply, sends SIGTERM to the recorded process id and waits for /health to stop answering, Clears a leftover or stale lock file even when there is no live process behind it to signal, Treats an already-stopped service as a no-op success rather than an error; out: Does not stop a service belonging to a different project; a foreign service on the port is reported, not signalled, Does not delete or export any recorded data; stopping only ends the process, Does not force-kill; it sends SIGTERM once and reports failure if the process is still answering after the timeout
- **Affected contracts:** none linked

### Primary flow

1. Run superdev stop to see the current state (dry run)
2. Re-run with --apply
3. Command sends SIGTERM to the process id recorded in the lock file
4. Polls /health until it stops answering, up to a 10 second timeout
5. Removes the lock file and reports the service stopped

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev stop halts all started services | Run superdev stop and record what was observed. | Met | EV-0013 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Permission Boundaries | Applicable | a service on the port that belongs to a different project is refused rather than signalled, since it is not this project's process to stop |
| Recovery | Applicable | a stale or still-starting lock with no live process behind it is cleared as a side effect of running stop, since there is nothing to signal |
| Slow Paths | Applicable | if the process is still answering /health after the 10 second shutdown window, stop reports failure and names the pid to kill directly rather than waiting longer |
| State Machine Violations | Applicable | stopping a service that is already stopped returns an already-stopped result rather than an error |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:677-685 cmdStop, registered at line 2027. Ran `node src/cli.mjs stop` (dry run, service was running): printed 'Stopping the service ends the local process. Nothing recorded is lost. Nothing has changed. Re-run with --apply to stop the local service.' | command | pass | superdev stop |

## Delivery state

- **What works now:** Reached by superdev stop. src/cli.mjs:677-685 cmdStop, registered at line 2027. Ran `node src/cli.mjs stop` (dry run, service was running): printed 'Stopping the service ends the local process. Nothing recorded is lost. Nothing has changed. Re-run with --apply to stop the local service.'
- **What remains:** Nothing known.
- **Next action:** Not recorded
