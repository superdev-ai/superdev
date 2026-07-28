#!/usr/bin/env node
/**
 * Source ingestion engine (ADR-0006). Package-closed inside the Docs skill:
 * inventory and screening run anywhere; record mutation (--apply) requires the
 * Superdev plugin installation (the record engine is loaded dynamically) and is
 * refused truthfully on a standalone single-skill install.
 *
 * Structural authority rules: raw sources are never modified and NEVER
 * executed or treated as instructions; claims are drafts until approved;
 * ingestion is the ONLY writer of talks/project/accepted/ and writes there ONLY
 * on an owner-approved, fresh, uncontradicted, integrity-verified claim (approval
 * fails closed if any contradiction record is even unreadable); re-ingestion of
 * unchanged content is a no-op; contradictions never auto-close.
 *
 * Operations:
 *   inventory --root <p>                                  inbox + source-record status
 *   ingest    --root <p> --source <rel> [--apply]         register + screen a source revision
 *   propose   --root <p> --revision <SRC..:rN> --proposals <file|-> [--apply]
 *             validate agent-proposed claims/contradictions against the
 *             deterministic schema; dedup by identity; merge provenance
 *   approve   --root <p> --id <CLM-..> --approver <who> [--apply]
 *   reject    --root <p> --id <CLM-..> --approver <who> --reason <r> [--apply]
 *   resolve   --root <p> --id <CTR-..> --authority <class> --evidence <e> [--apply]
 *   verify    --root <p>                                  re-verify provenance spans against revision hashes
 *   list      --root <p> [--kind claims|contradictions]   read-only listing
 *
 * Exit codes: 0 ok, 1 refused/findings, 2 usage error.
 */
import { parseArgs } from "node:util";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { screenText, screenIntake, hasSensitive, MAX_SOURCE_BYTES, SENSITIVE_CODES } from "./screen.mjs";

const USAGE = `Usage: node ingest.mjs <inventory|ingest|propose|approve|reject|resolve|verify|list> --root <path> [options]
  See the operation table in the header. --apply mutates; everything else plans.
  --json / --out <file>  machine-readable output / report path`;

// Test-only deterministic fault injection: throw right after a named write
// boundary so batch transactionality can be exercised without real I/O failures.
// Never triggers unless the env var is explicitly set by a test harness.
function testFailPoint(boundary) {
  if (process.env.SUPERDEV_TEST_FAIL_AFTER === boundary)
    throw new IngestError("E_TEST_FAULT", `injected fault after ${boundary}`);
}

export const CLAIM_CATEGORIES = [
  "goal", "user-role", "requirement", "exclusion", "constraint", "claimed-decision",
  "unresolved-question", "feature", "surface-action", "api", "data-entity",
  "workflow", "nfr", "risk", "external-dependency",
];
export const EPISTEMIC_LABELS = ["Confirmed", "Strongly supported", "Inferred", "Assumed", "Unknown", "Contradicted"];

class IngestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Record engine, plugin-mode only. Standalone: null → mutation refused truthfully. */
async function loadRecordEngine() {
  try {
    const lib = await import(new URL("../../../scripts/talks/lib.mjs", import.meta.url).href);
    const events = await import(new URL("../../../scripts/talks/events.mjs", import.meta.url).href);
    return { lib, events };
  } catch {
    return null;
  }
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Content hash of a file without buffering it (used for oversize sources). */
function streamHash(abs) {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(abs, "r");
  try {
    const chunk = Buffer.alloc(1 << 16);
    let n;
    while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) h.update(chunk.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex");
}

export function normalizeKey(key) {
  return String(key).normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Every persisted user/agent-supplied field is screened before it lands in a
 *  record, report, index, or CLI output. Sensitive (secret/PII) shapes are
 *  refused with a coded error; the offending value is never echoed. */
export function assertFieldsSafe(obj, where) {
  const walk = (v) => {
    if (typeof v === "string") {
      if (hasSensitive(v)) throw new IngestError("E_FIELD_SENSITIVE", `${where} contains a secret- or PII-shaped value; refused (never stored or echoed)`);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (REASONING_FIELD_NAMES.has(k)) throw new IngestError("E_FIELD_REASONING", `${where} contains a reasoning-shaped field "${k}"; refused`);
        walk(val);
      }
    }
  };
  walk(obj);
}
const REASONING_FIELD_NAMES = new Set(["reasoning", "chainOfThought", "chain_of_thought", "thinking", "internalMonologue", "internal_monologue", "thoughts", "scratchpad", "hiddenReasoning", "privateNotes"]);

// Domain separation via JSON-encoded arrays: unambiguous, collision-free, and
// pure ASCII in source (no NUL/control separators - the shipped file stays text).
export function sourceId(relPath) {
  return `SRC-${sha256(JSON.stringify(["source", relPath.split(path.sep).join("/")])).slice(0, 10)}`;
}

export function claimIdentity(category, canonicalKey) {
  return { category, canonicalKey: normalizeKey(canonicalKey) };
}

export function claimId(category, canonicalKey) {
  const id = claimIdentity(category, canonicalKey);
  return `CLM-${sha256(JSON.stringify(["claim", id.category, id.canonicalKey])).slice(0, 10)}`;
}

export function contradictionIdentity(a, b) {
  return [a, b].sort();
}

export function contradictionId(a, b) {
  return `CTR-${sha256(JSON.stringify(["contradiction", ...contradictionIdentity(a, b)])).slice(0, 10)}`;
}

function confine(rootReal, rel) {
  const v = String(rel);
  if (path.isAbsolute(v) || /^[A-Za-z]:[\\/]/.test(v)) throw new IngestError("E_PATH_ABSOLUTE", "absolute source path rejected");
  if (v.split(/[\\/]/).includes("..")) throw new IngestError("E_PATH_TRAVERSAL", "path traversal rejected");
  const resolved = path.resolve(rootReal, v);
  if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep)) throw new IngestError("E_PATH_OUTSIDE", "path resolves outside root");
  let probe = resolved;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const real = fs.realpathSync(probe);
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) throw new IngestError("E_PATH_SYMLINK", "symlink escape rejected");
  return resolved;
}

// Central ID validators: exact prefix + fixed shape, no separators/traversal/
// control chars. A record id is ONLY ever a basename - never a path fragment.
const ID_SHAPES = {
  SRC: /^SRC-[0-9a-f]{10}$/,
  CLM: /^CLM-[0-9a-f]{10}$/,
  CTR: /^CTR-[0-9a-f]{10}$/,
};
export function validateId(kind, id) {
  if (typeof id !== "string" || !ID_SHAPES[kind]) throw new IngestError("E_ID_SHAPE", `invalid ${kind} id`);
  if (/[\\/]|\.\.|[\u0000-\u001f\u007f]/.test(id) || !ID_SHAPES[kind].test(id))
    throw new IngestError("E_ID_SHAPE", `invalid ${kind} id shape`);
  return id;
}

