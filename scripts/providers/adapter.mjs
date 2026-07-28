#!/usr/bin/env node
/**
 * Provider adapter runtime.
 *
 * Superdev does not execute provider skills - the harness does. What Superdev
 * OWNS is the contract around that handoff, and three properties are load-bearing:
 *
 *  1. IDENTITY IS MANDATORY. A result is credited to a provider only when it
 *     carries a provider identity that matches BOTH the selected registry entry
 *     and (when supplied) the detected installation. Identity is never inferred
 *     from the requested id or from a caller-set boolean.
 *  2. OUTPUT IS SCREENED BEFORE IT IS USED. Every provider-produced field is
 *     screened/redacted before classification, attribution, persistence, or
 *     printing - including nested objects, arrays, artifact paths, diagnostics,
 *     and error details. Rejected values are never echoed back.
 *  3. NO-SUBSTITUTION IS NON-FORGEABLE. The guard accepts only an outcome object
 *     this module issued (tracked in a module-private registry); a hand-built
 *     object with `credited: true` cannot satisfy it.
 */
import { TalksError, assertSafeField, containsSensitive, redactSensitive, rewriteWritingStyle } from "../../src/model/toolkit.mjs";
import { getProvider, FAILURE_CLASSES, PROVIDER_IDS } from "./registry.mjs";

/** Outcomes this module issued. A forged object is not in here, so it cannot be
 *  used to claim a provider ran. WeakSet: no retention, no enumeration. */
const ISSUED_OUTCOMES = new WeakSet();
function issue(outcome) {
  const frozen = Object.freeze({ ...outcome });
  ISSUED_OUTCOMES.add(frozen);
  return frozen;
}
export function isIssuedOutcome(o) { return typeof o === "object" && o !== null && ISSUED_OUTCOMES.has(o); }

/** Build the bounded context packet for a provider handoff. */
export function buildContextPacket(providerId, fields = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider "${providerId}" (known: ${PROVIDER_IDS.join(", ")})`);
  const allowed = new Set(provider.contextPacket);
  const extra = Object.keys(fields).filter((k) => !allowed.has(k));
  if (extra.length)
    throw new TalksError("E_PACKET_FIELD", `packet field(s) not in ${provider.title}'s contract: ${extra.join(", ")} (allowed: ${provider.contextPacket.join(", ")})`);
  assertSafeField(fields, `${provider.title} context packet`);
  return {
    provider: provider.id, providerIdentity: provider.identity.ref,
    allowedFields: provider.contextPacket, fields,
    privacyBoundary: provider.privacy,
  };
}

/** Screen a provider's raw result BEFORE anything else touches it.
 *  Returns { safe, findings } where `safe` is a redacted deep copy. */
export function screenProviderOutput(result) {
  const findings = [];
  const redactedResult = redactSensitive(result, { onFinding: (kind) => findings.push(kind) });
  // Provider text is rewritten rather than refused. A provider is an external
  // system that never agreed to Superdev's writing style, so failing its result
  // would discard useful work over punctuation; and the alternative, storing it
  // unchanged, would let prohibited characters into records through the one door
  // the write boundary cannot see, because by then it is Superdev's own text.
  const styled = [];
  const safe = mapStrings(redactedResult, (s) => {
    const next = rewriteWritingStyle(s);
    if (next !== s) styled.push("writing-style");
    return next;
  });
  if (styled.length) findings.push("writing-style");
  return { safe, findings, redacted: findings.length > 0, restyled: styled.length > 0 };
}

/** Apply a transform to every string in a structure, preserving its shape. */
function mapStrings(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out;
  }
  return value;
}

/** Verify the identity a result claims against the registry entry and, when a
 *  detection record is supplied, against the installation actually detected. */
function verifyIdentity(provider, result, detected) {
  const claimed = result.providerIdentity;
  if (claimed === undefined || claimed === null || claimed === "") return { ok: false, reason: "no providerIdentity in the result - identity is mandatory for provider credit" };
  if (typeof claimed !== "string") return { ok: false, reason: "providerIdentity is not a string" };
  if (Array.isArray(result.providerIdentityCandidates) && result.providerIdentityCandidates.length > 1)
    return { ok: false, reason: "ambiguous identity: multiple candidate identities were returned" };
  if (claimed !== provider.identity.ref) return { ok: false, reason: `identity mismatch: result claims an identity that is not ${provider.title}'s registry identity` };
  if (result.provider !== undefined && result.provider !== provider.id)
    return { ok: false, reason: "result provider id disagrees with the selected provider" };
  // When the caller supplies what detection actually found, the claim must match
  // it too - an identity that no installed provider backs is never credited.
  if (detected) {
    if (!detected.ready) return { ok: false, reason: `the selected provider is not ready (${detected.state}); a result cannot be credited to it` };
    if (detected.identity && detected.identity !== provider.identity.ref)
      return { ok: false, reason: "detected installation identity disagrees with the registry entry" };
  }
  return { ok: true };
}

