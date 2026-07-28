<!-- superdev:generated source=ENT-0022 revision=2087 hash=e6bfc8d74ff9b2935a34eace761b9c8148dae41fdc9562d58745ab34b5ce4153 -->
# Entity: non_functional_requirements

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A security, performance, privacy, accessibility, or reliability requirement a feature can reference.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| module_id | text | y | - | none | none |
| feature_id | text | y | - | none | none |
| category | text | n | - | none | none |
| requirement | text | n | - | none | none |
| target | text | y | - | none | none |
| target_source | text | y | - | none | none |
| measurement_method | text | y | - | none | none |
| status | text | n | 'unmeasured' | none | none |
| created_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | non_functional_requirements.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | non_functional_requirements.module_id references modules.id. |
| project_id | outgoing | projects | n:1 | cascade | non_functional_requirements.project_id references projects.id. |

```mermaid
erDiagram
  NON_FUNCTIONAL_REQUIREMENTS }o--|| FEATURES : FEATURE_ID
  NON_FUNCTIONAL_REQUIREMENTS }o--|| MODULES : MODULE_ID
  NON_FUNCTIONAL_REQUIREMENTS }o--|| PROJECTS : PROJECT_ID
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
