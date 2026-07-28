# Fragment: Environments - Conventional Env Files

**Activates on evidence:** conventional env files (`.env*` patterns, env example/template files) - record filenames only. Or an accepted decision.

**Fills:** environment sections of foundations and operational docs.

## Sections supplied

- **File inventory:** which env files exist per environment, which are committed (examples/templates only) vs ignored.
- **Variable inventory:** variable **names** with purpose, sourced from the example file or a typed env schema if the project has one; values never appear.
- **Validation:** where env validation happens (typed schema, startup checks) if present.
- **Documented rules:** real env files stay uncommitted; the example file is maintained as variables change (drift check); secrets referenced by name only.
- **Precedence:** process env vs file vs defaults, as the project's loader actually resolves them.
