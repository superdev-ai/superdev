# Module Decomposition - the Twenty-Step Loop

The discipline for specifying a module completely. A module is **done** only when the user and the agent agree it is done AND every step below is either filled or explicitly marked `N/A - <reason>`. Silent gaps are defects.

## Grouping first

Group capability into modules by user-facing cohesion (what changes together, who uses it together), not by technical layer. Present the proposed module inventory (name, purpose, primary users, owned data) for approval before deep decomposition. After all modules are decomposed, run a **cross-module reconciliation pass**: shared entities, cross-module workflows, permission overlaps, event producers/consumers - resolving each overlap to one owner.

## The loop (per module)

Work the steps in order; each step's output lands in the module's spec artifacts - the module doc itself uses `assets/templates/module.md`; per-step artifacts use their own templates under `assets/templates/`:

1. **Pages/surfaces** - every screen/surface the module owns; path, purpose, primary role.
2. **UI composition** - per surface: components, tables (columns, sorting), forms, navigation.
3. **Actions** - full inventory per `surfaces-and-actions.md`: every button, link, gesture, bulk action.
4. **API surface** - operations backing the actions; style per active fragment.
5. **Data** - entities, fields, ownership ("this module owns tables/collections X; consumes Y from module Z").
6. **Wiring** - end-to-end path per key action: surface → handler → service → data → side effects.
7. **State machines** - every entity with a lifecycle: states, transitions, guards, terminal states.
8. **Events** - emitted and consumed; payload ownership; delivery expectations.
9. **Edge cases** - full category walk per `edge-cases.md`.
10. **UI states** - loading, empty, error, disabled, success, offline per surface and action.
11. **Telemetry** - what is measured, only if telemetry is approved for the project.
12. **Accessibility** - keyboard paths, focus behavior, accessible names, announcements.
13. **Internationalization** - translatable content, formats, direction, if in scope (deliberate N/A otherwise).
14. **Feature flags** - flagged behavior, defaults, cleanup conditions.
15. **Responsive behavior** - breakpoint behavior per surface class.
16. **Copy** - user-facing strings for key flows, including error and empty-state copy.
17. **URL state** - what persists in URLs, back-button behavior, deep links.
18. **Performance** - evidence-based budgets or deliberate N/A; never invented numbers.
19. **Discoverability/SEO** - public-surface metadata, or N/A for internal tools.
20. **Compliance and tests** - regulatory touchpoints (declared regimes only) and the module test plan.

## Rules

- One step at a time when working interactively; batch only what the user delegates.
- Every step's claims carry evidence or an epistemic label; brownfield modules use `reverse-engineer.md` to fill steps from code, marking inferred entries.
- The loop's output feeds validation categories in `validation.md` - a step filled here is a category checkable there.
