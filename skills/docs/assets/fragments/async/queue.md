# Fragment: Queue-Based Async

**Activates on evidence:** queue client configuration, producer/consumer code, queue infrastructure definitions - record the paths found. Or an accepted decision.

**Fills:** the mechanism sections of the jobs/webhooks template.

## Sections supplied

- **Queues:** each queue's name, message contract, producers, and consumers.
- **Delivery:** the queue system's actual guarantee (at-least-once typically) - consumer idempotency is therefore mandatory and documented per job.
- **Retry/backoff:** configured policy per queue; poison-message handling (dead-letter destination and its monitoring).
- **Visibility/locking:** in-flight semantics (visibility timeout, lock duration) and what happens on consumer crash.
- **Throughput controls:** concurrency limits, batch sizes, rate limits from configuration.
