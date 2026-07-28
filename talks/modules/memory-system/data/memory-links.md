<!-- superdev:generated source=ENT-0042 revision=2087 hash=e6c6ec5ac6bebed8c558f5190e690310908c5c435db99ab5ab63a1003b530e3a -->
# Entity: memory_links

- **Status:** Specified
- **Owning module:** Memory System
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

The link connecting a memory entry to the records it concerns.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| memory_id | text | n | - | none | none |
| target_type | text | n | - | none | none |
| target_id | text | n | - | none | none |
| relationship | text | n | 'about' | none | none |
| target_version | integer | y | - | none | none |
| target_fingerprint | text | y | - | none | none |
| created_at | text | y | - | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| memory_id | outgoing | memory_entries | n:1 | cascade | memory_links.memory_id references memory_entries.id. |

```mermaid
erDiagram
  MEMORY_LINKS }o--|| MEMORY_ENTRIES : MEMORY_ID
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
