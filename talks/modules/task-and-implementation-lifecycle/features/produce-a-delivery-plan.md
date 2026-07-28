<!-- superdev:generated source=FEAT-0013 revision=2943 hash=c76970d00e6ea1af0548cf6677e7a3f5a6e7b63de6d8a5f8944ac73a1275d292 -->
# Feature: Produce a delivery plan

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Task and Implementation Lifecycle
- **Risk level:** R1
- **Milestone:** Task and Execution Control
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work, GOAL-0005 Evidence-based, trustworthy completion
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Generate a structured plan of upcoming product work
- **User:** A founder, PM, or lead wants an ordered view of upcoming product work, grouped by milestone and module, to know what is planned and what is next.
- **User value:** Not recorded
- **Scope:** in: Prints overall progress percent, then a milestones table with each milestone's status, Groups every module with its features and each feature's current status (Implemented, In Progress, and so on), Reports how many tasks a derive run would create from accepted specifications, without creating them, Names the single next actionable task with its expected outcome; out: Does not create or modify any task, the derivation count shown is informational only, running derive --apply is a separate step, Does not let you reorder or reprioritize milestones from this command, it reflects recorded order and status as-is, Does not show individual task-level detail beyond the one named next action, task list is the command for that
- **Affected contracts:** none linked

### Primary flow

1. Run superdev plan from the project root
2. Read overall progress and the milestones table
3. Read modules grouped with their features and per-feature status
4. Check the Deriving Would section to see if new tasks are pending creation
5. Read the Next section for the single next task to start

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev plan outputs an ordered plan referencing goals, milestones, and features | Run superdev plan and record what was observed. | Met | EV-0049 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | The Deriving Would count reflects live comparison against already-created tasks, so if every accepted feature already has its derived tasks, it correctly reports 0 to create rather than recounting features that already have work. |
| Empty States | Applicable | A milestone with no features assigned still appears in the milestones table but is flagged elsewhere (via doctor's alignment warnings) as having no features, plan itself just shows it with its status and no feature rows. |
| Ordering | Applicable | Milestones and modules are printed in a fixed recorded order (MS-0001 through MS-0009 as stored), not resorted by status or progress, so the same run always produces the same ordering. |
| State Machine Violations | Not Applicable | N/A - Plan only reads milestone, module, and feature status to display them, it never transitions any record, so there is no invalid transition it could trigger. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran node src/cli.mjs plan; produced overall progress, a milestones table (MS-0001 through MS-0009 with status), modules grouped with their features and per-feature status, a derivation-would-create count, and a Next section naming the next actionable task, all read live from the database. | command | pass | superdev plan (COMMANDS.plan -> cmdPlan in src/cli.mjs:352) |

## Delivery state

- **What works now:** Reached by superdev plan (COMMANDS.plan -> cmdPlan in src/cli.mjs:352). Ran node src/cli.mjs plan; produced overall progress, a milestones table (MS-0001 through MS-0009 with status), modules grouped with their features and per-feature status, a derivation-would-create count, and a Next section naming the next actionable task, all read live from the database.
- **What remains:** Nothing known.
- **Next action:** Not recorded
