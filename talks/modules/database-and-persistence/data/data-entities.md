<!-- superdev:generated source=ENT-0013 revision=2087 hash=6f5b0cfc36427430400c20c4ad31e7dd8e5ae9652015550c596cd13170c0a1cf -->
# Entity: data_entities

- **Status:** Specified
- **Owning module:** Database and Persistence
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A persistent domain object. This schema is itself made of records of this kind.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| module_id | text | n | - | none | none |
| feature_id | text | y | - | none | none |
| name | text | n | - | none | none |
| purpose | text | y | - | none | none |
| store | text | y | - | none | none |
| schema_source | text | y | - | none | none |
| sensitivity_class | text | n | 'none' | none | none |
| retention_rule | text | y | - | none | none |
| deletion_semantics | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| position_x | real | y | - | none | none |
| position_y | real | y | - | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | set_null | data_entities.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | data_entities.module_id references modules.id. |
| entity_id | incoming | data_fields | n:1 | cascade | data_fields.entity_id references data_entities.id. |
| from_entity_id | incoming | data_relationships | n:1 | cascade | data_relationships.from_entity_id references data_entities.id. |
| to_entity_id | incoming | data_relationships | n:1 | cascade | data_relationships.to_entity_id references data_entities.id. |

```mermaid
erDiagram
  DATA_ENTITIES }o--|| FEATURES : FEATURE_ID
  DATA_ENTITIES }o--|| MODULES : MODULE_ID
  DATA_FIELDS }o--|| DATA_ENTITIES : ENTITY_ID
  DATA_RELATIONSHIPS }o--|| DATA_ENTITIES : FROM_ENTITY_ID
  DATA_RELATIONSHIPS }o--|| DATA_ENTITIES : TO_ENTITY_ID
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
