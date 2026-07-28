# Fragment: Authentication - Neutral Base

**Activates on evidence:** any authentication machinery in the project (sign-in flows, session/token handling, auth middleware or guards) - record the paths found. Or an accepted decision. Always the starting point when any auth exists; provider-specific detail comes from `detected-provider.md` on top of this base - never instead of it.

**Fills:** auth-related sections of foundations, API, and permissions templates.

## Sections supplied

- **Identity model:** what a user/account/principal is; multi-account and service-principal cases.
- **Session/credential shape:** session cookie, token, or key - lifetime, renewal, revocation semantics (capability level).
- **Authentication flows:** sign-up, sign-in, sign-out, recovery, and (if present) MFA - as flows, per the workflow template.
- **Authorization handoff:** where authenticated identity meets the permission matrices (the enforcement points).
- **Session edge cases:** expiry mid-flow, revoked-while-active, role-changed-mid-session (edge-case categories 4, 16).
- **Secret handling:** credentials and signing material are named by location, never printed.
