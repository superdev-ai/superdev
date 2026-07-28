<!-- Template: compliance. ONLY declared regimes (recorded decisions) - never
     inferred from geography or vertical. No regime declared => say exactly that. -->
# {{project-name}} - Compliance

- **Status:** draft | accepted
- **Declared regimes:** {{list-with-declaring-decision-ids - or "none declared"}}
- **Last verified:** {{revision}} on {{date}}

## Regulated data inventory (per declared regime)

| Entity.field | Class under {{regime}} | Modules touching it |
|---|---|---|
| {{entity.field}} | {{class}} | {{modules}} |

## Handling rules

| Concern | Rule | Enforced at |
|---|---|---|
| Encryption at rest | {{rule}} | {{evidence}} |
| Encryption in transit | {{rule}} | {{evidence}} |
| Access control | {{rule}} | {{permission-matrix-link}} |
| Retention | {{rule-from-decision}} | {{enforcement}} |
| Subject rights (access/export/delete) | {{supported-operations}} | {{code-paths}} |

## Gaps (open items)

| Gap | Risk | Owner decision needed |
|---|---|---|
| {{gap}} | {{risk}} | {{question}} |
