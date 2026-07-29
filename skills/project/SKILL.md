---
name: project
description: The Superdev entry point for anything about building or understanding a product. Use when someone describes something they want built ("I want to build X"), asks to plan or implement a feature, asks what the project does or why it works a certain way, asks for status ("what is done?", "what is blocked?"), wants the control center opened, or when it is unclear which Superdev skill applies. Clarifies intent, routes to init or adopt, runs discovery, keeps goals, milestones, modules, features, workflows, APIs, data, decisions and tasks in the project database, derives tasks from accepted specifications, enforces the find-or-create, link, claim sequence before any product-changing work, records activity and completes work with evidence, and routes specialist work to its provider.
---

# Superdev Project Orchestrator

The single entry point. People describe what they want in ordinary language.
You run the loop below, keep the database true, and route specialist work.
Nobody should have to learn a command name or a provider name.

`SD` below means:
the installed `superdev` command, with `--root <project>` on every call.
Full surface: `the plugin's skills/project/references/commands.md`.

## What is authoritative

One normalized database at `.superdev/superdev.db` holds the product definition
and all execution state. Markdown under `talks/` is generated from it: a
projection, never a second place to write. `.superdev/` is git-ignored.

A manual edit to generated Markdown is never overwritten silently. It becomes a
proposal that a human reviews, and accepting it updates the database first.

## Writing style, always

Never emit the em dash character (U+2014) and never emit emoji, in anything
Superdev writes or stores: records, documentation, commit messages it drafts,
interface copy, generated comments, summaries. Use a comma, colon, semicolon,
parentheses or a hyphen. This binds text taken from a provider too, so rewrite
it before storing it. Canonical writes are screened and refused with
`E_STYLE_EM_DASH` or `E_STYLE_EMOJI`.

## The loop

Run in order. Skip a step only when it plainly does not apply, and say so.

1. **Orient.** Read repository instructions, layout, manifests, routes, schemas,
   git state. Never ask what the repository already answers.
2. **Understand intent.** Build, plan, question, status, debug, review, docs,
   decision, or an external action.
3. **Check the project exists.** `SD status --json`. Nothing in the database
   means new or unadopted, so go to **Starting a project**.
4. **Check governing decisions.** `SD decision list --json`, then read the ones
   touching this capability, its dependencies or its files. Surface a conflict
   before proposing anything, never after.
5. **Determine what is genuinely missing.** Only what changes the product.
6. **Ask** per **Questions** below.
7. **Update the model before building.** New or changed behavior is a
   specification change first: feature, acceptance criteria, workflow steps,
   surfaces and UI actions, API operations, data entities, migrations,
   integrations, jobs, webhooks, permissions, NFRs. Route to the `feature`
   skill for the interview and the depth choice.
8. **Derive tasks** from the accepted specification, never from a feature title.
   `SD derive <FEAT-id>`, then present the plan for acceptance. The feature is
   positional: as a flag it is ignored and every accepted feature is derived.
9. **Run the before-implementation sequence.** Below. It is not optional.
10. **Implement** against the accepted specification: smallest sufficient
    change, existing conventions preserved.
11. **Verify for real.** Run the product's own required check and read its
    output. Never claim a result you did not observe. Superdev itself has no
    test suite, so never tell anyone to run tests for the plugin.
12. **Complete with evidence.** Below.
13. **Refresh.** The control center updates from the committed transaction and
    waits for no Markdown rebuild. Run `SD docs generate` when accepted
    specification content changed.
14. **Report** the outcome and the single next action.

## Starting a project

| Situation | Route |
|---|---|
| Empty or new repository, an idea, a brief, or a folder of notes | `SD init`, through the `init` skill |
| Existing code, existing docs, existing conventions | `SD adopt`, through the `init` skill |

Discovery belongs to `init`. What this skill guarantees is that implementation
does not start before there is an accepted plan: the high-level plan and the
material decisions are presented and accepted, stored in the database, rendered
to Markdown, and only then turned into tasks.

## Before implementation

Before any product-changing work, in this order (brief section 12.2):

1. **Search for an existing task.** `SD task list --status ready --json`, or
   `SD task show <TASK-id>` when the user named one.
2. **If none exists, create a draft task.**
   `SD task create --feature <FEAT-id> --name <t>`.
3. **Link it to a feature.** Mandatory. A task with no feature is invalid and
   the database refuses it.
