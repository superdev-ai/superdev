# Pages, UI Surfaces, and Action/State Inventories

Every interactive element is accounted for; no dead controls, no undocumented states. Templates: `assets/templates/pages-ui-actions.md`.

## Pages/surfaces table (per module)

| Path/route | Surface | Purpose | Primary role | Key components | Entities shown |

## Action inventory (per surface - complete, including bulk and destructive)

Per action: **trigger** (control + location) · **who** (role/permission gate, and where the gate is enforced) · **precondition** (state/visibility conditions) · **effect** (API operation or local effect) · **input/validation** · **side effects** (events, notifications, derived updates) · **confirmation** (required for destructive/irreversible) · **states** (loading, disabled + why, success feedback, empty, error + copy, offline if in scope) · **keyboard** (shortcut/reachability) · **accessible name** · **focus behavior** (after completion/cancel) · **responsive** (behavior at breakpoints in scope) · **telemetry** (only if approved) · **acceptance test** reference.

## Role × action matrix (per module)

Actions as rows, roles as columns: `✓` full · `own` only own records · ` - ` blocked. The matrix must agree with the enforcement points named in the action inventory; disagreement is a validation finding.

## State completeness rule

Every surface documents empty, loading, error, and success states; every action documents disabled conditions. Offline behavior is documented when the delivery shape includes it (active UI fragment), otherwise deliberately N/A.

## Completeness gates

- Everything documented exists; everything existing is documented (checked in review and by UI acceptance tests when the feature ships).
- New actions enter through change tracking - an implemented control with no inventory row is drift (`code-ahead-of-spec`).
