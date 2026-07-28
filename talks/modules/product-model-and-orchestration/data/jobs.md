<!-- superdev:generated source=ENT-0018 revision=2087 hash=ab8566cbf1f01884e1f6ad12d75713fd61feb80935345c8bd9a021288f459083 -->
# Entity: jobs

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A background or scheduled process a feature can reference.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| feature_id | text | y | - | none | none |
| module_id | text | n | - | none | none |
| name | text | n | - | none | none |
| trigger | text | y | - | none | none |
| input_contract_json | text | n | '{}' | none | none |
| idempotency | text | y | - | none | none |
| retry_policy | text | y | - | none | none |
| failure_destination | text | y | - | none | none |
| timeout | text | y | - | none | none |
| concurrency | text | y | - | none | none |
| observability | text | y | - | none | none |
| delivery_guarantee | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | jobs.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | jobs.module_id references modules.id. |

```mermaid
erDiagram
  JOBS }o--|| FEATURES : FEATURE_ID
  JOBS }o--|| MODULES : MODULE_ID
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