4. **Link it to a contract**: workflow step, UI action, API operation, data
   entity, migration, integration, job, webhook, NFR, document or accepted
   decision. Links are passed on creation: `SD task create --link <kind>:<id>`. If the work is
   genuinely enabling, mark it so and name the feature it unblocks:
   `--enabling --unblocks <FEAT-id>`. The refusals `E_TASK_WITHOUT_CONTRACT`
   and `E_ENABLING_WITHOUT_TARGET` are the database telling you the work is not
   yet understood.
5. **If no feature exists, stop.** Create or update the feature specification
   first, through the `feature` skill. Do not invent a feature to satisfy the
   constraint.
6. **Check governing decisions** for this capability, dependency or path. A
   conflict routes to the `decision` skill before any code changes.
7. **Claim it.** `SD task claim <TASK-id>` records developer, agent, branch and
   session.
8. **Move it to In Progress.** `SD task update <TASK-id> --status in_progress`.

Lifecycle detail, categories, dependencies, subtasks and blocked work live in
the `task` skill.

## During implementation

- Record meaningful activity at natural boundaries:
  `SD task evidence <TASK-id> --summary "<what changed and why>"`. Every mutation
  writes an activity event on its own, so do not narrate every file read or
  shell command. The test is whether a human would want to read it.
- Scope changed? Update the specification and the task before continuing. New
  work must not live only in conversation or in the code.
- Blocked? `SD task block <TASK-id> --reason <why>` immediately, not at the end.
- Behavior outside the accepted scope needs the feature and its docs updated
  first.

## Completion

Before completing a task:

1. Run the product's required verification and observe the output.
2. `SD task evidence <TASK-id> --summary <what was observed> --result <pass|fail|inconclusive> --reference <path or command>`, once per stated verification requirement, then `SD task complete <TASK-id>`.
3. Update affected documentation with `SD docs generate`, then `SD docs diff` to
   see whether anything on disk is now a pending proposal.
4. Verify the related acceptance criteria are genuinely satisfied.
5. Let dependent work reopen or proceed as the dependency graph says.
6. The assignment releases on completion. Use `SD task release <TASK-id>` when
   stepping away without finishing.
7. Write the session outcome and the exact next action.

Parent progress is derived, never asserted. No command marks a feature,
milestone or goal complete. If a parent will not close, the open child work
named in `SD status` is the answer.

What is measured, though, is recorded rather than derived, and each has a
command:

- A goal is measured by its success criteria. `SD goal criterion <GOAL-id>
  --criterion "<what must be true>" --measurement "<how it is read>"` adds one,
  and `SD task evidence <TASK-id> --criterion <GSC-id> --result pass` marks it
  met once somebody has read it against the running product. A goal with no
  criteria counts as unmeasurable, not as met.
- A milestone is reached when its exit conditions are met. `SD milestone
  condition <MS-id> --condition "<what must hold>"` adds one, and `SD milestone
  met <MS-id> --condition "<its text>" --reading "<what was observed>"` marks it.
  The reading is required: met on its own is an assertion.
- A concept from the brief that nobody turned into a record stays a concept.
  `SD discovery convert <DIS-id> --to goal|module|feature` turns one into a
  record, and the concept stays on the map beside what it became. Leaving one
  unconverted is a decision; `SD doctor` names them so it is a decision somebody
  made rather than one nobody noticed.

## When a capability is missing

`SD doctor` reports every provider's readiness truthfully. A provider that is not
ready is named, with what is lost while it is absent, and Superdev never
substitutes its own approximation of what that provider does.

When the work needs a capability no installed provider covers, **find-skills** is
how to look for one; it owns discovery and the package manager, and Superdev never
reimplements either. If it is unavailable, say so and proceed with the capabilities
that exist. Never describe a catalogue of skills you have not read.

**task-observer** watches a working session for friction worth turning into a
skill. It is ambient rather than something to call at a moment, and its findings
belong in its own log, not in the project record.

## Correcting what is already recorded

A one-shot parse of a brief gets things wrong, and so do people. Nothing here is
frozen, and nothing is deleted:

```
SD module rename <MOD-id> --name "<better name>"
SD milestone update <MS-id> --name --outcome --target
SD feature move <FEAT-id> --module <MOD-id>
SD scope remove <SCOPE-id>
SD memory supersede <MEM-id> --by <MEM-id>
SD evidence supersede <EV-id> --reason "<why it no longer applies>"
SD decision supersede <DEC-id> --title "<the decision that replaces it>"
SD task merge <duplicate> --into <TASK-id>
SD retire <GOAL-id|MS-id> --reason "<why>"
```

A module's name becomes its documentation directory, so renaming one changes
committed paths and `SD docs generate` moves them. Everything else keeps its
history: superseding leaves the original and its reason readable, which is the
difference between a correction and a rewrite of the past.

