<!-- superdev:generated source=FEAT-0027 revision=2943 hash=3a155ac2fa4d15e9539a3db34e4c88cd7dddfdef65baafc4bd4434c468717235 -->
# Feature: Show a module

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show detail for a single module including scope and dependencies
- **User:** A developer or designer about to work inside one part of the product wants that module's full detail, boundaries, and everything it owns, before touching code.
- **User value:** Not recorded
- **Scope:** in: shows one module's status, purpose, and explicit out-of-scope statement, lists every feature that belongs to the module with its id, name, and status, lists every data entity, API operation, surface, and integration owned by the module, when any exist, refuses with a clear error if the module id does not exist; out: does not show the module's dependencies on other modules or workflows crossing module boundaries, does not let you edit the module's purpose or scope from this command, does not show historical changes to the module, only its current recorded state
- **Affected contracts:** none linked

### Primary flow

1. run superdev module show <MOD-id>
2. read the status, purpose, and out-of-scope statement
3. read the list of features belonging to the module with each one's status
4. read the owned data entities, operations, surfaces, and integrations, when the module has any

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev module show <MODULE-id> returns the module's full record | Run superdev module show <MODULE-id> and record what was observed. | Met | EV-0031 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | a module with zero features prints 'None' under the features heading rather than omitting the section; a module with no data entities, operations, surfaces, or integrations simply omits those sections entirely |
| Invalid Input | Applicable | an id that does not match any module throws 'There is no module <id>' rather than returning a blank record |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| src/cli.mjs:2061 maps 'module show' to cmdModuleShow. Ran `node src/cli.mjs module show MOD-0002`, printed full detail: status, purpose, outside-its-scope, list of 16 features, and 19 owned data entities. | command | pass | superdev module show <MODULE-id> |

## Delivery state

- **What works now:** Reached by superdev module show <MODULE-id>. src/cli.mjs:2061 maps 'module show' to cmdModuleShow. Ran `node src/cli.mjs module show MOD-0002`, printed full detail: status, purpose, outside-its-scope, list of 16 features, and 19 owned data entities.
- **What remains:** Nothing known.
- **Next action:** Not recorded
