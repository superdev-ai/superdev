# APIs and Data/Schema

Universal structure lives in templates; style-specific sections come from fragments activated by evidence or decision - never defaults.

## APIs (`assets/templates/api.md` + `assets/fragments/api/*`)

Per operation, regardless of style: name/route/procedure · purpose · caller surfaces/actions · auth requirement + permission · request contract (fields, validation, limits) · response contract (success shape, error shapes with codes and user-facing meaning) · idempotency (key/semantics for anything retried) · rate/size limits (from evidence) · side effects (events, jobs, notifications) · versioning/compatibility expectations · test references.

Style fragments add the style's specifics: REST (methods/status codes/resource shape), GraphQL (schema types/resolvers/authorization points), RPC (procedures/middleware), events (topics/payloads/delivery), local-only (in-process contracts).

API docs map to real code: each operation names its implementing file(s). Unmapped operations are drift.

## Data/schema (`assets/templates/data-schema.md` + `assets/fragments/data/*`)

Per entity: purpose · owning module · fields (name, type, nullability, default, constraints) · relationships · lifecycle (created/updated/deleted by which operations) · sensitivity class (what is personal/secret/regulated under declared regimes) · retention (from decisions, not invented) · indexes/uniqueness from evidence · migration notes.

Persistence fragments add style specifics: SQL-with-ORM (model↔table mapping, migration tool in use), SQL-without-ORM (DDL location, migration discipline), document (collection shape, denormalization rules), key-value (key schema, TTL), external SaaS (owned-by-vendor caveats, sync), no-persistence (explicit statement).

## Shared rules

- Schema docs cite the schema source files; prose never outranks the schema file (authority ladder).
- Cross-module data access is documented on both sides (owner and consumer).
- Breaking-change candidates (field removal/retype, contract change) trigger the API-contract / schema-migration change classes in `change-tracking.md`.
