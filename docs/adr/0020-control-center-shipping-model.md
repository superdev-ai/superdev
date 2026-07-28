# ADR-0020: One control-center source, one committed bundle, assembled everywhere else

- **Status:** Accepted
- **Date:** 2026-07-27
- **Owner/approver:** Project owner
- **Scope:** The local control center and how it reaches every distribution surface.
- **Supersedes:** ADR-0012

## Context

Two brief requirements look contradictory. The compiled interface must ship
inside the plugin so a user project installs no frontend dependencies, and
duplicate standalone copies that are not rebuilt deterministically must be
removed. Committing a built bundle looks like exactly the duplicate the second
rule forbids.

## Decision

`ui/` is the only source. Its build output lands at exactly one committed path
inside the plugin, accompanied by a manifest recording the hash of the sources
that produced it. Every other distribution surface is assembled from that one
path by the packaging script and never carries its own copy.

`npm run ui:check` rebuilds and fails if the committed bundle does not match, so
the bundle is a deterministic artifact of a known source rather than a second
copy someone edits by hand. That is what makes it a build output instead of a
duplicate.

The interface reads only the local HTTP API. It never reads project files, and
it holds no fallback path to the filesystem, so there is no way for it to show
something the database does not say.

## Technology

React, TypeScript, Vite, Tailwind and shadcn, with `@xyflow/react` and `dagre`
for the interactive canvases. React-native nodes are what let the canvas nodes
be real components, which is what makes pan, zoom, drag, selection and keyboard
navigation accessible rather than decorative. Static diagrams that do not need
interaction are rendered as Mermaid.

Node positions live in the database rather than browser storage, because the
interface is required to read only the local API, and because a saved layout is
project information a teammate should get too.

## Consequences

- Positive: user projects install nothing, and the bundle cannot drift silently.
- Negative: the repository carries a compiled artifact, which is noisy in diffs.
- Neutral: contributors need a Node toolchain to rebuild the interface.

## Enforcement

`ui:check` in the validators, plus the package inventory check for stale copies.

## Related

ADR-0012, ADR-0019.
