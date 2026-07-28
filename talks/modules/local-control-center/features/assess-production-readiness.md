<!-- superdev:generated source=FEAT-0014 revision=2943 hash=eba997e9e91a830b98540eaebccf0aa1d3c2c22e9363d4ea846a0d686ae47774 -->
# Feature: Assess production readiness

- **Status:** Complete
- **Depth:** Microspec
- **Module:** Local Control Center
- **Risk level:** R1
- **Milestone:** Local Control Center
- **Goals:** GOAL-0003 Always-answerable project state
- **Last verified:** see the generation marker at the top of this file.

## Microspec

- **Purpose:** Report which product areas are specified, awaiting decision, not applicable, or deferred
- **User:** A founder or lead preparing for a release wants to know exactly which product areas are settled, which are waiting on a decision, and which are deliberately out of scope, before calling something production ready.
- **User value:** Not recorded
- **Scope:** in: Reports overall readiness percent and a breakdown of questions answered versus open, and documentation in sync, Buckets every capability area into exactly one of Specified, Awaiting Decision, Deferred, or Not Applicable, Reports module completeness against any completeness checklist that exists, Lists every open question with why it matters, and any documents still waiting on a decision; out: Does not answer the open questions itself, it lists them with their stakes and leaves answering to superdev question or assumption commands, Does not gate or block any other command on readiness percent, this is a report, not an enforcement mechanism, Does not invent a completeness checklist for a module that has none, it says so plainly instead of estimating one
- **Affected contracts:** none linked

### Primary flow

1. Run superdev readiness from the project root
2. Read the overall readiness percent and the two counted sub-metrics
3. Read the capability area bucket counts (Specified, Awaiting Decision, Deferred, Not Applicable)
4. Read the open questions list with the reason each one matters
5. Check the documents-awaiting-decision section for anything blocking sign-off

### Acceptance criteria

| Criterion | Verified how | Status | Evidence |
|---|---|---|---|
| superdev readiness lists every applicable area with one of the four defined statuses | Run superdev readiness and record what was observed. | Met | EV-0050 |

### Error and edge behavior

| Category | Applicability | Behavior or reason |
|---|---|---|
| Auditability | Applicable | Each open question lists a 'why it matters' line naming the specific feature it blocks, so a reader can trace an unresolved question back to the concrete capability waiting on it. |
| Boundary Values | Applicable | Overall readiness can reach a high percent (for example 97 percent) while open questions remain unanswered, because the percent is computed from tracked items done versus total, and open questions are reported separately rather than being averaged into a single blended score that would hide them. |
| Empty States | Applicable | With every capability area answered or marked not applicable, all four buckets can read 0 and the report states plainly that every area has been answered or recorded as not applicable, rather than leaving the buckets ambiguous. |

### Test evidence

| Evidence | Type | Result | Reference |
|---|---|---|---|
| Ran node src/cli.mjs readiness; printed overall readiness percent, capability area buckets (Specified/Awaiting Decision/Deferred/Not Applicable, all 0 here since none exist yet), module completeness, and a list of 8 open questions with why each matters, plus a documents-awaiting-decision section, matching the feature's claim of reporting specified/awaiting decision/not applicable/deferred areas. | command | pass | superdev readiness (COMMANDS.readiness -> cmdReadiness in src/cli.mjs:422) |

## Delivery state

- **What works now:** Reached by superdev readiness (COMMANDS.readiness -> cmdReadiness in src/cli.mjs:422). Ran node src/cli.mjs readiness; printed overall readiness percent, capability area buckets (Specified/Awaiting Decision/Deferred/Not Applicable, all 0 here since none exist yet), module completeness, and a list of 8 open questions with why each matters, plus a documents-awaiting-decision section, matching the feature's claim of reporting specified/awaiting decision/not applicable/deferred areas.
- **What remains:** Nothing known.
- **Next action:** Not recorded
