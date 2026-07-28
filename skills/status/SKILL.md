---
name: status
description: Report where the project actually stands, from the Superdev database. Use for "where are we?", "what is done?", "what is blocked?", "what is left?", "show me progress", "is anything stale?", or before a handoff, a standup or a release conversation. Reads active work, progress with the counts behind it, blockers, open owner questions, capability areas awaiting a decision, pending documentation proposals, evidence freshness and the next action, then reports them in plain language. Read only, so it changes no record, and it never states a percentage the accepted contract does not support.
---

# Project Status

Report the truth, including the parts nobody wants to hear. Every number comes
from the database and can explain itself.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Steps

1. **Read the status.** `SD status --json`. It carries active work, progress per
   feature, module, milestone and goal, blockers, freshness and the derived next
   action. If there is no project in the database, say so and offer `init`
   rather than describing a project that does not exist.
2. **Check the database is sound.** `SD db status` runs the integrity and
   foreign-key check. A failing integrity check is the headline, not a footnote.
3. **Check for pending documentation proposals.** `SD docs diff`. A manual edit
   to generated Markdown is waiting for review, and until it is reviewed the
   docs and the database disagree.
4. **Check open owner questions and unresolved capability areas.** An area
   awaiting a decision is unfinished planning, not a blank.
5. **Cross-check against live reality.** Current branch and HEAD, dirty files,
   whether the evidence behind recent completions still matches what is on disk.
   Report a disagreement as a disagreement; never reconcile it silently.
6. **Report** in the shape below.

## What to report

- **Where the project stands**: completed and total per applicable component,
  with what counts and what remains.
- **Active work**: the claimed task, its feature, who or what holds it, and how
  long it has been held.
- **Blocked work**, each with what would unblock it.
- **Open owner questions** and capability areas awaiting a decision.
- **Pending documentation proposals** from `docs diff`.
- **Freshness**: database revision, last event sequence, last documentation
  generation, active session heartbeat, branch HEAD, stale evidence.
- **The next action**: exactly one, and say why it is next.

Lead with what matters. A wall of counts is not a status report.

## Progress honesty

Progress is derived from the accepted product contract, and one implementation
computes it for both the command line and the control center. They cannot
disagree.

- Only applicable components count. A backend feature with no interface is not
  permanently short one component.
- A record with no declared completion contract reports **Not measurable**.
  Never zero, never one hundred percent.
- Every value carries its completed count, total count, what counts, what
  remains, source revision and freshness. A bare percentage is not a valid
  answer.
- Cancelled and superseded work leaves the totals and stays visible in history.
- Evidence older than thirty days is **stale**, which is not the same as
  satisfied.

Never fabricate progress for a record the database has no contract for, and
never average unrelated numbers into one comforting figure.

## Seeing it

`SD ui` opens the control center, which shows the same data live and updates
from committed transactions. Offer it whenever the answer is more than a
paragraph, or when someone wants the blueprint, workflow, data or readiness
views rather than prose.

## Boundaries

- Read only. This skill changes no record and repairs nothing while reporting.
  A repair routes to `task`, `decision`, `feature` or `docs`.
- Never state a percentage the accepted contract does not support.
- Never present the absence of a record as the absence of the problem. Say what
  is unknown and what would make it known.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
