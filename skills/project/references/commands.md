# Command surface

One entry point. Users never have to type these; the skills invoke them and
report the outcome in ordinary language.

```
superdev <command> --root <project> [options]
```

Always use that absolute plugin-root form. A bare relative path would resolve
against whatever the current working directory happens to be.

Conventions:

- `--root <project>` names the project root. Every command accepts it.
- `--json` gives machine-readable output for anything you need to parse.
- `--apply` performs the change. Without it, every mutating command prints its
  plan and changes nothing.
- Exit `0` ok, `1` refused or findings present, `2` usage error.
- Mutations are one database transaction and each writes an activity event.
- **There is no per-command help.** `--help` is read before the command is
  resolved, so `task list --help` prints the same global text as `--help`. This
  file is the flag reference. If it disagrees with `src/cli.mjs`, the code wins
  and this file is the bug.
- `--actor <name>` records who is responsible for the change and lands in the
  permanent activity trail. It defaults to `superdev`.
- `--out <path>` writes this command's output to a file. It is global, not
  specific to `export`, where it names the export file itself.
- An unrecognised flag is not refused by name. Every flag outside a small
  boolean set is parsed as taking a value, so `--bogus` alone exits 2 asking for
  one, and `--bogus TASK-0001` swallows the id and the command then complains it
  was given none. If a command reports a missing argument you are sure you
  passed, suspect the flag before the argument.

## Project lifecycle

| Command | Purpose |
|---|---|
| `init [--idea <text>] [--brief <path>] [--name <text>] [--notes <text>]` | Detect new versus existing, run discovery, store accepted content, generate Markdown, derive tasks |
| `adopt` | Bring Superdev into a repository that already has code or documentation, without restructuring what is there |
| `plan [<FEAT-id>]` | The shape of the work: goals, milestones, modules, features, and what deriving would create. The optional feature narrows only the derivation preview, not the listing |
| `status` | Project state: active work, progress with its counts, blockers, freshness, next action |
| `readiness` | The production-readiness checklist, gap by gap |
| `resume [--objective <text>]` | Reconstruct working context from the database after a break, a new session, or compaction |
| `resume --end [--session <SES-id>] [--note <text>]` | Close the session and write its outcome. Without `--session` it ends the active one. `--note` applies only here |
| `doctor` | Storage engine, database, migration history, integrity, documentation, alignment and freshness |

