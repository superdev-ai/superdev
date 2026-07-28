<!-- Template: roles and permissions - the three nested matrices. -->
# {{project-name}} - Roles and Permissions

- **Status:** draft | accepted
- **Permission source of truth (code):** {{declared-path}}
- **Last verified:** {{revision}} on {{date}}

## 1. Role × module visibility

| Module | {{role-1}} | {{role-2}} |
|---|---|---|
| {{module}} | ✓ / - | ✓ / - |

## 2. Role × action capability (per module - link module inventories)

{{links-to-per-module-matrices}}

## 3. Role × field sensitivity

| Entity.field | Class | {{role-1}} | {{role-2}} |
|---|---|---|---|
| {{entity.field}} | personal/financial/secret | read / write / redacted / - | … |

## Enforcement

Every row names its enforcement point: {{middleware/policy/guard-paths}}. Matrix-vs-code disagreement is a P1 parity finding (validation category K).
