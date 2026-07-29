# Lifecycles

Every record Superdev keeps has a shape it moves through, a gate it cannot cross
without something, and a command that moves it. This file is that map, taken from
the code rather than from the requirements: the statuses are the ones the database
enforces and the transitions are the ones the status machine allows.

Two conventions hold everywhere and are not repeated per record.

**Nothing writes without `--apply`.** Every command that changes something prints
what it would do and changes nothing. That is the default, not a flag you pass to
get a preview.

**A refusal names the remedy.** If a command will not do something, its message
says what to run instead. Where it names a record that does not exist, it also
says which command lists the real ones.

## Contents

- [Init](#init), how a project begins
- [Discovery](#discovery), concepts before records
- [Goal](#goal), the outcome, and how it is measured
- [Milestone](#milestone), the delivery stage
- [Module](#module), the slice of the product
- [Feature](#feature), and the depth gate
- [The rest of the product map](#the-rest-of-the-product-map), surfaces, data, APIs, workflows
- [Task](#task), the only status machine with a table
- [Evidence](#evidence), what proves anything
- [Test plan](#test-plan)
- [Decision](#decision)
- [Question](#question)
- [Assumption](#assumption)
- [Change](#change)
- [Capability area](#capability-area), the readiness checklist
- [Document](#document), the Markdown projection
- [Session](#session), and why a claim matters

---

## Init

Sixteen steps, in this order. The plan runs all of them and writes nothing; with
`--apply` the same sixteen run and write.

1. Detect new project versus existing project
2. Inspect the repository before asking anything
3. Check specialist provider readiness
4. Start brainstorming when it is available
5. Create a discovery session and immutable source records
6. Build the initial concept map
7. Ask the smallest set of material questions
8. Recommend a default for every question
9. Accept an honest "I do not know" as a reversible assumption
10. Produce a high-level plan before creating implementation tasks
11. Generate draft foundations, modules, goals, milestones and feature candidates
12. Present the plan and material decisions for acceptance
13. Store accepted content in the database
14. Generate the Markdown documentation
15. Generate implementation tasks from accepted specifications
16. Start the local control center

Step 2 comes before step 7 on purpose: a question whose answer is sitting in
`package.json` is not a question. Step 14 runs last in execution order even though
it is reported as fourteenth, because documents are stamped with the revision they
were built from, and generating them before the closing event made every project
report stale documentation from the moment it was created.

**Routing.** Detection answers `init`, `adopt` or `reinit`. Existing documentation
routes to adopt, which writes only an adapter and leaves every file alone. When
those documents are input rather than a record of the project, a brief you are
initializing from, `init --adopt` says so and proceeds.

```bash
superdev init --brief requirement.md          # the plan
superdev init --brief requirement.md --apply  # the same, writing
superdev init --adopt --brief requirement.md --apply
```

`requirement.md` in this repository is the template, and it explains why the
headings matter: content under a heading Superdev does not recognise is skipped
rather than guessed at.

---

## Discovery

Concepts come before records. A brief becomes discovery items, each carrying where
it came from and how much it can be trusted, and only then becomes a goal, a
module or a feature.

**Kinds:** `problem`, `user`, `goal_candidate`, `feature_candidate`, `constraint`,
`assumption`, `risk`, `unknown`, `exclusion`.

**Status:** `proposed` to `converted`.

A converted concept stays on the map, marked converted, beside the record it
became. Nothing is deleted, so the provenance of a feature reaches back to the
sentence in the brief that suggested it.

```bash
superdev discovery convert DIS-0004 --to feature --module MOD-0001 --apply
```

A concept left at `proposed` raises a low-severity finding, because leaving one
unconverted is a legitimate decision and the only defect would be nobody knowing
they had made it.

---

## Goal

An outcome, not a feature. `draft` by default.

A goal is measured by its success criteria, and a goal with none is counted as
unmeasurable rather than as met. Each criterion is `unmet`, `met`, `unmeasured` or
`not_applicable`, and it moves to `met` only when evidence says so.

```bash
superdev goal record --name "..." --why "..." --apply
superdev goal criterion GOAL-0001 --criterion "..." --measurement "how you read it" --apply
superdev task evidence TASK-0007 --criterion GSC-0002 --result pass --summary "..." --apply
superdev feature goal FEAT-0003 --goal GOAL-0001 --apply
superdev retire GOAL-0004 --reason "..." --apply
```

A goal criterion is **not** derived from the acceptance criteria of the features
serving it. A goal can be served by features that are all finished and still not be
reached, and keeping outcomes separate from output is the reason goals exist as
their own records.

---

## Milestone

A delivery stage. `planned` by default, and it is reached when its exit conditions
are met.

Entry conditions say what must hold before it starts; exit conditions say when it
is done. Each condition carries `met` and the reading that decided it. The reading
is required: met on its own is an assertion, and the reading is what somebody else
can check.

```bash
superdev milestone record --name "..." --outcome "..." --apply
superdev milestone condition MS-0001 --condition "..." --apply          # exit
superdev milestone condition MS-0001 --condition "..." --entry --apply  # entry
superdev milestone met MS-0001 --condition "..." --reading "what you saw" --apply
superdev milestone update MS-0001 --name "..." --target 2026-09-30 --apply
```

---

## Module

A slice of the product that owns some of it. `planned`, `in_progress`,
`implemented`, `deprecated`.

A module's name reaches the filesystem as the directory its documentation is
written to, so renaming one changes committed paths. `docs generate` moves them.

```bash
superdev module record --name "..." --purpose "..." --apply
superdev module rename MOD-0002 --name "..." --apply
superdev feature move FEAT-0002 --module MOD-0001 --apply
```

---

## Feature

`draft` to `accepted`, then through implementation to `complete`. Acceptance is
gated on depth, and completion is derived from evidence rather than asserted.

### The depth gate

A feature declares a depth and cannot be accepted until it carries everything that
depth promises. Section 9.2:

| Depth | Requires |
|---|---|
| `microspec` | purpose, who wants it, scope in and out, the flow, acceptance criteria, edge cases |
| `standard` | all of the above, plus surfaces, an API or a data entity, a workflow with steps, an observability requirement, a test plan |
| `full` | all of the above, plus a governing decision, a migration with its rollback, a security and privacy analysis |

```bash
superdev feature create --module MOD-0001 --name "..." --apply
superdev feature specify FEAT-0001 --apply \
  --purpose "..." --user "..." \
  --in "what it does" --not "what it deliberately does not do" \
  --flow "first" --flow "then" \
  --criterion "what must be true || how it is checked" \
  --edge "empty_states:what happens when there is nothing"
superdev feature depth FEAT-0001 standard --apply    # positional, not a flag
superdev feature depth FEAT-0001                     # what that depth now requires
superdev feature accept FEAT-0001 --apply
```

`--not`, never `--out`. `--out` is the global flag for writing a command's output
to a file, and the two being the same flag once wrote files named after their own
contents into a repository.

### Acceptance criteria

`unmet`, `met`, `waived`. A criterion moves to `met` when passing evidence is
recorded against it, and back to `unmet` when a failure is. Waiving one needs a
reason, which is the difference between a decision and an oversight.

```bash
superdev feature waive FEAT-0001 --criterion AC-0004 --reason "..." --apply
```

### Completion

A feature is complete when every acceptance criterion is met or waived and every
task against it is closed. It is derived, never set: there is no command that
declares a feature finished.

---

## The rest of the product map

Surfaces, data entities, API operations, workflows, integrations, non-functional
requirements, state machines, jobs, webhooks and the glossary. Each is `planned`
or `draft` by default and each is what `standard` and `full` depth ask for.

```bash
superdev surface record --feature FEAT-0001 --name "..." --type screen \
  --route "/path" --action "what a person can do" --apply
superdev surface state SRF-0001 --state empty --copy "the real words" --apply

superdev entity record --feature FEAT-0001 --name "..." --sensitivity personal --apply
superdev field add ENT-0001 --name "..." --type "..." --apply
superdev relationship add --from ENT-0001 --to ENT-0002 --name "..." --apply

superdev operation record --feature FEAT-0002 --name "..." --style rest --apply
superdev service record --name "..." --apply

superdev workflow record --feature FEAT-0001 --name "..." \
  --step "first" --step "then" --apply
superdev workflow step WF-0001 --action "..." --apply
superdev workflow actor WF-0001 --who "..." --apply
superdev workflow branch WF-0001 --from-step 1 --condition "..." --apply

superdev requirement record --category security --requirement "..." --apply
superdev integration record --name "..." --when-absent "what happens" --apply
superdev states record --entity "..." --state "..." --state "..." --apply
superdev transition add SM-0001 --from "..." --to "..." --event "..." --apply
superdev migration record --name "..." --forward "..." --rollback "..." --apply
superdev job record --name "..." --trigger "..." --apply
superdev webhook record --name "..." --direction incoming --verification "..." --apply
superdev runtime record --name "..." --runs-where "..." --apply
superdev term record --term "..." --meaning "..." --apply
```

`requirement record` is where a security or privacy review lives. Several of these
refuse an incomplete record rather than storing a shell: a workflow needs its
steps, because a named process with no sequence is a title; an integration needs
what happens when it is unavailable, because failure behaviour invented during the
first outage is what the record prevents; a migration needs its rollback.

---

## Task

The only lifecycle with a full transition table. What may follow what, so nothing
arrives at complete sideways:

| From | May go to |
|---|---|
| `draft` | ready, in_progress, cancelled |
| `ready` | draft, in_progress, blocked, paused, cancelled |
| `in_progress` | in_review, verifying, blocked, paused, complete, cancelled |
| `in_review` | in_progress, verifying, blocked, complete, cancelled |
| `verifying` | in_progress, in_review, blocked, complete, cancelled |
| `blocked` | ready, in_progress, paused, cancelled |
| `paused` | ready, in_progress, blocked, cancelled |
| `complete` | in_progress |
| `cancelled` | ready, draft |
| `superseded` | ready |

Terminal: `complete`, `cancelled`, `superseded`. Everything else is open work.

### The gates

**A task must implement something.** Leaving `draft` is refused unless the task is
linked to an acceptance criterion, a workflow step, an operation, an entity, a
migration, an integration, a requirement, a document or a decision, or is marked
as enabling work naming the feature it unblocks.

**A task must be claimed to be worked.** Claiming points the session at the task,
which is what tells the untracked-work hook that an edit is accounted for. Every
path that ends a claim clears it.

**A task cannot complete without evidence.** Each acceptance criterion it verifies
needs a passing record, and a test plan covering the work needs a passing run.

```bash
superdev derive FEAT-0001 --apply             # tasks from accepted criteria
superdev task create --feature FEAT-0001 --name "..." --apply
superdev task update TASK-0007 --link acceptance_criterion:AC-0004 --apply
superdev task claim TASK-0007 --apply
superdev task start TASK-0007 --apply
superdev task evidence TASK-0007 --criterion AC-0004 --result pass \
  --summary "..." --detail "..." --command "how to re-run it" --apply
superdev task complete TASK-0007 --apply
superdev task block TASK-0007 --reason "..." --apply
superdev task unblock TASK-0007 --apply
superdev task reopen TASK-0007 --reason "..." --apply
superdev task merge TASK-0008 --into TASK-0007 --apply    # a duplicate
```

`reopen` and `unblock` take the claim, because a task in an active status that no
session owns is a state the record should not reach.

`merge` folds a duplicate in: evidence, dependencies, memory, changes and child
tasks move; contract links are copied; history stays where it happened; the claim
is released rather than reassigned. The duplicate becomes `superseded` and says
which task replaced it. There is no delete.

---

## Evidence

`current`, `stale`, `superseded`. What proves anything.

A record carrying a `--command` can be re-run, and `superdev verify` re-runs every
one. A check that stops passing marks its evidence `stale`, which takes the
criterion it proved back to `unmet`. Fresh proof supersedes the stale record it
replaces.

```bash
superdev verify                                  # re-run every recorded check
superdev evidence supersede EV-0004 --reason "..." --apply
```

Superseding is for a record that no longer applies, a check whose script moved,
say. It leaves the original and its reason in history, drops out of the tally, and
the criterion it proved falls back to whatever else is current, or to unmet.

Recording evidence for a criterion that already has some says so, and names the
command that retires the old one. Two current records for one criterion is
legitimate, because two different checks can both prove one thing; it is also what
a correction looks like, and the two are indistinguishable from the outside.

---

## Test plan

`draft`, `accepted`, `superseded`. An accepted plan covering the work is a
completion condition, so a plan needs how to run it: one nobody can run is a
promise.

```bash
superdev test-plan record-new --name "..." --strategy "..." --how-to-run "..." --apply
superdev test-plan run TP-0001 --apply
superdev test-plan record TP-0001 --apply     # a run carried out by hand
```

---

## Decision

`proposed`, `accepted`, `rejected`, `deprecated`, `partially_superseded`,
`superseded`, `time_boxed`, `revisit_required`.

A decision governs records, and superseding one keeps the chain: the old decision
stays, marked superseded, pointing at what replaced it.

```bash
superdev decision record --title "..." --governs feature:FEAT-0001 --apply
superdev decision supersede DEC-0004 --by DEC-0009 --apply
```

`full` depth asks for the decision governing a feature's load-bearing choice.

---

## Question

`open`, `answered`, `deferred`, `withdrawn`.

Every question carries why it matters, a recommendation, its options, and what
happens if it is deferred. Answering it settles the capability area it belongs to
and, for the two project-level questions, writes through to the field it exists to
fill.

```bash
superdev question list
superdev question answer Q-0002 --option "one of its options" --apply
superdev question answer Q-0002 --answer "in your own words" --apply
```

An honest "I do not know" is not refused and is not turned into a decision. It
becomes a reversible assumption carrying the recommended default, the question
stays open, and the area moves to `deferred` with an owner and a revisit trigger.

Options are selectable in the control centre, one or several according to the
question, with the recommended one tagged and the reason beside it. Four of the ten
material questions carry no recommendation, because nothing about a product in
general makes one of their options likelier.

---

## Assumption

`holding`, `confirmed`, `overturned`, `expired`. A reversible answer with a review
trigger.

```bash
superdev assumption record --statement "..." --revisit "when ..." --apply
superdev assumption resolve ASM-0003 --confirmed --apply
```

---

## Change

`proposed`, `recorded`, `reverted`. What moved in accepted scope, and why.

```bash
superdev change record --summary "..." --reason "..." --target feature:FEAT-0001 --apply
```

A change needs targets. Recording what moved without saying what it moved is the
gap this record exists to close.

---

## Capability area

The readiness checklist. `awaiting_decision`, `deferred`, `specified`,
`not_applicable`, seeded by init from a fixed list of 31 areas and 20 stack slots.

```bash
superdev capability list --open
superdev capability specify CAP-0001 --choice "what was chosen" --evidence "..." --apply
superdev capability not-applicable CAP-0021 --reason "..." --apply
```

`not-applicable` needs a reason, because an area dismissed without one is
indistinguishable from an area nobody looked at. An area that needs no question
because the project already answers it is settled during init, so "awaiting a
decision with no question raised" is unreachable rather than merely unlikely.

---

## Document

`generated`, `manual_edit_pending`, `accepted`, `rejected`, `missing`, `retired`.

Generated Markdown is a projection of the database, never a second writable source
of truth. A file whose body no longer matches its recorded hash becomes a pending
proposal that a person resolves.

```bash
superdev docs generate --apply
superdev docs diff talks/foundations/product.md
superdev docs accept talks/foundations/product.md --apply
superdev docs reject talks/foundations/product.md --apply
```

Accepting writes the human's values into the database first and only then touches
the file, because the reverse order would leave the file authoritative for however
long the write took. Rejecting records the discarded text before restoring the
generated version, so a rejection is recoverable.

Sections backed by child records rather than a single field cannot be read back
from Markdown, and the refusal names the command that writes them.

---

## Session

Sessions are written by the hooks, not authored. A session points at the task it
claimed, and that field is what tells the untracked-work hook whether an edit is
accounted for.

```bash
superdev resume        # everything the next session needs to carry on
superdev status        # where the project is, how fresh that is, what is next
superdev doctor        # health of the database, the docs and the record map
superdev readiness     # the production-readiness checklist, gap by gap
```

An edit made with no task claimed records a marker, and the readiness report raises
it at high severity. Three things are deliberately excluded from that: Superdev's
own runtime directory, a change git keeps reporting until it is committed, and
generated documents. All three once made the warning fire against work that had
been tracked properly, which teaches a reader to stop reading warnings.

---

## The one rule behind all of it

Completion is derived from recorded evidence about the real product. Not from a
status somebody set, not from a passing test count, not from a percentage. Every
gate above exists so that when the record says something is finished, something
was observed that made it true.
