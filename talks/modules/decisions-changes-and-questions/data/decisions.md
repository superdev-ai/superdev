<!-- superdev:generated source=ENT-0035 revision=2087 hash=aca5790b0280d46c3f9883bb84167f6245b3944d94fa2a590e13c1fd3ea6fd7f -->
# Entity: decisions

- **Status:** Specified
- **Owning module:** Decisions, Changes, and Questions
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

An accepted choice and its observable rationale.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| project_id | text | n | - | none | none |
| title | text | n | - | none | none |
| status | text | n | 'proposed' | none | none |
| scope_type | text | y | - | none | none |
| scope_id | text | y | - | none | none |
| context | text | y | - | none | none |
| evidence_json | text | n | '[]' | none | none |
| criteria_json | text | n | '[]' | none | none |
| options_json | text | n | '[]' | none | none |
| decision | text | y | - | none | none |
| observable_rationale | text | y | - | none | none |
| consequences_json | text | n | '{}' | none | none |
| risks_json | text | n | '[]' | none | none |
| enforcement_json | text | n | '[]' | none | none |
| verification | text | y | - | none | none |
| revisit_triggers_json | text | n | '[]' | none | none |
| supersedes_id | text | y | - | none | none |
| superseded_by_id | text | y | - | none | none |
| body_hash | text | y | - | none | secret |
| accepted_by | text | y | - | none | none |
| accepted_at | text | y | - | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |
| expires_at | text | y | - | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| project_id | outgoing | projects | n:1 | cascade | decisions.project_id references projects.id. |
| decision_id | incoming | decision_transitions | n:1 | cascade | decision_transitions.decision_id references decisions.id. |
| decision_id | incoming | changes | n:1 | set_null | changes.decision_id references decisions.id. |

```mermaid
erDiagram
  DECISIONS }o--|| PROJECTS : PROJECT_ID
  DECISION_TRANSITIONS }o--|| DECISIONS : DECISION_ID
  CHANGES }o--|| DECISIONS : DECISION_ID
```

## Lifecycle

- **Created by:** no operation recorded
- **Read or updated by:** superdev decision list
- **Deleted:** Not recorded
- **Retention:** none declared

## Indexes and uniqueness

- None recorded. The schema source outranks this prose.

## Migration notes

| Migration | Forward | Rollback | Compatibility | Status |
|---|---|---|---|---|
| 001_initial.sql | Creates 58 tables and alters 0. Tables touched: projects, source_material, discovery_items, discovery_links, questions, goals, goal_success_criteria, milestones, modules, features. | Restore the backup taken immediately before this migration ran. The runner writes one with VACUUM INTO before applying anything, and prints its path. There is no down migration: section 12.3 requires ordered migration files and forbids direct schema push, and a reversal written by hand would be a second unversioned path. | Recorded checksum 685c01b253bea226. The migrations validator rebuilds the schema from every file and reports drift if this file changes after being applied. | Applied |
| 002_docs_coverage.sql | Creates 6 tables and alters 4. Tables touched: project_scope_items, glossary_terms, runtime_pieces, runtime_piece_edges, decision_links, capability_areas_v2, decisions, roles, documents. | Restore the backup taken immediately before this migration ran. The runner writes one with VACUUM INTO before applying anything, and prints its path. There is no down migration: section 12.3 requires ordered migration files and forbids direct schema push, and a reversal written by hand would be a second unversioned path. | Recorded checksum 4e7f28afe6bee99d. The migrations validator rebuilds the schema from every file and reports drift if this file changes after being applied. | Applied |
