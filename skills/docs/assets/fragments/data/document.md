# Fragment: Document Store

**Activates on evidence:** document-database client configuration and collection access code - record the paths found. Or an accepted decision.

**Fills:** the "Persistence specifics" section of the data template.

## Sections supplied

- **Collection shape:** collection per entity group; document structure cited from the validation schema or the writing code.
- **Denormalization rules:** what is duplicated where, and which copy is authoritative; update propagation for each duplicate.
- **Schema enforcement:** validator rules if the store supports them, else the application-level validation source.
- **Indexes:** defined indexes and the queries they serve.
- **Consistency:** read/write concern settings and what staleness consumers must tolerate.
