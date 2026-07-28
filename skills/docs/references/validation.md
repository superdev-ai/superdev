# Documentation Validation

Three layers: structural (script), link (script), and implementation parity (evidence walk). Findings use stable codes with P0/P1/P2/info severity; any P0 blocks the operation that surfaced it.

## Contents
1. Script-backed validation
2. Severity model
3. Implementation-parity categories
4. Anti-pattern checks
5. Override flow
6. Baselines

## 1. Script-backed validation

`node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/validate-docs.mjs" --root <project> [--profile <id>] [--baseline <file>] [--json] [--out <file>]`

- Profile-aware: required artifacts, module discovery, and exclusions come from the active profile/adapter - a flat-profile project is never judged against the module profile's requirements. Adapter `required` entries are literal paths.
- Template and archive exclusions honored (`_templates/`, adapter `excluded` globs).
- Prohibitions vs usage: prose declaring a prohibition is never flagged; the validator flags **actual usage** in executable surfaces (package scripts, Makefiles, CI files) that violates it. Machine-checkable scope: prohibitions written as "never use/run `command`" with the command backticked; unbackticked prose prohibitions are guidance for review, not scanner input.
- Historical/superseded content (status marker in the first ~30 lines, or adapter markers) is exempt from active-contract checks.
- Workspace-aware: prohibited-usage checks traverse workspace member manifests (package scripts), not only the root.
- Read-only by default; JSON to stdout with `--json`; file output only via explicit `--out`.

## 2. Severity model

- **P0** - broken authority: missing required artifact, broken canonical link, prohibited usage present, duplicate source of truth. Blocks "done".
- **P1** - integrity risk: parity mismatch, matrix/enforcement disagreement, tests claimed but absent, orphan modules, undeclared N/A. Blocks "implemented" claims for the affected scope.
- **P2** - quality: stale freshness markers, missing optional sections, style inconsistencies.
- **info** - observations, no action required.

## 3. Implementation-parity categories (before any "implemented" claim)

Walk the spec against the code, category by category; each is confirmed, failed (with evidence), or deliberately N/A:

A pages/surfaces exist as specified · B components/composition match · C every inventoried action exists and behaves per contract · D API operations match contracts (routes, shapes, errors) · E schema matches data docs · F state machines enforced (incl. illegal transitions rejected) · G async jobs/webhooks exist with stated retry/idempotency · H edge-case behaviors implemented for applicable categories · I UI states present (loading/empty/error/disabled/success) · J telemetry as approved (no unapproved additions) · K permissions enforce the matrices at the named points · L i18n as scoped · M compliance handling as declared · N tests exist and pass for the plan's cases · O diagrams match reality (stale diagram = drift).

## 4. Anti-pattern checks (generalized)

Instruction-file drift (agent instructions contradicting code) · permission rules duplicated outside the source of truth · expired sunset markers ("remove after <date>" past due) · tests claimed in docs but absent · state machines documented but unenforced · docs asserting vendor/stack facts with no evidence.

## 5. Override flow

A parity failure may be consciously overridden only by: logging the override with owner and reason · writing the gap to a visible known-gaps record · keeping the module/feature status **below** "implemented". The gap stays recorded and the status stays below "implemented" until closed - a process obligation on every Docs operation that touches the module (parity categories are an evidence walk, not a script rule). Refuse to mark work implemented over an unlogged failure.

## 6. Baselines

`--baseline <file>` suppresses **known, accepted** findings by fingerprint (`RULE:path:detail`, or `RULE:path` to suppress a whole rule in one file) so legacy projects can adopt validation incrementally. The baseline is a JSON array of fingerprint strings; keep the reason for each entry in the commit or record that introduces it. New findings always surface. A baseline is never a way to hide P0s from a release gate.
