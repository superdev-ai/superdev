<!-- Template: module test plan. Tooling names come from project evidence. -->
# {{module-name}} - Test Plan

- **Status:** draft | accepted
- **Test tooling in use:** {{from-evidence}}
- **Last verified:** {{revision}} on {{date}}

## What must be true

{{acceptance-criteria-rollup-from-features}}

## Coverage map

| Area | Level (unit/integration/e2e) | Cases | Status |
|---|---|---|---|
| Happy paths per feature | {{level}} | {{cases}} | exists / planned / missing |
| Applicable edge-case categories | {{level}} | {{cases-per-category}} | … |
| Permission boundaries (per matrix) | {{level}} | {{role×action-cases}} | … |
| State machines (incl. illegal transitions) | {{level}} | {{transition-cases}} | … |

## Evidence conventions

Results live at {{where}}; a claim of "tested" cites a run. Tests claimed but absent is a P1 finding (validation category N).
