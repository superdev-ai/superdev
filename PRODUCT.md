# Product

What Superdev is for, who it is for, and the standards its interface is held to.
This is the product brief. `README.md` is how to use it, `docs/prd.md` is the
full requirements document, and `docs/adr/` is why it is built the way it is.

## Shape

Superdev is a command-line tool with a local dashboard, distributed three ways:

- **`superdev-cli`** on npm, which is the engine and every command.
- **A plugin** for Claude Code and Codex, distributed by git, carrying the skills
  an agent reads and the lifecycle hooks.
- **A standalone bundle** for skills.sh compatible agents, self-contained.

It is not a hosted service, has no accounts, and runs with no network.

## Users

Two groups, with different problems.

**People who can describe a product but not specify one.** They know what they
want built. Turning that into requirements, workflows, a data model, tasks and
evidence is the part they cannot do, and it is the part that decides whether what
gets built resembles what they asked for.

**Developers and teams who want an honest shared record.** They can specify
things. What they lose is continuity: a decision made last month, why a feature
exists, whether something is actually finished. Superdev is the record that does
not forget, and refuses to say finished when nothing proved it.

The dashboard serves both, plus anyone who needs to understand where a project
stands without first learning the repository layout or Superdev's own vocabulary.

Increasingly the reader is an agent rather than a person. That does not change
what is written, only that it has to be true when nobody is checking.

## Purpose

Superdev turns an ordinary-language product idea into a living, traceable product
record, then keeps that record honest while the product is built.

Success is that these questions have fast, confident answers:

- What are we building, and why?
- Which outcomes, features, workflows and integrations are in scope?
- What works now, what is being built, what remains?
- What is blocked, at risk, stale or drifting?
- What changed, why, and what evidence supports the claim?
- What should the person or the agent do next?

It will not make code correct. What it removes is ambiguity, forgotten context,
undocumented decisions, and the distance between a status report and the truth.

## Positioning

The shared product record that keeps people and coding agents agreed on what is
being built, why it matters, what is actually complete, and what happens next.

## Personality

Clear, calm and exact. Proactive without being intrusive, rigorous without
becoming bureaucratic, capable without hiding uncertainty. Ordinary language
first, technical detail on demand.

A refusal is part of the personality, not a failure of it. Superdev says no when
a feature is too thin to build or a task has nothing proving it, and every
refusal names the next step.

## The dashboard

A local page served by the CLI, reading the project database on every request.
Twenty areas, grouped by the question somebody arrives with rather than by the
shape of the data:

- **Where we are:** Overview, Readiness, Activity.
- **What we are building:** Discovery, Product, Blueprint, Features, Workflows.
- **How it is built:** Data, Architecture, APIs, UI Surfaces, Decisions.
- **How we know it works:** Evidence, Test Plans, Changes.
- **Who is doing it:** Tasks, Team, Sync, Settings.

An area that no group contains fails the build, so nothing can exist without a
way to reach it.

The interactive canvases, the product blueprint and the entity and architecture
maps, highlight a record's network on click and open it on double click. Below
tablet width the map is not drawn at all and the record list takes its place,
because a graph nobody can read is not a picture.

## Anti-references

Superdev must not resemble a console dump, a static printed report, a generic
admin template, or a decorative project-management mockup. It must not lead with
internal identifiers, bare percentages, unexplained status words, dense technical
tables, or visual effects that compete with meaning.

It must not use emoji or em dashes in anything it generates or stores. Both are
refused at the storage boundary and by a validator, so this is enforced rather
than requested.

It must never imply a status is current when the underlying record is
unavailable or stale.

## Design principles

1. **Human meaning before machine detail.** Lead with the outcome and the current
   reality. Keep identifiers, fingerprints, schema versions and command details
   available but secondary.
2. **Every number explains what it counts.** Progress always carries its
   numerator, denominator, scope, freshness and completion conditions. Where
   nothing has been agreed to measure, it says so rather than showing a figure
   that would not be true.
3. **Overview first, depth on demand.** A newcomer understands the project
   quickly; an expert reaches every feature, workflow, task, decision,
   dependency and piece of evidence.
4. **Relationships are part of the truth.** Status is not a list. The interface
   shows how goals, features, workflows, tasks, integrations, decisions and
   blockers affect one another.
5. **Live state is visibly live.** The interface names its data source, its
   freshness and its limits. It never silently substitutes stale data.
6. **Nothing is claimed that was not observed.** This applies to the product's
   own documentation as much as to its output. An unverifiable claim is a defect.

## Accessibility and inclusion

The dashboard supports complete keyboard navigation, semantic landmarks, visible
focus, responsive layouts, reduced motion, and status communication that never
relies on colour alone. Language stays understandable to a non-technical reader.
Empty, partial, stale, unavailable and error states each explain what happened
and what to do next.

## What it deliberately is not

- Not a hosted service. There is no cloud, and synchronization goes through a
  directory you provide.
- Not an issue tracker or a team project management tool.
- Not a CI system. It records what proved a change; it does not run your pipeline.
- Not a security sandbox. Destructive and outward-facing actions are governed by
  the agent harness's permission model, not by Superdev.
- Not a replacement for judgement. It refuses unproven completion; it does not
  decide whether the thing was worth building.
