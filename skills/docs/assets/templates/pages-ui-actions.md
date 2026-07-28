<!-- Template: pages, UI surfaces, and complete action/state inventories. -->
# {{module-name}} - Surfaces and Actions

- **Status:** draft | accepted
- **Last verified:** {{revision}} on {{date}} against {{code-paths}}

## Pages/surfaces

| Path/route | Surface | Purpose | Primary role | Key components | Entities shown |
|---|---|---|---|---|---|
| {{route}} | {{name}} | {{purpose}} | {{role}} | {{components}} | {{entities}} |

## Action inventory ({{surface-name}})

| Field | Value |
|---|---|
| Trigger | {{control-and-location}} |
| Who | {{role}} - enforced at {{enforcement-point}} |
| Precondition | {{state/visibility-conditions}} |
| Effect | {{api-operation-or-local-effect}} |
| Input/validation | {{fields-rules-limits}} |
| Side effects | {{events-notifications-derived}} |
| Confirmation | {{required?-copy}} |
| Loading | {{behavior}} |
| Disabled | {{conditions-and-affordance}} |
| Success | {{feedback}} |
| Empty | {{if-applicable}} |
| Error | {{behavior-and-copy}} |
| Offline | {{if-in-scope-else-N/A-deliberate}} |
| Keyboard | {{reachability/shortcut}} |
| Accessible name | {{name}} |
| Focus behavior | {{after-complete/cancel}} |
| Responsive | {{breakpoint-behavior}} |
| Telemetry | {{only-if-approved-else-none}} |
| Acceptance test | {{reference}} |

## Role × action matrix

| Action | {{role-1}} | {{role-2}} |
|---|---|---|
| {{action}} | ✓ / own / - | ✓ / own / - |

Legend: `✓` full · `own` only own records · ` - ` blocked. Matrix must agree with the enforcement points above.

## State completeness

Every surface: empty / loading / error / success documented. Every action: disabled conditions documented. Undocumented states found in code are drift (`code-ahead-of-spec`).