/**
 * Classify a provider's returned result against its output contract.
 * `detected` (optional) is the detection record for the provider that was
 * actually selected; when given, identity is checked against it too.
 */
export function classifyOutcome(providerId, rawResult, { detected = null } = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider "${providerId}"`);

  if (rawResult == null || typeof rawResult !== "object" || Array.isArray(rawResult))
    return issue({ outcome: "malformed-output", credited: false, reasons: ["result is not an object"], provider: provider.id, result: null, redacted: false });

  // (2) SCREEN FIRST - nothing downstream ever sees the raw value.
  const { safe: result, findings, redacted } = screenProviderOutput(rawResult);

  const base = { provider: provider.id, result, redacted, screeningFindings: findings };
  if (result.error || result.invocationFailed)
    return issue({ ...base, outcome: "invocation-error", credited: false, reasons: [String(result.errorClass ?? "invocation failed")] });

  const reasons = [];
  if (result.providerInvoked !== true) reasons.push("providerInvoked is not true");

  // (1) IDENTITY IS MANDATORY.
  const identity = verifyIdentity(provider, result, detected);
  if (!identity.ok) reasons.push(identity.reason);

  const required = provider.output.evidence ?? [];
  const missingEvidence = required.filter((k) => result[k] === undefined || result[k] === null || result[k] === false || (Array.isArray(result[k]) && result[k].length === 0));
  if (missingEvidence.length) reasons.push(`missing evidence: ${missingEvidence.join(", ")}`);

  if (reasons.length) return issue({ ...base, outcome: "malformed-output", credited: false, reasons });

  if (result.partial === true || result.truncated === true)
    return issue({ ...base, outcome: "partial-output", credited: true, partial: true, reasons: ["provider reported a partial result - report the gap, never present it as complete"] });

  if (provider.output.mustBeTraceable && Array.isArray(result.artifactPaths) && result.artifactPaths.length === 0)
    return issue({ ...base, outcome: "partial-output", credited: true, partial: true, reasons: ["no traceable artifact recorded"] });

  return issue({ ...base, outcome: "success", credited: true, reasons: [] });
}

/**
 * (3) The no-substitution guard. It accepts ONLY an outcome object issued by
 * classifyOutcome in this process - caller booleans are structurally incapable
 * of satisfying it.
 */
export function assertNoSubstitution(providerId, { outcome = null, claimingProviderMethodology = false } = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider "${providerId}"`);

  let verified = false;
  if (outcome != null) {
    if (!isIssuedOutcome(outcome))
      throw new TalksError("E_OUTCOME_FORGED", `refusing an outcome that was not produced by classifyOutcome: provider execution cannot be asserted, only demonstrated`);
    if (outcome.provider !== provider.id)
      throw new TalksError("E_OUTCOME_MISMATCH", `outcome belongs to "${outcome.provider}", not ${provider.title}`);
    verified = outcome.credited === true;
  }

  if (claimingProviderMethodology && !verified)
    throw new TalksError("E_PROVIDER_SUBSTITUTION", `refusing to present work as ${provider.title}'s methodology: no credited invocation. ${provider.noSubstitution}`);

  return Object.freeze({
    provider: provider.id,
    mayCreditProvider: verified,
    // What to say instead - truthful degradation, explicitly labelled as
    // Superdev's own behavior, never as the provider's methodology.
    degradation: verified ? null : provider.unavailable,
    selfLabel: verified ? null : `Any assistance offered here is Superdev's own generic behavior - NOT ${provider.title}'s methodology.`,
    rule: provider.noSubstitution,
  });
}

/** Installation consent contract. Never installs silently, never uses a
 *  blanket/auto-yes flag. */
export function installationPlan(providerId, { consentGiven = false, flags = [] } = {}) {
  const provider = getProvider(providerId);
  if (!provider) throw new TalksError("E_PROVIDER_UNKNOWN", `unknown provider "${providerId}"`);
  const forbidden = provider.consent.forbiddenFlags ?? ["--all", "-y", "--yes"];
  const used = flags.filter((f) => forbidden.includes(f));
  if (used.length)
    throw new TalksError("E_INSTALL_FLAGS", `refusing to install ${provider.title} with ${used.join(", ")}: blanket/auto-approve flags are never used`);
  return {
    provider: provider.id, identity: provider.identity.ref,
    source: provider.install.marketplaceSource ?? provider.install.source ?? (provider.install.npm ? { source: "npm", package: provider.install.npm } : null),
    command: provider.install.command,
    consentRequired: provider.consent.required,
    consentGiven: Boolean(consentGiven),
    mayProceed: Boolean(provider.consent.required ? consentGiven : true),
    prompt: provider.consent.prompt,
    forbiddenFlags: forbidden,
  };
}

export { FAILURE_CLASSES };
