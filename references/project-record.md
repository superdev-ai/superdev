# The Project Record

Where a fact lives, who may change it, and what is derived from it. This
replaces the file-per-record layout Superdev used previously; see ADR-0015 and
ADR-0017.

## 1. One authority

The project database at `.superdev/superdev.db` is the authority for project
definition, goals, milestones, modules, features, acceptance criteria, workflows
and steps, state machines, surfaces and actions, APIs, data entities and
migrations, integrations, jobs, webhooks, roles and permissions, quality
attributes, decisions, questions and assumptions, tasks and subtasks,
assignments, developers, agents, branches, sessions, activity, evidence, local
memory, and future sync metadata.

The whole `.superdev/` directory is git-ignored and never committed.

## 2. Canonical versus generated

| Information | Authority | Derived from it |
|---|---|---|
| Accepted specification fields | database | Markdown, control center, summaries |
| Tasks, assignments, sessions, branches, activity, evidence | database | control center, status reports, handoff summaries |
| Decisions and their transitions | database, append only | ADR Markdown, decision views |
| Change history | database, append only | changelog, activity feed |
| Raw intake sources | the original file plus an immutable content hash | extracted claims, processing report |
| Interface layout and components | versioned plugin source | the compiled bundle |

A derived artifact carries a regeneration marker and is safe to delete and
rebuild. It is never hand-edited as authority.

## 3. What the repository holds

Only the documentation the Docs skill generates, the `talks/project.yaml`
adapter, source material the owner deliberately keeps, and the product's own
files.

The repository must not contain one file per goal, milestone, task, subtask,
assignment, status transition, evidence item, activity event, session, agent,
branch, heartbeat, memory entry, sync operation, sync cursor, sync conflict or
database revision. Those are database records. A consumer repository is for the
product being built, not for Superdev's bookkeeping.

## 4. Identifier prefixes

Stable, human-readable and typed, because they appear in deep links, generated
Markdown, commit messages and agent conversation. The full map is in
`src/model/ids.mjs`. The common ones: `PRJ`, `GOAL`, `MS`, `MOD`, `FEAT`, `WF`,
`STEP`, `SRF`, `ACT`, `API`, `ENT`, `MIG`, `INT`, `JOB`, `WH`, `NFR`, `DEC`,
`DOC`, `TASK`, `DEV`, `AGT`, `SES`, `EV`, `MEM`, `Q`, `CAP`.

## 5. History is immutable

`activity_events`, `decision_transitions` and `status_history` refuse `UPDATE`
and `DELETE` at the database level, not by convention. Superseded content keeps
its row and gains a status and a banner; it is never deleted or rewritten. Drift
is marked, never silently resolved.

Every activity event carries a sequence and a hash chaining it to the one before
it, so a gap or a rewrite is detectable.

## 6. Minimum fields that must never be lost

**Activity event:** actor, event type, summary, when, sequence, and the records
it concerns. Enough for a person to understand what happened without opening the
code.

**Session summary:** objective, outcome, decisions encountered, changed
artifacts, verification, open questions, blockers, pending documentation, exact
next action. Outcomes only, never private model reasoning.

**Decision:** context, evidence, criteria, options considered, the decision,
observable rationale, consequences, risks, where it is enforced, how it is
verified, and what would reopen it.

**Task:** the feature it belongs to, why it exists, expected outcome, completion
criteria, verification requirements, and either a contract link or an explicit
statement of which feature it unblocks and why.

## 7. Existing projects are adopted, never restructured

Adoption writes the adapter and the control layer only. Existing documentation
is never moved, rewritten or duplicated, and a second editable source of truth
is never created. Migration between documentation profiles is a separately
approved action with its own plan.

## 8. Local first

The local database wins by default. A differing remote version creates a visible
conflict record and never silently overwrites local data. See ADR-0016.
