<!-- superdev:generated source=FEAT-0056 revision=3072 hash=6a1611867ba34f11bccfe65a64fc3b143407fb344109cb2cbb16224aab752e80 -->
# Feature: Verify a task

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Run the required verification checks for a task's acceptance criteria
- **User:** A lead or agent needs to know whether the evidence a task's completion stands on is still true, instead of trusting a claim written once and never rechecked.
- **User value:** Not recorded
- **Scope:** in: re-executes the check command recorded on each current piece of evidence, optionally scoped to one task with --task, and compares the fresh result to what was recorded, separates evidence into what carries a runnable command versus what was checked by hand only, since not every verification can be automated, with --apply, marks evidence whose re-run now fails as stale, without reopening the task that stood on it; out: does not run arbitrary commands, only this project's own scripts and grep are runnable, each filtered flag by flag through an allowlist rather than a program name or substring blocklist, does not decide the task's status from the result, reporting and any reopening are separate steps a person takes afterward, does not re-check or judge manual-only evidence, a check with no recorded command is counted but never re-run
- **Affected contracts:** none linked

### Primary flow

1. run superdev verify (optionally --task TASK-id) as a dry run
2. read the counts: evidence in force, carries a command, checked by hand only, re-ran, still passing, no longer passing, could not run
3. re-run with --apply to mark newly failing evidence stale

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev verify <TASK-id> reports pass or fail against the task's test plan | Run superdev verify <TASK-id> and record what was observed. | Met | EV-0078 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Dependency Failure | Applicable | observed directly in this project's own database: one evidence row had node src/cli.mjs verify itself recorded as its check command; re-running it spawned the verify command again as a subprocess, which recursively spawned further copies of itself until each hit its own timeout, and the outer report correctly classified the whole thing as could not run, an error, rather than a pass or fail, and did not crash. |
| Empty States | Applicable | a project with no current evidence returns all-zero counts across every column and exits 0. |
| Invalid Input | Applicable | a recorded command using shell punctuation, an unlisted flag, or any script other than this project's own is refused up front with a stated reason instead of being executed, for example written for a shell, so it cannot run without one, or node may only run this project's own scripts. |
| Recovery | Applicable | apply only marks evidence stale when the re-run actually fails; a command that could not run at all leaves that evidence's current status untouched, since an unrunnable check says nothing about whether the product itself is still correct. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:1525 cmdVerify calls verifyEvidence (src/verify/index.mjs), registered as "verify" (src/cli.mjs:2045), a top-level command distinct from "task evidence". It genuinely re-executes the recorded check command: after attaching evidence on TASK-0001 whose command was `node scripts/validate/validate-all.mjs --only data-model` (a script that does not exist in the scratch root), `node src/cli.mjs verify` re-ran that command, correctly reported "No longer passing: 1" with the real Node error text, and exited 1 (report.noLongerPassing > 0). A clean project with no evidence returned all-zero counts and exit 0, confirming the command runs without error in the base case. | manual_check | pass | superdev verify [--task <TASK-id>] [--apply] |

## Delivery state

- **What works now:** Reached by superdev verify [--task <TASK-id>] [--apply]. src/cli.mjs:1525 cmdVerify calls verifyEvidence (src/verify/index.mjs), registered as "verify" (src/cli.mjs:2045), a top-level command distinct from "task evidence". It genuinely re-executes the recorded check command: after attaching evidence on TASK-0001 whose command was `node scripts/validate/validate-all.mjs --only data-model` (a script that does not exist in the scratch root), `node src/cli.mjs verify` re-ran that command, correctly reported "No longer passing: 1" with the real Node error text, and exited 1 (report.noLongerPassing > 0). A clean project with no evidence returned all-zero counts and exit 0, confirming the command runs without error in the base case.
- **What remains:** Nothing known.
- **Next action:** Not recorded
