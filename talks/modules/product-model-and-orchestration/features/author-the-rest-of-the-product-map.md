<!-- superdev:generated source=FEAT-0100 revision=3639 hash=56c3a11356de414d7b8391cf69e9cb0828b4936278ccfb5dcc34eff8d9435b6d -->
# Feature: Author the rest of the product map

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** none
- **Goals:** GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Give surfaces, data entities, operations, workflows, requirements, integrations, test plans, migrations, states and the glossary a write path, so standard and full spec depth become reachable
- **User:** Anybody whose product has a screen, stores something, exposes an operation or needs a security review, all of which the product asked for and none of which it could record
- **User value:** Not recorded
- **Scope:** in: Recording surfaces with their actions, data entities, API operations, workflows with ordered steps, non-functional requirements including security and privacy, integrations with their failure behaviour, test plans with how to run them, migrations with their rollback, state machines and glossary term, Reading the module from the feature, so a reader names one place rather than two; out: Inventing a field the reader did not give, because a plausible default in a specification is worse than a gap somebody can see
- **Affected contracts:** none linked

### Primary flow

1. The reader records what a feature touches, stores and exposes
2. The depth gate sees them and standard depth becomes satisfiable
3. The feature is accepted at the depth it actually claims

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A feature can be accepted at standard depth | Record a surface, an entity, a workflow and an observability requirement against a feature at standard depth, then accept it | Met | EV-0160 |
| Each record refuses what would make it meaningless, naming the remedy | Record a workflow with no steps, an integration with no absence behaviour, and a migration with no rollback | Met | EV-0161 |
| A value the schema does not accept is refused by name, with the accepted values | Record a data entity with an invalid sensitivity class | Met | EV-0162 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Duplication | Applicable | A second record with the same name in the same module is refused, naming the one that has it |
| Invalid Input | Applicable | A surface type outside the known set is refused, listing the set |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| A feature is accepted at standard depth, which no project could do before | manual_check | pass | - |
| Each record refuses what would make it meaningless, and names the remedy | manual_check | pass | - |
| A value the schema will not accept is refused by name, listing what it accepts | manual_check | pass | - |
| Surface actions are written to ui_actions, which is where every interface counter reads them | manual_check | pass | - |
| The ten remaining record types the interface reads now have authors, and three defects were found by exercising them | manual_check | pass | - |
| The five empty states that told readers to wait now name the command | manual_check | pass | - |
| All 21 alignment warnings name the command that clears them | manual_check | pass | - |
| A concept can be converted from the command line, and unconverted ones are reported | manual_check | pass | - |
| Every write command is routed by a skill, and every trigger names the command that resolves it | manual_check | pass | - |
| An assumption still holding is reported, and the decision remedy names decision commands again | manual_check | pass | - |
| Security review is routed to the installed reviewer, all eight providers are named by a skill, and recording a goal hands the session to the harness | manual_check | pass | - |

## Delivery state

- **What works now:** Not recorded
- **What remains:** Not recorded
- **Next action:** Not recorded
