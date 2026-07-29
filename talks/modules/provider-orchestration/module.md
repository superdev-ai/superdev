<!-- superdev:generated source=MOD-0010 revision=3969 hash=307f189a417fb2402a73994a302eb2f64bacc79a0294dff3afa0262a109e46e8 -->
# Module: Provider Orchestration

- **Status:** Planned
- **Purpose:** Invokes specialist provider skills such as brainstorming, planning, TDD, debugging, code review, and frontend design for the smallest necessary context, screening and attributing their output before it becomes project truth.
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
| Empty States | When none of the known providers is ready, the ready list is empty and the plan step reports 0 ready and the rest as not installed, using the same reporting sentence as any other count rather than a special error path. | Inspect provider capability |
| Permission Boundaries | A provider blocked by policy is reported with a message telling the user to resolve it with their administrator; Superdev never overrides the block itself. | Inspect provider capability |
| Dependency Failure | If the live plugin listing command is unavailable or returns unparseable JSON, that failure is caught and returned as a not-ok result, and the affected provider is then reported as not ready rather than assumed ready. | Inspect provider capability |
| Versioning | When an installed provider's live version is below its required minimum, it is reported as installed but incompatible, with a remediation message naming the needed update. | Inspect provider capability |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Not Applicable | N/A - This module renders nothing. Provider work is routed from the skills and runs in the provider's own process. |
| 2 | UI composition | Not Applicable | N/A - This module renders nothing. Provider work is routed from the skills and runs in the provider's own process. |
| 3 | Actions | Filled | The action is routing work to an installed provider at the moment it applies; the registry declares the fifteen-element adapter contract each provider must satisfy. |
| 4 | API surface | Filled | The module deliberately exposes no command of its own. Superdev routes to a provider and never wraps its interface, so there is nothing here to call. |
| 5 | Data | Filled | Providers are declared in the shipped registry rather than the database. Nothing about a provider is project data. |
| 6 | End-to-end wiring | Filled | Proven by journey: doctor reports eight of eight providers ready, each skill names the provider at the moment it applies, and validator RT-002 refuses a provider no skill names. |
| 7 | State machines | Not Applicable | N/A - A provider is either installed and ready or it is absent, which doctor reports; there is no lifecycle in between. |
| 8 | Events | Open | Not recorded |
| 9 | Edge cases | Filled | Four recorded, including a provider that is absent, one whose output is offered as authoritative without screening, and a capability no installed provider covers. |
| 10 | UI states | Not Applicable | N/A - This module renders nothing. Provider work is routed from the skills and runs in the provider's own process. |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Not Applicable | N/A - This module renders nothing. Provider work is routed from the skills and runs in the provider's own process. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Not Applicable | N/A - This module renders nothing. Provider work is routed from the skills and runs in the provider's own process. |
| 16 | User-facing copy | Filled | Doctor names every provider that is not ready and what is lost while it is absent, and never substitutes Superdev's own approximation of what it does. |
| 17 | URL state and deep links | Not Applicable | N/A - This module renders nothing. Provider work is routed from the skills and runs in the provider's own process. |
| 18 | Performance | Not Applicable | N/A - Provider work runs in the provider's own process and Superdev does not bound its runtime. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | Validator RT-002 refuses a provider no skill routes to, and doctor reports every provider's readiness truthfully before a release. |
