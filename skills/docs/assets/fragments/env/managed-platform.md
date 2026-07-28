# Fragment: Environments - Platform-Managed Configuration

**Activates on evidence:** environment configuration held in a deployment platform (platform config files declaring env bindings, dashboard-managed settings referenced in docs/code) - record the evidence. Or an accepted decision.

**Fills:** environment sections of foundations and operational docs.

## Sections supplied

- **Where configuration lives:** the platform and scope (project/environment level) - names, never values.
- **Environment map:** the platform's environments and how they map to the project's stages.
- **Sync procedure:** how local development obtains configuration (platform CLI pull, generated local file) and which direction is authoritative.
- **Change procedure:** who changes platform config and how changes are recorded (a config change is an operations change class).
- **Secret rotation:** the rotation path for platform-held secrets, recorded as procedure without values.
