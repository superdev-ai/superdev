<!-- superdev:generated source=MOD-0011 revision=3537 hash=09d36cd159e52cc9eb355da24375de29742af5706a593e2fdc6368900fd02b91 -->
# Module: Packaging and Distribution

- **Status:** Planned
- **Purpose:** How Superdev is installed and shipped: the Claude Code plugin, the Codex plugin, the skills.sh standalone bundle, and what each of them must contain. Section 19 of the requirements document.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

No surfaces recorded.

## API surface

No API operations recorded.

## Data

No entities recorded.

## Wiring (key actions end to end)

No actions recorded, so no end-to-end path can be asserted.

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | with no sync_peers rows at all (the normal state today), peers prints as 0 rather than erroring or omitting the field. | Show cloud sync status, Synchronize with the cloud, Preview a sync |
| Boundary Values | passing --dry-run with any other combination of sync flags (for example --resolve) still only flips the one boolean in the JSON output; no flag combination changes the refusal path. | Preview a sync |
| Invalid Input | the flag is accepted regardless of value or combination with other sync flags; there is no validation because the flag is never inspected by the command handler.; A record type deliberately written only by init is named as such rather than counted as missing | Resolve sync conflicts, Refuse a record type the interface shows and nothing can write |
| Permission Boundaries | N/A - there is no credential or account check because no connection attempt is ever made; the refusal fires before anything requiring authorization would run. | Connect cloud sync |
| State Machine Violations | running the command repeatedly, or with any combination of flags, always yields the identical refusal and exit code; there is no connected state to transition into so no invalid transition can occur.; sync cannot be called mid-transfer or interrupted, because no transfer ever starts; every call is a fresh, complete no-op refusal. | Connect cloud sync, Synchronize with the cloud, Resolve sync conflicts |
| Network Failure | N/A - no network call is ever attempted, so a network failure cannot occur here; the refusal is returned before any transport would be reached. | Synchronize with the cloud |
| Dependency Failure | if the sync_peers table query fails for any reason, the count falls back to 0 rather than surfacing a raw database error to the caller. | Show cloud sync status |
| Versioning | the refusal text is fixed at the current build; if the three blocking decisions (DEC-TBD-006/007/008) are ever resolved, this command's behavior is expected to change, but nothing today distinguishes a resolved decision from an open one at runtime.; the refusal is tied to DEC-TBD-006 specifically; resolving that one decision (versus 007 or 008, which block connect and status) is what this command's future implementation depends on.; A record type added to the depth gate later is picked up without editing the validator | Connect cloud sync, Synchronize with the cloud, Preview a sync, Refuse a record type the interface shows and nothing can write |
| Consistency | connected is hardcoded false regardless of the peer count, so a nonzero peers count (if one ever existed from prior schema use) would not be reported as connected; the two fields are independent, not derived from each other.; a reader might expect --dry-run to be safer or more informative than a real sync; here they are behaviorally identical, which is itself the fact worth documenting since it could otherwise mislead a script into thinking a preview happened.; a caller relying on --resolve to change the outcome will see the exact same refusal as without it, which is worth flagging explicitly since a silently ignored flag is easy to miss in a script that checks only the exit code. | Show cloud sync status, Preview a sync, Resolve sync conflicts |
| Auditability | because no row is ever written, there is no record that a connect attempt happened beyond whatever the caller's own terminal or script log captures. | Connect cloud sync, Show cloud sync status, Resolve sync conflicts |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Open | Not recorded |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Open | Not recorded |
| 4 | API surface | Open | Not recorded |
| 5 | Data | Open | Not recorded |
| 6 | End-to-end wiring | Open | Not recorded |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Open | Not recorded |
| 9 | Edge cases | Open | Not recorded |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Open | Not recorded |
| 12 | Accessibility | Open | Not recorded |
| 13 | Internationalization | Open | Not recorded |
| 14 | Feature flags | Open | Not recorded |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Open | Not recorded |
| 17 | URL state and deep links | Open | Not recorded |
| 18 | Performance | Open | Not recorded |
| 19 | Discoverability and SEO | Open | Not recorded |
| 20 | Compliance and product tests | Open | Not recorded |
