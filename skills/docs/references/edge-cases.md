# Edge-Case Coverage

Walk every applicable category for each feature or module. **No category is left silent:** each is either specified or marked `N/A - <deliberate reason>`. A category marked N/A without a reason is a validation finding.

## Contents
1. The categories (behavioral · operational · distribution · data integrity and lifecycle)
2. Per-capability starter sets

## The categories

### Behavioral
1. **Empty states** - no data yet, filtered-to-empty, first-run.
2. **Boundary values** - zero, one, maximum, overflow, truncation, pagination edges.
3. **Invalid input** - type, format, range, injection-shaped input at trust boundaries.
4. **Permission boundaries** - each role attempting each action, including URL/API access without UI affordance.
5. **State-machine violations** - actions attempted in wrong states; double-submits; replayed transitions.
6. **Concurrent actions** - two actors editing/deleting the same entity; optimistic-lock behavior.
7. **Ordering** - out-of-order arrival of events/webhooks/responses.
8. **Duplication** - retried requests, duplicate submissions, idempotency expectations.

### Operational
9. **Network failure** - timeouts, partial failure mid-flow, retry behavior, user feedback.
10. **Dependency failure** - downstream service down, degraded mode, circuit behavior.
11. **Slow paths** - long-running operations, progress feedback, cancellation.
12. **Time** - timezones, DST, clock skew, expiry boundaries, date rollover, leap cases.
13. **Data migration states** - old-shape data encountered by new code and vice versa.
14. **Recovery** - crash mid-operation; what is resumable, what is orphaned, cleanup.
15. **Limits and quotas** - rate limits, storage limits, plan limits; behavior at and past the limit.

### Distribution
16. **Multi-device/session** - same account concurrently; stale-tab actions; session expiry mid-flow.
17. **Offline/degraded** - if in scope: queued actions, conflict resolution, reconnect.
18. **Localization** - long strings, RTL, unsupported locale fallback (if in scope).
19. **Platform variance** - browser/OS/device classes in scope.
20. **Versioning** - old clients against new APIs; deprecation windows.

### Data integrity and lifecycle
21. **Deletion semantics** - soft/hard, cascades, references to deleted entities, export-before-delete.
22. **Consistency** - derived data staleness, cache invalidation, eventual-consistency visibility.
23. **Privacy lifecycle** - data subject requests, retention, anonymization (declared regimes only).
24. **Auditability** - who did what when, for actions that require it.

## Per-capability starter sets

When a capability is present, its typical hot spots (start here, then walk all categories): **auth** - expiry mid-flow, revoked session, role change mid-session · **payments** - webhook replay/ordering, partial refund, currency rounding · **upload** - oversize, wrong type, interrupted upload, orphaned blobs · **search** - empty, injection-shaped queries, permission filtering, index lag · **realtime** - reconnect gaps, missed events, ordering · **multi-tenant** - cross-tenant reference attempts, tenant deletion · **mobile** - backgrounding mid-flow, push permission denied, app-version skew against the API, deep-link cold start · **i18n** - long-string overflow, RTL layout, locale fallback, pluralization rules · **AI features** - model failure/timeout, unsafe output handling, cost runaway, nondeterminism in tests.
