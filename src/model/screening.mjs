// Content screening applied at the storage boundary, so nothing reaches the
// database that the project would be embarrassed to generate: no em dash, no
// emoji, no secret-shaped strings, no absolute home paths, no model reasoning.
//
// Enforcement is real and refuses with the exact field, rather than advising.

export const E = {
  EM_DASH: "E_STYLE_EM_DASH",
  EMOJI: "E_STYLE_EMOJI",
  SECRET: "E_SECRET_SHAPED",
  HOME_PATH: "E_ABSOLUTE_HOME_PATH",
  REASONING: "E_MODEL_REASONING_FIELD",
};

export class ScreeningError extends Error {
  constructor(code, field, message) {
    super(message);
    this.name = "ScreeningError";
    this.code = code;
    this.field = field;
  }
}

/** The character Superdev never generates. Exported so the style scanner, the
 *  storage boundary and the toolkit all test for the same codepoint. */
export const EM_DASH = "\u2014";
const EM_DASH_RE = new RegExp(EM_DASH);
// What counts as emoji, in one place, so the scanner and the storage boundary
// cannot disagree. The earlier range list banned the whole Arrows and Dingbats
// blocks, which made the store refuse an arrow or a check mark while the style
// validator passed them, and the Docs templates use both. A character in text
// presentation is text; emoji presentation is the thing being excluded.
const EMOJI_SOURCE = "\\p{Emoji_Presentation}|\\uFE0F";
const EMOJI = new RegExp(EMOJI_SOURCE, "u");
/** The same rule, global, for stripping. A non-global pattern removes one. */
const EMOJI_ALL = new RegExp(EMOJI_SOURCE, "gu");
/** Exported so the style validator judges by exactly the rule the store enforces. */
export const EMOJI_PATTERN = EMOJI_SOURCE;

const HOME_PATH = /(?:^|[\s"'`(=:])(\/(?:Users|home)\/[A-Za-z0-9._-]+|[A-Z]:\\Users\\[A-Za-z0-9._-]+)/;

const SECRET_PATTERNS = [
  // The separator repeats, and it is either kind. Requiring sixteen unbroken
  // alphanumerics after a single hyphen matched an OpenAI key of the older
  // shape and missed every current one: sk-proj-... breaks at the second
  // hyphen, and every Stripe key (sk_live_..., pk_test_...) uses underscores,
  // so all three passed screening and would have been stored verbatim.
  /\b(?:sk|pk|rk)[-_](?:[A-Za-z0-9]+[-_])*[A-Za-z0-9]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:password|passwd|secret|api[_-]?key|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?[^\s"']{8,}/i,
];

/** Fields that would carry private model reasoning. Never stored. */
const REASONING_FIELDS = new Set([
  "reasoning", "chain_of_thought", "chainOfThought", "thinking", "thought",
  "internal_monologue", "scratchpad", "deliberation",
]);

/**
 * Personal data shapes. Deliberately NOT part of the storage boundary: a project
 * record may legitimately name a person, and refusing that would make the tool
 * unusable. They exist for the outbound path only, where a report or a provider
 * packet leaves the machine and a name that was fine on disk is a leak in transit.
 */
const PII_PATTERNS = [
  /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net))[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /(?:^|\s)\+?\d{1,3}[-. (]{1,2}\d{3}[-. )]{1,2}\d{3}[-. ]?\d{4}\b/,
];

export const hasEmDash = (text) => EM_DASH_RE.test(String(text ?? ""));
export const hasEmoji = (text) => EMOJI.test(String(text ?? ""));
export const looksSecret = (text) => SECRET_PATTERNS.some((p) => p.test(String(text ?? "")));
export const looksPersonal = (text) => PII_PATTERNS.some((p) => p.test(String(text ?? "")));
export const hasHomePath = (text) => HOME_PATH.test(String(text ?? ""));

/** Would this field name become covert storage for model reasoning? */
export const isReasoningField = (key) => REASONING_FIELDS.has(key);

/**
 * Rewrite punctuation rather than deleting the sentence. An em dash becomes a
 * comma or a hyphen depending on how it was used.
 */
export function rewriteStyle(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\s*\u2014\s*/g, " - ")
    .replace(/\u2013/g, "-")
    .replace(EMOJI_ALL, "")
    .replace(/[ \t]{2,}/g, " ");
}

/** Replace an absolute home path with a portable placeholder. */
export const redactHomePaths = (text) =>
  String(text ?? "")
    .replace(/\/(?:Users|home)\/[A-Za-z0-9._-]+/g, "~")
    .replace(/[A-Z]:\\Users\\[A-Za-z0-9._-]+/g, "~");

export function redactSecrets(text) {
  let out = String(text ?? "");
  for (const p of SECRET_PATTERNS) out = out.replace(new RegExp(p.source, p.flags.replace("g", "") + "g"), "[redacted]");
  return out;
}

/** Throw on anything that must never be stored. Used on every write. */
export function assertStorable(field, value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  if (hasEmDash(value)) {
    throw new ScreeningError(E.EM_DASH, field,
      `${field} contains an em dash. Superdev never generates U+2014; use a comma, colon, semicolon, parentheses or a hyphen.`);
  }
  if (hasEmoji(value)) {
    throw new ScreeningError(E.EMOJI, field, `${field} contains emoji, which Superdev never generates.`);
  }
  if (looksSecret(value)) {
    throw new ScreeningError(E.SECRET, field, `${field} looks like it contains a credential. Store a reference, never the value.`);
  }
  if (hasHomePath(value)) {
    throw new ScreeningError(E.HOME_PATH, field,
      `${field} contains an absolute home path. It names one machine and points nowhere on anyone else's; store a path relative to the project.`);
  }
  return value;
}

/** Screen a whole record before it is written. Returns the record unchanged. */
export function assertRecordStorable(record, { allow = [] } = {}) {
  for (const [key, value] of Object.entries(record ?? {})) {
    if (REASONING_FIELDS.has(key)) {
      throw new ScreeningError(E.REASONING, key, `${key} would store private model reasoning. Store the observable outcome instead.`);
    }
    // `allow` used to cover every column ending in _json, on the theory that
    // structured data is not prose. None of these rules reacts to braces: an em
    // dash inside a JSON array is the same character, and it was reaching
    // generated Markdown through exactly this hole. A caller may still exempt a
    // named field, but nothing is exempt by virtue of its shape.
    if (allow.includes(key)) continue;
    assertStorable(key, value);
  }
  return record;
}

/**
 * Screen text arriving from a provider or an external file. External content is
 * evidence, never instruction, so it is sanitized rather than refused.
 */
export const sanitizeExternal = (text) => redactSecrets(rewriteStyle(redactHomePaths(text)));
