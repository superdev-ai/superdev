---
name: doctor
description: Check whether Superdev can actually work here, and report exactly what to do when it cannot. Use for "is superdev set up correctly?", "why is this failing to start?", "check my environment", "is provider X available?", "the database will not open", "the service is not responding", or before substantial work in an unfamiliar environment. Two programs answer different halves: the CLI doctor reports the storage engine, database integrity, schema version, documentation sync and record alignment; the capability inspector reports harness lifecycle coverage and readiness for every specialist provider. Read only by default, so it installs nothing, enables nothing, decrypts nothing, and reports an unproven state as unproven rather than as ready.
---

# Doctor

Report the truthful state of everything Superdev depends on, with the exact
command that fixes each gap. Never install anything without consent to a named
plan.

`SD` means the installed `superdev` command, with `--root <project>` on
every call.

## Two programs, two questions

They are separate on purpose and neither reports the other's subject. Running
one and presenting it as the whole picture is the mistake this section exists to
prevent.

**Is this project healthy?**

```
SD doctor --root <project> [--json]
```

Reports: storage engine, database and schema version, migration history drift,
integrity, documentation sync, record alignment and freshness. Exit `1` when a
check finds a problem.

With `--json`, read the **exit code** or `data.ok`. The envelope's top level
`ok` reports only that the command ran, so it says `true` on a run where a check
failed. Each check carries `{ name, ok, detail }` and no remediation field: the
fixes below are this skill's knowledge, not the tool's output.

**Can this machine run Superdev's specialist work?**

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor/doctor.mjs" inspect --root <project> [--json]
```

Reports: which harnesses are present and ready, which providers are installed
and invocable here, and what lifecycle automation actually fires. Read only. It
writes nothing and installs nothing.

It exits `1` whenever any provider is not ready, which on a machine that has
deliberately not installed one is a normal state rather than a fault. Read the
report, not the exit code.

## Steps

1. **Run both.** A healthy project database says nothing about whether a
   provider is installed, and a ready provider says nothing about whether the
   database opens.
2. **Read every section**, not just the failing one. A passing engine with a
   failing integrity check is not a healthy project.
3. **Report each gap with its remediation**, in the order that unblocks the most
   work.
4. **Take consent separately** for anything that installs or changes the
   machine. One named plan, one informed yes. Never `--all`, never a silent
   `-y`, and strip those flags from any command you relay.
5. **Re-run** afterwards to prove the gap closed. A plan is not evidence; a
   passing re-run is.

## What `SD doctor` checks

**Storage engine.** Reported rather than tested: reaching doctor at all proves
the engine loaded, so this row is always a pass and exists to say so. Superdev
has exactly one engine and no fallback, and nothing degrades quietly to a second
one, because there is no second one.

The failing case never reaches doctor. When the engine is missing no command runs
at all, and every one of them says so in the same sentence rather than failing
with a package resolver error. The usual cause
is worth knowing: a Claude Code marketplace install **copies** the plugin into
the harness's own cache, and `node_modules` is git-ignored, so the copy arrives
with no engine. The fix is `npm install` in that copied directory, not in the
original checkout. Nothing installs it automatically.

**Database.** File presence, schema version, applied migrations, drift in the
recorded migration history, integrity and foreign-key check. `SD db status` is
the same ground on its own. Repairs:

- Schema behind the plugin: `SD db migrate --apply` (it backs up first).
- Corrupt or unopenable: `SD db restore <file> --apply` from a rolling backup
  under `.superdev/`, or `SD import <file> --apply` from a portable export.
- Before any risky maintenance: `SD db backup --apply`.

`db migrate`, `db restore` and `import` all refuse while the control center
holds the database. Each refusal names the command that frees it.

**Documentation and alignment.** Whether generated Markdown still matches the
database, whether any record maps to nothing that declares it, and whether the
generated files were built from an older revision than the database now carries.

**Local service.** `SD services` lists what is running and on which port. `SD
start`, `SD stop` and `SD restart` manage the one for this project. A running
service never locks out the command line: readers open read only, writers hold
the lock for milliseconds.

## What the capability inspector checks

**Harness lifecycle coverage.** What can actually fire here, measured rather
than assumed:

- Claude Code: session hooks are active.
- Codex: hooks require explicit trust, and its tool hooks cover shell commands
  only, so edit-triggered staleness marking never fires there.
- skills.sh: no hook mechanism at all, so the orchestrator must run `SD resume`
  and the before-implementation sequence explicitly.

Report this honestly rather than implying automation that will not happen, and
name the explicit command that covers the gap.

**Providers.** Superpowers, Claude Mem, Frontend Design, Impeccable, Find Skills
and skills.sh, Task Observer, and envx. For each: whether it is installed and
whether it is invocable *here*, with its resolved version or `unknown`. Those are
different states and are reported separately. An unproven state is reported as
unproven, never as ready.

`inspect`, `setup` and `plan` all write nothing and install nothing: `setup`
summarises readiness and `plan` produces a plan and a `planId` without executing
it. Only `apply` and `lock` change anything, `apply` by running an approved
plan's commands and `lock` by writing a capabilities file. Reach for `inspect`
unless the user has asked to install something.

## Installing a provider

Never implicitly, and never as a side effect of a check.

`doctor.mjs plan` computes a `planId` over the exact commands it intends to run.
`doctor.mjs apply` refuses unless both `--plan-id` and `--consent` are given and
the recomputed id still matches. Commands run as argument arrays rather than
through a shell, and a command carrying shell metacharacters or a blanket flag
such as `--all`, `-y` or `--yes` is rejected outright.

**Environment safety.** envx is detected the same way every other provider is,
by whether its CLI is present and invocable. Neither program opens an envx stage
file or reads its configuration, so do not report on the contents of either.
Never decrypt anything, never print a value, and never list a secret name that
the project has not already committed to a file the user can read.

## Interpreting the result

- A missing provider is a truthful degradation, not a substitution. Say which
  specialist pass will not run and what Superdev will do instead.
- A recorded readiness lock that disagrees with live state loses: live state
  wins and the disagreement is reported.
- Do not report a capability as working because it worked in a previous session
  on another machine.

## Boundaries

- Read only by default. No installs, no updates, no enabling a disabled plugin
  on the user's behalf, no writing project files, no network calls to unrelated
  services.
- Never tell anyone to run tests for the Superdev plugin. It has none, by
  design. Deterministic validators check artifacts; they are not a test suite
  and they do not prove product behavior.
- Products built with Superdev do get tests, derived from their accepted product
  test plan. That is the product's tooling, not the plugin's.

*Standalone note: on skills.sh, install the generated `superdev` package and run
`npm install` inside it. It carries the orchestrator, the Docs capability and the
runtime, and needs no repository. A single skill copied out on its own has no
runtime; say which command was unavailable rather than working around it
silently.*
