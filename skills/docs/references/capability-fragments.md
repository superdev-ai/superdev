# Capability Fragments - Inventory and Activation Rules

A fragment supplies the style-specific sections of universal templates. **Activation rule:** a fragment activates only when (a) detected from current code/configuration - with the evidence recorded - or (b) selected in an accepted decision. Never by default, never from genre expectations.

## Layout

One directory per capability axis under `assets/fragments/`, one file per style. Each fragment states its activation evidence patterns and the template sections it fills. `none.md` variants make absence an explicit, documentable state.

## Inventory

| Axis | Styles |
|---|---|
| `assets/fragments/api/` | rest · graphql · rpc · events · local-only |
| `assets/fragments/data/` | sql-orm · sql-plain · document · key-value · external-saas · none |
| `assets/fragments/async/` | queue · scheduler · event-bus · platform-jobs · none |
| `assets/fragments/auth/` | neutral-base · detected-provider |
| `assets/fragments/ui/` | web · mobile · desktop · cli · api-only |
| `assets/fragments/env/` | envx · conventional · managed-platform · none |

## Usage

1. Determine the relevant axis from the operation (API doc → `api/`, entity doc → `data/`, …).
2. Pick the style whose activation evidence is present, or the style an accepted decision selects; record which and why in the produced artifact.
3. If no style's evidence exists and no decision selects one, use the `none.md` variant where the axis has one, or state the absence - never pick a plausible default.
4. Fragment content fills the template's designated section; universal template text is never edited to embed style specifics.
