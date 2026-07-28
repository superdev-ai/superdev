# Documentation Profiles

A profile tells every Docs operation where truth lives, what is required, and how to validate - so no structure is ever imposed on a project that has its own. Never judge documentation quality by conformance to `talks-v1`; judge it by the profile's own rules.

## Contents
1. Profile definitions (talks-v1 · module-docs · legacy-flat-docs · custom)
2. The adapter (`talks/project.yaml`)
3. Rules that hold for every profile

## Profile definitions

### `talks-v1` (default for new projects)
- **Canonical root:** `talks/project/` per the shared talks schema.
- **Required:** `talks/project.yaml`, `state/schema-version.json`; foundations grow as accepted.
- **Module discovery:** `talks/project/modules/<module>/module.md` registers a module.
- **Ownership:** `talks/indexes/ownership.json` (generated; engine arrives with the record phase).
- **Link rules:** relative links inside `talks/`; templates under any `_templates/` are excluded from link validation.
- **Validation:** structure per schema; parity against code where specs claim implementation.
- **Index destinations:** `talks/indexes/`.

### `module-docs` (existing module-centric project)
- **Canonical root:** adapter-declared (e.g. `docs/<root>/`), modules under a modules directory, each a mini-tree (module file + features/apis/schemas/workflows subfolders in the project's own naming).
- **Required:** module registration file per module; whatever the adapter marks required.
- **Module discovery:** subdirectories of the declared modules root that contain the module file; folders without it are **orphans** (reported distinctly, never auto-registered).
- **Ownership:** the project's own index/ownership files, declared in the adapter.

### `legacy-flat-docs` (existing type-folder project)
- **Canonical root:** adapter-declared; sibling type folders (features/, apis/, data/, workflows/ or equivalents) with one file per domain.
- **Module discovery:** by filename convention across type folders (same domain name ties files together).
- **Required:** the adapter's list; absence of a modules/ tree is **not** a finding.

### `custom`
- **Everything from the adapter:** canonical root, required artifacts, discovery rules, ownership map, exclusions, link and validation expectations, index destinations. Detection reports `custom` with evidence when a structure matches no known profile - silence or forced classification is a defect.

## The adapter (`talks/project.yaml`)

```yaml
docs:
  profile: module-docs          # talks-v1 | module-docs | legacy-flat-docs | custom
  canonicalRoot: docs/project
  modulesRoot: docs/project/modules   # profile-dependent
  required:                     # profile-required artifacts (literal paths)
    - docs/project/README.md
  ownership: docs/project/index # where code<->doc ownership lives
  excluded:                     # directory globs; flow style [a, b] also accepted
    - docs/archive/**
    - "**/_templates/**"
  historicalMarkers:
    - Superseded
    - Historical
  migrationStatus: none         # none | offered | in-progress | complete
```

## Rules that hold for every profile

1. One editable source of truth per specification - adoption never creates a second copy.
2. Existing conventions are preserved through the adapter; migration between profiles is a separately approved action with its own plan.
3. Historical or superseded content (status field, banner, or adapter `historicalMarkers`) is never interpreted as the active contract.
4. Generated artifacts (indexes, reports) carry a regeneration marker and are rebuildable; they are never hand-edited.
5. Profile detection (`profile-detect.mjs`, invoked per the router's script rule) reports **evidence and confidence**; low confidence means ask or record `custom` - never guess silently.
