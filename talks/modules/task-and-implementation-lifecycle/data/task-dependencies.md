<!-- superdev:generated source=ENT-0025 revision=2087 hash=3a0e0f80b7f9c5ed47575109ab92b8b3fa5e6cb56a9ecb45bb3c93e06eeb38d8 -->
# Entity: task_dependencies

- **Status:** Specified
- **Owning module:** Task and Implementation Lifecycle
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A task that must complete before another task can proceed.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| task_id | text | n | - | none | none |
| depends_on_task_id | text | n | - | none | none |
| dependency_type | text | n | 'blocks' | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| depends_on_task_id | outgoing | tasks | n:1 | cascade | task_dependencies.depends_on_task_id references tasks.id. |
| task_id | outgoing | tasks | n:1 | cascade | task_dependencies.task_id references tasks.id. |

```mermaid
erDiagram
  TASK_DEPENDENCIES }o--|| TASKS : DEPENDS_ON_TASK_ID
  TASK_DEPENDENCIES }o--|| TASKS : TASK_ID
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
| 001_initial.sql | Creates 58 tables and alters 0. Tables touched: projects, source_material, discovery_items, discovery_links, questions, goals, goal_success_criteria, milestones, modules, features. | Restore the backup taken immediately before this migration ran. The runner writes one with VACUUM INTO before applying anything, and prints its path. There is no down migration: section 12.3 requires ordered migration files and forbids direct schema push, and a reversal written by hand would be a second unversioned path. | Recorded checksum 685c01b253bea226. The migrations validator rebuilds the schema from every file and reports drift if this file changes after being applied. | Applied |
