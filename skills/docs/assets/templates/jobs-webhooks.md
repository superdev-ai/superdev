<!-- Template: async jobs and webhooks. Mechanism specifics come from the active
     async fragment; "none" is a deliberate statement. -->
# {{job-or-webhook-name}}

- **Status:** draft | accepted | implemented
- **Module:** {{owning-module}}
- **Mechanism:** {{from-active-async-fragment-or-none}}
- **Last verified:** {{revision}} on {{date}} against {{code-paths}}

## Async job

- **Trigger:** {{schedule/event/enqueue}}
- **Input:** {{contract}}
- **Idempotency:** {{safe-to-re-run?-how}}
- **Retry:** {{policy-and-backoff}}
- **Failure destination:** {{dead-letter/park/alert}}
- **Timeout:** {{limit-and-behavior}}
- **Concurrency:** {{limits}}
- **Observability:** {{how-a-stuck-job-is-noticed}}
- **Delivery guarantee:** {{at-least-once/at-most-once - stated honestly}}

## Incoming webhook

- **Endpoint:** {{route}}
- **Sender verification:** {{signature-scheme-from-evidence}}
- **Replay protection:** {{idempotency-mechanism}}
- **Ordering:** {{assumption-and-out-of-order-handling}}
- **Failure semantics:** {{what-triggers-sender-retry}}
- **Payload versioning:** {{handling}}

## Outgoing webhook

- **Registration:** {{how-subscribers-register}}
- **Delivery:** {{guarantees-retry-backoff}}
- **Signing:** {{scheme}}
- **Failure visibility:** {{operator-view}}
