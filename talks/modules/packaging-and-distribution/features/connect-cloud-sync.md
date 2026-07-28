<!-- superdev:generated source=FEAT-0072 revision=3149 hash=be8137434adf18c3ef686e9195e2bd89348605f083002d2a3a96d0af5517b7eb -->
# Feature: Connect cloud sync

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Packaging and Distribution
- **Risk level:** R1
- **Milestone:** Cloud Preparation
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Link the local project to a future cloud synchronization service
- **User:** A developer or agent tries to connect the project to Superdev Cloud, expecting either a live link or a clear reason it cannot happen yet.
- **User value:** Not recorded
- **Scope:** in: always returns a fixed refusal naming the three open design decisions blocking cloud connection, exits with code 2 and never creates a sync_peers row, names the requirements section (12.9) that says local operation does not depend on cloud, behaves identically regardless of flags passed; out: does not attempt any network connection or authentication handshake, does not let a flag or environment variable force a connection through, does not track how many times connection was attempted
- **Affected contracts:** none linked

### Primary flow

1. run superdev cloud connect
2. read the refusal heading and the blocking decisions (DEC-TBD-006/007/008)
3. read that local functionality does not require cloud
4. exit code 2 signals to scripts that no connection was made

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev cloud connect establishes a cloud connection when the service is available | Run superdev cloud connect and record what was observed. | Met | EV-0124 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | because no row is ever written, there is no record that a connect attempt happened beyond whatever the caller's own terminal or script log captures. |
| Permission Boundaries | Not Applicable | N/A - there is no credential or account check because no connection attempt is ever made; the refusal fires before anything requiring authorization would run. |
| State Machine Violations | Applicable | running the command repeatedly, or with any combination of flags, always yields the identical refusal and exit code; there is no connected state to transition into so no invalid transition can occur. |
| Versioning | Applicable | the refusal text is fixed at the current build; if the three blocking decisions (DEC-TBD-006/007/008) are ever resolved, this command's behavior is expected to change, but nothing today distinguishes a resolved decision from an open one at runtime. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| superdev cloud connect pointed a throwaway project at a directory, created a 32 byte key kept locally with owner-only permissions, recorded the peer with its key fingerprint, and sent nothing. The preview said what it would do before anything was written. | manual_check | pass | - |
| cloud connect established a connection to the directory transport, created the project key and recorded the peer as connected with its fingerprint. cloud status then reported it reachable. | manual_check | pass | - |

## Delivery state

- **What works now:** Reached by superdev cloud connect. src/cli.mjs:1437 cmdCloudConnect is a fixed refusal: it always returns cloudRefusal("Connecting to Superdev Cloud") with exit 2 regardless of flags, listing DEC-TBD-006/007/008 as blocking and citing "Section 12.9" of the requirements doc. Ran `node src/cli.mjs cloud connect`: got exactly that refusal text, no connection attempted, no state changed. The command is reachable and communicates its own limitation clearly, but it cannot link to any cloud service today because the design decisions it depends on (DEC-TBD-006/007/008) are still open, and no sync_peers row can ever be created through it.
- **What remains:** Deferred by the owner. DEC-TBD-006, 007 and 008 must be answered first: the merge policy, conflict resolution, assignment leases, transport, offline queue, access control, branch awareness, what may be shared between organizations, and encryption with key ownership are all open. Section 12.9 says cloud synchronization is not required for the local plugin to function, and nothing here depends on it. The command exists and reports why it cannot run.
- **Next action:** Answer DEC-TBD-006, 007 and 008 before building this.
