---
name: review
description: Review a change in two stages, first whether it matches what was accepted, then whether the code is any good. Use for "review this", "review the PR", "check this against the spec", "is this ready to merge?", or before completing substantial work. Stage one compares the diff against the task's contract links, the feature's acceptance criteria and the governing decisions, and flags behavior that nobody specified. Stage two covers correctness, security, error handling, product tests and maintainability. Every finding carries a severity, a concrete failure scenario, a location, the requirement it affects, a remediation and a confidence. Reports findings; applies fixes only when asked.
---

# Review

A change that perfectly implements the wrong thing still fails. Stage one runs
first, always.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Stage one: contract compliance

1. **Find the governing contract.** `SD task show <TASK-id>` gives the task, its
   feature, and the exact contracts it links: workflow steps, UI actions, API
   operations, data entities, migrations, integrations, jobs, webhooks, NFRs,
   documents, decisions. That link set is the specification for this diff.
   No task means the work skipped the before-implementation sequence, which is
   itself a finding.
2. **Check the acceptance criteria** of the feature the task belongs to. Each
   one either has evidence in this change or is explicitly out of scope for this
   task.
3. **Check the governing decisions.** `SD decision list --json`. A change that
   violates an active decision is a P0 finding and routes to the `decision`
   skill, never a quiet exception.
4. **Look for unspecified behavior in the diff.** New behavior nobody accepted
   needs a specification through the `feature` skill or an explicitly recorded
   bypass with owner, reason, scope and expiry. Side effects that were never
   requested are findings, not bonuses.
5. **Check the documentation projection.** `SD docs diff`. A pending proposal
   means the docs and the database disagree, and merging on top of that hides
   the disagreement.

## Stage two: code quality

Review the diff plus enough surrounding code to judge it:

- correctness defects, including the paths the change did not touch but affects;
- security: trust boundaries, injection, authorization, secret handling;
- error handling and data-loss paths;
- product tests: missing, weakened, or asserting the implementation rather than
  the behavior;
- convention violations against this repository, not against a general
  preference;
- complexity beyond the smallest sufficient solution.

For products built with Superdev, the expected tests come from the accepted
product test plan. Never require tests for the Superdev plugin itself: it has
none, by design.

## Finding format

Every finding, both stages:

**Severity** (P0 blocks, P1 should fix, P2 improvement) followed by a **concrete
failure scenario** (inputs and state leading to the wrong outcome; no scenario,
no finding), **file and line**, the **requirement or contract affected**, a
**remediation**, and your **confidence**.

A finding without a failure scenario is a preference. Say so, or drop it.

## Providers

Route review discipline to **Superpowers** (its code review and receiving-review
workflows) and, for interface work, critique and accessibility to **Impeccable**.
Check readiness with `SD doctor`. If a provider is not ready, apply this
contract directly and say plainly that the specialist pass did not run. Never
present your own checklist as theirs.

## After the review

- Findings that survive verification block completion of the work under review.
  Record them: `SD task evidence <TASK-id> --summary "<the P0 and P1 findings>" --result fail`, or
  `SD task block <TASK-id> --reason <why>` when the work cannot proceed.
- When the change is accepted, completion still needs its evidence through
  `SD task complete`. A passing review is one kind of evidence, not a substitute
  for the product's own verification.

## Boundaries

- Report findings; apply fixes only when asked.
- State honestly what was reviewed and what was not: paths, depth, generated
  code skipped, anything you could not run.
- Never approve on the basis of a check you did not actually run.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
