# Workflows, State Machines, Async Jobs, and Webhooks

## Workflows (`assets/templates/workflow-state-machine.md`)

Per cross-actor/cross-module flow: purpose · actors (people, systems, jobs) · trigger · step sequence with owner per step (swimlane diagram per `diagrams.md` when it clarifies) · decision points and branches · failure behavior per step (retry, compensate, park, abort) · completion criteria · observability (how progress is visible).

## State machines

Per entity with a lifecycle: states (with meaning) · transitions (event, guard, actor allowed) · illegal transitions explicitly rejected (not just absent) · terminal states · timeout/expiry transitions · what each state permits in the UI (ties to action preconditions in `surfaces-and-actions.md`).

## Async jobs (`assets/templates/jobs-webhooks.md` + `assets/fragments/async/*`)

Per job: trigger (schedule/event/enqueue) · input contract · idempotency (safe to re-run?) · retry policy and backoff · failure destination (dead-letter/park/alert) · timeout · concurrency limits · observability (how a stuck job is noticed) · cleanup/exactly-once expectations stated honestly.

Async fragments supply the mechanism specifics (queue, scheduler, event bus, platform jobs) only when detected or decided; `none` states the absence explicitly.

## Webhooks

**Incoming:** endpoint · sender identity verification (signature scheme from evidence) · replay protection/idempotency · ordering assumptions (usually none - document how out-of-order is handled) · failure response semantics (what makes the sender retry) · payload versioning.
**Outgoing:** subscriber registration · delivery guarantees · retry/backoff · signing · failure visibility to the operator.

## Rules

- Every state machine in docs corresponds to enforcement in code (guards/validators); unenforced documented transitions are drift.
- Jobs and webhooks appear in the module's event step (module-decomposition step 8) - producers and consumers named on both sides.
