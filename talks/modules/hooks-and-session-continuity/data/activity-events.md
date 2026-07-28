<!-- superdev:generated source=ENT-0038 revision=2087 hash=ffe4d64747aa65a55bb6539088c0dce213292a49766dcffedd9b098b6ede8d71 -->
# Entity: activity_events

- **Status:** Specified
- **Owning module:** Hooks and Session Continuity
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A logged event used for audit trails and hook processing.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| session_id | text | y | - | none | none |
| actor_id | text | y | - | none | none |
| actor_label | text | y | - | none | none |
| task_id | text | y | - | none | none |
| feature_id | text | y | - | none | none |
| event_type | text | n | - | none | none |
| summary | text | n | - | none | none |
| metadata_json | text | n | '{}' | none | none |
| created_at | text | n | - | none | none |
| sequence | integer | n | - | none | none |
| immutable_hash | text | n | - | none | secret |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | set_null | activity_events.feature_id references features.id. |
| project_id | outgoing | projects | n:1 | cascade | activity_events.project_id references projects.id. |
| session_id | outgoing | work_sessions | n:1 | set_null | activity_events.session_id references work_sessions.id. |
| task_id | outgoing | tasks | n:1 | set_null | activity_events.task_id references tasks.id. |

```mermaid
erDiagram
  ACTIVITY_EVENTS }o--|| FEATURES : FEATURE_ID
  ACTIVITY_EVENTS }o--|| PROJECTS : PROJECT_ID
  ACTIVITY_EVENTS }o--|| WORK_SESSIONS : SESSION_ID
  ACTIVITY_EVENTS }o--|| TASKS : TASK_ID
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
