<!-- superdev:generated source=MOD-0001 revision=3969 hash=5ac1dcfaee742ec1ce61d31dfc2492518f4303226afc2697fe506049b5a57923 -->
# Module: Discovery and Onboarding

- **Status:** Planned
- **Purpose:** Guides a new or existing product through structured interviews to establish product foundation, modules, features, workflows, and architecture, then produces an accepted product map before implementation starts.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| #/discovery | Discovery | Everything said, assumed, feared or ruled out before the product existed | - | Discovery |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev adopt superdev adopt | Reverse engineer an existing product and build its initial product model. | superdev adopt |

## Data

No entities recorded.

## Wiring (key actions end to end)

| Action | Path |
|---|---|
| Convert a concept into a record | Discovery -> no handler recorded -> no side effects recorded |
| Move a node on the map | Discovery -> no handler recorded -> no side effects recorded |

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | On a directory with nothing in it, evidence inspection reports 0 files and 0 directories answered, and the concept map records an explicit unknown for every area instead of guessing.; When no .gitignore file exists yet, adoption creates one containing only the .superdev/ ignore line rather than failing.; An empty directory returns no findings, an empty answers map, 0 files and 0 directories, and an explicit empty flag, rather than erroring.; When no idea and no source material are supplied and no project exists yet, the plan adds a warning that the concept map will consist mostly of explicit unknowns.; An area already settled is refused, naming the state it is in | Initialize a new product, Adopt an existing product, Inspect the environment automatically, Present the product map for acceptance, Resolve a capability area through a command |
| Invalid Input | An id that is not a capability area is refused by name, and not-applicable without a reason is refused | Resolve a capability area through a command |
| State Machine Violations | If the repo already has detected documentation, the route is 'adopt' and applyInit throws InitError E_EXISTING_DOCS refusing to initialize over it, unless the caller passes --adopt.; When the documentation profile cannot be detected, adoptProject warns that it will record the profile as custom and assume nothing about the layout, rather than guessing a profile.; When documentation already exists, the plan's route is adopt and a warning names the detected documentation profile, telling the reader that init is refused here in favor of adopt. | Initialize a new product, Adopt an existing product, Present the product map for acceptance |
| Ordering | When both an inferred and a confirmed finding exist for the same area, the confirmed one always overwrites the inferred one in the answers map regardless of which was found first. | Inspect the environment automatically |
| Duplication | Re-running init on an already-initialized project finds the existing project row and reports steps like capability-area seeding as already done rather than creating duplicate rows.; Re-running adopt on an already-adopted repo reports each action as already present or leave exactly as it is, instead of rewriting talks/project.yaml or the .gitignore entry a second time.; Planning against an already-initialized project detects the existing project row and adds a warning that the plan will report what is present and create only what is missing, instead of presenting a fresh-start plan. | Initialize a new product, Adopt an existing product, Present the product map for acceptance |
| Dependency Failure | If provider detection throws, checkProviders catches it and returns checked:false with a reason string, so the rest of the plan still completes instead of the whole command crashing.; If the docs profile detector script is missing or throws, detection is wrapped in a try/catch and the profile defaults to unknown with source recorded as detector-absent, instead of crashing the caller. | Initialize a new product, Inspect the environment automatically |
| Limits And Quotas | On a very large repository the scan truncates past its file and manifest caps and sets a truncated flag, which the init plan surfaces as a warning that the evidence is a sample rather than a census. | Inspect the environment automatically |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | One surface, SRF-0021 Discovery at #/discovery. The rest of the module is reached as commands: superdev init and superdev adopt. |
| 2 | UI composition | Open | Not recorded |
| 3 | Actions | Filled | Two actions on the Discovery surface: convert a concept into a record, and move a node on the map. |
| 4 | API surface | Filled | superdev adopt (API-0002) and superdev init (API-0001), plus the control centre discovery read and the convert action on /api/mutations. |
| 5 | Data | Open | Not recorded |
| 6 | End-to-end wiring | Filled | Proven by journey: init writes the record from a brief, the Discovery view reads it, and converting a concept writes back and appears without a reload. |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Filled | Every write appends an activity event through recordActivity; init writes are attributed to the session that ran it. |
| 9 | Edge cases | Filled | Sixteen recorded across the five features, covering an unreadable brief, a directory already initialised, an absent git identity and a rejected product map. |
| 10 | UI states | Open | Not recorded |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Open | Not recorded |
| 16 | User-facing copy | Filled | The command output is the product here: every refusal names what was missing and the command that supplies it. |
| 17 | URL state and deep links | Filled | The Discovery view is a hash route, so it is deep linkable and survives a reload. |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | src/init/discovery.test.mjs asserts the screening, and a disposable init journey is re-run before every release. |
