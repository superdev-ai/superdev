<!-- superdev:generated source=FEAT-0012 revision=2943 hash=acbda3f09c30c96c98d8ffb694537288b99c57bd47605a3657b7d506eb990119 -->
# Feature: Check project health

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Verify database health, documentation parity, harness coverage, and provider availability
- **User:** A developer, lead, or agent wants a single command that tells them whether the project's database, docs, and providers are actually healthy before they trust anything else the tool reports.
- **User value:** Not recorded
- **Scope:** in: Checks storage engine, database schema version and pending migrations, and integrity (page damage, dangling references), Checks whether generated documentation matches the database and whether it was built from a stale revision, Checks alignment warnings and provider availability (for example 7 of 7 ready), and how much recorded evidence can be re-run, Prints a Pass or Problem verdict per check plus a Findings section detailing every alignment warning with what is wrong and what to do about it; out: Does not fix any problem it finds, each finding names a follow-up command (derive, docs generate, verify) instead of acting itself, Does not check anything outside the eight fixed categories (storage, database, integrity, documentation, alignment, freshness, providers, evidence), Does not require network access, providers are checked for local readiness/configuration, not live external connectivity
- **Affected contracts:** none linked

### Primary flow

1. Run superdev doctor from the project root
2. Read the per-check table of Pass/Problem verdicts
3. If any check reports Problem, read the Findings section grouped by severity
4. Follow the 'Do:' recommendation attached to each finding

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev doctor reports pass or fail status for each health check category | Run superdev doctor and record what was observed. | Met | EV-0048 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Boundary Values | Applicable | Doctor exits with status 1 whenever at least one check reports Problem, and exits 0 only when every check passes, so a calling hook or script can branch on exit code without parsing text. |
| Consistency | Applicable | A feature marked implemented but with an unmet acceptance criterion or an open task is flagged High severity, because the status and the underlying record disagree and one of them is wrong. |
| Dependency Failure | Applicable | Providers are reported as a ready count out of the total configured (for example 7 of 7), so a missing or misconfigured provider shows up as a fraction less than the total rather than a generic failure. |
| Empty States | Applicable | With no alignment warnings and no stale documents, Alignment and Freshness both report Pass and the Findings section is simply absent. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Checked by hand: this holds, and no single command exit code answers it, because the ones that touch it also report unrelated state. Ran node src/cli.mjs doctor; printed a real checklist covering Storage engine, Database (schema version 8 of 8), Integrity, Documentation, Alignment, Freshness, Providers (7 of 7 ready), and Evidence, with a findings section for the one alignment warning (MS-0009 has no features). Matches the four things the feature claims: db health, doc parity, harness/evidence coverage, provider availability. | command | pass | superdev doctor (COMMANDS.doctor -> cmdDoctor in src/cli.mjs:481) |

## Delivery state

- **What works now:** Reached by superdev doctor (COMMANDS.doctor -> cmdDoctor in src/cli.mjs:481). Ran node src/cli.mjs doctor; printed a real checklist covering Storage engine, Database (schema version 8 of 8), Integrity, Documentation, Alignment, Freshness, Providers (7 of 7 ready), and Evidence, with a findings section for the one alignment warning (MS-0009 has no features). Matches the four things the feature claims: db health, doc parity, harness/evidence coverage, provider availability.
- **What remains:** Nothing known.
- **Next action:** Not recorded
