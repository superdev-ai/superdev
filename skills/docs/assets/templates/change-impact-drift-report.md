<!-- Template: change-impact / drift report. Generated view - regeneration-marked,
     rebuildable, never hand-edited as authority. -->
<!-- REGENERATED - do not hand-edit. Source: change entries + validation run {{run-id}} -->
# {{project-name}} - Change Impact / Drift Report

- **Generated:** {{date}} against {{revision}}
- **Scope:** {{diff-or-full-tree}}

## Change impact

| Changed path | Class | Affected artifacts | Status |
|---|---|---|---|
| {{path}} | {{change-class}} | {{artifacts}} | updated / pending / deferred({{tracked-entry}}) |

## Drift findings

| # | Class | Evidence (code side) | Evidence (doc side) | Resolution owner |
|---|---|---|---|---|
| {{n}} | {{drift-class}} | {{path:line}} | {{doc-path}} | code / docs / decision |

## Contradictions still open

| Since | Sides | Blocking? |
|---|---|---|
| {{date}} | {{a-vs-b}} | {{yes/no}} |

## Pending sync (blocks completion of the causing change)

{{list-or-none}}
