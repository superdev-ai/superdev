# Contributing to Superdev

Read this before writing anything. This repository rejects work in ways you
cannot guess from looking at it, and the rules that explain the rejection live
in four different files. This page collects them.

Issues and pull requests are welcome at
https://github.com/superdev-ai/superdev. Open an issue before a large change, so
you do not spend an evening on something that will be refused by a rule you had
no way to know about.

## What will reject your change

Each of these is enforced by a program, not by a reviewer.

- **No em dash and no emoji.** Anywhere in project-owned text, including code
  comments. `scripts/validate/style.mjs` fails the run. It shares its emoji rule
  with `src/model/screening.mjs`, the storage boundary, so a file and a database
  record are judged by the same test. Use a comma, colon, semicolon, parentheses
  or a plain hyphen.
- **Tests only on pure functions, and only in one shape.**
  `scripts/validate/no-tests.mjs` permits a `<source>.test.mjs` beside the source
  it tests, under `src/` or `scripts/`, run by `node --test`. It fails on any
  `tests/`, `test/`, `__tests__/`, `spec/` or `fixtures/` tree, on any other test
  file shape, on a third-party framework in a script or a dependency, and on a
  test naming a source that does not exist. See
  `docs/adr/0021-unit-tests-on-pure-functions.md` for why the line is there, and
  `docs/adr/0019-validators-are-not-tests.md` for what it is protecting.

  Completion is never claimed from a passing count. A task completes on recorded
  evidence about the real product, and a green suite is not that.
- **No new imports.** Every `.mjs` and `.js` module under `src/` and `scripts/`
  may import only `node:` builtins, relative paths, and
  `@tursodatabase/database`. Only `src/db/connect.mjs` may import that one, so
  replacing the engine stays a one-file change.
  `scripts/validate/imports.mjs` enforces it.
- **No new dependencies.** `scripts/validate/dependencies.mjs` is a named
  allowlist. It fails on anything else, on an unpinned version, and on an
  `engines.node` value naming a major other than 20. These rules read the root
  `package.json` only; they do not reach into `ui/`.
- **No raw SQL for mutations.** Records are written through `create`, `patch`
  and `setStatus` in `src/db/store.mjs`, so screening, status history and the
  activity event cannot be skipped. Every mutation is one transaction that
  writes an activity event.
- **No private identifiers.** `scripts/privacy/scan.mjs` blocks on any finding.
  Absolute home paths, personal email addresses, secret-shaped strings and
  private project names do not enter the tree. Its binary policy is fail-closed:
  an unclassified binary file is a P0 finding unless it is listed in
  `.superdev-scan-binary-allow`.

The wider constraints, including what each module is allowed to know about the
others, are in `docs/module-contract.md`. Read it before adding a module.

## The validator rule

Superdev has validators, not tests. A validator's subject is a file already in
the repository, or one it builds deterministically in a temp directory and
deletes in the same run. It uses no committed fixture and no sample project, no
test framework and no test runner. It fails rather than skips when its input is
absent. It asserts a declared property of an artifact, never the behaviour of a
simulated product.

`scripts/validate/README.md` documents the finding interface, the full table of
validators, the `SUPERDEV_DENYLIST` contract, and how to add one.

Two validators are worth knowing about specifically:

- `migrations` is the only one that builds its subject. It creates a throwaway
  database, applies the ordered migration set forward, runs `integrity_check`
  and `foreign_key_check`, checks the recorded migrations against the
  checked-in files by version, name and checksum, then provokes the guard
  triggers and confirms they refuse. It also proves each constraint permits the
  mapped case, so "always refuses" cannot read as "correctly refuses".
- `markdown` inspects nothing when the repository has no initialized project. It
  reports clean because there is nothing to read, not because generated Markdown
  was verified. Do not treat its clean row as evidence.

## Before you commit

Run these from the repository root. All of them pass on a clean clone.

`validate` fails the run on an error and reports a warning without failing it. On
a fresh clone three validators warn that they had nothing to check, because the
project database is git-ignored by design and they read it. That is the expected
state of a clone, not a problem with it.

