<!-- superdev:generated source=MOD-0003 revision=3969 hash=b81c963cce61c7654e9803ec1565dc6688b2cb53de1ba6d0e3af8b3b9e6946c5 -->
# Module: Documentation Generation and Sync

- **Status:** Planned
- **Purpose:** Adapts the existing Docs skill to convert accepted database records into human-readable Markdown contracts, tracks revisions, detects manual edits as proposals, and keeps the database and documents from silently diverging.
- **Primary users:** none recorded
- **Owns:** none recorded
- **Does not own (consumes):** nothing recorded
- **Last verified:** see the generation marker at the top of this file.

## Surfaces

| Route | Surface | Purpose | Primary role | Doc |
|---|---|---|---|---|
| - | Product Vision | Required area of the control center. The document lists it as a required area but does not specify further content beyond that. | - | Product Vision |

## API surface

| Operation | Purpose | Doc |
|---|---|---|
| superdev docs accept <proposal-id> superdev docs accept <proposal-id> | Accept a documentation proposal. | superdev docs accept <proposal-id> |
| superdev docs diff superdev docs diff | Show the difference between generated documentation and what is currently accepted. | superdev docs diff |
| superdev docs generate superdev docs generate | Generate documentation proposals from the current product model. | superdev docs generate |
| superdev docs reject <proposal-id> superdev docs reject <proposal-id> | Reject a documentation proposal. | superdev docs reject <proposal-id> |
| superdev doctor superdev doctor | Check project health, database health, documentation parity, harness coverage, and provider availability. | superdev doctor |

## Data

| Entity | Role in module | Doc |
|---|---|---|
| documents | owner | documents |

## Wiring (key actions end to end)

No actions recorded, so no end-to-end path can be asserted.

## State machines

None recorded.

## Events

No events recorded.

## Edge cases

| Category | Outcome | Features |
|---|---|---|
| Empty States | On a project with no accepted content yet, generate can report 0 files to write, 0 already correct and 0 held back, rather than erroring on having nothing to do.; When every generated file already matches the database and nothing is obsolete, the counts show 0 to write and the full count already correct, with no file lists printed.; When nothing has diverged, the whole-project run prints exactly one line: every generated document matches the database, plus the total files checked.; When no documents exist with sync_status generated, no stale event is written at all, there is nothing to flag as behind. | Generate documentation from the accepted model, Generate documentation, Diff documentation against the model, Flag stale documentation after changes |
| Boundary Values | A single file with zero differences reports Status In Sync with Changed 0 lines added, 0 removed rather than omitting the change line. | Diff documentation against the model |
| Invalid Input | A path that does not correspond to any recorded generated document is reported as not applicable rather than silently returning in sync.; A path with no recorded generated document is refused with a message that no generated document is recorded there, telling the operator to generate documentation first.; Pointing docs reject at a path with no corresponding generated document still describes writing the generated version back, since the dry run does not verify the path exists before planning; the operator should confirm the path with docs diff first. | Diff documentation against the model, Accept a documentation proposal, Reject a documentation proposal |
| Permission Boundaries | A derived view file (one that is always rewritten on generation) cannot be accepted at all, the command explains it never holds a manual edit. | Accept a documentation proposal |
| State Machine Violations | A file that has been hand-edited since it was generated is not silently overwritten, it is counted as held back by a hand edit and left alone until the conflict is resolved through docs diff/accept/reject.; Accepting a file that is already in sync with the database is refused with a clear message that there is nothing to accept. | Generate documentation, Accept a documentation proposal, Flag stale documentation after changes |
| Duplication | Repeated edits within the quiet window after the last stale-flag event produce no further event, so a long editing session leaves one flag rather than one per file. | Flag stale documentation after changes |
| Dependency Failure | If documentation generation throws during init --apply, the error is caught and that step is recorded as failed with the error message, rather than losing the whole initialization. | Generate documentation from the accepted model, Generate documentation |
| Deletion Semantics | A document that is no longer applicable, for example because its source record was removed, is reported under a separate no-longer-applicable list with a reason, distinct from files actively written or held back.; Files that no longer correspond to any current record are reported under No longer applicable rather than deleted immediately, giving the operator visibility before anything is removed.; The discarded text is recorded before the overwrite happens, so a rejection can be read back afterward rather than being lost. | Generate documentation from the accepted model, Generate documentation, Reject a documentation proposal |
| Consistency | A file edited by hand between generations is detected as a proposal; generate leaves it alone and reports it as held back by a hand edit instead of overwriting the edit.; The revision based flag can fire even before any document's actual text differs, since it reacts to the database moving forward, not to a real content mismatch; docs diff answers the stronger question by comparing content hashes directly. | Generate documentation from the accepted model, Flag stale documentation after changes |
| Auditability | Every rejection is traceable after the fact because the discarded text is preserved rather than dropped. | Reject a documentation proposal |

## Twenty-step completeness

| # | Step | State | Outcome |
|---|---|---|---|
| 1 | Pages and surfaces | Filled | The module renders no screen. Its output surfaces are the generated Markdown contracts under docs/, and its only recorded surface is retired. |
| 2 | UI composition | Not Applicable | N/A - The module writes Markdown files read in an editor or on GitHub and renders no interface of its own. |
| 3 | Actions | Filled | The actions are commands: generate, diff, and accepting or rejecting the proposal a manual edit creates. |
| 4 | API surface | Filled | Five operations: doctor, docs generate, docs diff, docs accept and docs reject. |
| 5 | Data | Filled | One entity, documents, which carries each generated file path, revision and sync status. |
| 6 | End-to-end wiring | Filled | Proven by journey: generate writes the files, diff detects a hand edit as a proposal, and accepting folds it back into the record. |
| 7 | State machines | Open | Not recorded |
| 8 | Events | Filled | Generation and every accept or reject append an activity event, so a document history is readable. |
| 9 | Edge cases | Filled | Twenty-one across the six features, including a hand-edited document, a document whose record was retired, and a generation that would overwrite unaccepted edits. |
| 10 | UI states | Not Applicable | N/A - The module writes Markdown files read in an editor or on GitHub and renders no interface of its own. |
| 11 | Telemetry | Not Applicable | N/A - Superdev is local-first with no network egress; the design direction requires telemetry to be explicitly approved and it never has been. |
| 12 | Accessibility | Not Applicable | N/A - The module writes Markdown files read in an editor or on GitHub and renders no interface of its own. |
| 13 | Internationalization | Not Applicable | N/A - English only, with no locale switching anywhere; dates and numbers use the reader's own locale through Intl. |
| 14 | Feature flags | Not Applicable | N/A - There is no flag machinery in the product; behaviour changes ship as a version. |
| 15 | Responsive behavior | Not Applicable | N/A - The module writes Markdown files read in an editor or on GitHub and renders no interface of its own. |
| 16 | User-facing copy | Filled | The generated documents are the copy, and the alignment check refuses a document that no longer matches its record. |
| 17 | URL state and deep links | Not Applicable | N/A - The module writes Markdown files read in an editor or on GitHub and renders no interface of its own. |
| 18 | Performance | Filled | Covered by NFR-0002 for read speed, and generation rewrites the full document set in one pass rather than incrementally. |
| 19 | Discoverability and SEO | Not Applicable | N/A - The generated documents are internal contracts, not published pages, and the interface is served on localhost. |
| 20 | Compliance and product tests | Filled | The docs alignment validator plus the readiness check that 318 documents are in sync, both re-run before a release. |
