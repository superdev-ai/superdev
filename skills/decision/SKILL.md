---
name: decision
description: Find, record, revisit or supersede a project decision. Use for "what did we decide about X?", "why do we use Y?", "record this decision", "can we switch to Z now?", "can we add package P?" when it was declined before, or whenever proposed work conflicts with something already decided. Reads the decision records and their transitions from the database, checks whether a request follows, extends, conflicts with, triggers a revisit of or supersedes each active decision, and presents the owner with a bounded choice. History is append-only, so a decision is superseded with its scope named, never edited into a different past.
---

# Decisions

A decision record explains why the product is the way it is, so the same
argument is not had twice and a reversal is deliberate rather than accidental.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Reading

`SD decision list --json` returns decisions with status, scope, links and the
supersession chain. Statuses are Proposed, Accepted, Rejected, Deferred,
Superseded and Deprecated, and each one carries a transition history that only
appends.

The ADR Markdown under `talks/decisions/` is generated from those rows. Reading
it is fine. Editing it does not change the decision: the edit becomes a proposal
that a person reviews, and accepting the proposal updates the database first.
`SD docs diff` shows any that are waiting.

## Before consequential work: the conflict check

1. Search the active decisions for the capability, dependency, file path,
   surface or topic the work touches.
2. For each match, classify the request: **follows** it, **extends** it,
   **conflicts** with it, **triggers its revisit condition**, **supersedes** it,
   or is **unrelated**.
3. On a conflict, present exactly this and stop:
   - the active decision, its rationale and its scope;
   - its revisit triggers;
   - what evidence has actually changed since;
   - the consequences of each way forward.
4. Offer exactly four options: preserve the decision, narrow the request to fit
   it, run a time-boxed experiment that would produce the missing evidence, or
   record a superseding decision.

Never proceed past a conflict because the new work seems obviously better. The
earlier decision had reasons; make them visible and let the owner choose.

## Recording a decision

A decision record carries: context; evidence with its epistemic label (measured,
observed, reported, assumed) and where it came from; the criteria used; the
options considered with why each was rejected; the decision itself; observable
rationale (never private reasoning); consequences, positive, negative and
neutral; risks and their mitigations; enforcement points; how it is verified;
and its revisit triggers.

Declined and deferred outcomes are first-class records. "Declined, not
forgotten" is the point: a rejected option with a recorded reason and a revisit
condition is what stops the same suggestion arriving every month.

Decisions become records through the accepted-planning flow, the same as every
other accepted content, and status changes are append-only transitions. Run
`SD decision --help` for the subcommands this build exposes, and use the control
center's decision view when a person is deciding interactively. Then
`SD docs generate` renders the ADR.

## Superseding

```
SD decision record --title "<what was decided>" --governs feature:<FEAT-id>
SD decision supersede <DEC-id> --title "<the decision that replaces it>"
```

- The new record names what it supersedes and why.
- The old record gains a superseded-by pointer and stays readable, unedited.
- **Partial supersession** names the exact scope that fell and the exact scope
  that still stands. A vague partial supersession is worse than none, because
  nobody can tell afterwards which half survived.
- Never edit an earlier decision body to make it agree with the present. The
  record is a history, and rewriting it destroys the only evidence of why the
  reversal happened.

## A previously declined dependency, requested again

1. Find the record that declined it and read its actual reasons.
2. Check whether each reason still holds. Reasons expire; assume nothing.
3. Present the new evidence, or say plainly that there is none.
4. Get explicit confirmation before adding it.
5. Record a superseding decision if the direction changes, so the next agent
   sees a reversal rather than a contradiction.

Never install a declined dependency because it would be convenient right now.

## Boundaries

- One owner question at a time, with the recommendation stated.
- A decision that governs work in flight blocks that work until it is resolved.
  Report it; do not route around it.
- Store observable rationale only. Never private model reasoning, secrets,
  personal data or absolute machine paths.
- Superdev decides its own conflicts. No transport, sync or external tool
  arbitrates a decision by overwriting it.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
