<!-- superdev:generated source=ENT-0014 revision=2087 hash=1a23ac048ff2393f2c96d5b80e2efbdc520ce787f83e0d524e50cad438d22b8b -->
# Entity: data_fields

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

An attribute of a data entity.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| entity_id | text | n | - | none | none |
| name | text | n | - | none | none |
| type | text | n | - | none | none |
| nullable | integer | n | 1 | none | none |
| default_value | text | y | - | none | none |
| constraints_json | text | n | '[]' | none | none |
| sensitivity_class | text | n | 'none' | none | none |
| sequence | integer | n | 0 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| entity_id | outgoing | data_entities | n:1 | cascade | data_fields.entity_id references data_entities.id. |

```mermaid
erDiagram
  DATA_FIELDS }o--|| DATA_ENTITIES : ENTITY_ID
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
