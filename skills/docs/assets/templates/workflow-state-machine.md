<!-- Template: workflow and/or state machine. Use the sections that apply. -->
# {{workflow-or-entity-name}}

- **Status:** draft | accepted | implemented
- **Module:** {{owning-module}}
- **Last verified:** {{revision}} on {{date}} against {{code-paths}}

## Workflow

- **Purpose:** {{why}}
- **Actors:** {{people-systems-jobs}}
- **Trigger:** {{what-starts-it}}

| Step | Owner | Action | On failure |
|---|---|---|---|
| {{n}} | {{actor}} | {{action}} | {{retry/compensate/park/abort}} |

- **Completion:** {{criteria}}
- **Observability:** {{how-progress-is-visible}}

```mermaid
sequenceDiagram
  {{swimlane-if-multi-actor}}
```

## State machine

| State | Meaning | Permits (UI/API) |
|---|---|---|
| {{state}} | {{meaning}} | {{allowed-actions}} |

| From | Event | Guard | To | Actor |
|---|---|---|---|---|
| {{state}} | {{event}} | {{guard}} | {{state}} | {{who}} |

- **Illegal transitions:** explicitly rejected at {{enforcement-point}} (documented-but-unenforced = drift)
- **Terminal states:** {{list}}
- **Timeouts/expiry:** {{time-driven-transitions}}

```mermaid
stateDiagram-v2
  {{states-and-transitions}}
```
