# Diagram Catalogue

Diagrams are contracts, not decoration: each has an owner artifact, stays in sync through change tracking, and a stale diagram is drift (validation category O). Use Mermaid unless the project already uses another convention (adapter declares it).

## Project-wide (in architecture/foundations)

| Diagram | Shows | When required |
|---|---|---|
| System context | Actors, the system, external dependencies | Always (even one box + actors) |
| Container/deployment | Running pieces and their communication | More than one runtime piece |
| Module map | Modules and their dependencies | More than one module |
| Data-ownership map | Which module owns which entities | Shared persistence |
| Auth flow | Session/token issuance and checks | Any authentication |
| Critical-path sequence | The one flow the product exists for | Always |

## Per-module / per-artifact

| Diagram | Lives with | When |
|---|---|---|
| Navigation map | Module doc | Module has multiple surfaces |
| Feature sequence | Feature spec (standard+) | Cross-component flows |
| State machine | State-machine spec | Every lifecycle entity |
| Workflow swimlane | Workflow spec | Multi-actor flows |
| Job/webhook flow | Jobs spec | Async paths with failure branches |

## Rules

- Node names are the project's real names (routes, modules, entities) - never invented vendors or placeholder stacks; external dependencies appear only from evidence.
- Every diagram carries a one-line caption stating what it claims; a diagram that cannot be captioned is decoration - cut it.
- Diagrams participate in the change-tracking walk: a change touching a diagrammed path updates or explicitly defers the diagram.
- Prefer several small accurate diagrams over one mural; a diagram nobody updates is worse than none.
