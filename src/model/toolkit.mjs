/**
 * Shared safety layer for the command line surfaces.
 *
 * Extracted verbatim from the record engine that used to own it, because the
 * guarantees below are the reason the surrounding commands are safe to run and
 * rewriting them for tidiness would be a security change disguised as a cleanup:
 *
 *  - root confinement: every path an operation touches is validated against the
 *    project root (absolute inputs rejected, drive letters rejected, ".."
 *    rejected, symlink escapes rejected) BEFORE any read or write
 *  - atomic writes: content lands via temp file, fsync, rename, directory fsync,
 *    so a crash leaves either the old file or the new one, never a torn one
 *  - deterministic serialization: stable key order and a trailing newline, so
 *    reruns produce byte-identical files
 *  - one shared refusal type, so a CLI can tell an expected refusal from a bug
 *
 * The screening and writing style rules are NOT implemented here. They live in
 * screening.mjs, which is the storage boundary, and this file only adapts them
 * to the shapes the command line callers use (whole structures rather than one
 * field). Two implementations of "what counts as a secret" is how a rule quietly
 * stops matching in one of the places it is enforced.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  EM_DASH,
  isReasoningField,
  looksPersonal,
  looksSecret,
  redactHomePaths,
  rewriteStyle,
} from "./screening.mjs";

export class SuperdevError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Callers written against the previous name keep working unchanged. */
export { SuperdevError as TalksError };

/** Realpath-safe main-module check (Node realpaths the entry module URL). */
export function isMain(importMetaUrl) {
  try {
    return Boolean(process.argv[1]) && importMetaUrl === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

/** Resolve a project root: must exist, be a directory; returns its realpath. */
export function resolveRoot(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
    throw new SuperdevError("E_ROOT", `root is not a directory: ${root}`);
  return fs.realpathSync(root);
}

/**
 * Resolve a project-relative path safely. Rejects absolute paths, drive-letter
 * paths, ".." segments, resolution outside the root, and symlink escapes of any
 * existing ancestor. Returns the absolute confined path.
 */
export function safeResolve(rootReal, rel) {
  const v = String(rel);
  if (path.isAbsolute(v) || /^[A-Za-z]:[\\/]/.test(v))
    throw new SuperdevError("E_PATH_ABSOLUTE", `absolute path rejected: field-controlled path`);
  if (v.split(/[\\/]/).some((seg) => seg === ".."))
    throw new SuperdevError("E_PATH_TRAVERSAL", `path traversal rejected`);
  const resolved = path.resolve(rootReal, v);
  if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep))
    throw new SuperdevError("E_PATH_OUTSIDE", `path resolves outside root`);
  // Walk existing ancestors: none may realpath outside the root.
  let probe = resolved;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const real = fs.realpathSync(probe);
  if (real !== rootReal && !real.startsWith(rootReal + path.sep))
    throw new SuperdevError("E_PATH_SYMLINK", `symlink escape rejected`);
  return resolved;
}

/** Interrupted-migration guard shared by every mutating command. The journal is
 *  written next to the store it belongs to and removed when the migration
 *  finishes, so its presence means a migration stopped part way through. */
export function migrationJournalPath(rootReal) {
  return path.join(rootReal, ".superdev", ".migration-journal.json");
}

export function assertNotInterrupted(rootReal) {
  if (fs.existsSync(migrationJournalPath(rootReal)))
    throw new SuperdevError(
      "E_MIGRATION_INTERRUPTED",
      "an interrupted migration journal exists; complete or restore it before mutating the record"
    );
}

/** Deterministic serialization: known keys in declared order first, remaining
 *  keys alphabetically, 2-space indent, trailing newline. */
export function stableStringify(value, preferredOrder = []) {
  const order = (obj) => {
    if (Array.isArray(obj)) return obj.map(order);
    if (obj && typeof obj === "object") {
      // Null prototype + hasOwn: fields named after Object.prototype members
      // (toString, constructor, __proto__ and the rest) survive serialization intact.
      const out = Object.create(null);
      for (const k of preferredOrder) if (Object.hasOwn(obj, k)) out[k] = order(obj[k]);
      for (const k of Object.keys(obj).sort()) if (!Object.hasOwn(out, k)) out[k] = order(obj[k]);
      return out;
    }
    return obj;
  };
  return JSON.stringify(order(value), null, 2) + "\n";
}

