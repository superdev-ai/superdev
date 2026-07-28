# Fragment: REST API

**Activates on evidence:** HTTP route definitions with method verbs (route files, controller decorators, OpenAPI documents) - record the paths found. Or an accepted decision.

**Fills:** the "Style specifics" section of the API template.

## Sections supplied

- **Method and path:** `{{VERB}} {{/resource/path}}` - resource-oriented naming; path params vs query params stated.
- **Status codes:** success code(s) and each error code with its meaning and body shape.
- **Content types:** request/response media types; pagination convention (cursor/offset) as used in this project.
- **Caching:** cache headers/etags if the project uses them (evidence required).
- **OpenAPI:** if a spec file exists, it is the contract source; the doc cites it and does not duplicate it.
