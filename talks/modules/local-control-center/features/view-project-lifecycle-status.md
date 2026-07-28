<!-- superdev:generated source=FEAT-0009 revision=2943 hash=b95968baf411fe4af5fad8acbd4ff1f14fe0ebfa5d0adef61aead8548019dd19 -->
# Feature: View project lifecycle status

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Explain current product state in plain language
- **User:** Anyone returning to the project, technical or not, wants a plain-language read of where things stand without digging through the database themselves.
- **User value:** Not recorded
- **Scope:** in: Prints project name, id, and overall progress as a percent of tracked items done, Breaks progress down by accepted features delivered, milestones reached, and goal criteria met, Reports freshness: last activity time, last documentation build, and whether generated docs are behind the database, Surfaces alignment warnings by severity and names the next action to take; out: Does not let you filter or query specific slices of progress, it always prints the whole picture, Does not fix the alignment warnings it reports, those are read-only findings pointing at other commands, Does not change any state, it is a read-only report
- **Affected contracts:** none linked

### Primary flow

1. Run superdev status from the project root
2. Read the progress percent and the counts behind it
3. Check the freshness section for whether docs are stale
4. Read the Next section for the single next action to take
5. Scan alignment warnings by severity if anything looks off

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev status prints a human-readable summary of progress, active work, and blockers | Run superdev status and record what was observed. | Met | EV-0045 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | Every number shown (progress, freshness, warnings) is read live from the project database at report time and stamped with the revision and generated-at time, so two runs a minute apart can legitimately disagree. |
| Boundary Values | Applicable | Alignment warnings are grouped and counted by severity (High, Medium, Low) so a project with many High findings is visually distinguishable from one with only Low ones, not just a flat count. |
| Consistency | Applicable | When generated documentation was built from an older database revision, status flags it directly under Freshness as a documentation-behind-revision warning rather than staying silent about the mismatch. |
| Empty States | Applicable | On a project with no accepted features or no activity yet, progress reads 0 of N tracked items done and the Next section would name onboarding or acceptance as the next step instead of a task. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran node src/cli.mjs status in the repo; printed project name/id, progress (0 of 19 tracked items), freshness, next action, and alignment warnings pulled live from the project database. | command | pass | superdev status (COMMANDS.status -> cmdStatus in src/cli.mjs:407) |

## Delivery state

- **What works now:** Reached by superdev status (COMMANDS.status -> cmdStatus in src/cli.mjs:407). Ran node src/cli.mjs status in the repo; printed project name/id, progress (0 of 19 tracked items), freshness, next action, and alignment warnings pulled live from the project database.
- **What remains:** Nothing known.
- **Next action:** Not recorded
