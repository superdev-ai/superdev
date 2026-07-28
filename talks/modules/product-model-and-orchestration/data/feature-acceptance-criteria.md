<!-- superdev:generated source=ENT-0006 revision=2087 hash=fe1d771c5d128239967b69ffbfc06fb514fb2b9693842146b737e8cd8ce00958 -->
# Entity: feature_acceptance_criteria

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

The conditions a feature must meet before it counts as complete.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| feature_id | text | n | - | none | none |
| criterion | text | n | - | none | none |
| verification_method | text | y | - | none | none |
| status | text | n | 'unmet' | none | none |
| evidence_id | text | y | - | none | none |
| sequence | integer | n | 0 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| feature_id | outgoing | features | n:1 | cascade | feature_acceptance_criteria.feature_id references features.id. |
| acceptance_criterion_id | incoming | verification_evidence | n:1 | set_null | verification_evidence.acceptance_criterion_id references feature_acceptance_criteria.id. |

```mermaid
erDiagram
  FEATURE_ACCEPTANCE_CRITERIA }o--|| FEATURES : FEATURE_ID
  VERIFICATION_EVIDENCE }o--|| FEATURE_ACCEPTANCE_CRITERIA : ACCEPTANCE_CRITERION_ID
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
