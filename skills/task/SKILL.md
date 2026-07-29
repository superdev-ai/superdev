---
name: task
description: Run the task lifecycle against the Superdev database. Use for "what should I work on?", "what am I working on?", "create a task for this", "claim this", "this is blocked", "mark it done", "reopen that", "break this into subtasks", or when a task creation is refused because it has no feature or no contract behind it. Covers deriving tasks from accepted specifications, the find-or-create then link then claim sequence before implementation, recording activity, blocking and unblocking, completing with evidence, reopening with history, and the dependency and subtask graph. Does not run the feature interview, and an unspecified feature routes to the feature skill first.
---

# Task Lifecycle

Task tracking is an execution contract, not a status report written afterwards.
Every task lives in the database at `.superdev/superdev.db`. There is no task
file, and there never will be: one file per row is the failure this design
exists to remove.

`SD` means the installed `superdev` command, with `--root <project>` on
every call. Full surface:
`the plugin's skills/project/references/commands.md`.

## The two rules the database enforces

1. **Every task belongs to exactly one feature.** `feature_id` cannot be null.
2. **Every task either links a contract or is explicitly enabling.** Contract
   kinds: workflow step, UI action, API operation, data entity, migration,
   integration, job, webhook, NFR, document, accepted decision. Enabling work
   must name the feature it unblocks in plain language.

These are triggers, not advice. Refusals:

| Code | What it means | What to do |
|---|---|---|
| `E_TASK_WITHOUT_CONTRACT` | The task implements nothing that was specified | Link the contract, or specify it first through the `feature` skill |
| `E_ENABLING_WITHOUT_TARGET` | Enabling work naming no unblocked feature | Add `--enabling --unblocks <FEAT-id>` and say why in the outcome |
| `E_OPEN_SUBTASKS` | A parent cannot close over open required children | Close or cancel the children, or remove the requirement deliberately |
| `E_VERSION_CONFLICT` | The record changed under you | Re-read with `task show` and retry |
| `E_DB_LOCKED` | Another process holds the write lock | Retry. Never remove a lock by hand |

A refusal is information: the work is not yet understood well enough to start.
Do not route around it by inventing a feature or a link.

## Deriving work

Tasks are derived from accepted specifications, never invented from a feature
title.

```
SD derive <FEAT-id>
```

Derivation reads acceptance criteria, workflow steps, surfaces and UI actions,
API operations, data entities and migrations, integrations, jobs and webhooks,
permissions, NFRs, observability, the product test plan, documentation
synchronization, and rollout and rollback.

- Outcome sized: assignable, implementable, verifiable.
- Not one task per row. Combine what must change together, split what can be
  delivered or blocked on its own.
- Subtasks only where they improve execution clarity.
- **Present the derived plan for acceptance before any of it is implemented.**
- A scope change updates the specification first, then regenerates a delta.
- Product test work comes from the accepted product test plan. Never create a
  test task for the Superdev plugin itself.

## Before implementation

The sequence, in order:

```
SD task list --status ready --json          # 1. is there already a task
SD task create --feature <FEAT-id> --name <t> \
  --link <kind>:<id>                             # 2, 3, 4. draft it with its contract
SD decision list --json                          # 6. governing decisions
SD task claim <TASK-id>                          # 7. developer, agent, branch, session
SD task update <TASK-id> --status in_progress    # 8.
```

Step 5 has no command: if the feature does not exist, stop and specify it
through the `feature` skill. Implementation waits.

Claim exactly one active task at a time. If a second piece of work appears
mid-flight, it is either in scope for the current task (update it) or a new task
(create it and leave it Ready).

## Status model

Draft, Ready, In Progress, In Review, Verifying, Blocked, Paused, Complete,
Cancelled, Superseded.

- Status history is append-only. Nothing is edited into a different past.
- Parent status is derived. A parent never completes while required child work
  is open or verification is missing.
- Move with `SD task update <TASK-id> --status <status>`.

Categories are data, not constants: Feature, Improvement, Bug, Refactor,
Investigation, Documentation, Integration, Migration, Infrastructure, Security,
Quality, Backlog. A project may add its own. An unclassified historical task
displays as Unclassified until someone classifies it deliberately.

## During the work

- `SD task evidence <TASK-id> --summary "<what changed and why>"` at natural
  boundaries. Every mutation already writes an activity event, so a note is for
  what a human would want to read later, not for narrating tool calls.
