# ADR Authoring (Docs-side)

Docs owns the authoring quality of decision records; the decision skill owns conflict behavior and lifecycle enforcement. Template: `assets/templates/adr.md`; fields and statuses follow the shared project record (`${CLAUDE_PLUGIN_ROOT}/references/project-record.md`) §6.

## Authoring rules

- **Context before decision:** the problem, constraints, and evidence (with epistemic labels) come first; a reader must be able to disagree intelligently.
- **Options considered is mandatory** - including the rejected ones with honest reasons; "we didn't consider alternatives" is itself the recorded truth when so.
- **Observable rationale only:** criteria, tradeoffs, consequences, revisit triggers - never private reasoning.
- **Consequences include the negative ones.** A decision with only upsides is under-analyzed.
- **Enforcement points:** name where the decision is enforced (validator rule, review checklist, code location) - unenforced decisions drift.
- **Revisit triggers:** concrete conditions that reopen the decision (evidence changes, scale thresholds, dependency EOL), not vague "revisit later".
- **Declined and deferred are first-class:** record them with reasons and revisit conditions - "declined, not forgotten".

## Supersession (authoring side)

- New record lists `supersedes:`; the old record gains `superseded-by:` plus a dated banner explaining **why** - especially when superseded outside its own revisit triggers.
- **Bodies are immutable.** The old record's text is history; only status, banner, and cross-references change.
- **Partial supersession** names exactly which statements/scope fell and which stand, on both records.
- Same-decision-different-places drift (log entry vs index row vs record status) is a validation finding; the record file is authoritative, indexes are regenerated.

## Escalation rule

Changes crossing a system-design seam (new datastore, tenancy model, external dependency, public contract, security model) require a decision record before implementation - this is step 6 of the change-tracking protocol.
