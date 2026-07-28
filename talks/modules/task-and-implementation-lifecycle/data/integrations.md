<!-- superdev:generated source=ENT-0017 revision=2087 hash=42ba216969bc749d8ea69b021a459470699551c08bf2ec586576d007398f8483 -->
# Entity: integrations

- **Status:** Specified
- **Owning module:** Task and Implementation Lifecycle
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

An external or internal system dependency a feature can reference.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| feature_id | text | y | - | none | none |
| module_id | text | n | - | none | none |
| name | text | n | - | none | none |
| purpose | text | y | - | none | none |
| provider | text | y | - | none | none |
| environments_json | text | n | '[]' | none | none |
| auth_approach | text | y | - | none | none |
| configuration_status | text | n | 'unconfigured' | none | none |
| contract_refs_json | text | n | '[]' | none | none |
| failure_behavior | text | y | - | none | none |
| verification_status | text | n | 'unverified' | none | none |
| status | text | n | 'draft' | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | integrations.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | integrations.module_id references modules.id. |

```mermaid
erDiagram
  INTEGRATIONS }o--|| FEATURES : FEATURE_ID
  INTEGRATIONS }o--|| MODULES : MODULE_ID
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
