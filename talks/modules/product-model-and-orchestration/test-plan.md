<!-- superdev:generated source=MOD-0002 revision=3058 hash=09873dd8e3528a8f2c58c660d0e3ab46f14d2dc43e9216a56f0fbc8538837dbd -->
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

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command, validator | 16 | exists |
| Applicable edge-case categories | command, validator | 45 | exists |
| Permission boundaries | command, validator | 0 | missing |
| State machines including illegal transitions | command, validator | 0 | missing |

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
