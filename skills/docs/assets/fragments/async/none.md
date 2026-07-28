# Fragment: No Async System

**Activates on evidence:** no queue, scheduler, event bus, or background-job mechanism configured. Or an accepted decision.

**Fills:** the mechanism sections of the jobs/webhooks template.

## Sections supplied

- **Statement:** all work happens synchronously in request/interaction scope - recorded explicitly.
- **Consequences documented:** long operations block their caller; the UI states for slow paths (edge-case category 11) matter more, not less.
- **Boundaries:** operations currently near timeout limits are listed - they are the trigger list for introducing async later (becomes a decision when it happens).
