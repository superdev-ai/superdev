# Risk-Proportionate Specification Depths

Depth comes from risk and evidence - never from project size, user verbosity, or habit. Score the change on the shared risk model (blast radius, reversibility, interacting components, uncertainty, security/privacy, migration, external effects, cost, public contract) and pick the smallest depth that covers the risk.

## The spec-first gate (enforced)

New or materially changed behavior requires an accepted spec at the right depth **before implementation**. Refusals:

- Refuse to write feature code with no spec - offer the microspec (minutes, not ceremony) as the fast path.
- Refuse silent scope growth: implementation exceeding the accepted spec returns to the spec.
- **Emergency bypass** is available but bounded: it must be explicitly requested, and it creates a logged spec-debt record with owner, reason, scope, and expiry. Debt past expiry surfaces in status until resolved.

## Microspec - small, local, reversible new behavior

purpose · user · scope (in/out) · primary flow · acceptance criteria · affected files/contracts · error and edge behavior (from `edge-cases.md`, categories may be N/A only deliberately) · test evidence planned.

One page or less. Template: `assets/templates/feature.md` (microspec tier).

## Standard - cross-component features (default for product work)

Everything in microspec, plus: surfaces and actions (per `surfaces-and-actions.md`) · API/data impact · roles and permissions · workflow and states · non-happy paths · observability (what signals prove it works) · rollout · detailed test plan.

## Full design - architectural or sensitive changes

Everything in standard, plus: alternatives with a decision matrix · architecture · sequence/state diagrams where they clarify (per `diagrams.md`) · migrations · security/privacy/compliance analysis · performance/capacity from evidence · failure recovery · rollback · operations · compatibility · decision records (ADRs) for the load-bearing choices.

## Acceptance and change

- A spec is a draft until explicitly accepted; acceptance is recorded.
- Accepted specs change through change tracking (`change-tracking.md`), not silent edits.
- Implementation-versus-spec parity is validated before any "implemented" claim (`validation.md`).