- Scope grew? Update the task and the specification before continuing.
- `SD task block <TASK-id> --reason <why>` the moment something blocks, with
  what would unblock it. A blocker discovered at the end of a session was
  unrecorded for the whole session.
- Dependencies: a task that must wait names what it waits for, so the graph and
  not a memory decides the order.

## Completing

```
SD task evidence <TASK-id> \
  --summary <what was observed> \
  --result <pass|fail|inconclusive> \
  --type <validator|command|review|manual_check> \
  --reference <path or command> \
  --command <the check, re-runnable> \
  --criterion <AC-id, when it proves one> \
  --plan <TP-id, when it is a run of an accepted test plan>
SD task complete <TASK-id>
```

Record `--command` whenever a command proved it, so `SD verify` can re-run the
check later and mark the evidence stale if it stops passing. Leave it off when
nothing reproduces the check; a manual verification is honest, an invented
command is not.

Every task carries a category, seeded by init from a fixed list. When a project
needs one the list does not have, `SD category add "<the kind of work>"
--description "<what it covers here>"` adds it, `SD category rename <TC-id> "<new
name>"` corrects one, and `SD category retire <TC-id>` takes it off the pickable list
while keeping the history of tasks that used it. `SD category list` shows what
exists and how many tasks use each.

Two tasks for one piece of work split its evidence, so each looks half finished
and the feature they serve can never close either. Fold the duplicate in with
`SD task merge <duplicate-id> --into <TASK-id>`: what it owns moves across, its
history stays where it happened, and it becomes superseded pointing at the
survivor. There is no delete, because a task carries the reasons it existed.

`--criterion` takes an acceptance criterion (`AC-nnnn`) or a goal success
criterion (`GSC-nnnn`). A goal criterion is a measured outcome, read against the
running product, and passing evidence marks it met. It is not derived from the
features serving the goal, because a goal can be served by finished features and
still not be reached.

When a check moves or stops applying, retire the record rather than leaving it to
fail forever: `SD evidence supersede <EV-id> --reason "<why it no longer
applies>"`. The original and its reason stay in history, it leaves the
verification tally, and any criterion resting on it falls back to whatever else
is current, or to unmet. Recording a second piece of evidence for a criterion
that already has some tells you so and names this command, because a correction
and a second independent proof look identical from the outside.

Completion is refused until every verification requirement the task states
carries its own passing evidence, so `task evidence` runs once per requirement
and `task complete` comes last. Section 9.3 also requires the accepted test
plans covering the work to have passed: `SD test-plan list` shows which cover
it and whether each has a passing run, `SD test-plan run <TP-id>` runs the ones
that are commands, and `SD test-plan record <TP-id> --summary` records a journey
that was carried out rather than run. An acceptance criterion that will not be
met is set aside with `SD feature waive <AC-id> --reason`, never left silently
unmet. A requirement you could not run takes
`--result inconclusive`, which records the attempt and leaves the task open.

Before that call:

1. Run the product's required verification and read the output. Never attach
   evidence for a run you did not observe.
2. Update affected docs: `SD docs generate`, then `SD docs diff` for pending
   proposals.
3. Confirm the related acceptance criteria are genuinely satisfied.
4. Complete or reopen dependent work as the graph requires.

Completion releases the assignment and recalculates parent progress from the
accepted contract. Evidence older than thirty days is stale, which is not the
same as satisfied.

## Reopening and superseding

- `SD task reopen <TASK-id> --reason <why>` when completed work turns out not to
  hold. History is preserved; the earlier completion and its evidence stay
  visible.
- Work that no longer applies is cancelled or superseded, with the successor
  named. Never silently rewrite a completed task into a different task.

## Reading the board

- `SD task list --status <status>` filters the board.
- `SD task list --feature <FEAT-id>` shows one feature's work.
- `SD task list --all` includes work that is not Ready. Claims show in the
  listing, so what this developer or agent holds is read from there.
- `SD task show <TASK-id>` gives contract links, dependencies, subtasks,
  activity and evidence.
- `SD ui` opens the same data in the control center, live.

## Boundaries

- Never mark a task complete to make a report look finished. Completion is
  evidence.
- Never create a task that exists only to satisfy tracking. If it implements
  nothing specified and unblocks nothing, it should not exist.
- Never put secrets, personal data or absolute machine paths into a task, a
  note, or an evidence reference.
- Task detail belongs in the database and the control center, not in a Markdown
  file. Do not generate one.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
