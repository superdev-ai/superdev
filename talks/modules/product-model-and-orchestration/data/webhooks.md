<!-- superdev:generated source=ENT-0019 revision=2087 hash=f0e3dbc05d8d08fbdadae6569b99028277ceb2c448a7bc7b24d5b35ef302d223 -->
# Entity: webhooks

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

An inbound or outbound event contract a feature can reference.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| feature_id | text | y | - | none | none |
| module_id | text | n | - | none | none |
| name | text | n | - | none | none |
| direction | text | n | - | none | none |
| endpoint_or_registration | text | y | - | none | none |
| identity_verification | text | y | - | none | none |
| replay_protection | text | y | - | none | none |
| ordering_behavior | text | y | - | none | none |
| retry_behavior | text | y | - | none | none |
| signing | text | y | - | none | none |
| payload_version | text | y | - | none | none |
| failure_visibility | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | webhooks.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | webhooks.module_id references modules.id. |

```mermaid
erDiagram
  WEBHOOKS }o--|| FEATURES : FEATURE_ID
  WEBHOOKS }o--|| MODULES : MODULE_ID
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
