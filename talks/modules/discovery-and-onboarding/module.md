<!-- superdev:generated source=MOD-0001 revision=2942 hash=3e6868f69559f6a0d16bb65c32cb3d04a200bab52ca07f388cf40f12fbcfda9b -->
# Module: Discovery and Onboarding

- **Status:** Planned
- **Purpose:** Guides a new or existing product through structured interviews to establish product foundation, modules, features, workflows, and architecture, then produces an accepted product map before implementation starts.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

No surfaces recorded.

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev adopt superdev adopt | Reverse engineer an existing product and build its initial product model. | superdev adopt |

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
| Empty States | On a directory with nothing in it, evidence inspection reports 0 files and 0 directories answered, and the concept map records an explicit unknown for every area instead of guessing.; When no .gitignore file exists yet, adoption creates one containing only the .superdev/ ignore line rather than failing.; An empty directory returns no findings, an empty answers map, 0 files and 0 directories, and an explicit empty flag, rather than erroring.; When no idea and no source material are supplied and no project exists yet, the plan adds a warning that the concept map will consist mostly of explicit unknowns. | Initialize a new product, Adopt an existing product, Inspect the environment automatically, Present the product map for acceptance |
| State Machine Violations | If the repo already has detected documentation, the route is 'adopt' and applyInit throws InitError E_EXISTING_DOCS refusing to initialize over it, unless the caller passes --adopt.; When the documentation profile cannot be detected, adoptProject warns that it will record the profile as custom and assume nothing about the layout, rather than guessing a profile.; When documentation already exists, the plan's route is adopt and a warning names the detected documentation profile, telling the reader that init is refused here in favor of adopt. | Initialize a new product, Adopt an existing product, Present the product map for acceptance |
| Ordering | When both an inferred and a confirmed finding exist for the same area, the confirmed one always overwrites the inferred one in the answers map regardless of which was found first. | Inspect the environment automatically |
| Duplication | Re-running init on an already-initialized project finds the existing project row and reports steps like capability-area seeding as already done rather than creating duplicate rows.; Re-running adopt on an already-adopted repo reports each action as already present or leave exactly as it is, instead of rewriting talks/project.yaml or the .gitignore entry a second time.; Planning against an already-initialized project detects the existing project row and adds a warning that the plan will report what is present and create only what is missing, instead of presenting a fresh-start plan. | Initialize a new product, Adopt an existing product, Present the product map for acceptance |
| Dependency Failure | If provider detection throws, checkProviders catches it and returns checked:false with a reason string, so the rest of the plan still completes instead of the whole command crashing.; If the docs profile detector script is missing or throws, detection is wrapped in a try/catch and the profile defaults to unknown with source recorded as detector-absent, instead of crashing the caller. | Initialize a new product, Inspect the environment automatically |
| Limits And Quotas | On a very large repository the scan truncates past its file and manifest caps and sets a truncated flag, which the init plan surfaces as a warning that the evidence is a sample rather than a census. | Inspect the environment automatically |

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
