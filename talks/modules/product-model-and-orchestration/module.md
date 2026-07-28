<!-- superdev:generated source=MOD-0002 revision=2942 hash=a3b8c8e04c047d93fcdda82acb4b9aad95bd033d8cfc24487c1a9d82cb8d8224 -->
# Module: Product Model and Orchestration

- **Status:** Planned
- **Purpose:** Owns the canonical product model (goals, milestones, modules, features, workflows, tasks and their relationships) and routes all product work through it and through specialist providers via the project skill.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

No surfaces recorded.

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev architecture show superdev architecture show | Show the product architecture. | superdev architecture show |
| superdev cloud connect superdev cloud connect | Connect the product to cloud synchronization. | superdev cloud connect |
| superdev cloud status superdev cloud status | Report cloud connection status. | superdev cloud status |
| superdev feature accept <FEATURE-id> superdev feature accept <FEATURE-id> | Accept a feature specification. | superdev feature accept <FEATURE-id> |
| superdev feature depth <FEATURE-id> <depth> superdev feature depth <FEATURE-id> <depth> | Deepen a feature specification to the given depth. | superdev feature depth <FEATURE-id> <depth> |
| superdev feature list superdev feature list | List all features. | superdev feature list |
| superdev feature show <FEATURE-id> superdev feature show <FEATURE-id> | Show the detail of one feature. | superdev feature show <FEATURE-id> |
| superdev goal list superdev goal list | List all goals. | superdev goal list |
| superdev goal show <GOAL-id> superdev goal show <GOAL-id> | Show the detail of one goal. | superdev goal show <GOAL-id> |
| superdev integration list superdev integration list | List integrations. | superdev integration list |
| superdev milestone list superdev milestone list | List all milestones. | superdev milestone list |
| superdev milestone show <MILESTONE-id> superdev milestone show <MILESTONE-id> | Show the detail of one milestone. | superdev milestone show <MILESTONE-id> |
| superdev module list superdev module list | List all modules in the product map. | superdev module list |
| superdev module show <MODULE-id> superdev module show <MODULE-id> | Show the detail of one module. | superdev module show <MODULE-id> |
| superdev plan superdev plan | Produce the structured implementation plan for the accepted product model. | superdev plan |
| superdev status superdev status | Give a plain explanation of the current product state. | superdev status |
| superdev sync superdev sync | Synchronize local and cloud state. | superdev sync |
| superdev sync --resolve superdev sync --resolve | Resolve synchronization conflicts. | superdev sync --resolve |
| superdev workflow list superdev workflow list | List all workflows. | superdev workflow list |
| superdev workflow show <WORKFLOW-id> superdev workflow show <WORKFLOW-id> | Show the detail of one workflow. | superdev workflow show <WORKFLOW-id> |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| api_operations | owner | api_operations |
| api_services | owner | api_services |
| changes | owner | changes |
| data_fields | owner | data_fields |
| data_relationships | owner | data_relationships |
| feature_acceptance_criteria | owner | feature_acceptance_criteria |
| features | owner | features |
| goals | owner | goals |
| jobs | owner | jobs |
| milestones | owner | milestones |
| modules | owner | modules |
| non_functional_requirements | owner | non_functional_requirements |
| permissions | owner | permissions |
| projects | owner | projects |
| roles | owner | roles |
| test_plans | owner | test_plans |
| webhooks | owner | webhooks |
| workflow_steps | owner | workflow_steps |
| workflows | owner | workflows |

## Wiring (key actions end to end)

