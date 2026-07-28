<!-- superdev:generated source=ENT-0027 revision=2087 hash=85eecaea16e680eacdbf24fa1abd4854201a8299171ff8ec6ecb9f2fcb0b0ab5 -->
# Entity: task_assignments

- **Status:** Specified
- **Owning module:** Task and Implementation Lifecycle
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

Ownership of a task by a developer and an agent.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| task_id | text | n | - | none | none |
| developer_id | text | y | - | none | none |
| agent_id | text | y | - | none | none |
| branch_id | text | y | - | none | none |
| session_id | text | y | - | none | none |
| assigned_at | text | n | - | none | none |
| released_at | text | y | - | none | none |
| active | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| agent_id | outgoing | agents | n:1 | set_null | task_assignments.agent_id references agents.id. |
| branch_id | outgoing | branches | n:1 | set_null | task_assignments.branch_id references branches.id. |
| developer_id | outgoing | developers | n:1 | set_null | task_assignments.developer_id references developers.id. |
| session_id | outgoing | work_sessions | n:1 | set_null | task_assignments.session_id references work_sessions.id. |
| task_id | outgoing | tasks | n:1 | cascade | task_assignments.task_id references tasks.id. |

```mermaid
erDiagram
  TASK_ASSIGNMENTS }o--|| AGENTS : AGENT_ID
  TASK_ASSIGNMENTS }o--|| BRANCHES : BRANCH_ID
  TASK_ASSIGNMENTS }o--|| DEVELOPERS : DEVELOPER_ID
  TASK_ASSIGNMENTS }o--|| WORK_SESSIONS : SESSION_ID
  TASK_ASSIGNMENTS }o--|| TASKS : TASK_ID
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
