<!-- superdev:generated source=ENT-0008 revision=2087 hash=6b083b8d18c2020bf573bc4ea77857cd1c76f87baf873c09d89112c0a7205b67 -->
# Entity: workflow_steps

- **Status:** Specified
- **Owning module:** Product Model and Orchestration
- **Store:** project database
- **Schema source:** docs/prd.md section 14.1
- **Sensitivity:** none
- **Last verified:** see the generation marker at the top of this file.

## Purpose

A single action or system transition inside a workflow.

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| id | text | y | - | none | none |
| workflow_id | text | n | - | none | none |
| sequence | integer | n | - | none | none |
| owner_type | text | n | 'person' | none | none |
| owner_ref | text | y | - | none | none |
| action | text | n | - | none | none |
| input_contract | text | y | - | none | none |
| expected_result | text | y | - | none | none |
| failure_behavior | text | y | - | none | none |
| status | text | n | 'draft' | none | none |
| created_at | text | n | - | none | none |
| updated_at | text | n | - | none | none |
| version | integer | n | 1 | none | none |

## Relationships

| Relation | Direction | Target | Cardinality | On delete | Ownership |
|---|---|---|---|---|---|
| workflow_id | outgoing | workflows | n:1 | cascade | workflow_steps.workflow_id references workflows.id. |

```mermaid
erDiagram
  WORKFLOW_STEPS }o--|| WORKFLOWS : WORKFLOW_ID
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
