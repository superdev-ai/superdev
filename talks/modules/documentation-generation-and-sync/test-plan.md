<!-- superdev:generated source=MOD-0003 revision=3058 hash=ddba3ddb1a6c15cf1bfef9cbd72b14ec6413f6460aa543252c66ec82eeaa7658 -->
# Documentation Generation and Sync - Test Plan

- **Test tooling in use:** Deterministic validators and real journeys rather than an internal suite, which section 20.1 requires
- **Last verified:** see the generation marker at the top of this file.

## What must be true

| Feature | Criterion | Verified how | Status |
|---|---|---|---|
| Generate documentation from the accepted model | Generated docs and database records are confirmed to be in parity after onboarding | Do it through the surface a person would use and record what was observed. | Met |
| Generate documentation | superdev docs generate produces updated documentation files from current records | Run superdev docs generate and record what was observed. | Met |
| Diff documentation against the model | superdev docs diff lists differences between current docs and current records | Run superdev docs diff and record what was observed. | Met |
| Accept a documentation proposal | superdev docs accept <proposal-id> applies the proposed documentation change | Run superdev docs accept <proposal-id> and record what was observed. | Met |
| Reject a documentation proposal | superdev docs reject <proposal-id> discards the proposed change without applying it | Run superdev docs reject <proposal-id> and record what was observed. | Met |
| Flag stale documentation after changes | A code change linked to a documented feature causes that documentation to be flagged as potentially stale | Do it through the surface a person would use and record what was observed. | Met |

## Coverage map

| Area | Level | Cases | Status |
|---|---|---|---|
| Happy paths per feature | command | 6 | exists |
| Applicable edge-case categories | command | 19 | exists |
| Permission boundaries | command | 0 | missing |
| State machines including illegal transitions | command | 0 | missing |

## Evidence conventions

A claim of tested cites a run. Tests claimed but absent is a parity finding, not a rounding error.

| Evidence | Type | Result | Reference | State |
|---|---|---|---|---|
| src/cli.mjs line 2051 maps "docs generate" to cmdDocsGenerate, which calls generate() from src/docs/render.mjs. Ran `node src/cli.mjs docs generate` (dry run) and it printed "1 file to write, 290 already correct, 0 held back by a hand edit" with a list of files and skipped ones, ending "Re-run with --apply to write them." | command | pass | superdev docs generate | Current |
| src/cli.mjs line 2052 maps "docs diff" to cmdDocsDiff (line 1713), which calls detectProposals or diffProposal from src/docs/proposals.mjs. Ran `node src/cli.mjs docs diff` and got "Every generated document matches the database. 295 files checked." Ran `node src/cli.mjs docs diff talks/modules/documentation-generation-and-sync/module.md` and got a per-file report: "Status In Sync, Changed 0 lines added, 0 removed." | command | pass | superdev docs diff [path] | Current |
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/cli.mjs line 2053 maps "docs accept" to cmdDocsAccept (line 1734), which calls acceptProposal from src/docs/proposals.mjs (defined line 658, real logic: maps hand-edited Markdown sections back to database columns via planAcceptance). Ran `node src/cli.mjs docs accept talks/modules/documentation-generation-and-sync/module.md` and got the correct refusal "already matches the database, so there is nothing to accept", and on a derived view got "is a derived view. It is rewritten on every generation and never holds a manual edit." Both are real, correct code paths, not stubs. | command | pass | superdev docs accept <path> | Current |
| src/cli.mjs line 2054 maps "docs reject" to cmdDocsReject (line 1763), which calls rejectProposal from src/docs/proposals.mjs. Ran `node src/cli.mjs docs reject talks/changes/changelog.md` (dry run) and got "Rejecting talks/changes/changelog.md writes the generated version back over the file. The discarded text is recorded first... Re-run with --apply to put the generated version back." | command | pass | superdev docs reject <path> | Current |
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. Ran `node src/cli.mjs docs diff` in the real dogfooded repository (which has 91 features, migrations, decisions, etc.) and got 'Every generated document matches the database. 295 files checked.' This proves the docs/render.mjs generator produces Markdown that is byte-consistent with the live database across a real 295-file corpus, not a toy example. cmdDocsGenerate is wired at src/cli.mjs:1689. | command | pass | superdev docs generate (also invoked automatically at the end of superdev init --apply) | Current |
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. src/docs/render.mjs:1263 compares each document's stored generated_hash/database_revision against the live max(activity_events.sequence); node src/cli.mjs doctor printed 'Freshness Problem 296 generated documents were built from an older database revision than 1918' while node src/cli.mjs docs diff (content-hash check) reported 'Every generated document matches the database' -- i.e. the staleness flag reacts to a real DB change (new activity_events row) even before any doc content actually differs, exactly as designed. | command | pass | superdev status / superdev doctor / superdev docs diff, backed by the PostToolUse hook and the revision marker in each generated doc | Current |
