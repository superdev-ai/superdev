<!-- superdev:generated source=FEAT-0026 revision=2984 hash=563cd6affe2b69c34f127ac7bf8da6de6d0025b905fb692e833cc4ea2be1ba74 -->
# Feature: List modules

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show all modules in the product model
- **User:** A non-technical founder or a coding agent resuming work wants a quick map of the whole product before diving into any one part of it.
- **User value:** Not recorded
- **Scope:** in: lists every module recorded in the product model with its id, name, current feature count, and status, orders modules by their defined sequence, not alphabetically, is read only, no flags to filter or modify; out: does not show module detail like purpose, scope, or owned data, that is module show, does not show feature-level status breakdown, only a total count per module, does not let you create, rename, or reorder modules
- **Affected contracts:** none linked

### Primary flow

1. run superdev module list
2. read the printed table of modules, each row showing id, name, feature count, and status

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev module list returns every defined module | Run superdev module list and record what was observed. | Met | EV-0030 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | the feature count per module is computed live from the features table on every call, so it always matches the current count even if features were added since the module was defined |
| Empty States | Applicable | if no modules are recorded yet, the command prints 'Nothing recorded yet for modules' instead of an empty table |
| Ordering | Applicable | modules are ordered by their sequence column first and id second, so the list order is stable and matches the product's intended reading order rather than insertion order |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2060 maps 'module list' to cmdModuleList. Ran `node src/cli.mjs module list`, printed a table of 11 modules with id, name, feature count, and status. | command | pass | superdev module list |
| The api_services table exists, created by migration 008, and nine services group all seventy operations with none left loose. Section 6.1 defines a service as the boundary that owns operations, and every operation now sits under one. | validator | pass | scripts/validate/data-model.mjs |

## Delivery state

- **What works now:** Reached by superdev module list. src/cli.mjs:2060 maps 'module list' to cmdModuleList. Ran `node src/cli.mjs module list`, printed a table of 11 modules with id, name, feature count, and status.
- **What remains:** Nothing known.
- **Next action:** Not recorded
