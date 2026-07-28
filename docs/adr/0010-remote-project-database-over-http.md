# ADR-0010: Reach a remote project database over its HTTP API, not a client package

- **Status:** Accepted
- **Date:** 2026-07-26
- **Owner/approver:** Project owner (accepted scope), implemented by Superdev
- **Supersedes:** nothing
- **Relates to:** ADR-0001 (zero runtime dependencies), ADR-0007 (project graph and SQLite projection)

## Context

Accepted scope requires the dashboard to read the canonical project database in
two modes: a local SQLite or libSQL file, and a configured remote libSQL or
Turso compatible database.

The obvious implementation is the official client package. It cannot be used
here. ADR-0001 is accepted and mandates zero runtime dependencies, for a
concrete distribution reason rather than a stylistic one: plugin caches copy
files and do not run package installs, so a `node_modules` requirement would
make the plugin fail to start on a surface that cannot fetch from the network.
The rule is enforced, not merely documented. `scripts/package/validate-all.mjs`
fails with `DEP-001` when `package.json` declares any dependency, and the same
validation rejects a shipped script importing anything outside `node:` builtins
and repo relative files.

So the requirement and the accepted constraint appear to conflict.

They do not. libSQL and Turso expose an HTTP API. A remote database is
reachable with `fetch`, which is a Node builtin from Node 18 and is already
available under the `engines.node >= 20` floor this project declares.

## Decision

Remote project databases are reached over the libSQL HTTP API using built in
`fetch`. No client package is added, and `package.json` keeps zero
dependencies.

Local databases keep using `node:sqlite`, which is already how the projection
is read and written.

Both sit behind one read service, so a caller never has to know which is in
use, and the UI never learns the difference.

## Alternatives considered

1. **HTTP API over `fetch`**: chosen. Zero dependencies, no install step, works
   on every surface that can already run the plugin.
2. **Add `@libsql/client`**: rejected. Violates an accepted ADR, fails
   `DEP-001`, and breaks distribution on plugin caches that cannot install.
3. **Shell out to the Turso CLI**: rejected. Assumes a second tool is installed,
   is not Windows safe, and turns a read into process spawning.
4. **Drop remote support**: rejected. It is accepted scope.

## Consequences

- Remote reads cost a network round trip and must degrade honestly when the
  network or the token is unavailable, rather than silently serving stale data.
- The read service reports its active source and last synchronized time, so a
  reader can tell local from remote from unavailable.
- Only the read path is in scope. Superdev writes canonical records to files;
  the database stays a disposable projection, per ADR-0007.

## Revisit triggers

The libSQL HTTP API stops being a supported surface; or ADR-0001 is revisited
and runtime dependencies become acceptable on every target surface.
