# Fragment: External SaaS Persistence

**Activates on evidence:** data stored primarily in a third-party service (SDK configuration, API-based data access as the system of record) - record the paths found. Or an accepted decision.

**Fills:** the "Persistence specifics" section of the data template.

## Sections supplied

- **System of record:** which entities live in the external service vs locally; the boundary stated per entity.
- **Vendor-owned schema:** fields controlled by the vendor vs custom fields; what the project can and cannot change.
- **Sync:** how local copies (if any) stay current - webhooks, polling, on-demand - and their staleness window.
- **Failure mode:** behavior when the service is unavailable (degrade, queue, fail) per operation.
- **Export/exit:** what data can be exported and how, recorded honestly (lock-in is a documented risk, not a surprise).
