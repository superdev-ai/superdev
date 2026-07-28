---
name: debug
description: Investigate a failure to its root cause before anything is changed. Use for "why is this failing?", "this broke", "it works locally but not in production", a stack trace, a flaky test, corrupted output, or unexpected behavior. Assembles the evidence packet (exact reproduction, redacted logs, recent changes, environment differences, the feature and contracts involved, governing decisions), routes to the systematic-debugging provider when it is available, requires root-cause evidence that accounts for every important symptom before a fix, fixes at the layer all callers share, and verifies under the original failing conditions with a regression test. No feature interview for a defect.
---

# Debugging

A symptom report names where it hurts, not what is wrong. Evidence first, then
the fix, then proof under the conditions that originally failed.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Steps

1. **Build the evidence packet.**
   - The exact reproduction, including what makes it stop reproducing.
   - Errors and logs verbatim, with secrets redacted before they are pasted
     anywhere or stored.
   - Recent changes: diff, commits, dependency and configuration moves.
   - Environment differences between where it works and where it does not.
   - The product context: `SD task show <TASK-id>` if the failure has a task,
     the feature and the contracts involved, and `SD decision list --json` for
     the decisions that govern the area.
   - `SD memory search "<symptom or component>"` for whether this has
     been seen before. Recall is a lead, never a conclusion; verify it.
2. **Track it as work.** A defect that takes more than a moment gets a task
   linked to the feature and contract it breaks, so the investigation and its
   outcome survive the session. See the `task` skill.
3. **Route to the provider.** Superpowers systematic debugging owns this
   methodology. Check readiness with `SD doctor`. If it is not ready, apply the
   falsification discipline directly and say the specialist pass did not run:
   symptoms verbatim, at least three hypotheses before testing any, evidence
   that discriminates between them, the cheapest high-information check first,
   one variable per experiment, failed experiments reverted.
4. **Respect environment safety.** In an envx-managed project, run commands
   through its stage runner rather than exporting values by hand. Never decrypt
   or print a secret. Distinguish a missing-access failure from an application
   failure; they look alike and are not.
5. **Require root-cause evidence before any fix.** The explanation must account
   for every important symptom, including the ones that do not fit neatly. A
   plausible story that explains three of four symptoms is not a root cause.
6. **Fix at the layer every caller shares.** Before editing, find every caller
   of the function you are about to change. One guard in the shared path is
   both the smaller diff and the correct fix; patching only the path the report
   named leaves the siblings broken.
7. **Verify under the original failing conditions**, add a regression test to
   the product's own suite, and read the final diff.
8. **Record the outcome.** `SD task evidence <TASK-id> --summary "<root cause
   and fix>" --reference "<the failing case that now passes>"`, then complete with the verification as evidence. Update the
   specification only when the intended behavior or operations actually changed:
   a pure defect fix is not a specification change.

## Boundaries

- Never change a test so it passes without first proving the test was wrong.
- Two failures of the same shape mean the problem model is wrong. Stop varying
  details and re-examine the model.
- Evidence of data corruption or a security compromise stops the work and gets
  reported before anything else continues.
- The regression test belongs to the product, from its accepted test plan. The
  Superdev plugin has no test suite; never tell anyone to run tests for it.
- Report an unproven cause as unproven. "Probably fixed" is not a result.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
