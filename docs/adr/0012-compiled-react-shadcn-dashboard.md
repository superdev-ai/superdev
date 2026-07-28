# ADR-0012: Compile one stable React and Shadcn dashboard shell

> **Superseded by ADR-0020.** The interface was rebuilt. One source, one committed bundle with a source-hash manifest, and every other distribution surface assembled from it.
>
> The body below is left exactly as it was. History is not rewritten here; a
> decision that was true when it was made stays readable as what was decided.


- **Status:** Accepted
- **Date:** 2026-07-26
- **Owner/approver:** Project owner
- **Scope:** Superdev dashboard source, packaging, local snapshots and live project status.

## Context

The original dashboard was a large hand-authored HTML file. Each product
improvement increased the size and coupling of that file. Reusable navigation,
record drawers, task management and a manipulable product map need a component
model.

The dashboard must still work inside Claude Code, Codex and a standalone
skills.sh installation. Those plugin caches do not install packages. Ordinary
project work must update project data without asking an agent to regenerate or
inspect dashboard markup.

## Decision

The dashboard source is a React application built from Shadcn UI components.
It lives in `dashboard-ui/` and is contributor tooling, not plugin runtime.

The build produces one deterministic, self-contained
`skills/project/assets/dashboard.html` file with:

- all JavaScript and CSS inlined;
- the existing Superdev data placeholder;
- the existing live-client placeholder;
- no CDN, asset server or package installation requirement.

The compiled shell is stable. It is rebuilt only when dashboard source changes.
Project status, records, tasks, relationships and freshness are data. The live
dashboard reads that data from the Superdev read service and reacts to status
events. A saved snapshot embeds the same data in the compiled shell.

Agents interact with canonical project records and bounded task operations.
They do not read, rewrite or carry the dashboard component tree during ordinary
project work. This keeps visual reporting out of the agent context budget.

## Data flow

1. Canonical records in `talks/` remain the authority.
2. Superdev projects them into local SQLite or reads a configured remote
   libSQL projection.
3. The shared read service returns one typed dashboard payload.
4. React renders that payload through stable components.
5. Live status events replace the payload in memory and React updates only the
   affected view.
6. Bounded local task mutations update canonical records, refresh projections
   and publish a status event.

## Runtime boundary

React, Shadcn UI, Radix primitives, Tailwind CSS and Vite are build-time
dependencies of `dashboard-ui/`. They are compiled into the checked-in asset.
No shipped Superdev script imports them, and plugin users do not run a package
manager.

## Consequences

- Dashboard behavior can be organized into reusable, testable components.
- The same shell supports local SQLite, remote libSQL and static snapshots.
- Project data can change continuously without UI source churn.
- A dashboard source change requires rebuilding and checking the generated
  asset before release.
- The generated asset is larger than the previous hand-authored template, but
  it remains local, self-contained and cacheable.

## Enforcement and verification

- A deterministic build command regenerates the dashboard asset.
- A check command fails when the compiled asset differs from its React source.
- Static snapshot tests reject external scripts, styles and network clients.
- Live browser tests prove data refresh, deep links and bounded task mutations.
- Package validation continues to reject runtime dependencies in the root
  package and shipped scripts.

## Revisit triggers

Revisit this decision if a target plugin runtime gains a reliable package
installation lifecycle, if the compiled artifact becomes too large for a
supported marketplace, or if the shared read model cannot represent a required
dashboard interaction.
