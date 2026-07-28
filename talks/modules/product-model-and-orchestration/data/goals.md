<!-- superdev:generated source=ENT-0002 revision=2087 hash=057299a0dd23c7a4594d95b7e3e7809526b95ea64a54e2d2892d9b2297301769 -->
# Entity: goals

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A lasting business, user, or technical outcome for a project.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| name | text | n | - | none | none |
| description | text | y | - | none | none |
| why_it_matters | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| priority | text | y | - | none | none |
| sequence | integer | n | 0 | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| project_id | outgoing | projects | n:1 | cascade | goals.project_id references projects.id. |

```mermaid
erDiagram
  GOALS }o--|| PROJECTS : PROJECT_ID
```

## Lifecycle

- **Created by:** no operation recorded
- **Read or updated by:** superdev goal list
- **Deleted:** Not recorded
- **Retention:** none declared

## Indexes and uniqueness

- None recorded. The schema source outranks this prose.

## Migration notes

| Migration | Forward | Rollback | Compatibility | Status |
|---|---|---|---|---|
| 001_initial.sql | Creates 58 tables and alters 0. Tables touched: projects, source_material, discovery_items, discovery_links, questions, goals, goal_success_criteria, milestones, modules, features. | Restore the backup taken immediately before this migration ran. The runner writes one with VACUUM INTO before applying anything, and prints its path. There is no down migration: section 12.3 requires ordered migration files and forbids direct schema push, and a reversal written by hand would be a second unversioned path. | Recorded checksum 685c01b253bea226. The migrations validator rebuilds the schema from every file and reports drift if this file changes after being applied. | Applied |
