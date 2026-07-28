# Security

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository:
**Security > Report a vulnerability**, at
https://github.com/superdev-ai/superdev/security/advisories/new

That channel is private between you and the maintainer, which is what makes a
report safe before a fix exists. **Please do not open a public issue for a
security problem**, and do not describe one in a pull request, a discussion or a
fork, because there is no coordinated disclosure process running alongside it to
contain a public report.

If private reporting is unavailable to you for any reason, open a public issue
saying only that you have a security report and asking for a private channel.
Say nothing about the problem itself in it.

**What to expect, stated honestly.** This is maintained by one person and nobody
is on rota, so no response time is promised. What is promised is that a report is
read, that you are told what was concluded, and that you are credited in the fix
unless you ask not to be.

**Supported versions.** The latest released version only. There is no long-term
support branch and no backporting: a fix ships as a new release of
`superdev-cli` and a new plugin tag, which share one version number.

| Version | Supported |
|---|---|
| Latest release | Yes |
| Anything older | No, update first |

## What Superdev is not

Superdev is a development orchestrator, not a security sandbox, and does not try
to be one. It runs inside an agent harness that already has file system access
and the ability to run commands. Destructive, outward-facing and irreversible
actions are governed by that harness's permission model, plus explicit
confirmation in the skills. If your harness is configured to approve everything,
Superdev does not add a second line of defence.

Treat the project database and the generated documentation as trusted only as
far as you trust whoever wrote to them.

## The local service

The control center is served by one local process, started by the CLI and never
run separately.

- It binds to `127.0.0.1` on port 4317 by default.
- A request that reaches the service under a name that is not loopback is
  refused with `E_FOREIGN_HOST`. That check runs ahead of every route, reads and
  the event stream included, and it is what defeats DNS rebinding, where an
  attacker-controlled name resolves to `127.0.0.1`.
- Any `/api/` request that is not same-origin is refused with `E_CROSS_ORIGIN`.
  That covers reads, not only writes, which is what stops a page on another
  origin reading your project through the browser. Verified: a request to
  `/api/overview` carrying a foreign `Origin` header returns 403.
- `/health` returns an instance token so the process manager can confirm it is
  talking to its own service rather than to something else that took the port.
  The token is masked in text output and appears only in `--json`.

## The write surface

The browser cannot send SQL, a shell command or a file path. Every write goes
through one endpoint, `POST /api/mutations`, taking `{ action, payload }`
against an allowlist of 22 named actions. There is no generic query endpoint and
no path parameter that reaches the file system.

The HTTP surface is fixed and small: ten read routes in a table, two resolved in
the server, `/health`, `/api/events`, `/api/mutations`, and `GET` or `HEAD` on
`/` for the interface itself.

## History that cannot be quietly rewritten

Some tables are append-only, enforced by database triggers rather than by
convention: `activity_events`, `decision_transitions` and `status_history` each
raise `E_APPEND_ONLY` on update and on delete. Decision transitions are
hash-chained, each row storing a sha256 over the previous hash, the sequence,
the from and to status and the timestamp, so a rewritten transition breaks the
chain visibly.

This makes tampering detectable. It does not make it impossible: the database is
an ordinary SQLite file and anyone with write access to the disk can replace it.

## Installing providers

Superdev never installs anything implicitly. `scripts/doctor/doctor.mjs plan`
computes a sha256 `planId` over the exact commands it intends to run, and
`apply` refuses unless both `--plan-id` and `--consent` are supplied and the
recomputed id still matches. Commands are executed as argument arrays, never
through a shell. A command containing shell metacharacters is rejected, as is
one carrying a blanket flag such as `--all`, `-y` or `--yes`.

## Data leaving the machine

Superdev's own code makes no outbound network request. The only network module
imported anywhere under `src/` or `scripts/` is `node:http`, used for the
loopback server and the client that talks to it. There is no telemetry, no
analytics and no crash reporting. The committed control center bundle fetches
only `/api/` paths.

Two things do reach the network, and neither is Superdev sending your data:
`npm install` fetches the runtime dependency from the public npm registry once,
and a consented provider install runs that provider's own installer.

The agent harness Superdev runs inside is a separate program with its own
network behaviour. Superdev neither controls nor observes it.

## Content screening

Content is screened at the storage boundary, in `src/model/screening.mjs`, so
certain shapes never reach the database: secret-shaped strings, absolute home
paths, em dashes, emoji and model reasoning fields. Screening refuses with the
exact field rather than advising. This is a hygiene measure against accidental
capture, not a secret scanner you should rely on. Handling real secrets is
routed to the envx provider.

## Known limits

Stated because they are true, not because they are comfortable.

- The privacy scan over git history, `npm run scan:history`, passes on this
  history. It did not pass on the history this repository was developed in: a
  brand asset carried a third party's email address in its metadata, and a
  history cannot be cleaned without rewriting it. This repository was therefore
  published from a fresh initial commit rather than by rewriting a history whose
  earlier state had already been distributed. The development history is not
  public.
- On Codex, lifecycle hooks do not fire until each hook is explicitly trusted,
  and Codex tool hooks cover shell commands only, so edit-triggered staleness
  marking never fires there.
- `references/confidentiality.md` states that the denylist and staged scans run
  before every commit. Nothing enforces that: there is no committed hook
  installer. They are commands a maintainer runs.
