# Module contract

Every module in `src/` is built against this. It exists so independently built
parts fit together without a later reconciliation pass.

## Ground rules

1. Node 20+, ESM, `.mjs`. No TypeScript in `src/`. The UI is TypeScript.
2. Import only `node:*`, relative paths, and `@tursodatabase/database` (which
   only `src/db/connect.mjs` may import).
3. No emoji. Never the em dash character U+2014. Use a comma, colon, semicolon,
   parentheses or a hyphen. This binds code comments too.
4. No test files. No `*.test.mjs`. No fixtures. Deterministic validators live in
   `scripts/validate/` and check artifacts, never simulate product behavior.
5. Never store private model reasoning. Store observable outcomes and rationale.
6. Every mutation is one transaction and creates an activity event.
7. Absolute machine paths, secrets and private identifiers never reach a record
   or a generated file.

## Database access

```js
import { paths, query, mutate, create, patch, setStatus,
         recordActivity, recordStatusChange, currentProject,
         json, ancestors, descendants } from "../db/store.mjs";

paths(root)            // { dir, db, backups, runtime, exports } under .superdev/
await query(root, async db => { ... })   // read only, lock free
await mutate(root, async db => { ... })  // one transaction, then closed
```

`db` exposes `exec`, `all`, `get`, `run`, `value`, `versionedUpdate`.

**Never cache a connection.** A readonly connection is pinned to its open-time
snapshot and never sees later commits from another process, while every query
still succeeds. Open per read. It costs 0.3 ms.

**Never write raw SQL for mutations.** Use `create`, `patch`, `setStatus` so
screening, history and activity cannot be skipped.

## Engine limits to design around

- No `WITH RECURSIVE`. Walk hierarchies with `ancestors` and `descendants`.
- No vector index. Vector recall is a bounded scan using `vector32()` and
  `vector_distance_cos()`.
- No `PRAGMA data_version`. Change detection polls
  `SELECT max(sequence) FROM activity_events`.
- One writer process at a time. Never do subprocess or network work inside
  `mutate`; compute it before.

## Identifiers

`src/model/ids.mjs` owns them. `FEAT-0007`, `TASK-0012`, `DEC-0003`. Use
`nextId(db, kind)` and `slugify` / `uniqueSlug`. Never invent an id format.

## Vocabulary

`src/model/vocabulary.mjs` owns statuses, labels, task categories, the
capability-area catalog, the twenty module steps, edge-case categories and
activity event types. Use `titleCase(value)` for anything user facing.

## Local HTTP API

The service exposes exactly these. The control center reads nothing else and
never touches the filesystem.

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ ok, projectRoot, instanceToken, version }` |
| GET | `/api/overview` | project, headline counts, active work, next action, freshness |
| GET | `/api/discovery` | sources, discovery items and links, questions, assumptions, risks |
| GET | `/api/product` | goals, milestones, modules, features with progress |
| GET | `/api/features/:id` | one feature and every contract hanging off it |
| GET | `/api/workflows` | workflows, steps, branches, actors, state machines |
| GET | `/api/data` | entities, fields, relationships, migrations |
| GET | `/api/architecture` | runtime pieces and edges, module dependencies, integrations |
| GET | `/api/tasks` | tasks with feature, assignment, dependencies, subtasks, evidence |
| GET | `/api/team` | developers, agents, branches, sessions, presence |
| GET | `/api/decisions` | decisions, links, transitions, conflicts |
| GET | `/api/activity` | activity events and memory, paged |
| GET | `/api/readiness` | capability areas, module completeness, open questions |
| GET | `/api/events` | server-sent events, resumable by `Last-Event-ID` |
| POST | `/api/mutations` | one bounded mutation, see below |

`POST /api/mutations` takes `{ action, payload }` and accepts only the actions
`ALLOWED_ACTIONS` exports from `src/service/mutations.mjs`. Today that is:
`task.create`, `task.update`, `task.claim`, `task.release`, `task.transition`,
`task.block`, `task.complete`, `task.reopen`, `task.cancel`, `task.link`,
`task.addSubtask`, `question.answer`, `decision.transition`,
`discovery.upsert`, `discovery.convert`, `layout.save`,
`docs.acceptProposal`, `docs.rejectProposal`, `category.create`,
`category.update`, `category.retire`, `category.restore`.

The list in the code is the authority; this one is a reading aid and can fall
behind it. Anything not on it is refused. The browser may never submit SQL, a shell command or
a path.

Every read response carries:

```json
{ "data": ..., "meta": { "revision": 42, "lastEventSequence": 42,
  "generatedAt": "...", "stale": false } }
```

`revision` is `max(sequence)` from `activity_events`.

## Server-sent events

- One `hello` event on connect carrying the current sequence.
- A `change` event per new activity sequence, id equal to the sequence.
- `resync` when the client's `Last-Event-ID` is older than the replay buffer.
- Heartbeat comment every 15 s, timer unreferenced.
- The client resubscribes with `Last-Event-ID` and falls back to a full reload.

## Generated Markdown

Every generated file starts with:

```
<!-- superdev:generated source=FEAT-0007 revision=42 hash=<sha256-of-body> -->
```

The hash covers the body after the marker line, normalized to LF line endings,
trailing whitespace stripped, exactly one terminal newline. The renderer must be
deterministic: stable ordering, no timestamps in the body.

`documents.regeneration_mode` is `authored_projection` (foundations, modules,
features, workflows, surfaces, apis, data, integrations, jobs, roles, nfrs,
observability, compliance, test plans, decisions) or `derived_view` (changelog,
status, drift, project summary). A derived view is always rewritten and never
raises an edit proposal. An authored projection whose on-disk hash differs from
`generated_hash` raises a proposal and is never overwritten silently.

## What must never be generated

No Markdown file for a task, subtask, assignment, session, activity event,
evidence record, agent, branch, memory entry, sync cursor, conflict, or progress
snapshot. Those are database and interface concerns. One file per database row
is the failure this rebuild exists to remove.

## Errors

Throw `DbError` or a module error carrying a stable `code`. Codes already in
use: `E_DB_LOCKED`, `E_VERSION_CONFLICT`, `E_NOT_FOUND`, `E_TASK_WITHOUT_CONTRACT`,
`E_ENABLING_WITHOUT_TARGET`, `E_OPEN_SUBTASKS`, `E_APPEND_ONLY`,
`E_STYLE_EM_DASH`, `E_STYLE_EMOJI`, `E_SECRET_SHAPED`.

A user-facing message says what happened and what the person can do next.
