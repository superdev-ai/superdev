# Confidentiality and Leak-Prevention Policy

Superdev is developed with a strict private/public boundary: private development evidence informs the design, but no private identifier, path, or recognizable material may appear in this repository, its git history, tests, fixtures, generated artifacts, or release archives. This document describes the public mechanism; the actual denylist lives outside the repository by design.

## The leak scanner

`scripts/privacy/scan.mjs` scans file contents and relative paths for:

- entries from an **external denylist** supplied at execution time (`--denylist <path>`) - the denylist itself is never shipped, committed, or echoed into scanner output; findings reference rule ids (`DL-<n>`) and file/line locations only;
- absolute home-directory paths (`/Users/<name>/…`, `/home/<name>/…`);
- email addresses outside documentation-safe example domains;
- private-key markers and high-entropy secret-like strings;
- environment files staged for commit.

Behavior contract: reads only; writes nothing unless `--out <path>` is explicitly provided; machine-readable JSON on stdout with `--json`; exit `0` clean, `1` findings, `2` usage error. Any finding - P0 or P1 - is release-blocking: the scanner exits non-zero on either, and packaging, publication, and pushes stop until resolved.

One documented allowlist exception: `anthropic.com` addresses pass the email rule because agent-generated commits carry standard `Co-Authored-By` trailers that history scans would otherwise flag.

## Where the gates run

| Gate | When |
|---|---|
| Denylist + built-in scans over the working tree | before every commit |
| Scan over staged files (`--staged`) | before every commit |
| Archive listing + content scan | every package build |
| Full git-history scan | before any first public push |
| Cross-product re-identifiability review (below) | before release |

## Synthetic fixtures

Current tests generate their fixture material at runtime inside temporary directories. Any fixture added to the repository (e.g. under `tests/fixtures/`) must be independently authored and synthetic:

- generic domains only (e.g. `sample-saas`, `sample-mobile-app`, `legacy-docs-project`, `module-docs-project`, `example-api`);
- deliberately fictional feature combinations, counts, names, routes, schemas, and stacks;
- fictional far-future dates;
- a provenance note declaring the fixture independently authored.

Renaming something real is not anonymization: a fixture that preserves a real project's recognizable vertical, route shapes, counts, schema, or wording fails review even with every name changed.

## Cross-product re-identifiability review

Before release, review whether multiple individually-generic examples **combine** to identify any real system (same module mix + same workflow shape + same domain vocabulary). If they do, replace with broader composites. Reviewer output is recorded as release evidence.

## Contributor rules

- Never commit real project names, client names, internal domains, local paths, package scopes, or credentials - in code, fixtures, tests, comments, or commit messages.
- Never paste real error logs or screenshots without redaction.
- Treat any leak as an incident: stop, remove, rescan; if it entered git history, the history is rebuilt or sanitized before any publication.
