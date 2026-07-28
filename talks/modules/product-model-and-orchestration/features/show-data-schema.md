<!-- superdev:generated source=FEAT-0039 revision=2943 hash=1b4ab026c53992bd460c4717bfe962db751bb9df596b854e1e83f10f919f02ed -->
# Feature: Show data schema

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Product Model and Orchestration
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0001 Complete, structured product model, GOAL-0002 No unmapped or disconnected implementation work
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Show the current data model of entities, fields, and relations
- **User:** A developer writing a migration or a query needs an entity's exact fields, nullability, and sensitivity before touching the table, without opening the migration files.
- **User value:** Not recorded
- **Scope:** in: Runs superdev schema show for the full entity list, or superdev schema show <entity> for one entity by id or name, Full listing returns every entity with its field count and status, plus relationship count and applied schema version, Scoped view returns the entity's fields with type, nullable, and sensitivity, and what it points at or is pointed at by; out: Does not run or generate a migration, Does not show row level data, only the structure of the tables
- **Affected contracts:** none linked

### Primary flow

1. Run superdev schema show to see the entity list, relationship count, and schema version
2. Run superdev schema show <entity> with an id or name to drill into one entity
3. Read its fields and its relationships to other entities

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev schema show returns the current schema definition | Run superdev schema show and record what was observed. | Met | EV-0043 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Empty States | Applicable | An entity that is only planned and has no table yet prints that no table exists so it has no fields, distinguishing not-built-yet from a genuinely empty table. |
| Invalid Input | Applicable | An entity name or id that matches nothing throws a clean error naming what was looked up, and exits non-zero. |
| Versioning | Applicable | The full listing reports schema version as the highest applied migration version, so a reader can tell the recorded data model apart from what has actually been migrated into this project's database. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| All fifteen product map commands from section 12.4 run and print real records: 11 modules, 5 goals, 9 milestones, 91 features, 9 workflows, 9 runtime pieces, 43 entities, 70 operations, 13 integrations. | command | pass | src/cli/product-map.mjs |
| All fifteen product map commands from section 12.4 run and print real records: 11 modules, 5 goals, 9 milestones, 91 features, 9 workflows, 9 runtime pieces, 43 entities, 70 operations, 13 integrations. | command | pass | src/cli/product-map.mjs |
| src/cli.mjs line 1141-1143 cmdSchemaShow wired in COMMANDS table at line 2071. Ran: node src/cli.mjs schema show, returned 43 data entities with field counts and status. Entity-scoped lookup also runs (returns a clean not-found message for a name that does not match a table). | command | pass | superdev schema show [entity] |

## Delivery state

- **What works now:** Reached by superdev schema show [entity]. src/cli.mjs line 1141-1143 cmdSchemaShow wired in COMMANDS table at line 2071. Ran: node src/cli.mjs schema show, returned 43 data entities with field counts and status. Entity-scoped lookup also runs (returns a clean not-found message for a name that does not match a table).
- **What remains:** Nothing known.
- **Next action:** Not recorded
