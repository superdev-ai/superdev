<!-- superdev:generated source=ENT-0028 revision=2087 hash=0d366b4ba5a938db7d1b6d80e70aadb8ecb11075578cc7fb6fa0c5b40a743f03 -->
# Entity: developers

- **Status:** Specified
- **Owning module:** Task and Implementation Lifecycle
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A human user who owns or works on tasks.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| display_name | text | n | - | none | personal |
| external_identity | text | y | - | none | none |
| status | text | n | 'active' | none | none |
| created_at | text | n | - | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| project_id | outgoing | projects | n:1 | cascade | developers.project_id references projects.id. |
| developer_id | incoming | task_assignments | n:1 | set_null | task_assignments.developer_id references developers.id. |
| developer_id | incoming | agents | n:1 | cascade | agents.developer_id references developers.id. |
| developer_id | incoming | work_sessions | n:1 | set_null | work_sessions.developer_id references developers.id. |

```mermaid
erDiagram
  DEVELOPERS }o--|| PROJECTS : PROJECT_ID
  TASK_ASSIGNMENTS }o--|| DEVELOPERS : DEVELOPER_ID
  AGENTS }o--|| DEVELOPERS : DEVELOPER_ID
  WORK_SESSIONS }o--|| DEVELOPERS : DEVELOPER_ID
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