// Project-relative directory for each record kind - the single source of truth
// for record locations. Everything is resolved from these via confine(), the
// symlink-aware primitive, so a swapped/symlinked canonical directory can never
// redirect a read or write outside the project root.
const REL_DIR = { SRC: "talks/inbox/sources", CLM: "talks/claims", CTR: "talks/contradictions" };

/** Resolve a canonical record file from a validated id, confined to its dir.
 *  confine() walks the real ancestor chain and rejects any symlink escape, so a
 *  replaced canonical directory cannot redirect the write outside the root. */
export function recordFile(rootReal, kind, id) {
  validateId(kind, id);
  if (!REL_DIR[kind]) throw new IngestError("E_ID_SHAPE", `unknown record kind ${kind}`);
  return confine(rootReal, `${REL_DIR[kind]}/${id}.json`);
}

/** Read a canonical record; verify filename↔embedded-id↔type agreement. */
export function readRecord(rootReal, kind, id, idField) {
  const file = recordFile(rootReal, kind, id);
  if (!fs.existsSync(file)) return null;
  let rec;
  try {
    rec = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new IngestError("E_RECORD_TORN", `${kind} ${id} is unreadable (integrity)`);
  }
  if (rec?.[idField] !== id) throw new IngestError("E_RECORD_MISMATCH", `${kind} ${id} embedded id disagrees with filename (integrity)`);
  return rec;
}

function readJsonDir(rootReal, rel) {
  const dir = confine(rootReal, rel); // symlink-aware: never read outside the root
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".json") || f.startsWith(".tmp-")) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
    } catch {
      out.push({ _unreadable: f });
    }
  }
  return out;
}

// ---- ingest: intake, screening, revision registration ----

/** Per-source revision store: one immutable exclusive-create file per revision,
 *  keyed by content hash - NOT a mutable array in the identity file. Concurrent
 *  different-content ingests write distinct files and never lose a revision. */
function revsDir(rootReal, id) {
  validateId("SRC", id);
  return confine(rootReal, `${REL_DIR.SRC}/${id}.revs`);
}
function processedReportFile(rootReal, id, contentHash) {
  validateId("SRC", id);
  if (!/^[0-9a-f]{64}$/.test(String(contentHash))) throw new IngestError("E_HASH_SHAPE", "content hash must be 64 hex chars");
  return confine(rootReal, `talks/inbox/processed/${id}-${contentHash}.json`);
}

/** Derived, ordered revision list for a source. Order is deterministic across
 *  processes (observedAt, then contentHash). `revision` index and `status` are
 *  derived: "processed" iff the immutable processing report exists. */
export function sourceRevisions(rootReal, id) {
  const dir = revsDir(rootReal, id);
  if (!fs.existsSync(dir)) return [];
  const revs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-"))
    .map((f) => {
      let rec;
      try {
        rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        throw new IngestError("E_RECORD_TORN", `revision ${id}/${f} is unreadable (integrity)`);
      }
      // Bind the filename to the recorded content hash and validate the shape:
      // a tampered/renamed revision file is an integrity failure, not silent data.
      const nameHash = f.replace(/\.json$/, "");
      if (!/^[0-9a-f]{64}$/.test(String(rec.contentHash)) || rec.contentHash !== nameHash)
        throw new IngestError("E_RECORD_MISMATCH", `revision ${id}/${f} content hash disagrees with its filename (integrity)`);
      if (typeof rec.observedAt !== "string" || typeof rec.mediaType !== "string" || typeof rec.extractable !== "boolean")
        throw new IngestError("E_RECORD_MISMATCH", `revision ${id}/${f} is missing required fields (integrity)`);
      return rec;
    })
    .sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : a.contentHash < b.contentHash ? -1 : 1));
  return revs.map((r, i) => ({
    ...r,
    revision: `r${i}`,
    status: fs.existsSync(processedReportFile(rootReal, id, r.contentHash)) ? "processed" : "registered",
  }));
}

/** Revision index/status for a source id + content hash, from the revision store. */
export function revisionStatusFor(rootReal, id, contentHash) {
  const srcFile = recordFile(rootReal, "SRC", id);
  if (!fs.existsSync(srcFile)) return { revision: "r0", status: "new-source" };
  const revisions = sourceRevisions(rootReal, id);
  const existing = revisions.findIndex((r) => r.contentHash === contentHash);
  if (existing !== -1)
    return { revision: `r${existing}`, status: revisions[existing].status === "processed" ? "unchanged-processed" : "unchanged-unprocessed" };
  return { revision: `r${revisions.length}`, status: revisions.length ? "new-revision" : "new-source" };
}

export function planIngest(rootReal, sourceRel) {
  const abs = confine(rootReal, sourceRel);
  const stat = fs.existsSync(abs) ? fs.statSync(abs) : null;
  if (!stat || !stat.isFile()) throw new IngestError("E_SOURCE_MISSING", "source file not found");

  // Enforce the size ceiling from metadata BEFORE reading the whole file:
  // oversized sources are inventoried and hashed by a streamed digest, never
  // fully buffered, decoded, screened, excerpted, or made extractable.
  if (stat.size > MAX_SOURCE_BYTES) {
    const id = sourceId(path.relative(rootReal, abs));
    const contentHash = streamHash(abs);
    const { revision, status } = revisionStatusFor(rootReal, id, contentHash);
    return {
      sourceId: id,
      path: path.relative(rootReal, abs).split(path.sep).join("/"),
      bytes: stat.size,
      mediaType: "application/octet-stream",
      contentHash,
      revision,
      status,
      extractable: false,
      intakeFindings: [{ code: "SCR-OVERSIZE", severity: "P1", detail: `exceeds ${MAX_SOURCE_BYTES} byte boundary; inventoried, never decoded or extracted` }],
      screeningFindings: [],
    };
  }

  const buf = fs.readFileSync(abs);
  const contentHash = sha256(buf);
  const intake = screenIntake(path.basename(abs), buf);
  const extractable = !intake.some((f) => ["SCR-EXECUTABLE", "SCR-BINARY", "SCR-ENCODING", "SCR-OVERSIZE"].includes(f.code));
  const screening = extractable ? screenText(buf.toString("utf8")) : [];
  const id = sourceId(path.relative(rootReal, abs));
  const { revision, status } = revisionStatusFor(rootReal, id, contentHash);
  return {
    sourceId: id,
    path: path.relative(rootReal, abs).split(path.sep).join("/"),
    bytes: buf.length,
    mediaType: abs.endsWith(".md") ? "text/markdown" : abs.endsWith(".json") ? "application/json" : "text/plain",
    contentHash,
    revision,
    status,
    extractable,
    intakeFindings: intake,
    screeningFindings: screening,
  };
}

