<!-- superdev:generated source=ENT-0036 revision=2087 hash=5d403e41fa331c04e0aed25b39bb97b2d56e8709067f28de6af11d60ad64b415 -->
# Entity: decision_transitions

- **Status:** Specified
- **Owning module:** Hooks and Session Continuity
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

The decision transitions table. The requirements document calls this "decision supersession".

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| decision_id | text | n | - | none | none |
| from_status | text | y | - | none | none |
| to_status | text | n | - | none | none |
| scope_delta | text | y | - | none | none |
| actor_id | text | y | - | none | none |
| reason | text | y | - | none | none |
| created_at | text | n | - | none | none |
| sequence | integer | n | - | none | none |
| immutable_hash | text | n | - | none | secret |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| decision_id | outgoing | decisions | n:1 | cascade | decision_transitions.decision_id references decisions.id. |

```mermaid
erDiagram
  DECISION_TRANSITIONS }o--|| DECISIONS : DECISION_ID
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
