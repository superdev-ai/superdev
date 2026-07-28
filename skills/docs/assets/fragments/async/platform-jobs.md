# Fragment: Platform-Managed Jobs

**Activates on evidence:** platform job/function definitions (serverless background functions, platform cron, managed workflow definitions) - record the paths found. Or an accepted decision.

**Fills:** the mechanism sections of the jobs/webhooks template.

## Sections supplied

- **Job definitions:** where each platform job is declared (config file, dashboard-as-code) and its trigger.
- **Platform limits:** execution timeout, payload size, concurrency - from the platform's documented limits for the configured tier, cited.
- **Retry behavior:** the platform's retry policy as configured; what the platform does on final failure.
- **Local development:** how jobs run locally (emulator, manual trigger) so behavior is testable.
- **Observability:** where platform logs/metrics for these jobs live and who can access them.
