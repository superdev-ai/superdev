# ADR-0019: Validators inspect artifacts, and never grow back into a test suite

> **Narrowed by [ADR-0021](0021-unit-tests-on-pure-functions.md) (2026-07-28)** - a
> `.test.mjs` beside the source it tests, run by node's own test runner, is now
> permitted. Everything else here stands: no test tree, no fixture project, no
> third-party framework, and completion is never claimed from a passing count.
> The reasoning below is why those limits exist and is left exactly as written.

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** Everything under `scripts/validate/`. Supersedes the plugin test strategy.

## Context

The previous repository carried 113 test files. They consumed time, reinforced
internal mechanics, and let completion be claimed from a passing count rather
than from a working product. The brief removes them and keeps "deterministic
validators" instead.

Without a rule, that distinction collapses. A validator that constructs a
scenario and asserts an outcome is a test wearing a different name, and the
suite grows back one helpful addition at a time.

## Decision

A validator inspects an artifact. Concretely, all of these must hold:

1. Its subject is a file that exists in the repository, or one it constructs
   deterministically in a temporary directory within the same run and deletes
   afterwards.
2. It has no committed fixtures and no sample project.
3. It uses no test framework and no test runner.
4. It has no phase names and reports no counts as evidence of completion.
5. It fails when its input is absent. It never skips and reports success.
6. It asserts a declared property of the artifact, not the behavior of a
   simulated product.

The migration validator is the boundary case and is instructive: it builds a
throwaway database, replays the ordered migrations, checks integrity and foreign
keys, confirms the applied list matches the checked-in files, and provokes the
enforcement triggers to confirm they fire. That is checking the schema artifact
does what it declares. It would become a test the moment it started asserting
what a feature does.

The `no-tests` validator enforces the rule against itself: it fails if any file
ending in `.test.mjs`, any `tests/` directory, or a test runner script appears.

## Consequences

- Positive: proof comes from real artifacts and a real product journey.
- Negative: regressions in product behavior are caught by using the product,
  which is slower than a unit test would be, and this is accepted deliberately.
- Neutral: products *built with* Superdev still get a full product test plan and
  real tests. This ADR governs the plugin only.

## Verification

`node scripts/validate/validate-all.mjs` and the disposable self-hosting journey.

## Related

ADR-0013, ADR-0015.
