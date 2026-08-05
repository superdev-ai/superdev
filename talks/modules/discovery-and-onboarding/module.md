<!-- superdev:generated source=MOD-0001 revision=4066 hash=0d95b53377196666415c9dd1dba94fd036f9dce06bb7961980d515b7a6c5035f -->
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
| 2 | UI composition | Filled | The Discovery area is ui/src/views/discovery.tsx, on the shared app-shell, built from the ui primitives (card, table, badge, tabs, dialog) and components/discovery/answer-question.tsx, which answers an open question in place. Concept relationships render through components/canvas: graph-canvas, record-node, layout and freshness. It reads discovery items, source material, questions and capability areas from the local read model and holds no state of its own beyond the record named in the hash. |
| 3 | Actions | Filled | Two actions on the Discovery surface: convert a concept into a record, and move a node on the map. |
| 4 | API surface | Filled | superdev adopt (API-0002) and superdev init (API-0001), plus the control centre discovery read and the convert action on /api/mutations. |
| 5 | Data | Filled | Discovery owns four collections. discovery_items carries a kind, an epistemic status and a status, and links to whatever it became through discovery_links. source_material records what was read, where it came from and its screening status. questions carries the question, its status and the answer. capability_areas carries the area, its state, the choice, the reason, the owner and the revisit trigger, unique per project, catalog, scope type, scope id and area, with a CHECK that any state other than specified has a reason. Init writes all four from the brief and from inspecting the repository. |
| 6 | End-to-end wiring | Filled | Proven by journey: init writes the record from a brief, the Discovery view reads it, and converting a concept writes back and appears without a reload. |
| 7 | State machines | Filled | Four, all enumerated in the schema. A discovery item's status runs proposed to accepted, rejected, converted or superseded, and its epistemic status is one of confirmed, inferred, assumed, unknown, contradicted or declined, opening at inferred. A question runs open to answered, deferred or withdrawn. Source material screening runs pending, clean, redacted or rejected and is decided when the source is read rather than moved afterwards. A capability area runs awaiting_decision to specified, deferred or not_applicable. AU-002 in the authorable validator holds each of these to something in src that can actually move it. |
| 8 | Events | Filled | Every write appends an activity event through recordActivity; init writes are attributed to the session that ran it. |
| 9 | Edge cases | Filled | Sixteen recorded across the five features, covering an unreadable brief, a directory already initialised, an absent git identity and a rejected product map. |
| 10 | UI states | Filled | The five shared states in ui/src/components/shell/states.tsx: Loading, Empty, Error, Stale and Offline. Principle I of DESIGN_DIRECTION.md requires each to carry a title, an explanation of what happened and an action, so a bare spinner, a blank region or the word None is a defect. Views import these rather than writing their own. Empty on a repository with no discovery yet names superdev init as the action rather than asking the reader to wait. |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Filled | Covered by NFR-0006, which requires the control centre to meet accepted requirements for navigation, focus, contrast, labels and reduced motion. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Filled | Tailwind breakpoints, no separate mobile build. Summary tiles run one column, then sm:grid-cols-2, then lg:grid-cols-3. The shell navigation collapses behind md:hidden below md and opens as a sheet. Wide tables and diagrams scroll inside their own container so the page body never scrolls sideways. The concept canvas keeps its own pan and zoom at every width instead of reflowing. |
| 16 | User-facing copy | Filled | The command output is the product here: every refusal names what was missing and the command that supplies it. |
| 17 | URL state and deep links | Filled | The Discovery view is a hash route, so it is deep linkable and survives a reload. |
| 18 | Performance | Filled | Covered by NFR-0002, which requires common status, task, feature and workflow reads to feel immediate on a normal development machine. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The interface is served on localhost and is never indexed. |
| 20 | Compliance and product tests | Filled | src/init/discovery.test.mjs asserts the screening, and a disposable init journey is re-run before every release. |
