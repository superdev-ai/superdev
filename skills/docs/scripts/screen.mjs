/**
 * Source-material screening (library, not a CLI): secret-shaped values,
 * credential URLs, key material, PII shapes, prompt-injection shapes,
 * executable-instruction shapes, and unsupported authority claims.
 *
 * Defense in depth, stated honestly: these detectors are tripwires that catch
 * known shapes - they do not prove absence. The PRIMARY control is structural:
 * ingested content is never executed and never treated as instructions,
 * whether or not a detector fires.
 *
 * Safety: findings carry stable codes, severity, and span coordinates.
 * Sensitive matches (secrets/PII) NEVER include the matched excerpt; injection
 * and authority matches may carry a short quoted excerpt as evidence - they are
 * quotes of untrusted data, never directives.
 */

const SENSITIVE_RULES = [
  { code: "SCR-KEY", severity: "P0", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { code: "SCR-SECRET", severity: "P0", re: /\b[A-Za-z0-9_]*(?:password|passwd|secret|token|api[_-]?key|credential)[A-Za-z0-9_]*s?\s*[:=]\s*["']?[^\s"']{6,}/i },
  { code: "SCR-URLCRED", severity: "P0", re: /:\/\/[^/\s:@]+:[^@\s]{4,}@/ },
  { code: "SCR-JWT", severity: "P0", re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  { code: "SCR-PII-EMAIL", severity: "P1", re: /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net))[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { code: "SCR-PII-PHONE", severity: "P1", re: /(?:^|\s)\+?\d{1,3}[-. (]{1,2}\d{3}[-. )]{1,2}\d{3}[-. ]?\d{4}\b/ },
];

const EVIDENCE_RULES = [
  { code: "SCR-INJECT", severity: "P0", re: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|disregard\s+(?:your|all)\s+(?:instructions|rules)|you\s+are\s+now\s+(?:a|an|in)\b|<\/?system>|\[system\]|jailbreak/i },
  { code: "SCR-EXEC", severity: "P0", re: /^\s*(?:\$|#|>)\s*(?:rm|curl|wget|bash|sh|eval|sudo)\b|```(?:bash|sh|shell)[\s\S]{0,40}\b(?:rm -|curl |wget )|"tool_call"|"function_call"|<tool_use>/im },
  { code: "SCR-AUTHORITY", severity: "P1", re: /\b(?:the\s+)?(?:CEO|CTO|CFO|legal(?:\s+team)?|compliance(?:\s+team)?|board)\s+(?:has\s+)?(?:decided|approved|requires|mandated|signed\s+off)|\blegally\s+required\b|\bregulation\s+requires\b/i },
];

/** Screen text; returns findings with line/span coordinates. Sensitive rules
 *  never echo the excerpt; evidence rules carry a bounded quote. */
export function screenText(text) {
  const findings = [];
  const lines = text.split("\n");
  let offset = 0;
  lines.forEach((line, i) => {
    for (const rule of SENSITIVE_RULES) {
      const m = rule.re.exec(line);
      if (m) findings.push({ code: rule.code, severity: rule.severity, line: i + 1, span: { start: offset + m.index, length: m[0].length } });
      rule.re.lastIndex = 0;
    }
    for (const rule of EVIDENCE_RULES) {
      const m = rule.re.exec(line);
      if (m)
        findings.push({
          code: rule.code, severity: rule.severity, line: i + 1,
          span: { start: offset + m.index, length: m[0].length },
          quotedEvidence: m[0].slice(0, 120),
        });
      rule.re.lastIndex = 0;
    }
    offset += line.length + 1;
  });
  // Multi-line EXEC shapes (fenced blocks) checked against the whole text once.
  const fence = /```(?:bash|sh|shell)[\s\S]{0,200}?```/g;
  let fm;
  while ((fm = fence.exec(text))) {
    if (/\b(?:rm -rf|curl |wget |sudo )/.test(fm[0]))
      findings.push({ code: "SCR-EXEC", severity: "P0", line: text.slice(0, fm.index).split("\n").length, span: { start: fm.index, length: fm[0].length }, quotedEvidence: "fenced shell block with destructive/network commands" });
  }
  return findings;
}

const BINARY_EXTENSIONS = new Set([".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".class", ".jar", ".wasm", ".app", ".msi", ".sh", ".bat", ".cmd", ".ps1"]);
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024; // boundary, reported not guessed

// Codes whose matched value is sensitive and must NEVER be excerpted, stored,
// or echoed anywhere (secrets AND PII - the latter is P1 by report severity but
// sensitive for persistence). Injection/exec/authority are NOT here: those are
// facts about source data, carried as bounded quoted evidence.
export const SENSITIVE_CODES = new Set(["SCR-KEY", "SCR-SECRET", "SCR-URLCRED", "SCR-JWT", "SCR-PII-EMAIL", "SCR-PII-PHONE"]);

/** True if a text value carries any sensitive (secret/PII) shape. */
export function hasSensitive(text) {
  return screenText(String(text)).some((f) => SENSITIVE_CODES.has(f.code));
}

/** Intake safety on raw bytes: executables/unsupported/oversize/malformed. */
export function screenIntake(name, buf) {
  const findings = [];
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) findings.push({ code: "SCR-EXECUTABLE", severity: "P0", detail: "executable or script file - rejected from extraction; never executed" });
  if (buf.length > MAX_SOURCE_BYTES) findings.push({ code: "SCR-OVERSIZE", severity: "P1", detail: `exceeds ${MAX_SOURCE_BYTES} byte boundary` });
  const probe = buf.subarray(0, 8000);
  if (probe.includes(0)) findings.push({ code: "SCR-BINARY", severity: "P1", detail: "binary content - inventoried but not extracted" });
  else {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(probe);
    } catch {
      findings.push({ code: "SCR-ENCODING", severity: "P1", detail: "malformed text encoding - inventoried but not extracted" });
    }
  }
  return findings;
}
