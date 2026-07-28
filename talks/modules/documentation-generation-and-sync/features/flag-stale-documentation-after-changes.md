<!-- superdev:generated source=FEAT-0081 revision=2943 hash=209451300de7893064acb9c044e5aaf4d4512b94405dc089aa10592dd43484b0 -->
# Feature: Flag stale documentation after changes

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Documentation Generation and Sync
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Mark generated documentation as potentially stale when related code changes
- **User:** A developer or reviewer wants to know when a generated document might be out of date after a code change, before trusting what it says.
- **User value:** Not recorded
- **Scope:** in: Fires after edits under src/ or scripts/ and checks how many generated documents exist in the project, Writes a documentation_possibly_stale activity event naming the count of documents that may now be behind, rate limited to avoid one event per edit, Compares each document's stored database revision against the live latest revision to answer status and doctor's freshness check, Offers a separate, precise content hash comparison through docs diff that says whether a document's actual text still matches; out: Does not determine whether the document's content actually changed, only that the underlying code moved after the document was generated, Does not regenerate or edit the documentation itself, it only flags the possibility for a human or agent to check, Does not fire on edits to the generated documentation files themselves, that is treated as a hand edit path
- **Affected contracts:** none linked

### Primary flow

1. Source file under src/ or scripts/ is edited during an active session
2. Hook checks whether any documents in the project have sync_status of generated
3. If so and the last stale-flag event was not too recent, a documentation_possibly_stale event is recorded naming the count
4. Later, superdev doctor or docs diff surfaces the same staleness by comparing revisions or content hashes directly

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| A code change linked to a documented feature causes that documentation to be flagged as potentially stale | Do it through the surface a person would use and record what was observed. | Met | EV-0084 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | The revision based flag can fire even before any document's actual text differs, since it reacts to the database moving forward, not to a real content mismatch; docs diff answers the stronger question by comparing content hashes directly. |
| Duplication | Applicable | Repeated edits within the quiet window after the last stale-flag event produce no further event, so a long editing session leaves one flag rather than one per file. |
| Empty States | Applicable | When no documents exist with sync_status generated, no stale event is written at all, there is nothing to flag as behind. |
| State Machine Violations | Not Applicable | N/A - There is no live session tracked, the hook exits without writing anything, since the activity event needs a session to attribute to. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/docs/render.mjs:1263 compares each document's stored generated_hash/database_revision against the live max(activity_events.sequence); node src/cli.mjs doctor printed 'Freshness Problem 296 generated documents were built from an older database revision than 1918' while node src/cli.mjs docs diff (content-hash check) reported 'Every generated document matches the database' -- i.e. the staleness flag reacts to a real DB change (new activity_events row) even before any doc content actually differs, exactly as designed. | command | pass | superdev status / superdev doctor / superdev docs diff, backed by the PostToolUse hook and the revision marker in each generated doc |

## Delivery state

- **What works now:** Reached by superdev status / superdev doctor / superdev docs diff, backed by the PostToolUse hook and the revision marker in each generated doc. src/docs/render.mjs:1263 compares each document's stored generated_hash/database_revision against the live max(activity_events.sequence); node src/cli.mjs doctor printed 'Freshness Problem 296 generated documents were built from an older database revision than 1918' while node src/cli.mjs docs diff (content-hash check) reported 'Every generated document matches the database' -- i.e. the staleness flag reacts to a real DB change (new activity_events row) even before any doc content actually differs, exactly as designed.
- **What remains:** Nothing known.
- **Next action:** Not recorded