## Task derivation

Tasks come from accepted specifications: acceptance criteria, workflow steps,
surfaces and UI actions, API operations, data entities and migrations,
integrations, jobs and webhooks, permissions, NFRs, observability, the product
test plan, documentation synchronization, rollout and rollback.

- Outcome sized, assignable, verifiable. Not one task per database row.
- Combine what must change together; split what can be delivered or blocked
  independently.
- Each task states why it exists, what contract it implements, the expected
  outcome, the boundaries it likely touches, completion criteria, verification
  requirements, documentation impact and dependencies.
- Present the derived plan for acceptance before implementing any of it.
- A scope change updates the specification first, then regenerates a task delta.
- Never rewrite completed tasks. Supersede or reopen them with history.
- Product test work is derived from the accepted product test plan. Never create
  a test task for the Superdev plugin itself.

## Questions

Ask only what changes the product. For each: plain language, why the answer
matters, a recommended default, and an example when it helps. Accept "I do not
know", propose the safe default, and record it as a reversible assumption.

- Batch three to five related questions.
- Ask one at a time for architecture, data, security, identity, billing, or
  anything irreversible.
- Never ask what you can safely infer from the repository.
- Ask a feature's questions when that feature enters discovery, not up front.

Owner questions are durable records. `SD question answer <Q-id> --answer
<text>` closes one. Unanswered material questions appear in `SD status` and in
the control center, so an open gap is never silent.

## Providers

Specialist work is routed outward. These are externally owned: orchestrate them,
never reimplement, rename or approximate their methodology.

| Need | Provider |
|---|---|
| Product brainstorming | Superpowers brainstorming |
| High-level and implementation planning | Superpowers planning |
| Product-code test discipline | Superpowers TDD |
| Debugging | Superpowers systematic debugging |
| Code review and finishing a branch | Superpowers review and finish workflows |
| Frontend product direction | Frontend Design |
| UI critique, accessibility and polish | Impeccable |
| "Is there a skill for X?" | Find Skills and skills.sh |
| Reusable methodology observations | Task Observer |
| Secrets and environment stages | envx (names only, never values) |
| Transitional recall, when installed | Claude Mem (a cache, never authority) |

Rules:

- Check readiness first with `SD doctor`. It installs nothing.
- Never install without explicit consent to a named plan. No `--all`, no silent
  `-y`, and strip those flags from any command you relay.
- A provider that did not run is named as not run, with its remediation. Work
  you did yourself is never presented as that provider's methodology.
- Screen provider output before it enters the database: no secrets, no machine
  paths, no em dash, no emoji, no private reasoning.
- Superdev's own local memory is the durable project memory. Claude Mem may
  supplement recall during the transition and never becomes project authority.

## Control center

`SD ui` opens the local control center and starts the service if it is not
running. `SD services` lists what is running; `SD start`, `SD stop` and
`SD restart` manage it. The interface reads only the local API and updates from
committed transactions, so it cannot show anything the database does not say.

Open it after initialization, after a derived task plan is accepted, and
whenever someone asks to see where the project stands.

## Harness honesty

Correctness never depends on a lifecycle hook firing.

- Claude Code runs the Superdev session hooks, which show the active task and
  persist handoff state.
- Codex hooks fire only after the user explicitly trusts them. Untrusted means
  no lifecycle automation there.
- skills.sh has no lifecycle-hook guarantee at all.

Where hooks are not active, run the explicit commands: `SD resume` at session
start, the before-implementation sequence by hand, and `SD status` before any
handoff. Say which one you ran.

## Routing to other skills

| Intent | Skill |
|---|---|
| Set up a new project or adopt an existing one | `init` |
| New or changed product behavior | `feature` |
| Task lifecycle: claim, block, reopen, derive | `task` |
| Where the project stands | `status` |
| Continue after a break or compaction | `resume` |
| Environment, providers, database health | `doctor` |
| Inspect, record or supersede a decision | `decision` |
| Something is failing | `debug` |
| Review a change before it lands | `review` |
| Documentation operation or template question | `docs` |

## Boundaries

- Completion is evidence, never assertion. If a gate refuses, report why; do not
  route around it.
- Never silently rewrite or delete a prior decision. Supersede it.
- Never put secrets, personal data, absolute machine paths or private
  identifiers into a record or a generated file.
- Superdev is a development orchestrator, not a security sandbox. External,
  destructive, publishing and installation actions need explicit confirmation on
  top of the harness permission model.
- The plugin has no test suite, by design. Products built with Superdev do get
  tests, derived from their accepted product test plan.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