/** Best-effort directory-entry durability (no-op where dirs cannot be fsynced,
 *  e.g. Windows). Scopes the durability claim: process-crash safety is
 *  guaranteed by construction; power-loss safety is best-effort via dir fsync. */
function fsyncDir(dir) {
  try {
    const fd = fs.openSync(dir, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    /* platform without directory fsync */
  }
}

/** Atomic write: temp file in the target directory, fsync, rename, dir fsync.
 *  Rename retries on EPERM (Windows: a concurrent reader briefly holding the
 *  target open makes rename flake; short bounded retry is the known remedy). */
export function atomicWrite(file, content) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, file);
      break;
    } catch (e) {
      if (e.code === "EPERM" && attempt < 4) {
        const until = Date.now() + 15;
        while (Date.now() < until); // bounded busy-wait; sync CLI context
        continue;
      }
      fs.rmSync(tmp, { force: true });
      throw e;
    }
  }
  fsyncDir(dir);
}

/** ISO-8601 UTC timestamp, second precision, filename-safe when compacted. */
export function nowStamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Shared CLI reporting contract (every public CLI):
 *  - `--out <file>` writes exactly the machine-readable report, deterministic
 *    JSON with a trailing newline, via the atomic path; no other destination is
 *    ever invented.
 *  - absence of --out writes no report file; read-only ops honor --out too.
 *  - expected failures never print stack traces. */
export function writeReport(outPath, report) {
  if (!outPath) return;
  atomicWrite(outPath, JSON.stringify(report, null, 2) + "\n");
}

export function usageError(message, usage) {
  console.error(message);
  console.error(usage);
  process.exit(2);
}

/* ------------------------------------------------------------------ *
 * Screening and writing style: adapters over screening.mjs
 * ------------------------------------------------------------------ */

export { EM_DASH };

/** Rewrite prohibited punctuation rather than deleting the sentence around it.
 *  Used for migration and for provider output, never as a silent fixer on the
 *  write path: a write that would have been wrong should fail loudly while
 *  someone can still choose the right punctuation. */
export const rewriteWritingStyle = rewriteStyle;

const isSensitiveString = (str) => looksSecret(str) || looksPersonal(str);

/** Is any string in this value secret- or personal-shaped? Never returns the value. */
export function containsSensitive(value) {
  let hit = false;
  const walk = (v) => {
    if (hit) return;
    if (typeof v === "string") hit = isSensitiveString(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return hit;
}

/** Redact every sensitive or machine-identifying string in a value, recursively.
 *  Returns a NEW value; the offending text is replaced, never echoed. Arrays,
 *  nested objects and object KEYS are all covered. */
export function redactSensitive(value, { onFinding } = {}) {
  const redactString = (str) => {
    if (isSensitiveString(str)) {
      onFinding?.("sensitive");
      return "[redacted: sensitive shape]";
    }
    const portable = redactHomePaths(str);
    if (portable !== str) onFinding?.("machine-path");
    return portable;
  };
  const walk = (v) => {
    if (typeof v === "string") return redactString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[redactString(k)] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value);
}

/** The single shared field-safety gate: reject any secret or personal string AND
 *  any reasoning-shaped field name, anywhere in the value. Coded refusal that
 *  NEVER echoes the offending value, so the refusal itself cannot leak it. */
export function assertSafeField(value, where = "field") {
  const walk = (v) => {
    if (typeof v === "string") {
      if (isSensitiveString(v)) throw new SuperdevError("E_SENSITIVE", `secret or personal content rejected in ${where}`);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (isReasoningField(k))
          throw new SuperdevError("E_REASONING_FIELD", `reasoning-shaped field "${k}" rejected in ${where}`);
        walk(val);
      }
    }
  };
  walk(value);
}
