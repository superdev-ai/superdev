# Fragment: Authentication - Detected Provider

**Activates on evidence:** a specific auth provider/library in the project (SDK dependency, provider configuration, callback routes) - record the exact evidence. Or an accepted decision. Applies **on top of** the neutral base, filling in provider-specific mechanics.

**Fills:** provider-specific subsections of the auth sections.

## Sections supplied

- **Provider identity:** the detected provider/library and where it is configured (evidence paths).
- **Managed vs owned:** which parts the provider manages (password storage, MFA, session issuance) vs what the project implements.
- **Integration points:** callback/webhook routes, middleware, client SDK usage - actual paths.
- **Configuration surface:** provider settings that change behavior (session lifetime, allowed callback URLs) - names and locations, never secret values.
- **Migration/exit notes:** what switching providers would touch (recorded honestly as coupling).

**Rule:** the provider's name appears in documentation only through this fragment - universal templates stay provider-free.
