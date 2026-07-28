<!-- Template: feature specification. Three tiers; fill the tier the risk selects.
     Microspec = the whole first section. Standard and Full add their sections. -->
# Feature: {{feature-name}}

- **Status:** draft | accepted | implemented
- **Depth:** microspec | standard | full
- **Module:** {{owning-module}}
- **Risk notes:** {{what-drove-the-depth-choice}}

## Microspec (always)

- **Purpose:** {{why-this-exists}}
- **User:** {{who-and-goal}}
- **Scope:** in: {{in}} · out: {{out}}
- **Primary flow:** {{numbered-steps}}
- **Acceptance criteria:** {{testable-criteria}}
- **Affected files/contracts:** {{paths-and-contracts}}
- **Error and edge behavior:** {{from-edge-case-walk - applicable categories, N/A deliberate}}
- **Test evidence:** {{planned-tests-and-where-results-live}}

## Standard (adds)

- **Surfaces and actions:** {{link-to-inventory}}
- **API/data impact:** {{operations-and-entities}}
- **Roles and permissions:** {{matrix-delta}}
- **Workflow and states:** {{flow-and-state-changes}}
- **Non-happy paths:** {{failure-flows}}
- **Observability:** {{signals-that-prove-it-works}}
- **Rollout:** {{flag/staged/at-once-and-why}}
- **Test plan:** {{detailed-cases}}

## Full (adds)

- **Alternatives:** {{options-with-decision-matrix}}
- **Architecture:** {{design-and-diagrams}}
- **Migrations:** {{data/schema-migration-plan}}
- **Security/privacy/compliance:** {{analysis-under-declared-regimes}}
- **Performance/capacity:** {{evidence-based}}
- **Failure recovery:** {{what-breaks-and-how-it-recovers}}
- **Rollback:** {{how-to-undo}}
- **Operations:** {{runbook-deltas}}
- **Compatibility:** {{public-contract-impacts}}
- **Decision records:** {{adrs-created}}
