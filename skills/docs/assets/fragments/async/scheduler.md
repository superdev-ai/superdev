# Fragment: Scheduled Jobs

**Activates on evidence:** cron expressions, scheduler configuration, or scheduled-task definitions - record the paths found. Or an accepted decision.

**Fills:** the mechanism sections of the jobs/webhooks template.

## Sections supplied

- **Schedule table:** each job with its cron/interval, timezone (explicit - DST behavior stated), and expected duration.
- **Overlap policy:** what happens if a run outlasts its interval (skip, queue, run concurrently) - configured, not assumed.
- **Missed-run policy:** behavior after downtime (catch up vs skip) per job.
- **Idempotency:** every scheduled job safe to re-run, or its guard documented.
- **Monitoring:** how a silently-not-running schedule is detected (heartbeat, last-run tracking).
