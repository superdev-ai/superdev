# Deterministic validators

**The rule that separates a validator from a test.** A validator inspects an
artifact that exists in the repository, or one it constructs deterministically
in a temp directory within the same run and deletes afterwards. It has no
committed fixtures, no test framework, no phase labels, and no simulated
product. It must FAIL rather than skip when its input is absent.

That last sentence is the whole point. A gate that turns itself off when the
thing it guards goes missing is worse than no gate, because it reports success
while checking nothing.

This repository ships no automated test suite for the plugin itself. Quality is
proven here, against real artifacts, and by building a real product with the
tool. Products built with Superdev do get tests; Superdev does not test a
simulated copy of itself. `no-tests.mjs` is the guard that stops the suite
growing back.

## Running

```sh
npm run validate                       # the repository in the working directory
node scripts/validate/validate-all.mjs --root <path>
node scripts/validate/validate-all.mjs --only migrations,imports
node scripts/validate/validate-all.mjs --json --out report.json
```

Exit codes: `0` no findings, `1` findings, `2` usage error.

`--out` writes exactly the machine-readable report, atomically, and nothing is
written without it.

## Interface

Every validator is a standalone module exporting `run(root)`:

```js
{ name: "migrations", findings: [{ code, severity, path, message }] }
```

- `code` is stable and greppable (`MG-007`), so a finding can be referred to.
- `severity` is `error` or `warning`. Both are findings and both exit non-zero;
  the distinction says how urgent it is, not whether it counts.
- `path` is repo-relative with forward slashes, optionally `:line` or
  `:line:column`. An absolute machine path never appears in output.
- `message` says what is wrong and, where it is not obvious, what to do.

A validator that throws is reported as a `VA-001` finding against itself. A
broken validator never reads as a passing run.

## The validators

| Module | Checks | Fails when its input is absent |
|---|---|---|
| `manifests.mjs` | Claude, Codex and marketplace manifests plus `hooks.json`: valid JSON, required fields, kebab name, no absolute or escaping paths | a manifest is missing |
| `skills.mjs` | `skills/*/SKILL.md`: frontmatter parses, name matches directory, description present and under 1024 characters, body under 500 lines, no working-directory-dependent commands, every named file resolves | `skills/` is missing or empty |
| `docs-templates.mjs` | Docs templates and fragments stay neutral: no vendor, latency, cloud region, compliance regime or concrete environment variable | the templates or fragments directory is missing |
| `migrations.mjs` | Builds a throwaway database in a temp directory, applies the full ordered set forward, runs integrity and foreign key checks, asserts the applied list equals the checked-in files, proves the task mapping constraint and the append-only triggers fire and that a mapped task still passes, then deletes it | no migration files are found |
| `markdown.mjs` | Generated Markdown under `talks/` carries a generation marker, its body still hashes to the recorded hash, and every relative link resolves | `talks/` is missing or holds no Markdown |
| `style.mjs` | No em dash character and no emoji in project-owned content | there are no project-owned text files |
| `privacy.mjs` | No absolute home paths, no secret-shaped strings, no private project identifiers | there are no project-owned text files |
| `imports.mjs` | Every module under `src/` and `scripts/` imports only node builtins, relative paths, or the one allowlisted runtime dependency, which only `src/db/connect.mjs` may import | neither directory exists |
| `dependencies.mjs` | `package.json` declares only allowlisted runtime dependencies, pins them exactly, declares the Node floor, and carries no dev toolchain | `package.json` is missing |
| `no-tests.mjs` | No `*.test.mjs`, no test or fixture tree, no test runner script or framework dependency | never; a missing root is itself the finding |
| `footprint.mjs` | No file-per-record operational tracking: no file named after a task, subtask, assignment, transition, evidence item, activity event, session, agent, branch, memory entry, sync cursor or conflict, and no directory named after one that has filled with data documents | never; an empty root is itself the finding |

## Private identifiers

The denylist of private project identifiers lives outside this repository by
design and is supplied at run time:

```sh
SUPERDEV_DENYLIST=<path outside the repo> npm run validate
```

Entries are never echoed into output. Findings carry a rule id and a location
only, because printing the matched value would be the leak the scan exists to
prevent. When the variable points at a file that does not exist, `privacy.mjs`
reports it rather than passing: a check that silently did not run must not read
as a check that passed.

The screening rules themselves come from `src/model/screening.mjs`, the same
module the storage boundary uses, so a string the database would refuse cannot
arrive through a file instead.

## Adding one

Write `scripts/validate/<name>.mjs` exporting `name` and `run(root)`, then add
it to `VALIDATORS` in `validate-all.mjs`. Declaration order is report order.

Before adding it, check it against the rule at the top of this file. If it needs
a fixture, it is a test. If it simulates product behavior, it is a test. If it
passes quietly when the artifact it inspects is not there, it is worse than a
test.