`doctor` reports the storage engine, the project database and its
documentation. It does **not** report provider readiness or harness coverage.
Those come from a separate program:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor/doctor.mjs" inspect --root <project>
```

The `doctor` skill covers both and says which answers which.

## Service and control center

| Command | Purpose |
|---|---|
| `ui` | Open the local control center (starts the service if it is not running) |
| `start` / `stop` / `restart` | Manage the one local service for this project |
| `services` | List running Superdev services and their ports |

The service is local only, reads through its own HTTP API, and never reads
project files. The interface can show nothing the database does not say.

## Database

| Command | Purpose |
|---|---|
| `db status` | Schema version, pending migrations, integrity, drift and row counts |
| `db migrate` | Apply ordered migrations (a backup is taken first) |
| `db backup [--label <text>]` | Rolling local backup under `.superdev/` |
| `db restore <file>` | Replace the database with a named backup |
| `export [--out <path>]` | Portable JSONL snapshot under `.superdev/` |
| `import <file>` | Load records from a verified export, inserting only what is absent |

`db migrate`, `db restore` and `import` all refuse while the control center is
running. The refusal names the command that frees the database.

`.superdev/` is git-ignored in full. Writing an export into the repository
happens only when the user explicitly asks for it.

## Tasks

| Command | Purpose |
|---|---|
| `task list [--status <s>] [--feature <FEAT-id>] [--limit <n>] [--all]` | Find work. Oldest first |
| `task show <TASK-id>` | Full task: contract links, dependencies, subtasks, activity, evidence |
| `task create --feature <FEAT-id> --name <text> ...` | New task. See the full flag set below |
| `task update <TASK-id> [fields]` | Change scope or content. Cannot change status |
| `task claim <TASK-id> [--developer <DEV-id>] [--agent <AGT-id>] [--branch <BR-id>] [--session <SES-id>]` | Assign to this developer, agent, branch and session |
| `task start <TASK-id> [--note <text>] [--session <SES-id>]` | Move to In Progress |
| `task release <TASK-id> [--reason <why>]` | Give up the assignment without closing the task |
| `task block <TASK-id> --reason <why>` | Record a blocker immediately |
| `task unblock <TASK-id> [--to <status>] [--note <text>]` | Put a blocked task back where it was |
| `verify [--task <TASK-id>] [--limit <n>]` | Re-run the checks recorded evidence stands on |
| `task evidence <TASK-id> --summary <what was observed> [--result <pass\|fail\|inconclusive>] [--type <kind>] [--reference <path>] [--criterion <AC-id>] [--command <re-runnable check>]` | Record what verifying it actually showed |
| `task complete <TASK-id> [--note <text>]` | Close it, once its verification requirements have passing evidence |
| `task cancel <TASK-id> --reason <why>` | Stop work that should not continue |
| `task reopen <TASK-id> --reason <why> [--to <status>]` | Reopen with history preserved; never rewrite a completed task |
| `derive [<FEAT-id>]` | Derive the task plan from accepted specifications. The feature is positional, not a flag |

`task create` requires `--feature` and `--name`. Everything else is optional:
`--description`, `--outcome`, `--why`, `--criterion`, `--verify`, `--boundary`,
`--priority`, `--risk`, `--category`, `--estimate`, `--due`, `--parent`,
`--dependsOn`, `--link`, `--status`, and for enabling work `--enabling` with
`--enabledFeature` and `--rationale`. `--criterion`, `--verify`, `--boundary`,
`--dependsOn` and `--link` may be repeated.

`task update` accepts `--name`, `--description`, `--outcome`, `--why`,
`--priority`, `--risk`, `--estimate`, `--due`, `--parent`, `--rationale`,
`--enabledFeature`, `--criterion`, `--verify` and `--boundary`. It **refuses
`--status`**: status moves through `task claim`, `task start`, `task block`,
`task unblock`, `task complete` and `task reopen`, so every change leaves
history.

`task claim` flags take identifiers, not names. Passing a person's name gets a
refusal naming what does not exist. Leaving them off lets Superdev resolve the
identity itself, which is the normal case.

`task complete` records no evidence of its own. Evidence is a
`verification_evidence` record written by `task evidence`, and completion
refuses until every verification requirement the task states carries its own
passing one. So `task evidence` runs once per requirement, and a requirement
that could not be run takes `--result inconclusive`: that records the attempt
honestly and leaves the task open rather than closing it on silence.

Passing evidence against an acceptance criterion is the only thing that ever
marks that criterion met, and failing evidence takes it back to unmet.

Pass `--command` whenever a command proved it. `superdev verify` re-runs every
recorded command and marks the evidence stale when a check that used to pass
stops passing, so a task completed months ago can notice the ground moved.
Evidence with no command is not a failure: reading a screenshot or confirming a
decision with the owner are real checks that no command reproduces, and
inventing one to look rigorous is worse than saying the check is manual. A
command that cannot run is reported separately from one that ran and failed,
because a broken check says nothing about whether the product is correct.

Statuses, as printed: Draft, Ready, In Progress, In Review, Verifying, Blocked,
Paused, Complete, Cancelled, Superseded. Status history is append-only.

Those are display labels. Every flag that takes a status wants the stored value,
which is lower case with underscores: `in_progress`, not `In Progress`. Nothing
normalises them and nothing refuses an unknown one, so a filter written in the
printed form is not an error, it just quietly matches nothing.

Refusal codes worth recognizing:

- `E_TASK_WITHOUT_CONTRACT` - the task has no workflow step, UI action, API
  operation, data entity, migration, integration, job, webhook, NFR, document or
  decision behind it, and is not marked enabling.
- `E_ENABLING_WITHOUT_TARGET` - enabling work that names no feature it unblocks.
- `E_OPEN_SUBTASKS` - a parent cannot complete while required child work is open.
- `E_VERSION_CONFLICT` - the record changed under you. Re-read and retry.
- `E_DB_LOCKED` - another process holds the write lock. Retry; do not remove a
  lock by hand.

## Specifications

| Command | Purpose |
|---|---|
| `feature depth [<FEAT-id>]` | Whether each feature carries what its declared depth promises |
| `feature accept <FEAT-id>` | Accept a feature. Refused while its declared depth is unmet, naming everything missing at once |

## Documentation

| Command | Purpose |
|---|---|
| `docs generate [--only <path>] [--reports]` | Render accepted database content to Markdown under `talks/`. `--reports` adds the summary, status and drift reports |
| `docs diff [<path>]` | Show manual edits to generated Markdown as pending proposals |
| `docs accept <path>` | Apply a reviewed proposal to the database, then regenerate |
| `docs reject <path>` | Discard the manual edit and write the generated version back |

Every generated file opens with a marker carrying its source record, database
revision, and body hash. An authored projection whose on-disk hash differs
raises a proposal and is never silently overwritten. Derived views (changelog,
status and drift reports) are always rewritten and carry a do-not-hand-edit
banner.

## Knowledge

| Command | Purpose |
|---|---|
| `memory search <text> [--kind <k>] [--task <TASK-id>] [--feature <FEAT-id>] [--limit <n>]` | Session outcomes, facts, blockers, handoffs, with their links. The text is positional, or `--text` |
| `question answer <Q-id> <text>` | Answer a durable owner question. The answer is positional, or `--answer` |
| `decision record --title <t> --decision <what was decided> [--context <t>] [--rationale <t>] [--verification <t>] [--governs <type>:<id>] [--status <proposed\|accepted>]` | Record a decision |
| `decision supersede <DEC-id> --title <t> --decision <t> [--partial --scopeDelta <what stops applying>]` | Replace a decision that no longer holds |
| `decision list [--all]` | Decisions with status, scope and supersession chain |

## Task categories

| Command | Purpose |
|---|---|
| `category list` | Categories, what they mean, and how many tasks use each |
| `category add <name> [--description <text>]` | Add a category of your own |
| `category rename <CAT-id> <name> [--description <text>]` | Rename one |
| `category describe <CAT-id> <text>` | Say what a category means in this project |
| `category retire <CAT-id>` | Take it off the pickable list, keeping history |
| `category restore <CAT-id>` | Put a retired one back |

Memory is recall, not authority. Verify a recalled fact against the current
specification, decision, code or evidence before acting on it.

## What has no command, deliberately

Nothing marks a feature, milestone or goal complete directly. Parent status and
progress are derived from accepted contract components and completed child work.
If a parent will not close, the answer is the open child work that `status`
names, not a manual override.
