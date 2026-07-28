# ADR-0008: A generated standalone package for skills.sh

**Status:** Accepted
**Date:** 2026-07-25
**Owner/approver:** Superdev maintainers
**Supersedes (in part):** ADR-0002, which deferred standalone packaging

## Context

Superdev supports three surfaces. Two of them - the Claude and Codex plugins -
share one repository layout, so a skill can address its resources through
`${CLAUDE_PLUGIN_ROOT}` and find the shared `references/` and `scripts/`.

skills.sh has no plugin concept at all. It installs **skills**: a directory
containing a `SKILL.md`, resolved by the frontmatter `name`, copied into
`.agents/skills/<name>/`. A single Superdev skill installed that way arrived
with neither the shared contracts nor any runtime. ADR-0002 acknowledged this
and deferred it. That deferral is what this record closes.

Installing the naive package against the real CLI produced two concrete
failures, neither visible from reading the code:

1. It registered as **`project`**, because the frontmatter name was `project`
   while the directory was `superdev`. skills.sh installs by frontmatter name,
   so the package landed under the wrong name and would collide with any other
   tool's `project` skill.
2. `status` worked and the **dashboard did not**, because the generator resolved
   its template only at the plugin path. The package looked healthy right up to
   the moment a user asked to see their project.

## Decision criteria

- One installable unit that works with no repository checkout.
- No dependence on `${CLAUDE_PLUGIN_ROOT}`.
- Canonical source ownership must stay unambiguous.
- No hand-maintained duplication of skills, references or runtime.
- The honest limitations of the surface must be stated in the package itself.

## Options considered

**A. Ship each skill separately with a documented limitation.** Status quo.
Rejected: it is the limitation, not a fix. A skill that can describe the product
but not operate it is worse than absent, because the user cannot tell.

**B. Hand-maintain a parallel standalone tree.** Rejected outright: two copies
of the orchestrator and the runtime would diverge within a release, and the
divergence would surface as a bug report from the surface we test least.

**C. Generate one self-contained `superdev` skill from the canonical source.**
Chosen.

**D. Require the repository as a peer install.** Rejected: skills.sh users
install skills, not repositories, and a package that needs a git checkout is not
a package.

## Decision

`scripts/package/build-standalone.mjs` generates `dist/skills/superdev/` from
the canonical source: the orchestrator, the Docs capability, the deterministic
runtime, the shared contracts, and the dashboard asset. Paths inside it resolve
relative to the skill directory.

**The repository stays canonical. `dist/` is output.** It is committed so the
package is installable from a clone, and a drift check fails the suite whenever
it no longer matches its source - so the two cannot silently disagree. The build
is deterministic: sorted traversal, byte-for-byte copies, no timestamps.

Template resolution now tries every supported install layout rather than
assuming the plugin one.

The package states plainly that skills.sh has no lifecycle hooks - no
session-start context, no dirty marking, no end-of-session prompt - and gives
the manual equivalent: open with *project status*, close by recording the
session outcome.

## Consequences

- A skills.sh user gets the whole product: initialize or adopt, build the
  product map, record decisions, tasks, evidence and session summaries, generate
  status and the dashboard, and use the Docs capability.
- The repository carries ~1 MB of generated output. Accepted: it is the price of
  a surface that actually works, and the drift check keeps it honest.
- Adding a runtime module means rebuilding the package; the drift check makes
  forgetting a test failure rather than a support ticket.
- Tests, fixtures and plugin manifests are excluded from the package.

## Verification

- `tests/integration/standalone-package.test.mjs` - drift, determinism,
  name/directory agreement, no plugin-root dependency, stated hook limitation,
  required runtime present, nothing extraneous shipped, template resolves in
  both layouts.
- Installed with the real `skills` CLI from a path containing spaces, into an
  unrelated working directory, then used to initialize a project, build a
  product map and generate a dashboard with no repository present.

## Revisit triggers

- skills.sh gains a plugin or bundle concept that removes the need to generate.
- The package outgrows what is reasonable to commit.
- A second standalone entry point is genuinely needed.