No actions recorded, so no end-to-end path can be asserted.

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | if no modules are recorded yet, the command prints 'Nothing recorded yet for modules' instead of an empty table; a module with zero features prints 'None' under the features heading rather than omitting the section; a module with no data entities, operations, surfaces, or integrations simply omits those sections entirely; if no goals are recorded yet, prints 'Nothing recorded yet for goals' instead of an empty table; a goal with no success criteria prints 'Nothing measurable is recorded, so nothing can show whether this goal was reached.'; a goal with no linked features prints 'None, so nothing being built moves this goal.'; no milestones recorded prints 'Nothing recorded yet for milestones.'; no exit conditions recorded prints 'None recorded, so nothing says when this is reached.'; no features scheduled prints 'Nothing is scheduled into it.'; no features match the given filters prints 'Nothing recorded yet for features.'; a feature with no user statement recorded shows 'Who wants it: Not recorded'; one with no acceptance criteria shows 'None, so nothing says what done means.'; one with no tasks shows 'None derived yet.'; when no accepted feature has an unmet depth requirement, the org-wide report prints 'Every accepted feature carries what its declared depth promises.' instead of an empty table; If no workflows are recorded, the command prints a plain nothing-to-show message instead of an empty table.; A workflow that exists but has zero steps recorded prints a direct warning that following it proves nothing, instead of showing an empty steps list.; Each of the four sections, pieces, connections, modules, integrations, prints its own none-recorded line independently if that section is empty, rather than one blanket empty message for the whole command.; An entity that is only planned and has no table yet prints that no table exists so it has no fields, distinguishing not-built-yet from a genuinely empty table.; Zero recorded services prints a line stating every operation is loose rather than grouped under a boundary, instead of an empty services block.; Zero recorded integrations prints the shared nothing-to-show message instead of an empty table. | List modules, Show a module, List goals, Show a goal, List milestones, Show a milestone, List features, Show a feature, Deepen a feature specification, List workflows, Show a workflow, Show architecture, Show data schema, Show API surface, List integrations |
| Boundary Values | a goal with zero success criteria defined shows '0 of 0' met rather than an error or a percentage, since the count is a plain ratio of rows; the completed count only counts features whose status is complete, delivered, or implemented, so a feature that is in progress or blocked counts as not complete even if work on it has started; There is no row cap or pagination on this list, unlike some other product-map views, so every recorded workflow prints in one table regardless of count. | List goals, Show a goal, Show a milestone, List features, Show a feature, List workflows |
| Invalid Input | an id that does not match any module throws 'There is no module <id>' rather than returning a blank record; an unknown goal id prints 'There is no goal GOAL-9999.' and exits 1; omitting the id prints 'Say which goal: superdev goal show <GOAL-id>.' and exits 2; an unknown milestone id prints 'There is no milestone MS-9999.' and exits 1; omitting the id prints 'Say which milestone: superdev milestone show <MS-id>.' and exits 2; the --status filter is matched case-sensitively against the raw stored value, so --status Implemented (capitalized, matching what the table displays) returns nothing while --status implemented (the actual stored casing) returns the expected rows, with no error either way; an unknown feature id prints 'There is no feature FEAT-9999.' and exits 1; omitting the id prints 'Say which feature: superdev feature show <FEAT-id>.' and exits 2; a feature whose declared spec_depth string is not one of the known depths raises an error naming the bad depth and listing the valid ones, rather than silently checking zero requirements; any unmet requirement causes an error naming all of them together and exits 1, even when --apply was not passed, since acceptance is checked before the apply flag is considered; An id that matches no workflow throws a clean error naming the id, and the command exits non-zero rather than printing a partial or blank record.; An entity name or id that matches nothing throws a clean error naming what was looked up, and exits non-zero. | Show a module, Show a goal, List milestones, Show a milestone, List features, Show a feature, Deepen a feature specification, Accept a feature, Show a workflow, Show data schema |
| State Machine Violations | the org-wide gap report only flags features whose status is already accepted, a draft feature can be as thin as it likes and never appears in that report even if every requirement is missing; acceptance only ever moves a feature's status to accepted, it does not touch tasks directly, so a feature can be accepted with zero tasks until derive is run against it separately | Deepen a feature specification, Accept a feature |
| Concurrent Actions | the acceptance gate is re-checked inside the same transaction that applies it, so if the recorded requirements change between the initial check and --apply, the accept fails again naming whatever is now missing instead of accepting a feature that stopped qualifying | Accept a feature |
| Ordering | modules are ordered by their sequence column first and id second, so the list order is stable and matches the product's intended reading order rather than insertion order; success criteria are always returned ordered by their recorded sequence, and served features ordered by feature id, so repeated calls show the same order; milestones are listed in their defined sequence then id, not alphabetically or by feature count, so the table order matches the product roadmap order rather than any column shown; Rows are always ordered by workflow id, not by status or how recently a workflow was defined.; Steps always print in their recorded sequence number, not insertion order, so a step added out of order still lands in the right place.; Pieces and modules are ordered by their recorded sequence then id, while connections print in the order the edges were recorded, so the two lists are not sorted the same way.; Operations are always listed alphabetically by name regardless of which service or status they belong to, while services themselves are ordered by their own recorded sequence, so the two listings sort differently. | List modules, Show a goal, List milestones, List workflows, Show a workflow, Show architecture, Show API surface |
| Duplication | N/A - accepting an already-accepted feature simply re-runs the same requirement check and re-applies the same status, there is no duplicate record created | Accept a feature |
| Limits And Quotas | The operations table caps at the first 60 rows and tells the user to pass --json to get the rest when the true count is higher, confirmed with 70 real operations.; The fallback-behavior block only prints the first 8 integrations that have failure behavior recorded, alphabetically by name, confirmed with 13 total integrations in the table but only 8 shown in that block; the rest are only visible through --json. | Show API surface, List integrations |
| Versioning | The full listing reports schema version as the highest applied migration version, so a reader can tell the recorded data model apart from what has actually been migrated into this project's database. | Show data schema |
| Consistency | the feature count per module is computed live from the features table on every call, so it always matches the current count even if features were added since the module was defined; feature and criteria-met counts are computed live from their linking tables on every call, so the numbers always reflect current state, not a cached total; each requirement's fix hint stays the same regardless of how many other requirements are already met, so a feature missing 4 of 6 gets all 4 hints at once rather than one at a time; The view reflects the last accepted architecture record, not a live scan of the code, so it can silently diverge from what the codebase actually does if a change was made outside the recorded decision flow.; Configured and verified are the last recorded status, not a live check performed at list time, so an integration could actually be working or broken differently from what the tag shows. | List modules, List goals, Deepen a feature specification, Show architecture, List integrations |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Open | Not recorded |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Open | Not recorded |
| 4 | API surface | Open | Not recorded |
| 5 | Data | Open | Not recorded |
| 6 | End-to-end wiring | Open | Not recorded |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Open | Not recorded |
| 9 | Edge cases | Open | Not recorded |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Open | Not recorded |
| 12 | Accessibility | Open | Not recorded |
| 13 | Internationalization | Open | Not recorded |
| 14 | Feature flags | Open | Not recorded |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Open | Not recorded |
| 17 | URL state and deep links | Open | Not recorded |
| 18 | Performance | Open | Not recorded |
| 19 | Discoverability and SEO | Open | Not recorded |
| 20 | Compliance and product tests | Open | Not recorded |
