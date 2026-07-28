<!-- Template: module specification. Built by the twenty-step decomposition loop;
     every step filled or "N/A - reason". -->
# Module: {{module-name}}

- **Status:** draft | accepted
- **Purpose:** {{one-sentence}}
- **Primary users:** {{roles}}
- **Owns:** {{entities-surfaces-processes}}
- **Does not own (consumes):** {{consumed-from-other-modules}}
- **Last verified:** {{revision}} on {{date}} against {{code-paths}}

## Surfaces

(per the pages/UI/actions template - link or inline)

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| {{operation}} | {{purpose}} | {{link}} |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| {{entity}} | {{owner/consumer}} | {{link}} |

## Wiring (key actions end-to-end)

| Action | Path |
|---|---|
| {{action}} | {{surface}} → {{handler}} → {{service}} → {{data}} → {{side-effects}} |

## State machines

{{list-with-links-or-deliberate-none}}

## Events

| Event | Direction | Payload owner | Consumers |
|---|---|---|---|
| {{event}} | emits / consumes | {{owner}} | {{consumers}} |

## Edge cases

{{category-walk-outcome-link}} - every category filled or `N/A - reason`

## Remaining loop steps

Telemetry: {{or-N/A}} · Accessibility: {{summary}} · i18n: {{or-N/A}} · Flags: {{or-N/A}} · Responsive: {{summary}} · Copy: {{link-or-inline}} · URL state: {{or-N/A}} · Performance: {{evidence-based-or-N/A}} · SEO: {{or-N/A}} · Compliance: {{declared-regimes-or-N/A}} · Test plan: {{link}}
