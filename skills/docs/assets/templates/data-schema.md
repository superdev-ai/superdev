<!-- Template: data entity. Universal core - persistence specifics come from the
     active data fragment. Schema source files outrank this prose. -->
# Entity: {{entity-name}}

- **Status:** draft | accepted | implemented
- **Owning module:** {{module}}
- **Schema source:** {{schema-file-path}}
- **Last verified:** {{revision}} on {{date}}

## Purpose

{{what-this-entity-represents}}

## Fields

| Field | Type | Null | Default | Constraints | Sensitivity |
|---|---|---|---|---|---|
| {{field}} | {{type}} | {{y/n}} | {{default}} | {{constraints}} | {{none/personal/secret/regulated-under-declared-regime}} |

## Relationships

| Relation | Target | Cardinality | On delete |
|---|---|---|---|
| {{relation}} | {{entity}} | {{1:n}} | {{cascade/restrict/null}} |

## Lifecycle

- **Created by:** {{operations}}
- **Updated by:** {{operations}}
- **Deleted:** {{soft/hard-semantics-and-cascades}}
- **Retention:** {{from-decision-or-none-declared}}

## Indexes and uniqueness

{{from-schema-evidence}}

## Persistence specifics

{{filled-by-active-fragment-section}}

## Migration notes

{{pending-or-completed-migrations-affecting-this-entity}}
