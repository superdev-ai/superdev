# Project Classification, Requirement Discovery, and Question Discipline

## Contents
1. Classify the project
2. Discover requirements
3. Question discipline
4. Push-back catalogue
5. Proactive suggestions

## 1. Classify the project

From evidence, never assumption: delivery shape (web / mobile / desktop / CLI / API-only / library), persistence style, API style, async needs, auth needs, environment handling, deployment shape. Each classification cites its evidence (file, config, dependency) and gets an epistemic label. Classifications feed **fragment activation** (`assets/fragments/`) - a capability fragment activates only from detected evidence or an accepted decision.

## 2. Discover requirements

Work section by section - product intent, users and roles, scope boundaries, core flows, data, integrations, quality attributes - and for each: state what the evidence already answers, then ask only what remains material. Requirements land as drafts with provenance; acceptance is explicit.

## 3. Question discipline

- One important question at a time; group only trivial factual selections.
- Recommend first: every question carries a recommendation, why, and when not to take it (the question-packet format in the shared evidence contract).
- Skip what evidence answers; never ask for facts visible in code, lockfiles, routers, or existing docs.
- Ask only when the answer materially changes the deliverable; otherwise proceed with a declared assumption.

## 4. Push-back catalogue

Push back when an answer cannot drive implementation - require the missing dimension, propose a concrete default, and record the resolution:

| Vague answer | Require |
|---|---|
| "secure" | threat model scope + data classes |
| "real-time" | latency + consistency expectation |
| "admin can manage X" | role boundary + exact capabilities |
| "multi-tenant" | tenant axis + isolation level |
| "scalable" | load assumption + growth horizon |
| "AI-powered" | model responsibility, failure behavior, cost boundary |
| "audit everything" | which events, retention, who reads them |
| "works offline" | which operations, conflict resolution |
| "fast" | budget with a measurement point, from evidence - never invented |

Do not push back on every answer; push back when building on the answer as-is would produce rework.

## 5. Proactive suggestions

When a capability appears, volunteer its commonly forgotten neighbors - as questions, at capability level, never as vendor choices:

| Trigger | Volunteer |
|---|---|
| authentication | session revocation, MFA policy, password reset, account lockout |
| payments/billing | refunds, disputes, dunning, tax handling, webhooks idempotency |
| file upload | size/type limits, virus scanning policy, storage lifecycle, access control |
| search | empty results, indexing lag, permission filtering |
| notifications | preferences, batching, quiet hours, delivery failure |
| invitations/teams | expiry, re-invite, role at accept, member removal |
| background jobs | retry policy, dead-letter handling, idempotency, monitoring |
| i18n | date/number formats, RTL, translatable content ownership |
| deletion | soft vs hard, cascades, export-before-delete, legal holds |

Suggestions are offers; declined ones are recorded as declined-not-forgotten with a revisit condition.
