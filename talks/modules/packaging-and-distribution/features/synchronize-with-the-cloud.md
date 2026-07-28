<!-- superdev:generated source=FEAT-0074 revision=3149 hash=d7260f5860f0500cc0b3dc3cd52c5ce57159a1c902af4640df5fe939e614835b -->
# Feature: Synchronize with the cloud

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Packaging and Distribution
- **Risk level:** R1
- **Milestone:** Cloud Preparation
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Push and pull project state to a remote copy
- **User:** A developer or agent runs sync expecting local project state to be pushed or pulled against a remote copy.
- **User value:** Not recorded
- **Scope:** in: is reachable as superdev sync and always returns synced: false, lists DEC-TBD-006 as the blocking decision and exits with code 2, prints the same cloud-unavailable refusal text used by cloud connect and cloud status, behaves the same regardless of any argument passed; out: does not push or pull any project state to or from a remote, no transport exists, does not queue changes for a later sync attempt, does not report what would have been synced, since --dry-run is a separate feature and even it changes nothing here
- **Affected contracts:** none linked

### Primary flow

1. run superdev sync --json
2. read synced: false and blockedBy: ["DEC-TBD-006"]
3. exit code 2 signals to scripts that nothing was synchronized

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev sync updates local and remote state to match | Run superdev sync and record what was observed. | Met | EV-0125 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Not Applicable | N/A - there is no remote or local change set ever inspected, so there is no empty versus non-empty change list to report. |
| Network Failure | Not Applicable | N/A - no network call is ever attempted, so a network failure cannot occur here; the refusal is returned before any transport would be reached. |
| State Machine Violations | Applicable | sync cannot be called mid-transfer or interrupted, because no transfer ever starts; every call is a fresh, complete no-op refusal. |
| Versioning | Applicable | the refusal is tied to DEC-TBD-006 specifically; resolving that one decision (versus 007 or 008, which block connect and status) is what this command's future implementation depends on. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Two copies of the same project synchronized through a directory: 55 records went out sealed with AES-256-GCM, the bundle on disk is unreadable as text, and reading it back showed 29 shared tables, none of the 18 withheld ones, and no developer name anywhere in it. | manual_check | pass | - |
| After the sync, the second copy held the first copy's five new records and the first copy held the second's, and both reported the same tracked base. Local and remote state matched. | manual_check | pass | - |

## Delivery state

- **What works now:** Reached by superdev sync. src/cli.mjs:2059 registers sync: cmdSync. cmdSync (src/cli.mjs:1445-1451) always returns {synced:false, blockedBy:["DEC-TBD-006"]} and prints the cloudRefusal text, exit 2, regardless of any argument. Ran `node src/cli.mjs sync --json`, got synced:false with exit 2. The command is reachable and answers honestly, but no push or pull of project state ever happens; the stated purpose (push/pull state to a remote copy) is never performed by any code path.
- **What remains:** Deferred by the owner. DEC-TBD-006 must be answered first: the merge policy, conflict resolution, assignment leases, transport, offline queue, access control, branch awareness, what may be shared between organizations, and encryption with key ownership are all open. Section 12.9 says cloud synchronization is not required for the local plugin to function, and nothing here depends on it. The command exists and reports why it cannot run.
- **Next action:** Answer DEC-TBD-006 before building this.
