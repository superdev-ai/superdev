<!-- superdev:generated source=ENT-0009 revision=2087 hash=b746c88b76a4183a1626c51603c23c623a020964b4deddfed99653c5f5eca7f4 -->
# Entity: surfaces

- **Status:** Specified
- **Owning module:** Local Control Center
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

The surfaces table. The requirements document calls this "ui surfaces".

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| feature_id | text | y | - | none | none |
| module_id | text | n | - | none | none |
| name | text | n | - | none | none |
| surface_type | text | n | 'page' | none | none |
| route | text | y | - | none | none |
| purpose | text | y | - | none | none |
| primary_role | text | y | - | none | none |
| components_json | text | n | '[]' | none | none |
| entities_shown_json | text | n | '[]' | none | none |
| responsive_behavior | text | y | - | none | none |
| accessibility_notes | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | surfaces.feature_id references features.id. |
| module_id | outgoing | modules | n:1 | cascade | surfaces.module_id references modules.id. |
| surface_id | incoming | ui_actions | n:1 | cascade | ui_actions.surface_id references surfaces.id. |

```mermaid
erDiagram
  SURFACES }o--|| FEATURES : FEATURE_ID
  SURFACES }o--|| MODULES : MODULE_ID
  UI_ACTIONS }o--|| SURFACES : SURFACE_ID
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