```bash
npm install
npm test             # unit tests on pure functions, node --test, no framework
npm run validate     # fifteen validators, in a fixed order, clean today
npm run scan         # privacy and leak scan of the working tree
                     # (the staged scan is a separate `scan.mjs --staged` run)
npm run ui:check     # committed control center matches ui/ source
```

Or all of the gate at once, which is what a release runs:

```bash
npm run check        # tests, validators, doctor, the release conditions
```

Set `SUPERDEV_DENYLIST` when running `validate` if you have a denylist file.
The privacy validator reads that variable and is fail-closed: pointing it at a
file that does not exist produces a finding rather than a quiet pass. Note that
`npm run scan` does **not** read `SUPERDEV_DENYLIST`, because `scan.mjs` accepts
a denylist only as a command line flag and the npm script does not pass one.

### Verifying a behaviour change

The validators check properties of files, and the unit tests check pure
functions. Neither runs the CLI end to end, so a change to runtime behaviour is
still verified by running it, and nothing will catch you if you skip that. Drive it against a throwaway project outside this
repository:

```bash
mkdir ../superdev-trial && cd ../superdev-trial
SD="node /path/to/superdev/src/cli.mjs"
$SD init --idea "anything" --apply
$SD doctor
$SD status
```

Not inside the checkout. `init` there finds the existing documentation tree,
reports `Route adopt` and proceeds rather than refusing, so the mistake is
quiet. Delete the directory afterwards.

Harness and provider readiness is a different program again:
`node scripts/doctor/doctor.mjs inspect` reports on your machine, while
`$SD doctor` reports on a project.

### If you touched `ui/`

`ui/` is a separate npm package, `superdev-control-center`, with its own
dependencies and lockfile. Its `node_modules` and `dist` are git-ignored.

```bash
cd ui
npm install
npm run typecheck    # tsc --noEmit -p tsconfig.app.json
npm run lint         # oxlint src
npm run build        # tsc --noEmit && vite build
cd ..
npm run ui:build     # regenerates the committed bundle and its manifest
npm run ui:check
```

`npm run ui:build` compiles `ui/`, then inlines exactly one CSS chunk and one JS
chunk into `src/service/assets/control-center.html` and writes
`control-center.manifest.json`. If there is more than one chunk of either kind
it stops and names the cause, `build.modulePreload` in `ui/vite.config.ts`,
rather than shipping half an application.

`npm run ui:check` does not rebuild, despite what ADR-0020 and the script's own
header comment say. It recomputes a fingerprint over every file under `ui/` and
compares it, plus the bundle's own hash, against the committed manifest. That is
enough to detect drift and it detects it immediately.

**Commit the regenerated bundle.** `npm run validate` has no ui validator, so a
change under `ui/` will pass `validate` while shipping a stale interface.

### The history scan

`npm run scan:history` runs the same privacy rules across every object in git
history, and it passes on this repository.

It did not pass on the history this project was developed in. A brand asset
carried a third party's email address in its PNG metadata, and history cannot be
cleaned without rewriting it, so the public repository starts from a fresh
initial commit rather than from a rewritten copy of a history that had already
been distributed. The development history is not public.

That is worth knowing if you add a binary: a file committed once is in history
forever, and `.gitignore` excludes `*.png` for exactly this reason. Documentation
images under `docs/images/` are the deliberate exception, and each was checked
for metadata before being added.

## Style

- Plain language, short sentences. No marketing adjectives.
- Never "simply", "just", "easy", "powerful", "seamless", "robust".
- Sentence case in prose. Title Case only for proper nouns.
- State what a thing does, why it exists, and what it deliberately does not do.
  Honesty about limits is the house style, not a caveat appended to it.
- Never claim a capability without having read the code or run the command. In
  this project an unverifiable claim in the documentation is a defect, not a
  rough edge.

## Commit messages

Conventional commits, lower case, always with a scope, and a subject that says
what changed rather than what you did. No validator enforces this, so it is on
you. The history is the reference:

```text
feat(providers): prove the provider route end to end
chore(package): remove generated distribution output
docs(rebuild): define the Superdev vNext reset
```

## Recording a decision

Architectural changes get an ADR in `docs/adr/`. Twenty exist. When one
supersedes another, the superseded body is left exactly as written and a banner
naming the replacement is added at the top. Rewriting the old reasoning to match
the new decision destroys the only record of why the old one looked right.
