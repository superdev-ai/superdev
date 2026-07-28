# Initialize or Adopt Documentation

Two distinct operations. Initializing creates the default record for a project without documentation; adopting wraps existing documentation without touching it. Never run initialize against a project that already has docs - that is adoption.

## Initialize (no existing documentation)

1. Confirm the project truly has no canonical docs (README alone is not a documentation system).
2. Confirm the plan with the user before creating anything: profile `talks-v1`, the directories that will exist, and what stays deferred until first use.
3. Create the minimal skeleton only: `talks/project.yaml`, `talks/README.md`, `talks/state/schema-version.json`. Foundations, modules, decisions, and indexes are created by the operations that first need them.
4. Re-running must be a no-op; report anything that already existed instead of overwriting it.

## Adopt (existing documentation present)

1. **Detect:** run `node "${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/profile-detect.mjs" --root <project> --json`. Present the detected profile with its evidence and confidence.
2. **Do not move, rewrite, or reformat anything.**
3. **Write the adapter** (`talks/project.yaml` per `profiles.md`): canonical root, profile, required artifacts, ownership location, exclusions, historical markers, `migrationStatus: none`.
4. **Create only the control layer** the project lacks: `talks/state/`, and `talks/decisions/` + `talks/changes/` only if the project has no equivalent (if it has its own decision log or changelog, the adapter points at those instead - no duplicates).
5. **Offer migration separately.** Migration to `talks-v1` is its own approved plan with a dry-run, never a side effect of adoption.
6. **Verify:** existing files untouched (diff empty outside `talks/`), adapter resolves (canonical root exists, required artifacts found or honestly listed as missing), re-run is a no-op.

## Refusals

- Refuse to initialize over existing docs, or to adopt by restructuring.
- Refuse to create a second editable copy of any specification.
- Refuse silent migration: any content move between profiles requires the separately approved migration plan.
