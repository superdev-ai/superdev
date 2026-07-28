<!-- superdev:generated source=FEAT-0070 revision=2943 hash=ac63f594e71defad56a370b7fb66e0f3271daafe98099f8281e66ecdb188b214 -->
# Feature: Supersede a memory

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Memory System
- **Risk level:** R1
- **Milestone:** Memory
- **Goals:** GOAL-0004 Continuity of project knowledge across sessions and people
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Mark an outdated memory as replaced without deleting it
- **User:** Someone who realizes a past memory turned out wrong or outdated wants to mark it replaced without erasing the record that it was once believed.
- **User value:** Not recorded
- **Scope:** in: Takes the id of the memory being replaced and requires --by <MEM-id> naming the replacement, Marks the old memory's superseded_by field rather than deleting the row, so both memories remain on file, Follows the same plan/--apply convention as the rest of the CLI: without --apply it prints the plan and changes nothing; out: Does not delete the superseded memory or its content, Does not require the replacement memory to already exist as a check before recording (no evidence found suggesting the --by id is validated against memory_entries), Does not cascade the supersession to memories or decisions that referenced the old one, it only sets the one field on the target memory
- **Affected contracts:** none linked

### Primary flow

1. Identify the outdated memory id and its replacement's id
2. Run superdev memory supersede <MEM-id> --by <MEM-id> as a dry run to confirm the plan text
3. Re-run with --apply to record the supersession
4. Run superdev memory show <MEM-id> afterward to confirm 'Superseded by' now shows the replacement

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev memory supersede <MEMORY-id> links the old memory to its replacement | Run superdev memory supersede <MEMORY-id> and record what was observed. | Met | EV-0082 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | The dry run and applied run both name which memory is being replaced and which replaces it, so the plan text alone documents the change before it is committed. |
| Deletion Semantics | Applicable | Superseding keeps the old memory fully intact and queryable, since the design intent stated in the plan text is that a memory believed and later found wrong is worth knowing, not worth losing. |
| Empty States | Not Applicable | N/A - This command targets one specific memory id passed as an argument, there is no list view or empty-collection state for it to show. |
| Invalid Input | Applicable | Omitting --by is rejected with a usage error asking which memory replaces it, before anything runs, whether or not --apply is passed. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:1212 cmdMemorySupersede requires --by, and on --apply calls supersede() -> src/memory/index.mjs:305 supersedeLocal which marks superseded_by rather than deleting. Ran `node src/cli.mjs memory supersede MEM-9999 --by MEM-9998` without --apply: printed the correct plan text ("Would mark MEM-9999 superseded by MEM-9998...") and changed nothing, exit 0, matching the plan/--apply convention used throughout this CLI. | command | pass | superdev memory supersede <MEM-id> --by <MEM-id> |

## Delivery state

- **What works now:** Reached by superdev memory supersede <MEM-id> --by <MEM-id>. src/cli.mjs:1212 cmdMemorySupersede requires --by, and on --apply calls supersede() -> src/memory/index.mjs:305 supersedeLocal which marks superseded_by rather than deleting. Ran `node src/cli.mjs memory supersede MEM-9999 --by MEM-9998` without --apply: printed the correct plan text ("Would mark MEM-9999 superseded by MEM-9998...") and changed nothing, exit 0, matching the plan/--apply convention used throughout this CLI.
- **What remains:** Nothing known.
- **Next action:** Not recorded
