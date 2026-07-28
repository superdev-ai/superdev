<!-- superdev:generated source=FEAT-0007 revision=2943 hash=ade8304b70834562c71a53df16dd10864eefe778718fbf58d6f53bd41c53cade -->
# Feature: Generate documentation from the accepted model

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Documentation Generation and Sync
- **Risk level:** R1
- **Milestone:** Product Model and Docs Foundation
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Produce human-readable Docs skill artifacts matching the database
- **User:** A developer or coding agent resuming work wants human-readable Markdown that is guaranteed to match the live database, not documentation that has silently drifted out of date.
- **User value:** Not recorded
- **Scope:** in: docs generate renders Markdown from the database, also run automatically at the end of init --apply, docs diff checks parity between generated documents and the database, verified at 295 files in the real project with the result every generated document matches the database, Detects hand edits: a file changed outside the generator is held back and reported separately from files it actually writes, Files no longer applicable are reported as skipped with a reason rather than left on disk as stale content; out: Does not overwrite a hand-edited file on generate; resolving that requires an explicit docs accept or docs reject, Does not run on its own outside init, adopt, or an explicit docs generate, diff, accept or reject call, Does not decide which side wins when a hand edit conflicts with the database; it only flags the conflict for a person to resolve
- **Affected contracts:** none linked

### Primary flow

1. Run superdev docs generate, or reach the end of init --apply which calls it automatically
2. The renderer compares the proposed Markdown against what is currently on disk for every generated file
3. Files that already match are left alone; changed files are written, and hand-edited files are held back instead
4. Run superdev docs diff to confirm every generated document matches the database

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Generated docs and database records are confirmed to be in parity after onboarding | Do it through the surface a person would use and record what was observed. | Met | EV-0065 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | A file edited by hand between generations is detected as a proposal; generate leaves it alone and reports it as held back by a hand edit instead of overwriting the edit. |
| Deletion Semantics | Applicable | A document that is no longer applicable, for example because its source record was removed, is reported under a separate no-longer-applicable list with a reason, distinct from files actively written or held back. |
| Dependency Failure | Applicable | If documentation generation throws during init --apply, the error is caught and that step is recorded as failed with the error message, rather than losing the whole initialization. |
| Empty States | Applicable | On a project with no accepted content yet, generate can report 0 files to write, 0 already correct and 0 held back, rather than erroring on having nothing to do. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. Ran `node src/cli.mjs docs diff` in the real dogfooded repository (which has 91 features, migrations, decisions, etc.) and got 'Every generated document matches the database. 295 files checked.' This proves the docs/render.mjs generator produces Markdown that is byte-consistent with the live database across a real 295-file corpus, not a toy example. cmdDocsGenerate is wired at src/cli.mjs:1689. | command | pass | superdev docs generate (also invoked automatically at the end of superdev init --apply) |

## Delivery state

- **What works now:** Reached by superdev docs generate (also invoked automatically at the end of superdev init --apply). Ran `node src/cli.mjs docs diff` in the real dogfooded repository (which has 91 features, migrations, decisions, etc.) and got 'Every generated document matches the database. 295 files checked.' This proves the docs/render.mjs generator produces Markdown that is byte-consistent with the live database across a real 295-file corpus, not a toy example. cmdDocsGenerate is wired at src/cli.mjs:1689.
- **What remains:** Nothing known.
- **Next action:** Not recorded
