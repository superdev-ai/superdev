<!-- superdev:generated source=FEAT-0085 revision=2943 hash=faa495aa765e69508ee25700e56b1677615de5829dc126b130e9a918f0f1f8b8 -->
# Feature: Drill down between related records

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Navigate from goals, modules, features, and tasks to their related records
- **User:** A product owner or developer looking at a goal, module, feature or task wants to jump straight to a record it connects to, instead of hunting for it in another view.
- **User value:** Not recorded
- **Scope:** in: Renders every cross-reference as a RecordLink showing the record's name and id, Resolves a click to a hash route of the form #/view/id via the shared parseHash and hrefFor router, Works the same way across product, data, activity, overview, discovery, architecture and features views, Features view builds its own links with hrefFor('features', feature.id) for feature and task rows; out: Does not open a separate page load: it is a client-side hash change, so no server round trip happens on navigation, Does not validate that the linked record still exists before rendering the link; that is left to the destination view
- **Affected contracts:** none linked

### Primary flow

1. Open any list or detail view that shows related records, for example a feature's detail panel
2. Click a RecordLink such as a workflow or task reference
3. The router's navigate() sets window.location.hash to #/<view>/<id>
4. The destination view reads the hash, loads the record, and opens it

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| Clicking a feature in the control center navigates to its workflows and tasks | Do it through the surface a person would use and record what was observed. | Met | EV-0089 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Deletion Semantics | Not Applicable | N/A - The router does not know a record was deleted; it hands the id to the destination view, which is responsible for showing a not-found state if the record is gone |
| Empty States | Applicable | RecordLinks renders a plain sentence supplied by the caller (the 'empty' prop) instead of an empty list when a record has no related records to link to |
| Invalid Input | Applicable | parseHash falls back to the default view (overview) when the hash names a view not in the VIEWS list, and rewrites the address bar to the normalized hash rather than leaving a broken-looking URL |
| Multi Device Session | Applicable | Because the full state (view plus record) lives in the URL hash, a link copied out of the address bar and opened elsewhere reproduces the same selection |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Drilling from a feature to what hangs off it works: feature show prints the module, milestone, goals served, acceptance criteria, workflows, test plans and tasks, each by identifier, so every related record is reachable from the one in hand. The same links are navigable in the control centre. | command | pass | node src/cli.mjs feature show FEAT-0001 |

## Delivery state

- **What works now:** Reached by Any list/detail view (Product, Data, Activity, Overview, Discovery, Architecture, Features, Tasks) -> click a RecordLink or feature/task row -> hash route #/<view>/<id> opens the related record. ui/src/components/product/panel.tsx:319-344 defines RecordLink(name,id,href) used by 6 views (grep -rl RecordLink ui/src/views/ -> product.tsx, data.tsx, activity.tsx, overview.tsx, discovery.tsx, architecture.tsx); ui/src/views/features.tsx:201-287 builds its own hrefFor('features', feature.id) links; ui/src/lib/route.ts implements the hash router (parseHash/hrefFor/navigate) that resolves these links to a view+record.
- **What remains:** Nothing known.
- **Next action:** Not recorded
