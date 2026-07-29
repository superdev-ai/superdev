#!/usr/bin/env node
/**
 * Provider registry - the canonical adapter contract for every external
 * capability Superdev orchestrates.
 *
 * WHAT THIS FILE IS: identity, ownership boundary, and the machine-checkable
 * parts of each adapter contract - how to DETECT a provider, how to probe its
 * readiness without side effects, where it is installed from, what consent its
 * installation needs, what a bounded context packet may contain, and what
 * evidence its output must carry.
 *
 * WHAT THIS FILE IS NOT: a copy of any provider's methodology. Superdev never
 * vendors, renames, reimplements, or approximates provider guidance. Each entry
 * records WHERE the capability lives and HOW to reach it - never what it says.
 * If a provider is absent, Superdev reports the truthful capability state and a
 * remediation plan; it never silently substitutes its own approximation.
 *
 * Identities below were VERIFIED against a live environment (installed plugin
 * records, marketplace sources, CLI/npm metadata) - never guessed. Anything that
 * could not be verified is marked `unresolved` and reported as such.
 */

/** Capability states (contract §21.1). */
export const CAPABILITY_STATES = [
  "available-and-ready", "installed-but-disabled", "installed-but-incompatible",
  "installed-but-unhealthy", "missing", "marketplace-unavailable", "policy-blocked",
  "authentication-required", "optional-and-absent", "unknown",
];
export const READY_STATES = new Set(["available-and-ready"]);

/** How a provider is delivered - determines detection and installation. */
export const DELIVERY = { CLAUDE_PLUGIN: "claude-plugin", AGENT_SKILL: "agent-skill", CLI: "cli" };

/** Failure classes every adapter maps its errors onto. */
export const FAILURE_CLASSES = [
  "not-installed", "disabled", "incompatible-version", "misconfigured",
  "unauthenticated", "invocation-error", "partial-output", "malformed-output",
  "timeout", "policy-blocked",
];

/**
 * The eight mandatory provider integrations. Each entry carries the complete
 * 15-element adapter contract. `identity` is the verified canonical identity.
 */
