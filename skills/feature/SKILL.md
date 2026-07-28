---
name: feature
description: Specify new or changed product behavior before it is built, at a depth proportionate to its risk. Use for "add X", "build Y", "change how Z works", "users should be able to ...", or any request that creates or alters what the product does. Picks microspec, standard spec or full design; checks governing decisions first; interviews only for what is genuinely undecided; records the feature with its module, milestone, goals, acceptance criteria, edge cases, workflows, surfaces and UI actions, API operations, data entities, migrations, integrations, jobs, permissions and NFRs in the database; then derives tasks from what was accepted. Bug fixes route to debug and behavior-preserving refactors need no feature interview.
---

# Feature Specification

New behavior gets an accepted specification before it gets code. The database
then derives the work from that specification, so a feature that was never
specified cannot produce a valid task.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Steps

1. **Confirm this is feature work.** A defect routes to `debug`. A
   behavior-preserving refactor needs no interview, only a task linked to what
   it touches. Everything that changes what the product does belongs here.
2. **Check governing decisions.** `SD decision list --json`, then read the ones
   touching this capability, its dependencies or its files. A conflict routes to
   the `decision` skill before any specification work, not after.
3. **Read what already exists.** `SD status --json` for the modules, milestones
   and features already accepted. New behavior usually extends a feature rather
   than creating one.
4. **Pick the depth** (brief section 9.2). Depth determines which fields and
   child records are required before acceptance:
   - **Microspec**: small, local, reversible behavior. Purpose, user, scope,
     primary flow, acceptance criteria, affected contracts, edge and error
     behavior, verification.
   - **Standard spec**: normal cross-component behavior. Adds surfaces and UI
     actions, API operations, data entities, roles and permissions, workflow and
     its steps, state transitions, non-happy paths, observability, rollout, test
     plan.
   - **Full design**: architecture, authentication, tenancy, public contracts,
     migrations, privacy, security, billing, high-risk integrations. Adds
     alternatives considered, sequence and state diagrams, migration and
     rollback plan, capacity and performance targets, failure recovery,
     operations, compatibility, and one or more decision records.
5. **Interview for what is undecided only.** Plain language, why the answer
   matters, a recommended default, an example when it helps. Batch three to
   five; ask one at a time for anything irreversible. "I do not know" becomes
   the default plus a recorded assumption.
6. **Route the specialist passes.** Superpowers brainstorming shapes the
   behavior, Superpowers planning shapes the implementation approach. Check
   readiness with `SD doctor`. If a provider is not ready, say so, run the
   interview here instead, and never present your own work as that provider's
   methodology.
7. **Record the specification.** `SD plan` presents new and changed features for
   acceptance and stores what is accepted (`SD plan --help` for scoping it to
   one module or feature). Every feature belongs to exactly one module and
   exactly one delivery milestone, and supports at least one goal. A capability
   that genuinely spans two stages becomes two bounded features with a
   dependency between them, never one feature with two milestones.
8. **Fill the contracts the depth requires.** `SD feature specify <FEAT-id>`
   writes the six microspec covers: `--purpose`, `--user`, `--in`, `--out`,
   `--flow`, `--criterion "what || how it is verified"` and
   `--edge category:behavior`. `SD feature depth <FEAT-id>` says what is still
   missing, and `SD feature depth <FEAT-id> <depth>` changes how much is owed.
   The deeper covers are their own records: workflows and steps, surfaces and
   their states, UI actions, API operations, data entities and fields,
   migrations, integrations, jobs and webhooks, roles and permissions, NFRs,
   observability, and the product test plan. All of them become the contract
   that tasks link to with `SD task update <TASK-id> --link type:id`.
9. **Generate the documentation.** `SD docs generate`, then `SD docs diff` to
   confirm nothing on disk is now an unreviewed proposal.
10. **Derive the work.** `SD derive <FEAT-id>`, present the derived
    plan for acceptance, then hand to the `task` skill for the
    before-implementation sequence. Implementation starts there, never here.

## Module completeness

For each module, capture or deliberately mark not applicable: pages and
surfaces; UI composition; actions; API surface; data; end-to-end wiring; state
machines; events; edge cases; UI states; telemetry; accessibility;
internationalization; feature flags; responsive behavior; user-facing copy; URL
state and deep links; performance; discoverability and SEO; compliance and
product tests.

"Not yet considered" is not an answer. Either it is specified, or it is marked
not applicable with a reason, or it is an open question with an owner.

## UI-bearing features

A surface is not specified until every interactive element on it has: label,
purpose, the role and permission that may use it, precondition, the action it
performs, input and validation, the API or local effect, and its loading,
disabled, empty, success, error and offline states, plus keyboard behavior,
accessible name, focus behavior, responsive behavior, and confirmation for
anything destructive. Telemetry only when explicitly approved.

Route direction and implementation to **Frontend Design**, and critique,
accessibility, interaction quality and polish to **Impeccable**. Check both with
`SD doctor`. Name each provider that ran and each that did not, with the reason.
A run that says nothing about a provider is not a passing run.

Validate against the real interface, not only headless assertions: exercise each
contracted state, keyboard navigation, focus restoration, accessible names and
responsive behavior, and keep the screenshot or recording as the evidence
attached to the task.

## Changing an accepted feature

Specification first, then the task delta.

1. Update the feature and its contracts, and take acceptance for the change.
2. `SD docs generate` so the projection matches.
3. `SD derive <FEAT-id>` regenerates the task plan as a delta. The feature is
   positional, not a flag.
4. Completed tasks are never rewritten. They are superseded or reopened with
   their history intact.

Work that appears mid-implementation and is outside the accepted scope stops and
comes back here. It must not live only in the conversation or in the code.

## Boundaries

- A feature is complete only when its accepted contract components are complete
  and its acceptance criteria carry current evidence. Progress is derived; there
  is no command to declare a feature done.
- No invented stack specifics. Vendors, frameworks, budgets, regions and
  compliance scopes come from repository evidence or an accepted decision.
- Product tests come from the accepted product test plan and the project's own
  tooling. Never invent a framework because it is popular, and never write a
  test task for the Superdev plugin.
- Never store secrets, personal data, private identifiers or absolute machine
  paths in a specification.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
