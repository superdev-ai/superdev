<!-- superdev:generated source=MOD-0002 revision=4066 hash=de5789b7a075e0b3265f9727a7ad435603326993a159c311b7b6c37fae704881 -->
# Product Model and Orchestration - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| List modules | superdev module list returns every defined module | Run superdev module list and record what was observed. | Met |
| Show a module | superdev module show <MODULE-id> returns the module's full record | Run superdev module show <MODULE-id> and record what was observed. | Met |
| List goals | superdev goal list returns every defined goal | Run superdev goal list and record what was observed. | Met |
| Show a goal | superdev goal show <GOAL-id> returns the goal's full record | Run superdev goal show <GOAL-id> and record what was observed. | Met |
| List milestones | superdev milestone list returns every defined milestone | Run superdev milestone list and record what was observed. | Met |
| Show a milestone | superdev milestone show <MILESTONE-id> returns the milestone's full record | Run superdev milestone show <MILESTONE-id> and record what was observed. | Met |
| List features | superdev feature list returns every defined feature | Run superdev feature list and record what was observed. | Met |
| Show a feature | superdev feature show <FEATURE-id> returns the feature's full record | Run superdev feature show <FEATURE-id> and record what was observed. | Met |
| Deepen a feature specification | superdev feature depth <FEATURE-id> <depth> increases the recorded specification depth of that feature | Run superdev feature depth <FEATURE-id> <depth> and record what was observed. | Met |
| Accept a feature | superdev feature accept <FEATURE-id> marks the feature accepted and unlocks its tasks | Run superdev feature accept <FEATURE-id> and record what was observed. | Met |
| List workflows | superdev workflow list returns every defined workflow | Run superdev workflow list and record what was observed. | Met |
| Show a workflow | superdev workflow show <WORKFLOW-id> returns the workflow's steps and behavior | Run superdev workflow show <WORKFLOW-id> and record what was observed. | Met |
| Show architecture | superdev architecture show returns the recorded architecture decisions | Run superdev architecture show and record what was observed. | Met |
| Show data schema | superdev schema show returns the current schema definition | Run superdev schema show and record what was observed. | Met |
| Show API surface | superdev api show returns defined API services and operations | Run superdev api show and record what was observed. | Met |
| List integrations | superdev integration list returns every defined integration | Run superdev integration list and record what was observed. | Met |
| Author the product map after initialization | A goal recorded through the command carries success criteria that progress can count | Record a goal and a criterion, then read superdev goal show | Met |
| Author the product map after initialization | A feature created through the command lands in draft and is refused acceptance while thin | Create one, run feature accept, and read the refusal | Met |
| Author the product map after initialization | Moving a feature leaves its contract, tasks and evidence intact | Move one and read feature show before and after | Met |
| Record what the product deliberately does not do | A brief's out-of-scope section reaches the generated foundations | Initialize from a brief with an Out of scope section and read talks/foundations/product.md | Met |
| Record what the product deliberately does not do | Scope can be recorded, listed and removed after init | Run superdev scope record, scope list and scope remove against a project | Met |
| Record what the product deliberately does not do | A hand edit to the Non-goals section is refused by naming the command that writes it | Edit the section in a generated document and run superdev docs accept | Met |
| Prove a goal success criterion with evidence | Evidence against a goal success criterion is stored and marks it met | Record passing evidence against a GSC id and read the criterion and the goal | Met |
| Prove a goal success criterion with evidence | A milestone exit condition can be marked met with its reading | Mark a condition met and read the milestone back | Met |
| Prove a goal success criterion with evidence | An identifier the write cannot store is refused in the plan, naming what it is and what to do | Plan evidence against an identifier of the wrong kind | Met |
| Author the rest of the product map | A feature can be accepted at standard depth | Record a surface, an entity, a workflow and an observability requirement against a feature at standard depth, then accept it | Met |
| Author the rest of the product map | Each record refuses what would make it meaningless, naming the remedy | Record a workflow with no steps, an integration with no absence behaviour, and a migration with no rollback | Met |
| Author the rest of the product map | A value the schema does not accept is refused by name, with the accepted values | Record a data entity with an invalid sensitivity class | Met |
| Settle a module completeness step | A step moves from open to filled with a summary, and readiness counts it as done. | Checked by hand against the running product. | Met |
| Settle a module completeness step | A step marked not applicable requires a reason and leaves the readiness total rather than counting against it. | Checked by hand against the running product. | Met |
| Settle a module completeness step | Both refuse an empty sentence, so a step cannot be closed by declaring it closed. | Checked by hand against the running product. | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, validator, manual_check | 21 | exists |
| Applicable edge-case categories | command, validator, manual_check | 58 | exists |
| Permission boundaries | command, validator, manual_check | 0 | missing |
| State machines including illegal transitions | command, validator, manual_check | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| All fifteen product map commands from section 12.4 run and print real records: 11 modules, 5 goals, 9 milestones, 91 features, 9 workflows, 9 runtime pieces, 43 entities, 70 operations, 13 integrations. | command | pass | src/cli/product-map.mjs | Current |
| All fifteen product map commands from section 12.4 run and print real records: 11 modules, 5 goals, 9 milestones, 91 features, 9 workflows, 9 runtime pieces, 43 entities, 70 operations, 13 integrations. | command | pass | src/cli/product-map.mjs | Current |
| Ran `node src/cli.mjs integration list` in ~/Projects/Personal/superdev, got a real 13-row table (INT-0001..INT-0013) with configured/verified status and per-integration fallback behavior, backed by src/cli.mjs:1145 cmdIntegrationList calling productMap().integrationList against the live project DB. | command | pass | superdev integration list | Current |
| src/cli.mjs:2060 maps 'module list' to cmdModuleList. Ran `node src/cli.mjs module list`, printed a table of 11 modules with id, name, feature count, and status. | command | pass | superdev module list | Current |
| src/cli.mjs:2061 maps 'module show' to cmdModuleShow. Ran `node src/cli.mjs module show MOD-0002`, printed full detail: status, purpose, outside-its-scope, list of 16 features, and 19 owned data entities. | command | pass | superdev module show <MODULE-id> | Current |
| src/cli.mjs:2062 maps 'goal list' to cmdGoalList. Ran `node src/cli.mjs goal list`, printed a table of 5 goals with feature counts and criteria-met counts. | command | pass | superdev goal list | Current |
| src/cli.mjs:2063 maps 'goal show' to cmdGoalShow. Ran `node src/cli.mjs goal show GOAL-0001`, printed status, outcome, why it matters, success criteria (2, both Unmet with target text), and list of 33 serving features. | command | pass | superdev goal show <GOAL-id> | Current |
| src/cli.mjs:2064 maps 'milestone list' to cmdMilestoneList. Ran `node src/cli.mjs milestone list`, printed a table of 9 milestones with feature counts and status. | command | pass | superdev milestone list | Current |
| src/cli.mjs:2065 maps 'milestone show' to cmdMilestoneShow. Ran `node src/cli.mjs milestone show MS-0001`, printed status, delivers text, scheduled feature completion count, exit conditions, and a list of 29 scheduled features. | command | pass | superdev milestone show <MILESTONE-id> | Current |
| src/cli.mjs:2066 maps 'feature list' to cmdFeatureList. Ran `node src/cli.mjs feature list`, printed a table of 91 features with id, name, module, depth, criteria-met, and status columns. | command | pass | superdev feature list | Current |
| src/cli.mjs line 1131-1134 cmdFeatureShow wired in COMMANDS table at line 2067. Ran: node src/cli.mjs feature show FEAT-0001, returned full detail (status, depth, module, milestone, goals, purpose, acceptance criteria, tasks). Ran with bad id FEAT-9999, got clean error 'There is no feature FEAT-9999.' exit 1. | command | pass | superdev feature show <FEAT-id> | Current |
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/cli.mjs line 1984-2013 cmdFeatureDepth wired in COMMANDS table at line 2090. Ran: node src/cli.mjs feature depth FEAT-0001, returned requirement-by-requirement readiness table (2 of 6 recorded, with fix hints for missing ones). Ran without id: node src/cli.mjs feature depth, returned org-wide gap report. | command | pass | superdev feature depth <FEAT-id> | Current |
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/cli.mjs line 1967-1982 cmdFeatureAccept wired in COMMANDS table at line 2089, delegates to acceptFeature in src/features/acceptance.mjs. Ran: node src/cli.mjs feature accept FEAT-0001 (no --apply), returned a clear readiness report naming the 4 of 6 missing requirements and instructing to record them or lower depth. | command | pass | superdev feature accept <FEAT-id> | Current |
| src/cli.mjs line 1135 cmdWorkflowList wired in COMMANDS table at line 2068. Ran: node src/cli.mjs workflow list, returned a table of 9 workflows with id, name, step count, status. | command | pass | superdev workflow list | Current |
| src/cli.mjs line 1136-1139 cmdWorkflowShow wired in COMMANDS table at line 2069. Ran: node src/cli.mjs workflow show WF-0001, returned full detail including status, feature, trigger, completion condition, and all 11 numbered steps with expected outcomes and failure notes. Bad id WF-9999 gave clean error. | command | pass | superdev workflow show <WF-id> | Current |
| src/cli.mjs line 1140 cmdArchitectureShow wired in COMMANDS table at line 2070. Ran: node src/cli.mjs architecture show, returned 9 runtime pieces, 9 connections, and 11 modules of the accepted architecture. | command | pass | superdev architecture show | Current |
| src/cli.mjs line 1141-1143 cmdSchemaShow wired in COMMANDS table at line 2071. Ran: node src/cli.mjs schema show, returned 43 data entities with field counts and status. Entity-scoped lookup also runs (returns a clean not-found message for a name that does not match a table). | command | pass | superdev schema show [entity] | Current |
| src/cli.mjs line 1144 cmdApiShow wired in COMMANDS table at line 2072. Ran: node src/cli.mjs api show, returned 70 API operations with style, state-change flag, and status. | command | pass | superdev api show | Current |
| The api_services table exists, created by migration 008, and nine services group all seventy operations with none left loose. Section 6.1 defines a service as the boundary that owns operations, and every operation now sits under one. | validator | pass | scripts/validate/data-model.mjs | Current |
| In a throwaway project: goal record created GOAL-0001 and said it was unmeasurable until it carried a criterion; goal criterion added GSC-0001 with its measurement and target; the database shows the criterion unmet against the goal, which is what progress counts. | manual_check | pass | - | Current |
| feature create drafted FEAT-0002 in MOD-0002 at microspec depth with status draft, and told the reader the depth gate would refuse acceptance until the specification was written. A second feature with the same name was refused, naming the one that existed. | manual_check | pass | - | Current |
| feature move reassigned FEAT-0001 from MOD-0001 to MOD-0002 and the database shows the new module with the feature's name, depth and status unchanged. This very feature, FEAT-0092, was created and specified through the new commands rather than by a script. | manual_check | pass | - | Current |
| A brief's out-of-scope line reached the generated Non-goals section, with its provenance | manual_check | pass | - | Current |
| Scope was recorded, listed and removed through the CLI on a real project | manual_check | pass | - | Current |
| A hand edit to Non-goals is refused with the command that writes it | manual_check | pass | - | Current |
| Evidence against a goal success criterion is stored and marks it met, and a failure takes it back | manual_check | pass | - | Current |
| A milestone condition can be marked met with the reading that decided it | manual_check | pass | - | Current |
| An unstorable identifier is refused in the plan, and a driver failure is now a sentence | manual_check | pass | - | Current |
| A feature is accepted at standard depth, which no project could do before | manual_check | pass | - | Current |
| Each record refuses what would make it meaningless, and names the remedy | manual_check | pass | - | Current |
| A value the schema will not accept is refused by name, listing what it accepts | manual_check | pass | - | Current |
| Surface actions are written to ui_actions, which is where every interface counter reads them | manual_check | pass | - | Current |
| The ten remaining record types the interface reads now have authors, and three defects were found by exercising them | manual_check | pass | - | Current |
| The five empty states that told readers to wait now name the command | manual_check | pass | - | Current |
| All 21 alignment warnings name the command that clears them | manual_check | pass | - | Current |
| A concept can be converted from the command line, and unconverted ones are reported | manual_check | pass | - | Current |
| Every write command is routed by a skill, and every trigger names the command that resolves it | manual_check | pass | - | Current |
| An assumption still holding is reported, and the decision remedy names decision commands again | manual_check | pass | - | Current |
| Security review is routed to the installed reviewer, all eight providers are named by a skill, and recording a goal hands the session to the harness | manual_check | pass | - | Current |
| Module completeness is seeded by the command that creates a module, the exclusion message tells the two cases apart, and an undetectable gap is recorded rather than warned about badly | manual_check | pass | - | Current |
| A low-severity note reports without failing the check, and high or medium still fail | manual_check | pass | - | Current |
| The recorded surfaces match the interface that ships, and a release condition now says so | manual_check | pass | - | Current |
| On a disposable project, filling step 1 moved it from Open to Specified and the readiness component moved from 0 of 20 to 1 of 19. | manual_check | pass | - | Current |
| Marking Internationalization not applicable dropped the readiness total from 20 to 19 rather than counting the step against it. | manual_check | pass | - | Current |
| Filling with no summary, marking not applicable with no reason, and filling with whitespace all refused with a sentence naming what was missing; a step number of 21 refused with the range. | manual_check | pass | - | Current |
| All eleven modules settled against their own records: 113 steps specified, 64 marked not applicable with a reason, 43 left honestly open. Readiness moved from 0 of 220 to 113 of 156. | manual_check | pass | - | Current |
| AU-002 and AU-003 added to the authorable validator, derived from migration SQL. It reads 28 enumerated state columns and finds 8 that nothing in src can move: modules, schema_migrations, integrations twice, branches, memory_embeddings, changes and test_plans. Removing an entry from IMMOVABLE escalates it to an error, which was checked by hand. 126 of 126 tests pass and the gate reports no errors. | manual_check | pass | - | Current |
| All 43 open steps filled from the shipped interface and schema rather than invented: module completeness moved 113 of 156 to 156 of 156, and readiness from 91 to 99 percent. The only item left is the deferred cloud synchronization capability area. | manual_check | pass | - | Current |
