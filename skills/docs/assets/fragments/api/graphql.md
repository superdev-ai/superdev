# Fragment: GraphQL API

**Activates on evidence:** a GraphQL schema (SDL files, code-first schema builders, generated schema artifacts) - record the paths found. Or an accepted decision.

**Fills:** the "Style specifics" section of the API template.

## Sections supplied

- **Operation type:** query / mutation / subscription and its schema name.
- **Schema types:** input and payload types (cite the schema source; do not duplicate it).
- **Authorization points:** where field/operation authorization is enforced (resolver guards, directive, middleware) - must match the permission matrices.
- **N+1 and batching:** data-loader/batching behavior where the project has it (evidence).
- **Error convention:** the project's error shape (error codes in extensions, union results, etc.) from evidence.
- **Deprecation:** `@deprecated` usage and the migration expectation.