export const PROVIDERS = [
  {
    id: "superpowers",
    title: "Superpowers",
    // 1. canonical provider identity (VERIFIED)
    identity: { delivery: DELIVERY.CLAUDE_PLUGIN, plugin: "superpowers", marketplace: "claude-plugins-official", ref: "superpowers@claude-plugins-official" },
    // 2. ownership boundary
    ownership: "Externally owned by the claude-plugins-official marketplace. Superdev routes to it and consumes its outputs; it never reproduces its brainstorming, planning, TDD, debugging, review, or finishing methodology.",
    // 3. applicable intents
    intents: ["brainstorm", "plan", "implement-tdd", "debug", "review", "finish"],
    // 4. detection mechanism (read-only)
    detection: { kind: "claude-plugin-record", key: "superpowers@claude-plugins-official" },
    // 5. readiness probe (non-destructive)
    readiness: { kind: "skill-namespace", expect: "superpowers:", note: "the loaded session exposes superpowers:* skills" },
    // 6. installation source
    install: { marketplaceSource: { source: "github", repo: "anthropics/claude-plugins-official" }, command: "claude plugin install superpowers@claude-plugins-official", verified: true },
    // 7. consent requirements
    consent: { required: true, class: "install-plugin", prompt: "Install the Superpowers plugin from the claude-plugins-official marketplace?" },
    // 8. invocation contract
    invocation: { kind: "skill", pattern: "superpowers:<skill>", examples: ["superpowers:brainstorming", "superpowers:systematic-debugging", "superpowers:test-driven-development"], superdevNeverInlines: true },
    // 9. structured context packet (bounded - never the whole record)
    contextPacket: ["objective", "acceptedConstraints", "relevantDecisionIds", "openOwnerQuestionIds", "riskTier", "requiredRecordOutputs"],
    // 10. expected output / evidence contract
    output: { form: "narrative + artifacts authored into talks/", evidence: ["providerInvoked", "providerIdentity", "artifactPaths"], mustBeTraceable: true },
    // 11. failure classification
    failures: ["not-installed", "disabled", "incompatible-version", "invocation-error", "partial-output"],
    // 12. unavailable-provider behavior
    unavailable: "State plainly that Superpowers was unavailable, run Superdev's OWN gates (scope contract, spec depth, completion evidence), and record that the specialist methodology was not applied.",
    // 13. no-substitution behavior
    noSubstitution: "Superdev must not present its own gates as Superpowers' methodology, and must not claim brainstorming/TDD/debugging discipline it did not obtain from the provider.",
    // 14. privacy and secret boundary
    privacy: { sends: "bounded context packet only", never: ["raw talks/ tree", "secrets", "PII", "model-private reasoning"], screened: true },
    // 15. tests - see tests/integration/provider-contracts.test.mjs
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
  {
    id: "claude-mem",
    title: "Claude Mem",
    identity: { delivery: DELIVERY.CLAUDE_PLUGIN, plugin: "claude-mem", marketplace: "thedotmack", ref: "claude-mem@thedotmack" },
    ownership: "Externally owned (github thedotmack/claude-mem). A recall/search CACHE - never project authority.",
    intents: ["recall", "search-prior-work"],
    detection: { kind: "claude-plugin-record", key: "claude-mem@thedotmack" },
    readiness: { kind: "skill-namespace", expect: "claude-mem:", note: "the loaded session exposes claude-mem:* skills" },
    install: { marketplaceSource: { source: "github", repo: "thedotmack/claude-mem" }, command: "claude plugin install claude-mem@thedotmack", verified: true },
    consent: { required: true, class: "install-plugin", prompt: "Install the Claude Mem plugin from thedotmack/claude-mem?" },
    invocation: { kind: "skill", pattern: "claude-mem:<skill>", examples: ["claude-mem:mem-search"], superdevNeverInlines: true },
    contextPacket: ["narrowQuery", "timeWindow", "projectScope"],
    output: { form: "recalled observations", evidence: ["providerInvoked", "recallIds", "verificationStatus"], mustBeTraceable: true },
    failures: ["not-installed", "disabled", "invocation-error", "malformed-output", "partial-output"],
    unavailable: "Proceed from talks/ state and session summaries alone, and say that cross-session recall was unavailable.",
    // The critical authority rule for this provider.
    noSubstitution: "Recall is NEVER authority. Every recalled fact must be verified against current artifacts before consequential use, and recall-sourced claims must be labelled with their verification status.",
    privacy: { sends: "narrow query only", never: ["secrets", "PII", "whole-record dumps"], screened: true },
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
  {
    id: "frontend-design",
    title: "Frontend Design",
    identity: { delivery: DELIVERY.CLAUDE_PLUGIN, plugin: "frontend-design", marketplace: "claude-plugins-official", ref: "frontend-design@claude-plugins-official" },
    ownership: "Externally owned by the claude-plugins-official marketplace. Superdev never reproduces its design methodology or aesthetic system.",
    intents: ["frontend-direction", "component-implementation", "visual-design"],
    detection: { kind: "claude-plugin-record", key: "frontend-design@claude-plugins-official" },
    readiness: { kind: "skill-namespace", expect: "frontend-design:", note: "the loaded session exposes frontend-design:* skills" },
    install: { marketplaceSource: { source: "github", repo: "anthropics/claude-plugins-official" }, command: "claude plugin install frontend-design@claude-plugins-official", verified: true },
    consent: { required: true, class: "install-plugin", prompt: "Install the Frontend Design plugin from the claude-plugins-official marketplace?" },
    invocation: { kind: "skill", pattern: "frontend-design:<skill>", examples: ["frontend-design:frontend-design"], superdevNeverInlines: true },
    contextPacket: ["productContext", "userGoals", "designConstraints", "designSystemEvidence"],
    output: { form: "design direction + implementation", evidence: ["providerInvoked", "artifactPaths"], mustBeTraceable: true },
    failures: ["not-installed", "disabled", "incompatible-version", "invocation-error", "partial-output"],
    unavailable: "Report that the design specialist was unavailable; implement only what the accepted design system already specifies, and do not invent visual direction.",
    noSubstitution: "Superdev must not generate design direction and present it as the provider's, nor imitate its aesthetic methodology.",
    privacy: { sends: "bounded design context", never: ["secrets", "PII", "customer data"], screened: true },
    // Version was 'unknown' in the verified local install record - identity is
    // confirmed, the version constraint is not. Reported honestly, never guessed.
    versionResolution: "unresolved",
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
  {
    id: "impeccable",
    title: "Impeccable",
    identity: { delivery: DELIVERY.CLAUDE_PLUGIN, plugin: "impeccable", marketplace: "impeccable", ref: "impeccable@impeccable" },
    ownership: "Externally owned (github pbakaus/impeccable). Superdev never reproduces its UI critique/refinement methodology.",
    intents: ["ui-audit", "ui-polish", "design-critique", "accessibility-review"],
    detection: { kind: "claude-plugin-record", key: "impeccable@impeccable" },
    readiness: { kind: "skill-namespace", expect: "impeccable:", note: "the loaded session exposes impeccable:* skills" },
    install: { marketplaceSource: { source: "github", repo: "pbakaus/impeccable" }, command: "claude plugin install impeccable@impeccable", verified: true },
    consent: { required: true, class: "install-plugin", prompt: "Install the Impeccable plugin from pbakaus/impeccable?" },
    invocation: { kind: "skill", pattern: "impeccable:<skill>", examples: ["impeccable:impeccable"], superdevNeverInlines: true },
    contextPacket: ["surfaceUnderReview", "designSystemEvidence", "accessibilityRequirements", "knownConstraints"],
    output: { form: "critique + concrete refinements", evidence: ["providerInvoked", "surfaceRefs"], mustBeTraceable: true },
    failures: ["not-installed", "disabled", "incompatible-version", "invocation-error", "partial-output"],
    unavailable: "Report that the UI specialist was unavailable and limit work to the accepted design system; do not improvise a critique framework.",
    noSubstitution: "Superdev must not produce a UI critique and attribute it to Impeccable, nor imitate its refinement methodology.",
    privacy: { sends: "surface + design constraints", never: ["secrets", "PII", "user data in screenshots"], screened: true },
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
  {
    id: "find-skills",
    title: "Find Skills / skills.sh",
    // Delivered as an agent skill; the ecosystem CLI is `skills` on npm.
    identity: { delivery: DELIVERY.AGENT_SKILL, skill: "find-skills", cli: "skills", npm: "skills", ref: "find-skills (agent skill) + skills CLI" },
    ownership: "Externally owned (the open agent skills ecosystem / skills.sh). Superdev never reimplements skill discovery or the package manager.",
    intents: ["discover-capability", "install-skill"],
    // COMPOSITE: the discovery skill and the ecosystem CLI are BOTH required -
    // the skill without the CLI cannot install anything.
    components: [
      { id: "skill", kind: "agent-skill", skill: "find-skills", required: true },
      { id: "cli", kind: "cli", cli: "skills", versionArgs: ["--version"], required: true },
    ],
    detection: { kind: "composite", skill: "find-skills", alsoCli: "skills" },
    readiness: { kind: "cli-version", cli: "skills", args: ["--version"], note: "npx skills --version; the CLI is the ecosystem package manager" },
    install: { npm: "skills", command: "npx skills add <skill>", verified: true, note: "skill discovery/installation is the provider's own flow" },
    // The installation-flags rule is a hard safety boundary for this provider.
    consent: { required: true, class: "install-skill", prompt: "Install a skill through the skills CLI?", forbiddenFlags: ["--all", "-y", "--yes"] },
    invocation: { kind: "skill", pattern: "find-skills", examples: ["find-skills"], superdevNeverInlines: true },
    contextPacket: ["capabilityGap", "intent", "constraints"],
    output: { form: "candidate skills + install plan", evidence: ["providerInvoked", "candidateIds"], mustBeTraceable: true },
    failures: ["not-installed", "misconfigured", "invocation-error", "malformed-output", "partial-output"],
    unavailable: "State that skill discovery was unavailable and proceed with existing capabilities only; never fabricate a catalogue of skills.",
    noSubstitution: "Superdev must not present its own guesses as ecosystem search results, and must never install with --all or a silent -y.",
    privacy: { sends: "capability gap description", never: ["secrets", "PII", "proprietary code"], screened: true },
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
  {
    id: "task-observer",
    title: "Task Observer",
    identity: { delivery: DELIVERY.AGENT_SKILL, skill: "task-observer", repo: "rebelytics/one-skill-to-rule-them-all", ref: "task-observer (agent skill)" },
    ownership: "Externally owned (github rebelytics/one-skill-to-rule-them-all). Superdev never reproduces its observation taxonomy or skill-extraction methodology.",
    intents: ["observe-session", "capture-skill-opportunity"],
    detection: { kind: "agent-skill", skill: "task-observer" },
    readiness: { kind: "agent-skill-files", skill: "task-observer", expectFiles: ["SKILL.md"] },
    install: { source: { source: "github", repo: "rebelytics/one-skill-to-rule-them-all" }, command: "npx skills add task-observer", verified: true },
    consent: { required: true, class: "install-skill", prompt: "Install the Task Observer skill?", forbiddenFlags: ["--all", "-y", "--yes"] },
    invocation: { kind: "skill", pattern: "task-observer", examples: ["task-observer"], superdevNeverInlines: true },
    contextPacket: ["sessionObjective", "toolUsagePattern", "userCorrections"],
    output: { form: "observation log entries", evidence: ["providerInvoked", "observationIds"], mustBeTraceable: true },
    failures: ["not-installed", "misconfigured", "invocation-error", "partial-output", "malformed-output"],
    unavailable: "Record session outcomes through Superdev's own session summaries and state that observation capture was unavailable.",
    noSubstitution: "Superdev must not label its own session summary as Task Observer output or imitate its skill-extraction taxonomy.",
    privacy: { sends: "session outcome signals", never: ["secrets", "PII", "model-private reasoning"], screened: true },
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
  {
    id: "security-guidance",
    title: "Security Guidance",
    // Delivered as a plugin but invoked through hooks, not a skill namespace. It
    // registers a pattern warning on edits, a diff review on stop, and an agentic
    // commit reviewer. There is no SKILL.md to call, which is why the invocation
    // contract below is `hook` and not `skill`: routing to it means letting its
    // hooks run and reading what they say, never calling something.
    identity: { delivery: DELIVERY.CLAUDE_PLUGIN, plugin: "security-guidance", marketplace: "claude-plugins-official", ref: "security-guidance@claude-plugins-official" },
    ownership: "Externally owned by the claude-plugins-official marketplace, authored at Anthropic. Superdev routes security review to it and records what it found; it never reproduces its vulnerability classes, its patterns, or its judgement.",
    intents: ["security-review", "vulnerability-scan", "commit-review"],
    detection: { kind: "claude-plugin-record", key: "security-guidance@claude-plugins-official" },
    readiness: { kind: "plugin-hooks", expect: "hooks/hooks.json", note: "the plugin works through hooks rather than a skill, so readiness is the hook manifest being present" },
    install: { marketplaceSource: { source: "github", repo: "anthropics/claude-plugins-official" }, command: "claude plugin install security-guidance@claude-plugins-official", verified: true },
    consent: { required: true, class: "install-plugin", prompt: "Install the Security Guidance plugin from the claude-plugins-official marketplace?" },
    invocation: { kind: "hook", pattern: "its own PostToolUse and Stop hooks", examples: ["a warning on an edit", "a diff review when a turn ends", "the commit reviewer"], superdevNeverInlines: true },
    contextPacket: ["changedPaths", "riskTier", "relevantDecisionIds"],
    output: { form: "findings against the diff", evidence: ["providerInvoked", "findingCount", "severities"], mustBeTraceable: true },
    failures: ["not-installed", "disabled", "invocation-error", "timeout", "policy-blocked"],
    unavailable: "Say plainly that no security reviewer ran, and run the review skill's own security dimension instead while naming it as Superdev's own reading rather than a security review.",
    noSubstitution: "Superdev must never present its own security reading as this provider's output, and must never claim a change was security reviewed when only its own review dimension ran.",
  },
  {
    id: "envx",
    title: "envx",
    identity: { delivery: DELIVERY.CLI, cli: "envx", npm: "envx-cli", skill: "envx", ref: "envx-cli (CLI) + envx (agent skill)" },
    ownership: "Externally owned (envx-cli). Superdev never reimplements secret encryption, decryption, or injection.",
    intents: ["secret-management", "env-injection"],
    // COMPOSITE: the CLI does the work, the skill carries the safe-usage
    // contract. Either alone is only partially ready.
    components: [
      { id: "cli", kind: "cli", cli: "envx", versionArgs: ["--version"], required: true },
      { id: "skill", kind: "agent-skill", skill: "envx", required: true },
    ],
    detection: { kind: "composite", cli: "envx", alsoSkill: "envx" },
    readiness: { kind: "cli-version", cli: "envx", args: ["--version"] },
    install: { npm: "envx-cli", command: "npm install -g envx-cli", verified: true, note: "the skill installs via `envx skill add`" },
    consent: { required: true, class: "install-cli", prompt: "Install the envx CLI (envx-cli) globally?" },
    invocation: { kind: "cli", pattern: "envx <command>", examples: ["envx run", "envx skill add"], superdevNeverInlines: true },
    // The privacy boundary is the whole point of this provider.
    contextPacket: ["stageName", "requiredVariableNames"],
    output: { form: "marker presence / exit status only", evidence: ["providerInvoked", "stage"], mustBeTraceable: true },
    failures: ["not-installed", "misconfigured", "unauthenticated", "invocation-error", "policy-blocked"],
    unavailable: "Report that envx was unavailable and refuse to improvise secret handling; never read, print, or copy a decrypted secret.",
    noSubstitution: "Superdev must NEVER decrypt, read, echo, or re-implement secret handling itself. It detects marker presence only.",
    privacy: { sends: "variable NAMES only", never: ["secret values", "decrypted content", "passphrases"], screened: true, readsSecretValues: false },
    testsRef: "tests/integration/provider-contracts.test.mjs",
  },
];

/** Version policy, stated explicitly rather than implied.
 *  No provider declares a minimum version today: Superdev integrates through
 *  stable, documented surfaces (skill namespaces, CLI subcommands) and has no
 *  verified evidence of a breaking floor. `minVersion` is therefore absent, and
 *  detection reports versions WITHOUT claiming compatibility validation. Adding
 *  a `minVersion` to a registry entry activates real enforcement (tested). */
export const VERSION_POLICY = {
  enforced: false,
  statement: "No minimum version is asserted for any provider; detection reports the observed version and never implies a compatibility check that was not performed. Set `minVersion` on a registry entry to enforce one.",
};

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);
export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/** The 15 contract elements every provider entry must define. */
export const CONTRACT_ELEMENTS = [
  "identity", "ownership", "intents", "detection", "readiness", "install", "consent",
  "invocation", "contextPacket", "output", "failures", "unavailable", "noSubstitution",
  "privacy", "testsRef",
];

/** Which Superdev skill routes each intent to a provider (proactive routing). */
export const INTENT_ROUTING = {
  brainstorm: "superpowers", plan: "superpowers", "implement-tdd": "superpowers",
  debug: "superpowers", review: "superpowers", finish: "superpowers",
  recall: "claude-mem", "search-prior-work": "claude-mem",
  "frontend-direction": "frontend-design", "component-implementation": "frontend-design", "visual-design": "frontend-design",
  "ui-audit": "impeccable", "ui-polish": "impeccable", "design-critique": "impeccable", "accessibility-review": "impeccable",
  "discover-capability": "find-skills", "install-skill": "find-skills",
  "observe-session": "task-observer", "capture-skill-opportunity": "task-observer",
  "secret-management": "envx", "env-injection": "envx",
};
