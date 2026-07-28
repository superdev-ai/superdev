# ADR-0021: Unit tests are permitted on pure functions, and nowhere else

- **Status:** Accepted
- **Date:** 2026-07-28
- **Owner/approver:** Project owner
- **Scope:** `scripts/validate/no-tests.mjs` and every `*.test.mjs` under `src/` or `scripts/`. Narrows [ADR-0019](0019-validators-are-not-tests.md).

## Context

ADR-0019 removed the plugin's test suite and forbade any test file. Its reasoning
holds and is not in dispute: 113 test files had consumed time, reinforced
internal mechanics, and let completion be claimed from a passing count rather
than from a working product. Every earlier attempt to keep "just a few" grew a
fixture project, then gates over that fixture, then completion measured in
counts.

What the absolute form of the rule also forbade was an assertion that a pure
function returns the right answer. The cost of that has now been measured rather
than argued.

Thirteen defects were found in one working session. Seven were in pure functions,
and none of them could fail a validator, because a validator asserts a declared
property of an artifact and none of these was a property of an artifact:

- A paragraph joiner read a hard-wrapped sentence line by line, so half a clause
  became a feature named "The outgoing chef records what is prepped, what ran
  out, and what the next".
- A backup restore resolved a bare filename against the working directory, so the
  name the product printed could not be handed back to it.
- A version comparison stripped the pre-release from both sides, so nobody
  running a pre-release was ever told the release had shipped.

Each was found by running the product and reading the output, which took hours.
Each would have been caught by two or three lines of assertion in milliseconds.

There is a second gap the same measurement exposed. The 80 re-runnable evidence
records looked like a behavioural safety net and are not one: `runCheck` decides
pass or fail from the exit code alone, so `superdev api show` passing proves only
that the command does not crash. It is a smoke test suite with no assertions.

## Decision

Unit tests are permitted, under conditions narrow enough that the failure mode
ADR-0019 describes cannot recur.

**Permitted.** A `.test.mjs` file beside the source it tests, under `src/` or
`scripts/`, run by node's own test runner, asserting on functions imported and
called directly.

**Refused, and enforced by `no-tests.mjs`:**

- Any `tests/`, `test/`, `__tests__/`, `spec/` or `fixtures/` tree.
- Any third-party test framework, in a script or in a dependency.
- Any test file shape other than `<source>.test.mjs`.
- A test whose named source does not exist, because it keeps passing after that
  source is deleted.

**Unchanged, and the part that matters most.** Completion is derived from
recorded evidence about the real product. A green suite is not evidence. A
coverage figure is not progress. Neither may be offered as either, and no task
may complete because tests pass.

## Consequences

`npm test` exists and joins the local gate, the release hooks and the publish
workflow, running first in all three because it is the cheapest check available.
Tests are excluded from the published package.

Two functions in `src/init/discovery.mjs` are now exported that were internal.
That is a real widening of a module's surface for the sake of testing, accepted
deliberately: the defect they carried was invisible from outside the module, and
the only alternative was a full initialization run to observe it.

Writing the first 91 assertions found four further defects, two of them in code
written the same day, which is the evidence this decision rests on rather than a
prediction it makes.

## Verification

- `npm test` passes and `npm run validate` stays clean.
- Planting a `tests/` tree, a framework script and a test naming a source that
  does not exist each produces a finding, checked by doing it.
- The parser assertion was checked against the defect rather than assumed to
  cover it: with the line-by-line reading restored, it fails.
