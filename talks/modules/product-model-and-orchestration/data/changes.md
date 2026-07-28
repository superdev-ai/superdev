<!-- superdev:generated source=ENT-0037 revision=2087 hash=2758150a1b7e8fd124f2cc184e79e6cf6840617ced573a77d544fa3c71ac1835 -->
# Entity: changes

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** src/db/migrations
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A recorded alteration to accepted product scope or behavior.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| summary | text | n | - | none | none |
| reason | text | n | - | none | none |
| change_type | text | n | 'scope_changed' | none | none |
| requested_by | text | y | - | none | none |
| decided_by | text | y | - | none | none |
| decision_id | text | y | - | none | none |
| task_id | text | y | - | none | none |
| session_id | text | y | - | none | none |
| status | text | n | 'recorded' | none | none |
| created_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| decision_id | outgoing | decisions | n:1 | set_null | changes.decision_id references decisions.id. |
| project_id | outgoing | projects | n:1 | cascade | changes.project_id references projects.id. |
| task_id | outgoing | tasks | n:1 | set_null | changes.task_id references tasks.id. |

```mermaid
erDiagram
  CHANGES }o--|| DECISIONS : DECISION_ID
  CHANGES }o--|| PROJECTS : PROJECT_ID
  CHANGES }o--|| TASKS : TASK_ID
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
