# Fragment: RPC API

**Activates on evidence:** procedure-style API definitions (typed procedure routers, RPC framework configs, IDL files) - record the paths found. Or an accepted decision.

**Fills:** the "Style specifics" section of the API template.

## Sections supplied

- **Procedure:** namespace/router path and procedure name; call semantics (query vs mutation vs stream) per the framework in use.
- **Input/output types:** cite the type definitions (schema-validation source is the contract).
- **Middleware chain:** auth/logging/validation middleware applying to this procedure, in order.
- **Transport:** how procedures are exposed (HTTP path convention, batching) from the project's configuration.
- **Client usage:** how callers invoke it (generated client, hook convention) as evidenced in the codebase.
