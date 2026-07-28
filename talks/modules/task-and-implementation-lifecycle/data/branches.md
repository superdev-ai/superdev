<!-- superdev:generated source=ENT-0030 revision=2087 hash=178aa77e9cd438c6d33733c69d417779c307b07966cc43d754b535aa46ef910f -->
# Entity: branches

- **Status:** Specified
- **Owning module:** Task and Implementation Lifecycle
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

The git branch a task's work happens on.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| name | text | n | - | none | none |
| worktree_fingerprint | text | y | - | none | none |
| head_revision | text | y | - | none | none |
| dirty | integer | n | 0 | none | none |
| status | text | n | 'active' | none | none |
| last_seen_at | text | y | - | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| project_id | outgoing | projects | n:1 | cascade | branches.project_id references projects.id. |
| branch_id | incoming | task_assignments | n:1 | set_null | task_assignments.branch_id references branches.id. |
| branch_id | incoming | work_sessions | n:1 | set_null | work_sessions.branch_id references branches.id. |

```mermaid
erDiagram
  BRANCHES }o--|| PROJECTS : PROJECT_ID
  TASK_ASSIGNMENTS }o--|| BRANCHES : BRANCH_ID
  WORK_SESSIONS }o--|| BRANCHES : BRANCH_ID
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
