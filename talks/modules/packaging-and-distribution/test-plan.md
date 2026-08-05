<!-- superdev:generated source=MOD-0011 revision=4091 hash=cd87c7288033224cdc541d36b369c86ba98906e36917f9db2bef15f7d560f2f8 -->
# Packaging and Distribution - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| Connect cloud sync | superdev cloud connect establishes a cloud connection when the service is available | Run superdev cloud connect and record what was observed. | Met |
| Show cloud sync status | superdev cloud status reports connection and sync state | Run superdev cloud status and record what was observed. | Met |
| Synchronize with the cloud | superdev sync updates local and remote state to match | Run superdev sync and record what was observed. | Met |
| Preview a sync | superdev sync --dry-run lists pending changes without applying them | Run superdev sync --dry-run and record what was observed. | Met |
| Resolve sync conflicts | superdev sync --resolve applies conflict resolution and leaves local and remote consistent | Run superdev sync --resolve and record what was observed. | Met |
| Refuse a record type the interface shows and nothing can write | A record type the depth gate requires with no writer fails the build | Run the validator against the current tree and read what it names | Met |
| Refuse a record type the interface shows and nothing can write | Adding a writer clears that finding without editing the validator | Add a write path and re-run it | Met |
| Refuse a state column nothing can move off its opening value | A state column with no writer and no recorded reason fails the build:Remove an entry from IMMOVABLE and confirm the run reports an error | Checked by hand against the running product. | Unmet |
| Refuse a state column nothing can move off its opening value | A column the creator computes is not reported:Confirm source material screening and non-functional requirement status are absent from the findings | Checked by hand against the running product. | Unmet |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, manual_check | 7 | exists |
| Applicable edge-case categories | command, manual_check | 17 | exists |
| Permission boundaries | command, manual_check | 0 | missing |
| State machines including illegal transitions | command, manual_check | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| src/cli.mjs:1421-1435 cmdCloudStatus queries sync_peers and returns connected:false with the blocking decisions. Ran `node src/cli.mjs cloud status --json` in the repo (which has a live .superdev/superdev.db): exit 0, printed {"connected":false,"peers":0,"blockedBy":["DEC-TBD-006","DEC-TBD-007","DEC-TBD-008"],"localWorksWithoutIt":true}. The command is registered at src/cli.mjs:2057 ("cloud status": cmdCloudStatus). It truthfully reports the real (permanently disconnected) status end to end. | command | pass | superdev cloud status | Current |
| superdev cloud connect pointed a throwaway project at a directory, created a 32 byte key kept locally with owner-only permissions, recorded the peer with its key fingerprint, and sent nothing. The preview said what it would do before anything was written. | manual_check | pass | - | Current |
| Two copies of the same project synchronized through a directory: 55 records went out sealed with AES-256-GCM, the bundle on disk is unreadable as text, and reading it back showed 29 shared tables, none of the 18 withheld ones, and no developer name anywhere in it. | manual_check | pass | - | Current |
| Both copies changed the same feature purpose after agreeing on a base. The sync recorded one conflict, took in nothing, and left the local value standing; superdev sync --resolve settled it by keeping remote, the value changed, and the next sync reported no conflict because the settled value became the new agreed base. A defect was found and fixed on the way: the base was being advanced to this side's own unacknowledged value, which overwrote a local edit with no conflict at all. | manual_check | pass | - | Current |
| superdev sync --dry-run reported the same counts the applied run then produced, and wrote nothing locally or remotely: the preview and the run share every line that decides anything, so they cannot describe different syncs. | manual_check | pass | - | Current |
| cloud connect established a connection to the directory transport, created the project key and recorded the peer as connected with its fingerprint. cloud status then reported it reachable. | manual_check | pass | - | Current |
| After the sync, the second copy held the first copy's five new records and the first copy held the second's, and both reported the same tracked base. Local and remote state matched. | manual_check | pass | - | Current |
| sync --dry-run listed 55 going out and 0 coming in, and the directory and database were unchanged afterwards. The applied run then reported the same counts. | manual_check | pass | - | Current |
| sync --resolve CONF-0001 --keep remote changed the local purpose to the remote value and marked the conflict resolved. The next sync on both copies reported zero conflicts, so they were left consistent. | manual_check | pass | - | Current |
| The validator names every record type the product asks for and cannot write | manual_check | pass | - | Current |
| Adding a write path clears the finding without editing the validator | manual_check | pass | - | Current |
