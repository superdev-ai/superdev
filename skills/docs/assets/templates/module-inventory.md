<!-- Template: module inventory. Every module folder is registered here or is an orphan. -->
# {{project-name}} - Module Inventory

- **Status:** generated projection of the `modules` table; the database is canonical and this file is rebuilt from it
- **Last verified:** {{revision}} on {{date}}

| Module | Purpose | Primary users | Owns | Status | Doc root |
|---|---|---|---|---|---|
| {{module}} | {{purpose}} | {{roles}} | {{data-and-surfaces}} | planned / in-progress / implemented / deprecated | {{path}} |

## Status rules

- `implemented` is derived, not asserted: it requires the module's features to be complete and their acceptance criteria to carry current verification evidence.
- Deprecated modules keep their row and doc root; history is never deleted.
- Editing this file does not change a module's status. Change it in the database, then regenerate; a manual edit here is detected and raised as a proposal.

## Deliberate exclusions

Folders under the modules root that are intentionally not modules (fixtures, archives): {{list-or-none}}