export async function applyIngest(rootReal, sourceRel, suppliedBy) {
  const engine = await loadRecordEngine();
  if (!engine)
    throw new IngestError("E_STANDALONE", "record mutation requires the Superdev plugin installation; standalone Docs can inventory and screen (dry-run) - apply from the plugin context (documented checkpoint)");
  engine.lib.assertNotInterrupted(rootReal);
  if (suppliedBy != null) assertFieldsSafe({ suppliedBy }, "supplied-by"); // persisted in the revision record
  const plan = planIngest(rootReal, sourceRel);
  if (plan.status === "unchanged-processed") return { ...plan, applied: false, noOp: true };
  const { lib } = engine;
  const srcFile = recordFile(rootReal, "SRC", plan.sourceId);
  // Bind the SRC id to its normalized project-relative path. If the identity file
  // already exists, its recorded path MUST match - a mismatch is a short-hash
  // collision (two paths → one id) and is refused rather than silently adding
  // revisions under the wrong source identity.
  const assertSrcIdentity = () => {
    const rec = readRecord(rootReal, "SRC", plan.sourceId, "sourceId");
    if (rec && rec.path !== plan.path)
      throw new IngestError("E_ID_COLLISION", "SRC id resolves to a different source path (short-hash collision); refusing to add revisions under a mismatched identity");
    return rec;
  };
  if (!assertSrcIdentity()) {
    try {
      lib.exclusiveWrite(srcFile, lib.stableStringify({ sourceId: plan.sourceId, path: plan.path, schemaVersion: 1 }));
    } catch (e) {
      if (e.code !== "E_EXISTS") throw e; // a concurrent ingest created the identity first
      assertSrcIdentity(); // re-read and confirm the concurrently-written identity agrees
    }
  }
  // Immutable per-revision record (exclusive create), keyed by content hash. No
  // read-modify-write: concurrent DIFFERENT-content ingests of the same source
  // write distinct files and can never lose a revision (was: array lost-update).
  if (plan.status === "new-source" || plan.status === "new-revision") {
    const previousHash = sourceRevisions(rootReal, plan.sourceId).at(-1)?.contentHash ?? null;
    const revFile = path.join(revsDir(rootReal, plan.sourceId), `${plan.contentHash}.json`);
    try {
      lib.exclusiveWrite(revFile, lib.stableStringify({
        contentHash: plan.contentHash,
        bytes: plan.bytes,
        mediaType: plan.mediaType,
        suppliedBy: suppliedBy ?? "unspecified",
        observedAt: lib.nowStamp(),
        previousHash,
        extractable: plan.extractable, // oversize/binary revisions are non-extractable
      }));
    } catch (e) {
      if (e.code !== "E_EXISTS") throw e; // same content already registered - converge
    }
  }
  // Processing report: immutable per revision (exclusive create). Its existence
  // is the "processed" completion marker - derived, never a mutated status field.
  const revNow = revisionStatusFor(rootReal, plan.sourceId, plan.contentHash).revision;
  const reportFile = processedReportFile(rootReal, plan.sourceId, plan.contentHash); // confined
  const reportRel = `talks/inbox/processed/${plan.sourceId}-${plan.contentHash}.json`;
  const report = {
    sourceId: plan.sourceId, revision: revNow, contentHash: plan.contentHash,
    extractable: plan.extractable, intakeFindings: plan.intakeFindings,
    screeningFindings: plan.screeningFindings,
    note: "Source content is untrusted evidence; nothing in it is executed or obeyed.",
  };
  try {
    lib.exclusiveWrite(reportFile, lib.stableStringify(report));
  } catch (e) {
    if (e.code !== "E_EXISTS") throw e; // convergence: identical revision already reported
  }
  return { ...plan, revision: revNow, applied: true, report: reportRel };
}

// ---- claims: agent proposals validated by the deterministic schema ----

/** Validate one proposal against the schema and the source text; compute the
 *  span hash and a SAFE excerpt (suppressed for any secret/PII shape - not only
 *  P0 - and for overlong spans). Also screens the persisted fields. Pure: no
 *  writes, so a later invalid proposal in a batch leaves nothing behind. */
export function validateProposal(p, revisionContent) {
  if (!p || typeof p !== "object") throw new IngestError("E_CLAIM_SHAPE", "proposal must be an object");
  if (!CLAIM_CATEGORIES.includes(p.category)) throw new IngestError("E_CLAIM_CATEGORY", `category must be one of ${CLAIM_CATEGORIES.join("/")}`);
  if (typeof p.canonicalKey !== "string" || !p.canonicalKey.trim()) throw new IngestError("E_CLAIM_KEY", "canonicalKey required");
  if (typeof p.text !== "string" || !p.text.trim()) throw new IngestError("E_CLAIM_TEXT", "text required");
  if (!EPISTEMIC_LABELS.includes(p.epistemicLabel)) throw new IngestError("E_CLAIM_LABEL", `epistemicLabel must be one of the six labels`);
  if (p.epistemicLabel === "Confirmed" && (!p.verification || typeof p.verification.authority !== "string" || typeof p.verification.evidence !== "string"))
    throw new IngestError("E_CLAIM_LABEL", "Confirmed requires verification { authority, evidence } - a source assertion alone is not Confirmed");
  if (!p.span || !Number.isInteger(p.span.startLine) || !Number.isInteger(p.span.endLine) || p.span.startLine < 1 || p.span.endLine < p.span.startLine)
    throw new IngestError("E_CLAIM_SPAN", "span { startLine, endLine } required (1-based, ordered)");
  const lines = revisionContent.split("\n");
  if (p.span.endLine > lines.length) throw new IngestError("E_CLAIM_SPAN", "span exceeds source length");
  // Every agent-authored field that will persist is screened up front.
  assertFieldsSafe({ canonicalKey: p.canonicalKey, text: p.text, verification: p.verification ?? null, extractionMethod: p.extractionMethod ?? null }, "claim proposal");
  const spanText = lines.slice(p.span.startLine - 1, p.span.endLine).join("\n");
  const sensitive = screenText(spanText).some((f) => SENSITIVE_CODES.has(f.code));
  return {
    spanSha256: sha256(spanText),
    excerpt: sensitive || spanText.length > 300 ? null : spanText, // no excerpt for any secret/PII shape
  };
}

