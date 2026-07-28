---
name: init
description: Start a Superdev project and run product discovery, or adopt a repository that already exists. Use for "set up superdev here", "I want to build X", "start a project", "initialize", "adopt this codebase", or when the orchestrator finds no project in the database. Detects new versus existing, inspects the repository before asking anything, checks provider readiness without installing, runs brainstorming and discovery, records sources and assumptions, walks the production-readiness checklist so no capability area is silently skipped, presents a high-level plan for acceptance, stores accepted content in the database, generates the Markdown projection, derives the first tasks, and opens the control center.
---

# Initialize or Adopt

Initialization creates the container and the accepted plan. It does not create
implementation work until a person has accepted the plan.

`SD` means the installed `superdev` command, with `--root <project>` on
every call. Full surface:
`the plugin's skills/project/references/commands.md`.

## Which path

| Input | Command |
|---|---|
| An idea in a sentence, a Markdown brief, a folder of notes | `SD init` |
| Empty or nearly empty repository | `SD init` |
| Existing code, existing documentation, existing conventions | `SD adopt` |

If both apply (a real codebase plus a brief for what comes next), adopt first,
then run discovery for the new direction on top of what adoption found.

## Order of operations

1. **Inspect before asking.** Repository instructions, README, manifests,
   routes, schemas, migrations, configuration, existing docs, tests. Every
   question the repository already answers is a question you must not ask.
2. **Check provider readiness.** `SD doctor`. It installs nothing. Report what
   is ready and what is not before relying on it.
3. **Run `SD init` or `SD adopt`.** This creates the database at
   `.superdev/superdev.db`, adds `.superdev/` to `.gitignore`, opens a discovery
   session, and records supplied material as immutable source records with
   content hashes. Original notes are never rewritten.
4. **Brainstorm with the provider.** Superpowers brainstorming shapes the
   product when it is ready. If it is not, say so plainly, run the discovery
   questions below, and do not present your own interview as that methodology.
5. **Build the concept map**: users, problems, desired outcomes, possible
   modules, capabilities, constraints, assumptions, unknowns, risks.
6. **Walk the readiness checklist.** Below. Every applicable area gets an
   answer or an explicit deferral.
7. **Ask the smallest set of material questions.** Below.
8. **Produce the high-level plan before any implementation task exists.**
   `SD plan` assembles goals, milestones, modules and feature candidates from
   what has been accepted so far.
9. **Present the plan and the material decisions for acceptance.** Nothing is
   stored as accepted until a person accepts it.
10. **Store the accepted content**, then `SD docs generate` to render the
    Markdown projection under `talks/`.
11. **Derive tasks** from the accepted specifications with `SD derive`, and
    present that plan for acceptance too. See the `task` skill.
12. **Open the control center** with `SD ui`.

## Production-readiness checklist

Discovery evaluates each applicable area. Silent gaps are invalid.

Product purpose and success criteria; users, roles, permissions and tenancy;
frontend delivery shape; navigation and information architecture; design system
and accessibility; backend boundaries; API style and public contracts;
authentication and session lifecycle; authorization enforcement; database and
data ownership; migrations and rollback; file or object storage; search and
indexing; real-time behavior; offline behavior and conflict handling;
background jobs and scheduling; events and webhooks; external integrations;
notifications; rate limiting and abuse controls; security and privacy;
compliance (only when explicitly declared); observability and operational
response; performance and capacity targets; environments and secret management;
CI and CD; infrastructure and deployment; backups, recovery, retention and
deletion; product analytics (only when approved); testing strategy for the
product; release and rollback.

Each area ends as exactly one of:

- **Applicable and specified.**
- **Applicable and awaiting a decision** (it becomes an owner question).
- **Not applicable, with a reason.**
- **Deferred, with owner, revisit trigger and consequence.**

"Not discussed" is not one of the four. An area nobody has looked at is an open
question, not an absence.

## Questions

For each: plain language, why the answer matters, a recommended default, and an
example when it helps.

- Batch three to five related questions.
- Ask one at a time for architecture, data, security, identity, billing, or
  anything irreversible.
- Accept "I do not know". Record the recommended default as a reversible
  assumption with what would make it wrong.
- Do not front-load every feature question. A feature's questions belong to the
  moment that feature enters discovery.

## Adopting an existing project

- Existing documentation is never moved, rewritten, restructured or duplicated.
  Adoption reads it and records what it found.
- Adopt the repository's conventions rather than imposing new ones.
- Label every inferred fact as inferred, with the file it came from. An
  inference presented as a specification is a lie the project will inherit.
- Where detection is genuinely ambiguous, ask rather than guess.
- Reverse-engineering existing behavior into specifications is a Docs operation:
  route to the `docs` skill for that, then store what is accepted.
- Migrating an existing documentation system into the generated projection is a
  separate decision, taken later and deliberately. Never create two editable
  copies of one specification.

## Verify before handing back

- `SD db status` reports integrity, foreign keys and schema version cleanly.
- `SD status` shows the project, the accepted plan and a next action.
- `SD docs diff` is empty, or the pending proposals are explained.
- `.superdev/` is git-ignored, and no per-record tracking file was created
  anywhere in the repository.
- Re-running `SD init` or `SD adopt` reports an existing project rather than
  overwriting one.

Then hand back to the `project` skill. Initialization creates the container and
the plan; it does not build the product.

## Boundaries

- Writes stay under the project root and under `.superdev/` plus generated
  `talks/` documentation.
- No network installation happens here. Provider gaps are reported with their
  remediation and consent is asked separately.
- Never store secrets, personal data, private identifiers or absolute machine
  paths in a record or a generated file.
- A dirty worktree is preserved. Conflicts are surfaced, never forced past.

*Standalone note: on skills.sh, install the generated `superdev` package. It
carries the orchestrator, the Docs capability and the runtime, and needs no
repository. A single skill copied out on its own has no runtime; say which
command was unavailable rather than working around it silently.*
