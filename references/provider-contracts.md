# External Provider Contracts

Superdev orchestrates specialist capabilities through explicit adapters. It never duplicates a provider's methodology, never vendors provider instructions, never renames external capability as first-party, and never silently substitutes a lower-quality approximation when a provider is missing. Provider absence produces a truthful capability state and a remediation plan.

## Adapter contract (every provider defines all fifteen)

1. Canonical provider identity (verified, never guessed)
2. Ownership boundary (always external)
3. Applicable intents
4. Detection mechanism (read-only)
5. Readiness probe (non-destructive)
6. Installation source
7. Consent requirements
8. Invocation contract
9. Structured context packet (bounded - only what the task needs)
10. Expected output / evidence contract
11. Failure classification
12. Unavailable-provider behavior (truthful degradation, never imitation)
13. No-substitution behavior
14. Privacy and secret boundary
15. Tests

The machine-checkable form of all fifteen lives in `scripts/providers/registry.mjs`; it records **where** a capability lives and **how** to reach it, never what the provider says.

## Verified provider identities

Identities below were verified against a live environment (plugin install records, marketplace sources, CLI/npm metadata). A version that could not be resolved is reported `unresolved` - never assumed.

| Provider | Delivery | Canonical identity | Installation source |
|---|---|---|---|
| Superpowers | Claude plugin | `superpowers@claude-plugins-official` | github `anthropics/claude-plugins-official` |
| Claude Mem | Claude plugin | `claude-mem@thedotmack` | github `thedotmack/claude-mem` |
| Frontend Design | Claude plugin | `frontend-design@claude-plugins-official` | github `anthropics/claude-plugins-official` |
| Impeccable | Claude plugin | `impeccable@impeccable` | github `pbakaus/impeccable` |
| Find Skills / skills.sh | Agent skill + CLI | `find-skills` skill · `skills` CLI | npm `skills` (`npx skills add <skill>`) |
| Task Observer | Agent skill | `task-observer` | github `rebelytics/one-skill-to-rule-them-all` |
| envx | CLI + agent skill | `envx` CLI (`envx-cli`) · `envx` skill | npm `envx-cli` |

## Engine

- **Detect / readiness:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/providers/detect.mjs" detect --root <project> --json` - read-only capability state per provider (it installs, enables, configures, and invokes nothing). Exit 1 when any provider is not ready.
- **Contract:** `... detect.mjs contract [--provider <id>]` - the adapter contract itself.
- **Adapter runtime:** `scripts/providers/adapter.mjs` - `buildContextPacket` (bounded + screened; refuses any field outside the contract), `classifyOutcome` (success / partial-output / malformed-output / invocation-error, credited only with the contracted evidence), `assertNoSubstitution` (refuses to present work as a provider's methodology unless it genuinely ran), `installationPlan` (consent-gated; refuses `--all` / `-y` / `--yes`).

## Capability states

Available-and-ready · Installed-but-disabled · Installed-but-incompatible · Installed-but-unhealthy · Missing · Marketplace-unavailable · Policy-blocked · Authentication-required · Optional-and-absent · Unknown.

The capability lock (`talks/state/capabilities.lock.json`) records identity, source, version, constraint, scope, harness, license, trust status, readiness, last-verified, and verification method. The lock is a record, not proof - the doctor rechecks live state.

## Providers

### Brainstorming, planning, TDD, debugging, review, finishing - Superpowers
- **Route when:** behavior is new/ambiguous; designs compete; plans are needed after spec approval; bugs need systematic root-cause work; substantial work needs review or completion discipline.
- **Context packet:** accepted project context, relevant decisions, constraints, known users, open owner questions, risk tier, required record outputs. Never the entire `talks/` tree.
- **Return contract:** results feed an approved record artifact (spec, plan, decision), never an isolated file with no traceability. Superdev verifies the provider skill was actually available and invoked before crediting its methodology.
- **Fallback:** run Superdev's own gates (scope contract, spec depth, completion evidence) and state plainly that the specialist provider was unavailable.

### Cross-session recall - Claude Mem
- **Role:** recall/search cache. Never project authority.
- **Use:** query narrowly for prior context; verify every returned fact against current artifacts before consequential use; label recall-sourced claims and their verification status.
- **Fallback:** proceed from `talks/` state and session summaries alone.

### Frontend direction and implementation - Frontend Design
- **Context packet:** product context, user goals, design constraints, current design-system evidence.
- **Return contract:** implementation traced to the UI contract (below); visual evidence retained.

### UI critique, accessibility, interaction quality - Impeccable
- **Route:** after or alongside frontend design; verify states and visual behavior.
- **UI contract per interactive element:** surface · location · label/icon · purpose · user/role · permission · precondition · action · input/validation · API or local effect · loading · disabled · success · empty · error · offline · confirmation · side effects · keyboard behavior · accessible name · focus behavior · responsive behavior · telemetry (only if approved) · acceptance tests · visual evidence. Real browser or platform-visible validation whenever possible - headless alone does not prove interaction quality.

### Domain-skill discovery - Find Skills / skills.sh
- **Flow:** search → inspect source and contents → check license, maintenance, compatibility (popularity is supporting evidence only) → evaluate permissions and scripts → present exact candidate, source, scope, risk → ask before installing when approval is required → pin identity in the capability lock → verify activation in a clean session.
- **Never** install from a search result alone; never pass bulk/consent-skipping install flags.

### Methodology observation - Task Observer
- **Boundary:** owns reusable skill-improvement memory, not project requirements memory. Activates independently where configured (structural activation - never chained through another skill). Project facts stay out of shared methodology observations; its log is never project authority.

### Secret-safe environments - envx
- **Detect:** marker files (encrypted stage files, `.envxrc`) - presence checks only.
- **Use:** prefer `envx run -e <stage> -- <command>` over decrypting; name variables without printing values; never commit plaintext stages; distinguish missing-access from application failure.
- **Fallback:** conventional env handling with the same no-printing rules.

## Mandatory attribution (no silent outcome)

Every routed pass reports its provider outcome **explicitly, in both directions**. Reporting only failures is not enough: if a run is silent when a provider *was* used and silent when it was *skipped*, the two cases are indistinguishable, and unattributed Superdev-owned work reads as the specialist's. Silence is the failure mode this rule exists to remove.

For each specialist pass a workflow routes, state exactly one of:

1. **Ran** - name the provider and the identity actually detected, including version when detection reports one: *"design direction via frontend-design (ready, v2.1.0)"*. Never name a provider whose identity was not verified against the detected installation.
2. **Did not run** - name the provider and the concrete reason: not installed, disabled, incompatible, blocked on a precondition, or awaiting consent. Give the remediation.
3. **Not applicable** - the task did not call for that pass.

Work done by Superdev while a provider did not run is labelled as Superdev's own and is never presented as the provider's output. Attribution is claimable only when the adapter issued a verified-credit outcome; a provider that was never invoked is never credited, and a provider whose detected identity disagrees with the registry entry is reported as unverified rather than named.

## Boundary rules (all providers)

- Never surface an install or setup command carrying a broad-consent flag (`--all`, `-y`, `--yes`, or an equivalent), including when relaying one verbatim from a registry listing, provider output, or README. Strip the flag and let the confirmation stand - a quoted command is a recommended command.
- Handoffs include only the context the task requires.
- Installation does not equal activation; activation does not equal readiness - probe before relying.
- Version-verify before representing external behavior as guaranteed.
- Critical workflows never depend on one skill invoking another merely for activation: discovery comes from skill descriptions, project instructions, session-start integration where supported, and explicit commands. A broken chain must not silence safety, observation, or project-state behavior.
