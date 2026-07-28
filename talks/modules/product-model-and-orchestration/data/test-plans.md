<!-- superdev:generated source=ENT-0023 revision=2087 hash=c9579d05a3e3f901f014a8d4c23de3ec19bc88865d6027feb3a97b7c3495b6fb -->
# Entity: test_plans

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** src/db/migrations
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

The agreed verification strategy for a feature or workflow.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| feature_id | text | y | - | none | none |
| workflow_id | text | y | - | none | none |
| module_id | text | y | - | none | none |
| name | text | n | - | none | none |
| strategy | text | n | - | none | none |
| how_to_run | text | y | - | none | none |
| passing_condition | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | test_plans.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | test_plans.module_id references modules.id. |
| project_id | outgoing | projects | n:1 | cascade | test_plans.project_id references projects.id. |
| workflow_id | outgoing | workflows | n:1 | cascade | test_plans.workflow_id references workflows.id. |

```mermaid
erDiagram
  TEST_PLANS }o--|| FEATURES : FEATURE_ID
  TEST_PLANS }o--|| MODULES : MODULE_ID
  TEST_PLANS }o--|| PROJECTS : PROJECT_ID
  TEST_PLANS }o--|| WORKFLOWS : WORKFLOW_ID
```

## Lifecycle

- **Created by:** no operation recorded
- **Read or updated by:** no operation recorded
- **Deleted:** Not recorded
- **Retention:** none declared

## Indexes and uniqueness

- None recorded. The schema source outranks this prose.

## Migration notes

| Migration | Forward | Rollback | Compatibility | Status |
|---|---|---|---|---|
| 008_changes_assumptions_test_plans_api_services.sql | Creates 6 tables and alters 1. Tables touched: changes, change_targets, assumptions, test_plans, test_plan_cases, api_services, api_operations. | Restore the backup taken immediately before this migration ran. The runner writes one with VACUUM INTO before applying anything, and prints its path. There is no down migration: section 12.3 requires ordered migration files and forbids direct schema push, and a reversal written by hand would be a second unversioned path. | Recorded checksum 038b409ed83caa66. The migrations validator rebuilds the schema from every file and reports drift if this file changes after being applied. | Applied |
