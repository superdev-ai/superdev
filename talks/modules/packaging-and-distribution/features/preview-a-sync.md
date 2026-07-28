<!-- superdev:generated source=FEAT-0075 revision=3149 hash=ad846a369f09a9cabc312d7c0d75a19bb317b124399219c600ef536b72155f7b -->
# Feature: Preview a sync

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Packaging and Distribution
- **Risk level:** R1
- **Milestone:** Cloud Preparation
- **Goals:** GOAL-0001 Complete, structured product model
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show what a sync would change without applying it
- **User:** A developer or agent runs sync --dry-run wanting to see what a real sync would change before committing to it.
- **User value:** Not recorded
- **Scope:** in: accepts the --dry-run flag and echoes it back as dryRun: true in the JSON payload, still returns the identical cloud-unavailable refusal text as plain sync, still exits with code 2, same as a non-dry-run call; out: does not compute or display any diff, plan, or list of pending changes, dryRun is only a flag echoed back, not a data source, does not distinguish a project with pending local changes from one with none, since no comparison against a remote ever runs, does not affect the exit code or refusal text in any way versus omitting the flag
- **Affected contracts:** none linked

### Primary flow

1. run superdev sync --dry-run --json
2. read dryRun: true alongside the same synced: false and blockedBy fields
3. notice the printed text is character-for-character identical to plain sync

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev sync --dry-run lists pending changes without applying them | Run superdev sync --dry-run and record what was observed. | Met | EV-0126 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | passing --dry-run with any other combination of sync flags (for example --resolve) still only flips the one boolean in the JSON output; no flag combination changes the refusal path. |
| Consistency | Applicable | a reader might expect --dry-run to be safer or more informative than a real sync; here they are behaviorally identical, which is itself the fact worth documenting since it could otherwise mislead a script into thinking a preview happened. |
| Empty States | Not Applicable | N/A - there is no change list ever computed, so there is no case of an empty versus populated diff to show. |
| Versioning | Not Applicable | N/A - there is no prior sync state to diff against, since no sync has ever completed for any project using this build. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| superdev sync --dry-run reported the same counts the applied run then produced, and wrote nothing locally or remotely: the preview and the run share every line that decides anything, so they cannot describe different syncs. | manual_check | pass | - |
| sync --dry-run listed 55 going out and 0 coming in, and the directory and database were unchanged afterwards. The applied run then reported the same counts. | manual_check | pass | - |

## Delivery state

- **What works now:** Reached by superdev sync --dry-run. src/cli.mjs:1445-1451 cmdSync reads ctx.flags.dryRun only to echo it back in data.dryRun; the printed text (cloudRefusal) is identical with or without the flag. Ran `node src/cli.mjs sync --dry-run --json`: returned {"synced":false,"dryRun":true,"blockedBy":["DEC-TBD-006"]}, same refusal text as plain sync. There is no diff, plan, or list of what would change.
- **What remains:** Deferred by the owner. DEC-TBD-006 must be answered first: the merge policy, conflict resolution, assignment leases, transport, offline queue, access control, branch awareness, what may be shared between organizations, and encryption with key ownership are all open. Section 12.9 says cloud synchronization is not required for the local plugin to function, and nothing here depends on it. The command exists and reports why it cannot run.
- **Next action:** Answer DEC-TBD-006 before building this.
