# Roles/Permissions, Observability, Compliance, NFRs, and Test Plans

## Roles and permissions (`assets/templates/roles-permissions.md`)

Three nested matrices, built by interview plus code evidence:

1. **Role × module visibility** - which roles see which modules at all.
2. **Role × action capability** - per module, the role×action matrix from `surfaces-and-actions.md` (`✓` / `own` / ` - `).
3. **Role × field sensitivity** - for personal/financial/secret fields: which roles read, which write, which see redacted forms.

The permission **source of truth in code** is declared per project (adapter/foundations) and every matrix row names its enforcement point. Matrix-says-yes/code-says-no (or reverse) is a P1 parity finding.

## Observability (`assets/templates/observability.md`)

Per module: signals that prove it works (events/metrics/logs at capability level) · dashboards or views the operator actually has (from evidence) · alerts with thresholds from evidence or decisions · what a responder looks at first. Vendor names appear only via detected evidence or decision.

## Compliance (`assets/templates/compliance.md`)

Only for **declared regimes** (recorded as decisions - never inferred from geography or vertical): applicable regime list with the declaring decision · per-module data inventory of regulated classes · handling rules (encryption at rest/in transit, access, retention, subject rights) · gaps as explicit open items. If no regime is declared, the document says exactly that.

## Non-functional requirements (`assets/templates/nfr.md`)

Budgets and targets come from **evidence or explicit decisions**: measured baselines, platform limits, or owner-set targets with their rationale. Never invent latency numbers, availability percentages, or capacity figures. An NFR without a measurement method is a draft, not a requirement.

## Test plans (`assets/templates/test-plan.md`)

Per module: what must be true (from acceptance criteria) · test levels used in this project (unit/integration/E2E - the project's actual tooling, named from evidence) · the specific cases covering: happy paths per feature, the edge-case categories marked applicable, permission boundaries per matrix, state-machine transitions incl. illegal ones · evidence conventions (where results live). Tests-claimed-but-absent is a P1 finding in parity validation.