// Provenance lives in per-claim exclusive-create files so concurrent additions
// from different sources never race a read-modify-write: each provenance is one
// file keyed by its span hash. Distinct spans coexist; identical spans converge.
function provDir(rootReal, claimId) {
  validateId("CLM", claimId); // never trust a caller-supplied id in a path
  return confine(rootReal, `${REL_DIR.CLM}/${claimId}.prov`);
}
/** The provenance file key: the full-identity hash (source + revision + content
 *  + span). The filename IS this key, so it can be re-derived and verified. */
function provKey(pr) {
  return sha256(JSON.stringify([pr.sourceId, pr.revision, pr.contentHash, pr.spanSha256])).slice(0, 16);
}
export function readClaimProvenance(rootReal, claimId) {
  const dir = provDir(rootReal, claimId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-"))
    .sort()
    .map((f) => {
      let rec;
      try {
        rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        throw new IngestError("E_RECORD_TORN", `provenance ${claimId}/${f} is unreadable (integrity)`);
      }
      // Bind the filename to the record's full identity: a provenance file whose
      // name does not match its (source,revision,content,span) key - or whose
      // fields are malformed - is an integrity failure, never silently trusted.
      if (typeof rec.sourceId !== "string" || typeof rec.revision !== "string" || !/^[0-9a-f]{64}$/.test(String(rec.contentHash)) || !/^[0-9a-f]{64}$/.test(String(rec.spanSha256)) || !rec.span)
        throw new IngestError("E_RECORD_MISMATCH", `provenance ${claimId}/${f} is missing required identity fields (integrity)`);
      if (`${provKey(rec)}.json` !== f)
        throw new IngestError("E_RECORD_MISMATCH", `provenance ${claimId}/${f} disagrees with its full-identity key (integrity)`);
      return rec;
    });
}

function loadRevision(rootReal, revisionKey) {
  const m = /^(SRC-[0-9a-f]{10}):r(\d+)$/.exec(revisionKey);
  if (!m) throw new IngestError("E_REVISION", "revision must look like SRC-xxxxxxxxxx:rN");
  const record = readRecord(rootReal, "SRC", m[1], "sourceId");
  if (!record) throw new IngestError("E_REVISION", "unknown source");
  const rev = sourceRevisions(rootReal, m[1])[Number(m[2])];
  if (!rev) throw new IngestError("E_REVISION", "unknown revision");
  if (rev.extractable === false)
    throw new IngestError("E_REVISION_NONEXTRACTABLE", "this revision is non-extractable (oversize/binary); no claims can be extracted from it");
  const raw = confine(rootReal, record.path); // confined even though it came from a record
  if (!fs.existsSync(raw)) throw new IngestError("E_SOURCE_MISSING", "raw source no longer present; claims persist but no new spans can be verified");
  const stat = fs.statSync(raw);
  if (stat.size > MAX_SOURCE_BYTES) throw new IngestError("E_REVISION_NONEXTRACTABLE", "raw source is now oversize; not decoded for extraction");
  const content = fs.readFileSync(raw);
  if (sha256(content) !== rev.contentHash) throw new IngestError("E_REVISION_STALE", "raw file no longer matches this revision; ingest the current content first");
  return { sourceId: m[1], revIndex: m[2], rev, text: content.toString("utf8") };
}

export async function applyProposals(rootReal, revisionKey, proposals, { apply }) {
  const engine = await loadRecordEngine();
  if (!engine && apply) throw new IngestError("E_STANDALONE", "record mutation requires the Superdev plugin installation");
  if (apply) engine.lib.assertNotInterrupted(rootReal);
  const { sourceId: srcId, revIndex, rev, text } = loadRevision(rootReal, revisionKey);

  // PREFLIGHT: validate the COMPLETE batch before any mutation. Any failure
  // here leaves every canonical file, event, and mtime unchanged.
  const claimPlans = [];
  for (const p of Array.isArray(proposals?.claims) ? proposals.claims : []) {
    const { spanSha256, excerpt } = validateProposal(p, text);
    const id = claimId(p.category, p.canonicalKey);
    // Collision binding: a matching short hash must agree on full identity.
    const existing = readRecord(rootReal, "CLM", id, "claimId");
    if (existing && (existing.category !== p.category || existing.canonicalKey !== normalizeKey(p.canonicalKey)))
      throw new IngestError("E_ID_COLLISION", "deterministic claim id collided with a different category/key");
    claimPlans.push({ p, id, existing, provenance: { sourceId: srcId, revision: `r${revIndex}`, contentHash: rev.contentHash, span: p.span, spanSha256, excerpt } });
  }
  const ctrPlans = [];
  for (const c of Array.isArray(proposals?.contradictions) ? proposals.contradictions : []) {
    if (typeof c.claimA !== "string" || typeof c.claimB !== "string") throw new IngestError("E_CTR_SHAPE", "contradiction proposal needs claimA/claimB ids");
    for (const cid of [c.claimA, c.claimB]) {
      validateId("CLM", cid);
      if (!fs.existsSync(recordFile(rootReal, "CLM", cid)) && !claimPlans.some((cp) => cp.id === cid))
        throw new IngestError("E_CTR_UNKNOWN", "contradiction references an unknown claim");
    }
    assertFieldsSafe({ kind: c.kind ?? null, downstreamImpact: c.downstreamImpact ?? null }, "contradiction proposal");
    ctrPlans.push({ id: contradictionId(c.claimA, c.claimB), kind: c.kind ?? "source-vs-source", sides: [{ claimId: c.claimA }, { claimId: c.claimB }], severity: c.severity ?? "P1", downstreamImpact: c.downstreamImpact ?? "" });
  }

  // DRY-RUN: report the plan without mutation.
  if (!apply) {
    const results = claimPlans.map(({ id, existing }) => ({ claimId: id, action: existing ? "unchanged-or-merge" : "create" }));
    return { applied: false, revision: revisionKey, claims: results, contradictions: ctrPlans.map((c) => c.id) };
  }

  // ---- Batch transaction: reserve → commit every write (each exclusive-create,
  // so replays and concurrent same-batch runs converge) → completion marker.
  // A re-run whose completion marker exists returns the recorded result (idempotent);
  // an interrupted batch has NO completion marker, so a partial can never look
  // complete, and re-running converges. If THIS call owns the reservation and a
  // write faults, it rolls back only the files it created (pristine on failure). ----
  // The apply loop is itself idempotent (every write is an exclusive-create that
  // converges on E_EXISTS), so we always re-evaluate; the completion marker is a
  // completeness SIGNAL (partial batches lack it), not a result cache.
  const marks = batchMarkers(rootReal, engine, revisionKey, proposals);
  const created = []; // files THIS call exclusive-created (rollback set)
  const exCreate = (file, content) => {
    try { engine.lib.exclusiveWrite(file, content); created.push(file); return true; }
    catch (e) { if (e.code !== "E_EXISTS") throw e; return false; } // converge on a concurrent/prior identical write
  };
  let ownsReservation = false;
  try {
    ownsReservation = exCreate(marks.reservation, engine.lib.stableStringify({ batchId: marks.batchId, revisionKey, at: engine.lib.nowStamp(), claims: claimPlans.map((c) => c.id) }));

    const results = [];
    const persistedCtrs = [];
    const autoContradictions = [];
    for (const { p, id, existing, provenance } of claimPlans) {
      const key = `${provKey(provenance)}.json`;
      if (existing) {
        if (normalizeKey(existing.text) !== normalizeKey(p.text))
          autoContradictions.push({ id: contradictionId(id, `${id}@${provenance.spanSha256.slice(0, 6)}`), kind: "source-vs-source", claimId: id, sides: [{ text: existing.text }, { text: p.text }] });
        const wrote = exCreate(path.join(provDir(rootReal, id), key), engine.lib.stableStringify(provenance));
        results.push({ claimId: id, action: wrote ? "merge-provenance" : "unchanged" });
      } else {
        results.push({ claimId: id, action: "create" });
        const claim = {
          claimId: id, category: p.category, canonicalKey: normalizeKey(p.canonicalKey), text: p.text,
          epistemicLabel: p.epistemicLabel, verification: p.verification ?? null, status: "draft",
          extractionMethod: p.extractionMethod ?? "agent-proposed", loadBearing: Boolean(p.loadBearing),
          publicId: null, related: [], history: [{ at: engine.lib.nowStamp(), action: "created", from: `${srcId}:r${revIndex}` }],
        };
        const won = exCreate(recordFile(rootReal, "CLM", id), engine.lib.stableStringify(claim));
        testFailPoint("claim");
        // Lost the create race (concurrent or in-batch peer): the winner's text may differ → contradiction.
        if (!won) {
          const winner = readRecord(rootReal, "CLM", id, "claimId");
          if (winner && normalizeKey(winner.text) !== normalizeKey(p.text))
            autoContradictions.push({ id: contradictionId(id, `${id}@${provenance.spanSha256.slice(0, 6)}`), kind: "source-vs-source", claimId: id, sides: [{ text: winner.text }, { text: p.text }] });
        }
        exCreate(path.join(provDir(rootReal, id), key), engine.lib.stableStringify(provenance));
        testFailPoint("provenance");
        if (writeDraftArtifact(rootReal, engine, { claimId: id, category: p.category, text: p.text, epistemicLabel: p.epistemicLabel, provenance })) created.push(confine(rootReal, `talks/inbox/drafts/${id}.md`));
        testFailPoint("draft");
      }
    }
    for (const c of [...autoContradictions, ...ctrPlans]) {
      persistedCtrs.push(c.id);
      const ctrRecord = {
        contradictionId: c.id, kind: c.kind, claimId: c.claimId ?? null, sides: c.sides,
        severity: c.severity ?? "P1", authorityClass: null, downstreamImpact: c.downstreamImpact ?? "",
        status: "open", ownerDecisionNeeded: true, resolution: null,
        history: [{ at: engine.lib.nowStamp(), action: "opened" }],
      };
      const wrote = exCreate(recordFile(rootReal, "CTR", c.id), engine.lib.stableStringify(ctrRecord));
      if (!wrote) {
        // Converge ONLY if the existing record has the same canonical identity
        // (kind + sides + claimId). A different identity under the same id is a
        // short-hash collision and is refused - never silently reused.
        const existing = readRecord(rootReal, "CTR", c.id, "contradictionId");
        if (existing && (existing.kind !== ctrRecord.kind || engine.lib.stableStringify(existing.sides) !== engine.lib.stableStringify(ctrRecord.sides) || (existing.claimId ?? null) !== (ctrRecord.claimId ?? null)))
          throw new IngestError("E_ID_COLLISION", "contradiction id resolves to a different contradiction (kind/sides mismatch); refusing to reuse the existing record");
      }
      testFailPoint("contradiction");
    }

    const result = { applied: true, revision: revisionKey, claims: results, contradictions: persistedCtrs };
    // Completion marker last: its presence is the ONLY signal the batch is complete.
    try { engine.lib.exclusiveWrite(marks.done, engine.lib.stableStringify({ batchId: marks.batchId, at: engine.lib.nowStamp(), result })); }
    catch (e) { if (e.code !== "E_EXISTS") throw e; } // a concurrent same-batch runner completed first - converge
    return result;
  } catch (err) {
    // Owned-failure rollback: remove only the files THIS call created, leaving the
    // canonical state pristine. A crash (no catch) instead leaves valid, idempotent
    // partial records with no completion marker - re-running converges.
    if (ownsReservation) for (const f of created.reverse()) { try { fs.rmSync(f, { force: true }); } catch { /* best effort */ } }
    throw err;
  }
}

// Category → accepted public-id prefix.
const CATEGORY_PREFIX = {
  goal: "REQ", "user-role": "REQ", requirement: "REQ", exclusion: "REQ", constraint: "REQ",
  "claimed-decision": "REQ", "unresolved-question": "Q", feature: "FEAT", "surface-action": "SURF",
  api: "API", "data-entity": "DATA", workflow: "WF", nfr: "REQ", risk: "REQ", "external-dependency": "REQ",
};

/** Provenance-linked DRAFT artifact - a distinct file from raw source, evidence
 *  claim, and (later) accepted artifact. Marked draft; non-authoritative. */
function writeDraftArtifact(rootReal, engine, { claimId, category, text, epistemicLabel, provenance }) {
  validateId("CLM", claimId);
  const rel = `talks/inbox/drafts/${claimId}.md`;
  const body = [
    "<!-- DRAFT - non-authoritative until approved. Generated from evidence claim; do not treat as accepted. -->",
    `# Draft: ${category}`,
    "",
    `- **Claim:** ${claimId}`,
    `- **Epistemic label:** ${epistemicLabel}`,
    `- **Source:** ${provenance.sourceId} ${provenance.revision} lines ${provenance.span.startLine}-${provenance.span.endLine}`,
    "",
    "## Statement",
    "",
    text,
    "",
    "> Complete the appropriate first-party Docs template on approval; this stub cites the evidence only.",
    "",
  ].join("\n");
  try {
    engine.lib.exclusiveWrite(confine(rootReal, rel), body);
    return true; // created
  } catch (e) {
    if (e.code !== "E_EXISTS") throw e; // draft already generated - idempotent
    return false;
  }
}

// ---- approval, rejection, resolution ----

/** Provenance freshness for ONE claim: every span still hash-verifies against
 *  a present, unchanged source revision. Returns findings (empty = fresh). */
export function verifyClaim(rootReal, claimId) {
  const findings = [];
  const prov = readClaimProvenance(rootReal, claimId);
  if (!prov.length) findings.push({ code: "ING-NO-PROVENANCE", claimId });
  for (const pr of prov) {
    const src = readRecord(rootReal, "SRC", pr.sourceId, "sourceId");
    if (!src) {
      findings.push({ code: "ING-NO-SOURCE", claimId, detail: pr.sourceId });
      continue;
    }
    const raw = confine(rootReal, src.path);
    if (!fs.existsSync(raw)) {
      findings.push({ code: "ING-SOURCE-GONE", claimId, detail: "raw file removed; claim persists, span unverifiable" });
      continue;
    }
    const content = fs.readFileSync(raw);
    if (sha256(content) !== pr.contentHash) {
      findings.push({ code: "ING-STALE", claimId, detail: "source changed since this revision" });
      continue;
    }
    const spanText = content.toString("utf8").split("\n").slice(pr.span.startLine - 1, pr.span.endLine).join("\n");
    if (sha256(spanText) !== pr.spanSha256) findings.push({ code: "ING-SPAN-MISMATCH", claimId, detail: "span hash mismatch" });
  }
  return findings;
}

export async function decideClaim(rootReal, id, decision, approver, reason, { apply }) {
  const engine = await loadRecordEngine();
  if (!engine && apply) throw new IngestError("E_STANDALONE", "record mutation requires the Superdev plugin installation");
  if (apply) engine.lib.assertNotInterrupted(rootReal);
  validateId("CLM", id);
  const claim = readRecord(rootReal, "CLM", id, "claimId");
  if (!claim) throw new IngestError("E_CLAIM_UNKNOWN", "no such claim");
  if (!["approved", "rejected"].includes(decision)) throw new IngestError("E_CLAIM_TRANSITION", "decision must be approved or rejected");
  if (!approver) throw new IngestError("E_APPROVER", "an approver is required");
  assertFieldsSafe({ approver, reason: reason ?? null }, "decision"); // approver + reason are persisted
  // Idempotent + no silent overwrite of a prior owner decision. Recovery: a prior
  // decision may have written the claim state but crashed before appending the
  // audit event (state write precedes event append). Re-ensure the event here -
  // appendIngestEvent is deterministic + existence-checked, so this is exactly-once.
  if (claim.status === decision) {
    // Recovery: re-ensure the audit event from the CANONICAL claim record, so the
    // payload is byte-identical to the original write (keyed on recorded history,
    // not this call's approver) and converges exactly-once.
    if (apply) await appendIngestEvent(rootReal, engine, decisionEvent(id, claim, decision));
    return { claimId: id, status: decision, applied: false, idempotent: true };
  }
  if (["approved", "rejected"].includes(claim.status))
    throw new IngestError("E_CLAIM_TRANSITION", `claim already ${claim.status}; a new owner decision must be an explicit re-open, not a silent overwrite`);

  if (decision === "approved") {
    if (claim.loadBearing && ["Contradicted", "Unknown"].includes(claim.epistemicLabel))
      throw new IngestError("E_CLAIM_BLOCKED", "a load-bearing Contradicted/Unknown claim cannot be approved into accepted fact");
    const contradictions = readJsonDir(rootReal, REL_DIR.CTR);
    // Fail closed: a torn/unparseable contradiction file could be an open
    // contradiction for this claim. We cannot prove it isn't → refuse approval.
    const unreadable = contradictions.filter((c) => c._unreadable);
    if (unreadable.length)
      throw new IngestError("E_CLAIM_BLOCKED", `cannot verify contradiction status: unreadable record(s) ${unreadable.map((c) => c._unreadable).join(", ")}; refusing approval until repaired`);
    const open = contradictions.filter(
      (c) => c.status === "open" && (c.claimId === id || (c.sides ?? []).some((s) => s.claimId === id))
    );
    if (open.length) throw new IngestError("E_CLAIM_BLOCKED", "claim has open contradictions; resolve them first");
    // Integrity + provenance freshness: no promotion on stale/unverifiable evidence.
    const stale = verifyClaim(rootReal, id);
    if (stale.length) throw new IngestError("E_CLAIM_STALE", `claim evidence is stale or unverifiable (${stale.map((f) => f.code).join(",")}); re-ingest before approval`);
  }
  if (!apply) return { plan: decision, claimId: id, applied: false };

  // ---- Reserve the terminal decision: an atomic compare-and-swap via exclusive
  // create. The FIRST writer to create the marker commits the claim's terminal
  // decision. A concurrent CONFLICTING decision (approve vs reject) sees the
  // marker and is refused - no last-writer-wins, no orphan accepted artifact, no
  // conflicting events. The SAME decision (or a crash-recovery re-run) converges
  // and completes the remaining writes idempotently. ----
  const marker = decisionMarkerFile(rootReal, id);
  const reservation = { claimId: id, decision, approver, reason: reason ?? null, at: engine.lib.nowStamp() };
  let reserved = true, committed = reservation;
  try {
    engine.lib.exclusiveWrite(marker, engine.lib.stableStringify(reservation));
  } catch (e) {
    if (e.code !== "E_EXISTS") throw e;
    reserved = false;
    try { committed = JSON.parse(fs.readFileSync(marker, "utf8")); }
    catch { throw new IngestError("E_RECORD_TORN", "decision reservation is unreadable (integrity)"); }
    if (committed.decision !== decision)
      throw new IngestError("E_CLAIM_TRANSITION", `claim already committed to "${committed.decision}"; a conflicting "${decision}" is refused`);
    // same decision already committed by a concurrent/prior writer → complete idempotently.
  }

  // ---- Complete the committed decision (idempotent; safe to re-run after a crash).
  const fresh = readRecord(rootReal, "CLM", id, "claimId");
  if (decision === "rejected") {
    if (fresh.status !== "rejected") {
      fresh.status = "rejected";
      fresh.history.push({ at: engine.lib.nowStamp(), action: "rejected", approver: committed.approver, reason: committed.reason ?? null });
      engine.lib.atomicWrite(recordFile(rootReal, "CLM", id), engine.lib.stableStringify(fresh));
    }
    await appendIngestEvent(rootReal, engine, decisionEvent(id, readRecord(rootReal, "CLM", id, "claimId"), "rejected"));
    return { claimId: id, status: "rejected", applied: reserved, ...(reserved ? {} : { idempotent: true }) };
  }

  // Approve → mint/bind the accepted public id (deterministic → recovery re-mints
  // the SAME id) and promote. Fold the category into the mint key so distinct
  // claims sharing a canonical key across categories never alias one public id.
  const prefix = CATEGORY_PREFIX[fresh.category] ?? "REQ";
  const publicId = await mintPublicId(rootReal, engine, prefix, JSON.stringify(["public", fresh.category, fresh.canonicalKey]));
  const acceptedRel = `talks/project/accepted/${publicId}.md`;
  const accepted = [
    `<!-- Accepted artifact. Promoted from evidence claim ${id} on owner approval. -->`,
    `# ${publicId}: ${fresh.category}`,
    "",
    `- **Status:** accepted`,
    `- **Evidence claim:** ${id} (${fresh.epistemicLabel})`,
    `- **Approver:** ${committed.approver}`,
    "",
    "## Statement",
    "",
    fresh.text,
    "",
  ].join("\n");
  // Promote (idempotent overwrite of the derived accepted file is fine).
  engine.lib.atomicWrite(confine(rootReal, acceptedRel), accepted);
  if (fresh.status !== "approved") {
    fresh.status = "approved";
    fresh.publicId = publicId;
    fresh.history.push({ at: engine.lib.nowStamp(), action: "approved", approver: committed.approver, publicId });
    engine.lib.atomicWrite(recordFile(rootReal, "CLM", id), engine.lib.stableStringify(fresh));
  }
  await appendIngestEvent(rootReal, engine, decisionEvent(id, readRecord(rootReal, "CLM", id, "claimId"), "approved"));
  return { claimId: id, status: "approved", publicId, acceptedArtifact: acceptedRel, applied: reserved, ...(reserved ? {} : { idempotent: true }) };
}

/** The claim's terminal-decision reservation marker (CAS record). Named without a
 *  .json extension so it is not itself listed as a claim; confined like all paths. */
function decisionMarkerFile(rootReal, claimId) {
  validateId("CLM", claimId);
  return confine(rootReal, `${REL_DIR.CLM}/${claimId}.decision`);
}

// Proposal-batch reservation (.batch) and completion (.done) markers, keyed by a
// deterministic hash of the revision + the exact proposals - so a re-run of the
// SAME batch converges to the SAME markers.
function batchMarkers(rootReal, engine, revisionKey, proposals) {
  const batchId = sha256(JSON.stringify(["ingest-batch", revisionKey, engine.lib.stableStringify(proposals)])).slice(0, 16);
  return {
    batchId,
    reservation: confine(rootReal, `talks/inbox/batches/${batchId}.batch`),
    done: confine(rootReal, `talks/inbox/batches/${batchId}.done`),
  };
}

async function mintPublicId(rootReal, engine, prefix, canonicalKey) {
  const idmod = await import(new URL("../../../scripts/talks/id.mjs", import.meta.url).href);
  return idmod.mintId(rootReal, prefix, canonicalKey, { apply: true }).id;
}

/** Append a lifecycle event with a DETERMINISTIC id keyed by the decision, and
 *  skip if it already exists. This makes the append idempotent so a crash between
 *  the claim-state write and the event append is recoverable: re-running the
 *  decision re-appends the (still-missing) event exactly once, never a duplicate. */
/** Build a decision's lifecycle-event payload from the CANONICAL claim record so
 *  the normal write and any later recovery re-run produce a byte-identical event
 *  (actor and rationale come from recorded history, not the live call). */
function decisionEvent(id, claim, decision) {
  const entry = [...claim.history].reverse().find((h) => h.action === decision);
  const actor = `superdev/ingest:${entry?.approver ?? "owner"}`;
  if (decision === "approved")
    return { eventKey: ["approve", id, claim.publicId], files: [`talks/claims/${id}.json`, `talks/project/accepted/${claim.publicId}.md`], summary: `Approve claim ${id} → ${claim.publicId}`, rationale: "owner approved; evidence fresh and uncontradicted", actor };
  return { eventKey: ["reject", id], files: [`talks/claims/${id}.json`], summary: `Reject claim ${id}`, rationale: entry?.reason ?? "owner rejected", actor };
}

async function appendIngestEvent(rootReal, engine, { eventKey, summary, files, rationale, actor }) {
  const eventId = `CHG-ing-${sha256(JSON.stringify(["ingest-event", ...eventKey])).slice(0, 12)}`;
  // Exactly-once: exclusive-create of the exact deterministic id; a concurrent or
  // recovery re-run converges (alreadyRecorded) instead of minting a suffixed
  // duplicate. The event payload is derived only from the decision identity (the
  // eventKey) and stable recorded fields - never a transient/live approver - so
  // re-runs produce an identical payload and never trip an E_EVENT_COLLISION.
  return engine.events.appendDeterministicEvent(rootReal, {
    eventId,
    actor,
    requestSummary: summary,
    scope: "ingestion lifecycle",
    filesChanged: files,
    observableRationale: rationale,
    validationResults: "provenance freshness + contradiction gates enforced at approval",
    sessionId: "S-ingest",
  });
}

export async function resolveContradiction(rootReal, id, authorityClass, evidence, { apply }) {
  const engine = await loadRecordEngine();
  if (!engine && apply) throw new IngestError("E_STANDALONE", "record mutation requires the Superdev plugin installation");
  if (apply) engine.lib.assertNotInterrupted(rootReal);
  validateId("CTR", id);
  const ctr = readRecord(rootReal, "CTR", id, "contradictionId");
  if (!ctr) throw new IngestError("E_CTR_UNKNOWN", "no such contradiction");
  if (!authorityClass || !evidence) throw new IngestError("E_CTR_RESOLUTION", "resolution requires an authority class and observable evidence");
  assertFieldsSafe({ authorityClass, evidence }, "contradiction resolution");
  const resolveEvent = (ctrRec) => ({ eventKey: ["resolve", id], summary: `Resolve contradiction ${id}`, files: [`talks/contradictions/${id}.json`], rationale: `resolved via ${ctrRec.resolution.authorityClass}`, actor: "superdev/ingest:owner" });
  if (ctr.status === "resolved") {
    if (apply) // recovery: re-ensure the (possibly-missing) audit event, exactly once, from the recorded resolution
      await appendIngestEvent(rootReal, engine, resolveEvent(ctr));
    return { contradictionId: id, status: "resolved", applied: false, idempotent: true };
  }
  if (!apply) return { plan: "resolve", contradictionId: id, applied: false };
  ctr.status = "resolved";
  ctr.resolution = { authorityClass, evidence, at: engine.lib.nowStamp() };
  ctr.history.push({ at: engine.lib.nowStamp(), action: "resolved", authorityClass });
  engine.lib.atomicWrite(recordFile(rootReal, "CTR", id), engine.lib.stableStringify(ctr)); // history preserved; never deleted
  await appendIngestEvent(rootReal, engine, resolveEvent(ctr));
  return { contradictionId: id, status: "resolved", applied: true };
}

/** Re-verify every stored provenance span across all claims. */
export function verifyProvenance(rootReal) {
  const findings = [];
  const dir = confine(rootReal, REL_DIR.CLM);
  const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith(".tmp-")).map((f) => f.replace(/\.json$/, "")) : [];
  for (const id of ids) {
    try {
      findings.push(...verifyClaim(rootReal, id));
    } catch (e) {
      findings.push({ code: e.code ?? "ING-ERR", claimId: id, detail: e.message });
    }
  }
  return { findings };
}

