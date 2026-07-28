<!-- superdev:generated source=FEAT-0065 revision=2943 hash=9eed31aeb8ce5d49112782f9fadb7646b62470ccd10b62e5691f728e74ddc604 -->
# Feature: List decisions

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Decisions, Changes, and Questions
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0003 Always-answerable project state, GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all recorded decisions and their status
- **User:** Anyone joining a project midstream, technical or not, wants a single list of every decision made so far and whether each one still holds.
- **User value:** Not recorded
- **Scope:** in: Lists decisions for the current project as a table of id, status, expiry date, and title, newest first, By default hides decisions in rejected, superseded, or deprecated status, showing only what is currently in force, With --all, includes every decision regardless of status so the full history is visible, Adds a 'What they govern' section for the first 8 decisions showing which tasks or features each one binds, pulled from decision_links; out: Does not show the full decision text or rationale inline, only the title in the table (use memory show or decision detail for full content), Does not filter by module, task, or date range, it is one project-wide list, Does not distinguish full supersession from partial supersession in the table itself, both collapse to the same status label
- **Affected contracts:** none linked

### Primary flow

1. Run superdev decision list
2. Read the table of active decisions with id, status, expiry, and title
3. Read the 'What they govern' section to see which tasks or features each decision binds
4. Optionally re-run with --all to bring back rejected, superseded, and deprecated decisions

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev decision list returns every decision with active or superseded state | Run superdev decision list and record what was observed. | Met | EV-0079 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | A decision with no expiry date shows a blank expiry cell rather than a placeholder value or an error. |
| Empty States | Applicable | When no decision has been recorded yet, the command returns "No decision has been recorded yet." instead of an empty table. |
| Limits And Quotas | Applicable | The 'What they govern' breakdown only covers the first 8 decisions in the list even if more are returned, to keep the summary short. |
| Versioning | Applicable | Without --all, superseded and deprecated decisions drop out of the list entirely once replaced, so the default view always reflects only what currently governs, not the full history. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:1844 cmdDecisionList, registered at src/cli.mjs:2085 as "decision list". Ran `node src/cli.mjs decision list`: printed a real table of 16 decisions (DEC-0001..DEC-0016) with id, status, expires, title, pulled from the decisions table with decision_links joined per row. | command | pass | superdev decision list (and decision list --all) |

## Delivery state

- **What works now:** Reached by superdev decision list (and decision list --all). src/cli.mjs:1844 cmdDecisionList, registered at src/cli.mjs:2085 as "decision list". Ran `node src/cli.mjs decision list`: printed a real table of 16 decisions (DEC-0001..DEC-0016) with id, status, expires, title, pulled from the decisions table with decision_links joined per row.
- **What remains:** Nothing known.
- **Next action:** Not recorded
