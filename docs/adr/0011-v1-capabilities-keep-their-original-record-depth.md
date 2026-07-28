# ADR-0011: v1 capabilities keep their original record depth

> **Superseded by ADR-0015.** Record depth is now a property of the schema and of the spec-depth gate, not a convention applied per capability.
>
> The body below is left exactly as it was. History is not rewritten here; a
> decision that was true when it was made stays readable as what was decided.


- **Status:** Accepted
- **Date:** 2026-07-26
- **Owner/approver:** Project owner
- **Relates to:** ADR-0003 (project record), the MS-0001 delivery stage

## Context

The map audit reports three v1 capabilities as complete with no workflows and
no work items: product and feature modeling, the SQLite projection, and the
visual status dashboard.

The finding is accurate. Those capabilities were built and evidenced before
this project modelled journeys and work items at all, so the records that would
have described how they were built never existed.

There are two ways to clear it, and only one of them is honest.

Writing workflows and work items for finished capabilities now would mean
inventing a history nobody lived. The records would look complete, the audit
would go quiet, and every number derived from them would be describing work
that was never planned that way. That is precisely the failure this project
exists to prevent, so the reconciliation tool refuses to do it automatically
and hands the decision here.

## Decision

The three v1 capabilities keep the record depth they were built with. Their
delivery is evidenced, which is what completion requires; the absence of
journey and work-item records for them is a fact about when they were built,
not a gap to be backfilled.

`COMPLETE-WITHOUT-WORK` on these three is accepted and does not block a gate.
It stays visible in the audit, because a finding that is accepted is not the
same as a finding that is false, and a later reader deserves to see both the
observation and the decision.

Every capability delivered from MS-0002 onward carries its journeys and work
items, so this applies to the v1 stage alone and does not grow.

## Alternatives considered

1. **Accept the gap and record why**: chosen.
2. **Backfill workflows and work items**: rejected. It invents history and makes
   derived numbers describe a plan that never existed.
3. **Deprecate the capabilities**: rejected. They work, they are evidenced, and
   deprecating shipped capabilities to satisfy a report would be worse than the
   report.
4. **Remove the audit rule**: rejected. The rule is correct and catches a real
   problem on projects where the work genuinely was never recorded.

## Consequences

- The audit continues to report these three, at medium severity, with this
  decision as their answer.
- A reader comparing MS-0001 and MS-0002 will see different record depth. That
  difference is real and worth seeing.

## Revisit triggers

Someone reconstructs the v1 journeys from evidence that actually exists, rather
than from memory.
