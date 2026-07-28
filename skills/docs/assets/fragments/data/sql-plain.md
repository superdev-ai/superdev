# Fragment: SQL without ORM

**Activates on evidence:** SQL DDL files, migration directories with raw SQL, or query files without ORM models - record the paths found. Or an accepted decision.

**Fills:** the "Persistence specifics" section of the data template.

## Sections supplied

- **DDL location:** where table definitions live; the DDL is the schema contract.
- **Migration discipline:** ordered migration files, naming convention, how applied per environment.
- **Query layer:** where queries live (query files, repository modules); parameterization required at trust boundaries.
- **Constraints:** DB-enforced constraints listed per entity; application-enforced invariants listed separately.
- **Transactions:** explicit transaction boundaries for multi-statement operations.
