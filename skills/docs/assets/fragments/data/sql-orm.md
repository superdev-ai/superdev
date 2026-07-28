# Fragment: SQL with ORM

**Activates on evidence:** an ORM's model/schema definitions plus a SQL database configuration - record the paths found. Or an accepted decision.

**Fills:** the "Persistence specifics" section of the data template.

## Sections supplied

- **Model ↔ table mapping:** model source file per entity; the model file is the schema contract.
- **Migration discipline:** the project's migration tool and flow (generate → review → apply); hand-edited or skipped migrations are drift. If the project prohibits a push-style shortcut, that prohibition is recorded here and enforced by validation as *usage* detection, not mention detection.
- **Constraints in code vs database:** which invariants live in ORM validations vs actual DB constraints - both listed; DB-enforced wins for integrity claims.
- **Transactions:** the project's transaction convention for multi-entity operations.
- **Seed/test data:** where seeds live and whether they are safe to run per environment.
