<!-- superdev:generated source=ENT-0029 revision=2087 hash=e62bbea6198fc0fd2ecf4dd31636d52d6e59b5a838303726aa677edee71819e2 -->
# Entity: agents

- **Status:** Specified
- **Owning module:** Task and Implementation Lifecycle
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

An autonomous or assisting system actor assigned to tasks.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| developer_id | text | n | - | none | none |
| harness | text | n | - | none | none |
| model_label | text | y | - | none | none |
| session_external_id | text | y | - | none | none |
| status | text | n | 'active' | none | none |
| last_seen_at | text | y | - | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| developer_id | outgoing | developers | n:1 | cascade | agents.developer_id references developers.id. |
| agent_id | incoming | task_assignments | n:1 | set_null | task_assignments.agent_id references agents.id. |
| agent_id | incoming | work_sessions | n:1 | set_null | work_sessions.agent_id references agents.id. |

```mermaid
erDiagram
  AGENTS }o--|| DEVELOPERS : DEVELOPER_ID
  TASK_ASSIGNMENTS }o--|| AGENTS : AGENT_ID
  WORK_SESSIONS }o--|| AGENTS : AGENT_ID
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