// ---- CLI ----

function writeReportLocal(outPath, report) {
  if (!outPath) return;
  const dir = path.dirname(path.resolve(outPath));
  const tmp = path.join(dir, `.tmp-report-${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(report, null, 2) + "\n");
  fs.renameSync(tmp, path.resolve(outPath));
}

async function main() {
  let args, positionals;
  try {
    const parsed = parseArgs({
      options: {
        root: { type: "string", default: "." },
        source: { type: "string" },
        revision: { type: "string" },
        proposals: { type: "string" },
        id: { type: "string" },
        approver: { type: "string" },
        reason: { type: "string" },
        authority: { type: "string" },
        evidence: { type: "string" },
        "supplied-by": { type: "string" },
        kind: { type: "string" },
        apply: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        out: { type: "string" },
        help: { type: "boolean", default: false },
      },
      allowPositionals: true,
    });
    args = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    console.error(String(err.message ?? err));
    console.error(USAGE);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const op = positionals[0];
  const OPS = ["inventory", "ingest", "propose", "approve", "reject", "resolve", "verify", "list"];
  if (!OPS.includes(op)) {
    console.error(`unknown operation: ${op ?? "(none)"}`);
    console.error(USAGE);
    process.exit(2);
  }
  if (!fs.existsSync(args.root) || !fs.statSync(args.root).isDirectory()) {
    console.error(`root is not a directory: ${args.root}`);
    console.error(USAGE);
    process.exit(2);
  }
  const rootReal = fs.realpathSync(args.root);
  try {
    let report;
    let failed = false;
    if (op === "inventory") {
      const rawDir = confine(rootReal, "talks/inbox/raw");
      const raw = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter((f) => !f.startsWith(".")).sort() : [];
      report = { raw, sources: readJsonDir(rootReal, REL_DIR.SRC).filter((s) => s.sourceId).map((s) => {
        const revs = sourceRevisions(rootReal, s.sourceId);
        return { sourceId: s.sourceId, path: s.path, revisions: revs.length, latestStatus: revs.at(-1)?.status ?? null };
      }) };
    } else if (op === "ingest") {
      if (!args.source) throw new IngestError("E_ARGS", "ingest requires --source <project-relative path>");
      report = args.apply ? await applyIngest(rootReal, args.source, args["supplied-by"]) : { mode: "plan", ...planIngest(rootReal, args.source) };
      failed = report.intakeFindings?.some((f) => f.severity === "P0") ?? false;
    } else if (op === "propose") {
      if (!args.revision || !args.proposals) throw new IngestError("E_ARGS", "propose requires --revision and --proposals");
      let rawIn;
      try {
        rawIn = args.proposals === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(args.proposals, "utf8");
      } catch (e) {
        // File-not-found / unreadable is a usage error (exit 2), distinct from
        // a malformed-JSON body (exit 1). Never conflate the two.
        throw new IngestError("E_ARGS", `cannot read proposals file (${e.code ?? "read error"})`);
      }
      let payload;
      try {
        payload = JSON.parse(rawIn);
      } catch {
        throw new IngestError("E_PROPOSAL_PARSE", "proposals payload is not valid JSON"); // content never echoed
      }
      report = await applyProposals(rootReal, args.revision, payload, { apply: args.apply });
    } else if (op === "approve" || op === "reject") {
      if (!args.id) throw new IngestError("E_ARGS", `${op} requires --id`);
      report = await decideClaim(rootReal, args.id, op === "approve" ? "approved" : "rejected", args.approver, args.reason, { apply: args.apply });
    } else if (op === "resolve") {
      if (!args.id) throw new IngestError("E_ARGS", "resolve requires --id");
      report = await resolveContradiction(rootReal, args.id, args.authority, args.evidence, { apply: args.apply });
    } else if (op === "verify") {
      report = verifyProvenance(rootReal);
      failed = report.findings.length > 0;
    } else {
      const kind = args.kind ?? "claims";
      if (!["claims", "contradictions"].includes(kind)) throw new IngestError("E_ARGS", "--kind must be claims or contradictions");
      const items = readJsonDir(rootReal, kind === "claims" ? REL_DIR.CLM : REL_DIR.CTR);
      report = { count: items.length, [kind]: items.map((i) => i._unreadable ? { unreadable: i._unreadable } : kind === "claims" ? { claimId: i.claimId, category: i.category, epistemicLabel: i.epistemicLabel, status: i.status, sources: readClaimProvenance(rootReal, i.claimId).length } : { contradictionId: i.contradictionId, status: i.status, severity: i.severity }) };
    }
    console.log(args.json ? JSON.stringify(report, null, 2) : humanizeReport(op, report));
    writeReportLocal(args.out, report);
    process.exit(failed ? 1 : 0);
  } catch (e) {
    if (e instanceof IngestError || e?.code?.startsWith?.("E_")) {
      console.error(`[${e.code}] ${e.message}`);
      // Usage errors (missing/unreadable args) exit 2; refusals/failures exit 1.
      process.exit(e.code === "E_ARGS" ? 2 : 1);
    }
    throw e;
  }
}

/** Terse human-readable summary (default output); --json emits the full record. */
function humanizeReport(op, report) {
  const scalar = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
  const parts = [];
  for (const [k, v] of Object.entries(report)) {
    if (scalar(v)) parts.push(`${k}=${v}`);
    else if (Array.isArray(v)) parts.push(`${k}[${v.length}]`);
    else if (v && typeof v === "object") parts.push(`${k}{${Object.keys(v).length}}`);
  }
  return `${op}: ${parts.join(" ")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
