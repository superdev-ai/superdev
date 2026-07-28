# Fragment: Event-Driven API

**Activates on evidence:** event/message contracts (topic definitions, event schema files, publisher/subscriber code) - record the paths found. Or an accepted decision.

**Fills:** the "Style specifics" section of the API template.

## Sections supplied

- **Event name/topic:** naming convention as used; version suffix policy.
- **Payload contract:** schema source cited; required vs optional fields; payload owner.
- **Producers and consumers:** both sides named (modules/services), matching module event steps.
- **Delivery semantics:** at-least-once/at-most-once as configured - stated honestly; consumer idempotency expectations.
- **Ordering:** guarantees (per-key, none) and how consumers handle disorder.
- **Schema evolution:** compatibility rules (additive-only, versioned topics) from project convention.
