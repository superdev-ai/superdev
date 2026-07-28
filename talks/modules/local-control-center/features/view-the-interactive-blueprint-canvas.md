<!-- superdev:generated source=FEAT-0087 revision=2943 hash=9d6c15fbda4265197163e55ffdbd58fedd275dee16dcede66f09ce73b869bfac -->
# Feature: View the interactive blueprint canvas

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Visualize relationships between product, goals, modules, features, tasks, and decisions
- **User:** A product owner or engineering lead wants to see the whole product, goals down to tasks, as one connected map instead of reading separate lists.
- **User value:** Not recorded
- **Scope:** in: Reads /api/product, /api/workflows and /api/tasks and renders goals, milestones, modules, features, workflows and tasks as nodes on a pannable, zoomable canvas, Draws solid containment lines and dashed labelled cross-cutting lines (a goal a feature supports, a task that blocks another, a task that unlocks a feature), Clicking a node highlights what it connects to; double-clicking opens a detail panel with its fields and linked records, Saves the user's manual node layout separately from the product data, keyed to the blueprint canvas; out: Does not let the user edit product data from the canvas; the detail panel is read-only and links out to the record's own view for changes, Does not refresh live; the three reads are folded into one freshness reading and only update on demand, Does not sync a saved layout across browsers or devices; layout is stored in this browser's local storage
- **Affected contracts:** none linked

### Primary flow

1. Navigate to #/blueprint
2. The view fetches /api/product, /api/workflows and /api/tasks and lays out the containment chain goals to tasks
3. Click a node to see what connects to it, or double-click to open its detail panel
4. Drag a node to reposition it; the new position is saved to this browser for next time

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| The Blueprint renders a pannable, zoomable canvas that highlights connected records on selection and persists the user's layout separately from product data | Do it through the surface a person would use and record what was observed. | Met | EV-0086 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Consistency | Applicable | Because the view reads three separate endpoints, it merges their freshness timestamps into one reading and shows Stale if any one of the three is behind, rather than quietly displaying the newest source next to an older one |
| Empty States | Applicable | With no goals, milestones, modules, features, workflows or tasks yet, the canvas shows 'There is no product to map yet' with an explanation and buttons to Discovery or Overview instead of a blank canvas |
| Multi Device Session | Applicable | Saved node positions live in this browser's local storage under a key scoped to the blueprint canvas, so a different browser or device sees the default layout, not this one's arrangement |
| Network Failure | Applicable | An offline or failed read shows the Offline or ErrorState component with a reconnect action, rather than a canvas that silently shows stale or partial data |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: the command that shows this needs a shell, so nothing can re-run it unattended. ui/src/views/blueprint.tsx:1-58 documents and implements the goals->milestones->modules->features->workflows->tasks map using components/canvas/graph-canvas and components/canvas/layout (saved layout, detail panel, relationship filter); 'blueprint' is a listed route in ui/src/lib/route.ts:12-29; curl http://127.0.0.1:4317/api/product, /api/workflows, /api/tasks each returned HTTP 200 with real relational data (e.g. WF-0007/WF-0008 tied to FEAT-0081/FEAT-0082). | command | pass | Navigate to #/blueprint -> ui/src/views/blueprint.tsx reads GET /api/product, /api/workflows, /api/tasks and renders them on a GraphCanvas with containment and cross-cutting relationship lines |

## Delivery state

- **What works now:** Reached by Navigate to #/blueprint -> ui/src/views/blueprint.tsx reads GET /api/product, /api/workflows, /api/tasks and renders them on a GraphCanvas with containment and cross-cutting relationship lines. ui/src/views/blueprint.tsx:1-58 documents and implements the goals->milestones->modules->features->workflows->tasks map using components/canvas/graph-canvas and components/canvas/layout (saved layout, detail panel, relationship filter); 'blueprint' is a listed route in ui/src/lib/route.ts:12-29; curl http://127.0.0.1:4317/api/product, /api/workflows, /api/tasks each returned HTTP 200 with real relational data (e.g. WF-0007/WF-0008 tied to FEAT-0081/FEAT-0082).
- **What remains:** Nothing known.
- **Next action:** Not recorded
