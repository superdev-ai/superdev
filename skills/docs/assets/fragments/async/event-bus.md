# Fragment: Event Bus

**Activates on evidence:** pub/sub topic configuration, event-bus client code, subscription definitions - record the paths found. Or an accepted decision.

**Fills:** the mechanism sections of the jobs/webhooks template; pairs with the events API fragment when events are also the API style.

## Sections supplied

- **Topics and subscriptions:** topic map with publishers and every subscriber (a topic with unknown subscribers is a finding).
- **Fan-out semantics:** per-subscriber delivery and failure isolation (one failing subscriber must not block others - verified from configuration).
- **Ordering:** per-key ordering guarantees if any; consumer tolerance otherwise.
- **Replay:** whether history is replayable, retention window, and the re-subscription procedure.
- **Schema governance:** how event payload changes propagate to subscribers without breakage.
