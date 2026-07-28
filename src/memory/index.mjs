// Local project memory, brief section 13.
//
// Memory is recall, never authority. Every entry that comes out of here carries
// its epistemic status and a note saying it must be checked against the live
// records before it changes anything, and `verifyRecall` is that check. The
// point is that an agent resuming work reads the database, not a transcript.
//
// memory_entries.embedding stays null: this engine has no vector index, so
// vector recall would be a bounded full scan with vector32() and
// vector_distance_cos(), which is a later decision and is not implemented here.

import { createHash } from "node:crypto";
import {
  query, mutate, create, patch, currentProject, recordActivity, json, DbError,
} from "../db/store.mjs";
import { tableFor } from "../model/ids.mjs";
import { sanitizeExternal, rewriteStyle, hasEmoji, assertRecordStorable } from "../model/screening.mjs";

const KINDS = new Set([
  "outcome", "decision", "learned_fact", "unresolved_question",
  "blocker", "handoff", "summary",
]);

const STATUSES = new Set(["confirmed", "inferred", "assumed", "unknown", "contradicted"]);

const TERMINAL_WORK = new Set(["complete", "cancelled", "superseded"]);
const DEAD_DECISION = new Set(["superseded", "partially_superseded", "deprecated", "rejected"]);

const RECALL_NOTE =
  "Recall, not authority. Verify with verifyRecall against current specifications, decisions and evidence before acting on it.";

// Progressive retrieval: a recall answers with the smallest set that is still
// useful, so an agent loads five relevant entries rather than a session log.
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
const CANDIDATE_CAP = 500;
const HALF_LIFE_DAYS = 30;
// Anything scoring below this share of the best match is noise next to it.
const RELATIVE_FLOOR = 0.35;

// A decision or a handoff is worth more on recall than a passing summary of the
// same age, and a confirmed fact is worth more than an assumed one.
const KIND_WEIGHT = {
  decision: 1.6, handoff: 1.5, blocker: 1.4, unresolved_question: 1.3,
  learned_fact: 1.2, outcome: 1.0, summary: 0.7,
};
const STATUS_WEIGHT = {
  confirmed: 1.3, inferred: 1.0, assumed: 0.8, unknown: 0.6, contradicted: 0.2,
};

const nowIso = () => new Date().toISOString();

/**
 * Redact before storage. `sanitizeExternal` covers secret-shaped strings and the
 * home paths that carry a person's account name; the loop exists because
 * `rewriteStyle` strips one emoji per pass (its pattern is not global), and a
 * second one would otherwise reach the storage screen and be refused rather
 * than cleaned.
 */
function clean(text) {
  if (text === null || text === undefined) return null;
  let out = sanitizeExternal(String(text)).trim();
  for (let i = 0; i < 8 && hasEmoji(out); i++) out = rewriteStyle(out).trim();
  return out;
}

const shape = (row, extra = {}) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  content: row.content,
  epistemicStatus: row.epistemic_status,
  sourceRef: row.source_ref,
  sessionId: row.session_id,
  taskId: row.task_id,
  featureId: row.feature_id,
  supersededBy: row.superseded_by,
  createdAt: row.created_at,
  version: row.version,
  authority: "recall",
  note: RECALL_NOTE,
  ...extra,
});

function normalizeLinks(links) {
  if (!links) return [];
  return (Array.isArray(links) ? links : [links])
    .map((l) => ({
      targetType: String(l.targetType ?? l.target_type ?? "").trim(),
      targetId: String(l.targetId ?? l.target_id ?? "").trim(),
      relationship: String(l.relationship ?? "about").trim() || "about",
    }))
    .filter((l) => l.targetType && l.targetId);
}

/**
 * What the linked record looked like when the memory was written. Verification
 * later compares against this: a record that still exists proves nothing on its
 * own, because the fact may have been true about an earlier version of it.
 */
async function targetState(db, targetType, targetId) {
  const table = tableFor(targetType);
  if (!table) return { exists: false, version: null, fingerprint: null };
  const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, targetId);
  if (!row) return { exists: false, version: null, fingerprint: null };
  // Volatile bookkeeping is excluded so an unrelated touch does not read as a
  // contradiction. Everything that carries meaning is hashed.
  const meaningful = Object.keys(row)
    .filter((k) => !["updated_at", "last_seen_at", "last_activity_at"].includes(k))
    .sort();
  const canonical = meaningful.map((k) => `${k}=${row[k] === null ? "" : String(row[k])}`).join("\u0001");
  return {
    exists: true,
    version: row.version ?? null,
    fingerprint: createHash("sha256").update(canonical).digest("hex"),
  };
}

/**
 * memory_links has no id, version or status, so `create` does not cover it and a
 * direct insert is the only route. The database also refuses a link to a record
 * that does not exist, per migration 003; this check runs first so the caller
 * gets a sentence rather than a trigger name.
 */
async function linkRow(db, memoryId, link, at) {
  assertRecordStorable({
    target_type: link.targetType, target_id: link.targetId, relationship: link.relationship,
  });
  const state = await targetState(db, link.targetType, link.targetId);
  if (!state.exists) {
    throw new DbError(
      "E_MEMORY_LINK_ORPHAN",
      `${link.targetType} ${link.targetId} does not exist, so a memory cannot be linked to it.`,
    );
  }
  await db.run(
    `INSERT OR REPLACE INTO memory_links
       (memory_id, target_type, target_id, relationship, target_version, target_fingerprint, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    memoryId, link.targetType, link.targetId, link.relationship,
    state.version, state.fingerprint, at ?? new Date().toISOString(),
  );
}

// ------------------------------------------------------------- term indexing

/** Weighting by where a term appeared. A title match is a stronger signal. */
const FIELD_WEIGHT = { title: 3.0, content: 1.0, source_ref: 0.5 };

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this",
  "these", "those", "is", "are", "was", "were", "be", "been", "being", "to",
  "of", "in", "on", "at", "for", "with", "by", "from", "as", "it", "its",
  "we", "our", "you", "your", "they", "their", "not", "no", "so", "do", "does",
]);

/** Lowercase word tokens of three characters or more, stop words removed. */
export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * Rebuild the postings for one memory. Called inside the same transaction as the
 * write, so the index can never describe a memory that was rolled back.
 */
async function indexMemory(db, memoryId, { title, content, sourceRef }) {
  await db.run("DELETE FROM memory_search_terms WHERE memory_id = ?", memoryId);
  const counts = new Map();
  for (const [field, text] of [["title", title], ["content", content], ["source_ref", sourceRef]]) {
    for (const term of tokenize(text)) {
      const key = `${term}\u0000${field}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, frequency] of counts) {
    const [term, field] = key.split("\u0000");
    await db.run(
      `INSERT INTO memory_search_terms (memory_id, term, field, frequency, field_weight)
       VALUES (?,?,?,?,?)`,
      memoryId, term, field, frequency, FIELD_WEIGHT[field] ?? 1.0,
    );
  }
  return counts.size;
}

async function linksOf(db, memoryIds) {
  if (!memoryIds.length) return new Map();
  const rows = await db.all(
    `SELECT * FROM memory_links WHERE memory_id IN (${memoryIds.map(() => "?").join(",")})`,
    ...memoryIds,
  );
  const byMemory = new Map();
  for (const row of rows) {
    const list = byMemory.get(row.memory_id) ?? [];
    list.push({ targetType: row.target_type, targetId: row.target_id, relationship: row.relationship });
    byMemory.set(row.memory_id, list);
  }
  return byMemory;
}

// ------------------------------------------------------------------- writing

async function rememberLocal(root, entry = {}) {
  // A key named `reasoning`, `thinking` or `scratchpad` never reaches storage.
  // `create` would drop it silently as an unknown column, which would look like
  // it worked, so it is refused here while the caller can still see why. Passing
  // every key as allowed leaves only the private-reasoning rule armed; the text
  // itself is redacted below rather than rejected.
  assertRecordStorable(entry, { allow: Object.keys(entry) });

  const kind = String(entry.kind ?? "").trim();
  if (!KINDS.has(kind)) {
    throw new DbError("E_MEMORY_KIND", `"${kind}" is not a memory kind. Use one of: ${[...KINDS].join(", ")}.`);
  }
  const epistemicStatus = String(entry.epistemicStatus ?? entry.epistemic_status ?? "inferred");
  if (!STATUSES.has(epistemicStatus)) {
    throw new DbError("E_MEMORY_STATUS", `"${epistemicStatus}" is not an epistemic status. Use one of: ${[...STATUSES].join(", ")}.`);
  }

  const title = clean(entry.title);
  const content = clean(entry.content);
  if (!title || !content) {
    throw new DbError("E_MEMORY_EMPTY", "A memory needs a title and content. Store the observable outcome and the rationale for it.");
  }

  const links = normalizeLinks(entry.links);
  const sourceRef = clean(entry.sourceRef ?? entry.source_ref);
  const contentHash = createHash("sha256")
    .update(`${kind}\n${title}\n${content}\n${sourceRef ?? ""}`)
    .digest("hex");

  // A hook, a compaction and a handoff all retry. The key is supplied by the
  // caller and is deliberately NOT the content hash: two genuinely different
  // observations can be worded alike, and collapsing those would lose real
  // information. Only an explicit key claims "this is the same delivery".
  const dedupeKey = entry.dedupeKey ?? entry.dedupe_key ?? null;
  const sourceEventId = entry.sourceEventId ?? entry.source_event_id ?? null;

  return mutate(root, async (db) => {
    const project = await currentProject(db);
    if (!project) throw new DbError("E_NOT_FOUND", "This directory has no Superdev project yet. Run superdev init first.");

    if (dedupeKey) {
      const existing = await db.get(
        "SELECT * FROM memory_entries WHERE project_id = ? AND dedupe_key = ?",
        project.id, dedupeKey,
      );
      if (existing) {
        const known = await linksOf(db, [existing.id]);
        return shape(existing, { links: known.get(existing.id) ?? [], deduplicated: true });
      }
    }

    const row = await create(db, "memory_entry", {
      project_id: project.id,
      session_id: entry.sessionId ?? null,
      task_id: entry.taskId ?? null,
      feature_id: entry.featureId ?? null,
      kind,
      title,
      content,
      source_ref: sourceRef,
      epistemic_status: epistemicStatus,
      dedupe_key: dedupeKey,
      source_event_id: sourceEventId,
      content_hash: contentHash,
    }, {
      projectId: project.id,
      actor: entry.actor,
      sessionId: entry.sessionId ?? null,
      taskId: entry.taskId ?? null,
      featureId: entry.featureId ?? null,
      activitySummary: `Remembered ${kind.replace(/_/g, " ")}: ${title.slice(0, 80)}`,
    });

    await indexMemory(db, row.id, { title, content, sourceRef });
    for (const link of links) await linkRow(db, row.id, link, row.created_at);
    return shape(row, { links, deduplicated: false });
  });
}

async function linkLocal(root, memoryId, targetType, targetId, relationship = "about") {
  const link = normalizeLinks([{ targetType, targetId, relationship }])[0];
  if (!link) throw new DbError("E_MEMORY_LINK", "A memory link needs both a target type and a target id.");

  return mutate(root, async (db) => {
    const memory = await db.get("SELECT * FROM memory_entries WHERE id = ?", memoryId);
    if (!memory) throw new DbError("E_NOT_FOUND", `Memory ${memoryId} does not exist.`);
    await linkRow(db, memoryId, link);
    await recordActivity(db, memory.project_id, {
      type: "specification_changed",
      summary: `Linked memory ${memoryId} to ${link.targetType} ${link.targetId}`,
      sessionId: memory.session_id,
      taskId: memory.task_id,
      featureId: memory.feature_id,
      metadata: { kind: "memory_link", id: memoryId, target: link },
    });
    return { memoryId, ...link };
  });
}

async function supersedeLocal(root, memoryId, replacementId, { actor } = {}) {
  if (memoryId === replacementId) {
    throw new DbError("E_MEMORY_SUPERSEDE", "A memory cannot supersede itself.");
  }
  return mutate(root, async (db) => {
    const memory = await db.get("SELECT * FROM memory_entries WHERE id = ?", memoryId);
    if (!memory) throw new DbError("E_NOT_FOUND", `Memory ${memoryId} does not exist.`);
    const replacement = replacementId
      ? await db.get("SELECT * FROM memory_entries WHERE id = ?", replacementId)
      : null;
    if (replacementId && !replacement) {
      throw new DbError("E_NOT_FOUND", `Memory ${replacementId} does not exist, so it cannot replace ${memoryId}.`);
    }
    if (replacement?.superseded_by === memoryId) {
      throw new DbError("E_MEMORY_SUPERSEDE", `${replacementId} is already superseded by ${memoryId}; superseding it back would make a loop.`);
    }

    const row = await patch(db, "memory_entry", memoryId, memory.version, {
      superseded_by: replacementId ?? null,
    }, {
      projectId: memory.project_id,
      actor,
      sessionId: memory.session_id,
      activitySummary: replacementId
        ? `Memory ${memoryId} superseded by ${replacementId}`
        : `Memory ${memoryId} is no longer superseded`,
    });
    return shape(row);
  });
}

// ------------------------------------------------------------------ recalling

/**
 * Scoring runs in application code because there is no full-text-search table.
 * It is four cheap signals combined:
 *
 *   overlap  how many query tokens appear, title hits counting double, scaled
 *            to 0..1 so a long query does not automatically outscore a short one
 *   phrase   a flat bonus when the whole query string appears verbatim
 *   recency  a 30 day half life, so this week's note beats last quarter's
 *   weight   kind and epistemic status, so a confirmed decision outranks an
 *            assumed summary at equal relevance
 *
 * With no query text, overlap and phrase are zero and the ranking is recency
 * times weight, which is the right answer for "what happened here lately".
 */
function scoreRow(row, tokens, phrase, now) {
  // Relevance arrives from the index as a weighted term score. Coverage (how
  // many of the query's terms this memory matched at all) is kept separate,
  // because matching three different terms once each is a better signal than
  // matching one term three times.
  const matched = Number(row.matched_terms ?? 0);
  const coverage = tokens.length ? matched / tokens.length : 0;
  const termScore = Number(row.term_score ?? 0);
  const relevance = tokens.length ? coverage * 2 + Math.min(termScore / 10, 1) : 0;

  // A verbatim phrase is checked directly, which is cheap here because the
  // index has already reduced the field to a small candidate set.
  const haystack = `${row.title} ${row.content}`.toLowerCase();
  const phraseBonus = phrase.length > 3 && haystack.includes(phrase) ? 2 : 0;

  const ageDays = Math.max(0, (now - Date.parse(row.created_at)) / 86_400_000);
  const recency = 2 ** (-ageDays / HALF_LIFE_DAYS);
  const weight = (KIND_WEIGHT[row.kind] ?? 1) * (STATUS_WEIGHT[row.epistemic_status] ?? 1);

  // Recency is additive rather than multiplicative so that age can never drive
  // a strongly relevant old memory to zero. That was the failure the newest-N
  // window made structural.
  return { matched, score: (relevance + phraseBonus + recency) * weight };
}

/** The read half of recall, on an open connection so callers can reuse it. */
async function recallOn(db, projectId, options = {}) {
  const { text = "", kinds, taskId, featureId, sessionId, includeSuperseded = false } = options;
  const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_LIMIT, MAX_LIMIT));

  const kindList = (Array.isArray(kinds) ? kinds : kinds ? [kinds] : []).filter((k) => KINDS.has(k));
  const phrase = String(text ?? "").trim().toLowerCase();
  const tokens = [...new Set(tokenize(phrase))];
  const { about } = options;

  const where = ["m.project_id = ?"];
  const params = [projectId];
  if (!includeSuperseded) where.push("m.superseded_by IS NULL");
  if (kindList.length) {
    where.push(`m.kind IN (${kindList.map(() => "?").join(",")})`);
    params.push(...kindList);
  }
  if (taskId) { where.push("m.task_id = ?"); params.push(taskId); }
  if (featureId) { where.push("m.feature_id = ?"); params.push(featureId); }
  if (sessionId) { where.push("m.session_id = ?"); params.push(sessionId); }

  // Structured recall also reaches through the links, not only the direct
  // columns, so "what do we remember about this decision" actually works.
  if (about && about.targetType && about.targetId) {
    where.push(`EXISTS (SELECT 1 FROM memory_links l
                        WHERE l.memory_id = m.id AND l.target_type = ? AND l.target_id = ?)`);
    params.push(about.targetType, about.targetId);
  }

  let rows;
  if (tokens.length) {
    // Candidates come through the inverted index, so a relevant memory stays
    // reachable however old it is and however many newer ones exist. The
    // previous newest-N window silently hid exactly the long-lived facts that
    // memory is for.
    rows = await db.all(
      `SELECT m.*, SUM(t.frequency * t.field_weight) AS term_score,
              COUNT(DISTINCT t.term) AS matched_terms
         FROM memory_entries m
         JOIN memory_search_terms t ON t.memory_id = m.id
        WHERE ${where.join(" AND ")}
          AND t.term IN (${tokens.map(() => "?").join(",")})
        GROUP BY m.id
        ORDER BY matched_terms DESC, term_score DESC
        LIMIT ?`,
      ...params, ...tokens, CANDIDATE_CAP,
    );
  } else {
    // With no query text the honest ranking is recency times authority, which
    // is what "what happened here lately" means.
    rows = await db.all(
      `SELECT m.*, 0 AS term_score, 0 AS matched_terms FROM memory_entries m
        WHERE ${where.join(" AND ")}
        ORDER BY m.created_at DESC LIMIT ?`,
      ...params, CANDIDATE_CAP,
    );
  }

  const now = Date.now();
  const scored = rows
    .map((row) => ({ row, ...scoreRow(row, tokens, phrase, now) }))
    .filter((entry) => !tokens.length || entry.matched > 0)
    .sort((a, b) => b.score - a.score || b.row.created_at.localeCompare(a.row.created_at));

  const best = scored[0]?.score ?? 0;
  const kept = scored.filter((entry) => entry.score >= best * RELATIVE_FLOOR).slice(0, limit);
  const links = await linksOf(db, kept.map((entry) => entry.row.id));

  return kept.map((entry) => shape(entry.row, {
    score: Math.round(entry.score * 1000) / 1000,
    links: links.get(entry.row.id) ?? [],
  }));
}

async function recallLocal(root, options = {}) {
  return query(root, async (db) => {
    const project = await currentProject(db);
    if (!project) return [];
    return recallOn(db, project.id, options);
  });
}

// ---------------------------------------------------------------- verifying

/**
 * A recalled fact is checked against what the records say now: the linked
 * specifications, the decisions that govern them, and the evidence recorded
 * since the memory was written. `stillTrue` is null when there was nothing to
 * check it against, because reporting true for an unverifiable claim is the
 * failure this function exists to prevent.
 */
async function verifyLocal(root, memoryId) {
  return query(root, async (db) => {
    const memory = await db.get("SELECT * FROM memory_entries WHERE id = ?", memoryId);
    if (!memory) throw new DbError("E_NOT_FOUND", `Memory ${memoryId} does not exist.`);

    const checkedAgainst = [];
    const contradictions = [];

    if (memory.superseded_by) {
      contradictions.push({
        targetType: "memory_entry",
        targetId: memory.superseded_by,
        reason: `This memory was superseded by ${memory.superseded_by}. Read that one instead.`,
      });
    }
    if (memory.epistemic_status === "contradicted") {
      contradictions.push({
        targetType: "memory_entry",
        targetId: memory.id,
        reason: "This memory is already marked contradicted.",
      });
    }

    const linkRows = await db.all("SELECT * FROM memory_links WHERE memory_id = ?", memoryId);
    const targets = [];
    const seen = new Set();
    const push = (targetType, targetId) => {
      const key = `${targetType}:${targetId}`;
      if (!targetId || seen.has(key)) return;
      seen.add(key);
      targets.push({ targetType, targetId });
    };
    // The recorded state at link time is what makes verification honest. A link
    // row carries the target's version and fingerprint as they were when the
    // memory was written; without that, existence is the only available signal
    // and existence proves nothing.
    const recorded = new Map();
    for (const row of linkRows) {
      push(row.target_type, row.target_id);
      recorded.set(`${row.target_type}:${row.target_id}`, {
        version: row.target_version,
        fingerprint: row.target_fingerprint,
      });
    }
    push("task", memory.task_id);
    push("feature", memory.feature_id);

    let anyChanged = false;
    let anyConfirmed = false;

    for (const target of targets) {
      const table = tableFor(target.targetType);
      if (!table) {
        checkedAgainst.push({ ...target, found: false, outcome: "unverifiable", note: "unknown record type, nothing to check against" });
        continue;
      }
      const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, target.targetId);
      if (!row) {
        checkedAgainst.push({ ...target, found: false, outcome: "contradicted" });
        contradictions.push({ ...target, reason: `${target.targetType} ${target.targetId} no longer exists.` });
        continue;
      }

      const was = recorded.get(`${target.targetType}:${target.targetId}`);
      const now = await targetState(db, target.targetType, target.targetId);
      const movedAt = row.updated_at ?? row.accepted_at ?? null;

      let outcome;
      if (!was || (was.fingerprint === null && was.version === null)) {
        // A link made before state capture existed, or to a record that carries
        // neither. Nothing can be compared, so nothing is claimed.
        outcome = "unverifiable";
      } else if (was.fingerprint && now.fingerprint && was.fingerprint === now.fingerprint) {
        outcome = "verified";
        anyConfirmed = true;
      } else {
        // The record moved after the memory was written. That does not make the
        // memory wrong, and it certainly does not make it right, so it is
        // referred for review rather than silently passed.
        outcome = "needs_review";
        anyChanged = true;
      }

      checkedAgainst.push({
        ...target,
        found: true,
        outcome,
        status: row.status ?? null,
        updatedAt: movedAt,
        recordedVersion: was?.version ?? null,
        currentVersion: now.version,
        changedSince: outcome === "needs_review",
      });

      if (target.targetType === "decision" && DEAD_DECISION.has(row.status)) {
        contradictions.push({ ...target, reason: `Decision ${row.id} is now ${row.status.replace(/_/g, " ")}, so it no longer governs.` });
      }
      if ((memory.kind === "blocker" || memory.kind === "unresolved_question") && TERMINAL_WORK.has(row.status)) {
        contradictions.push({ ...target, reason: `This memory records open work, but ${target.targetType} ${row.id} is ${row.status}.` });
      }
    }

    // Evidence recorded after the memory is the strongest live signal there is:
    // a failing run after a remembered success means the memory is out of date.
    const taskIds = targets.filter((t) => t.targetType === "task").map((t) => t.targetId);
    if (memory.task_id && !taskIds.includes(memory.task_id)) taskIds.push(memory.task_id);
    for (const taskId of taskIds) {
      const evidence = await db.all(
        `SELECT * FROM verification_evidence
         WHERE task_id = ? AND recorded_at > ? AND status <> 'superseded'
         ORDER BY recorded_at DESC LIMIT 5`,
        taskId, memory.created_at,
      );
      for (const row of evidence) {
        checkedAgainst.push({
          targetType: "verification_evidence",
          targetId: row.id,
          found: true,
          status: row.status,
          result: row.result,
          updatedAt: row.recorded_at,
          changedSince: true,
        });
        if (row.result === "fail" && (memory.kind === "outcome" || memory.kind === "learned_fact")) {
          contradictions.push({
            targetType: "verification_evidence",
            targetId: row.id,
            reason: `Evidence recorded after this memory failed: ${row.summary}`,
          });
        }
      }
    }

    // Four states, in precedence order. "verified" is reachable only when every
    // record this memory names is byte-identical to what it was when the memory
    // was written. Existence alone never gets there.
    let state;
    if (contradictions.length) state = "contradicted";
    else if (anyChanged) state = "needs_review";
    else if (anyConfirmed) state = "verified";
    else state = "unverifiable";

    const NOTE = {
      verified: "Every record this memory names is unchanged since it was written. Confirm anything consequential in the record itself.",
      contradicted: "The records disagree with this memory. Trust the records.",
      needs_review: "A record this memory names has changed since it was written, and exact equivalence could not be established. Re-read the record before acting on this.",
      unverifiable: "There was nothing current to check this against. Treat it as unverified and confirm by hand before acting on it.",
    };

    return {
      memory: shape(memory, { links: linkRows.map((r) => ({ targetType: r.target_type, targetId: r.target_id, relationship: r.relationship })) }),
      state,
      // Kept for callers that want a tri-state, and deliberately null for both
      // needs_review and unverifiable: neither is a claim of truth.
      stillTrue: state === "verified" ? true : state === "contradicted" ? false : null,
      checkedAgainst,
      contradictions,
      checkedAt: nowIso(),
      note: NOTE[state],
    };
  });
}

// ------------------------------------------------------------------- handoff

/** Everything the next agent needs to resume, without any conversation history. */
async function handoffLocal(root, sessionId) {
  return query(root, async (db) => {
    const session = await db.get("SELECT * FROM work_sessions WHERE id = ?", sessionId);
    if (!session) throw new DbError("E_NOT_FOUND", `Session ${sessionId} does not exist.`);

    const developer = session.developer_id
      ? await db.get("SELECT * FROM developers WHERE id = ?", session.developer_id) : null;
    const agent = session.agent_id
      ? await db.get("SELECT * FROM agents WHERE id = ?", session.agent_id) : null;
    const branch = session.branch_id
      ? await db.get("SELECT * FROM branches WHERE id = ?", session.branch_id) : null;
    const task = session.active_task_id
      ? await db.get("SELECT * FROM tasks WHERE id = ?", session.active_task_id) : null;
    const feature = task?.feature_id
      ? await db.get("SELECT * FROM features WHERE id = ?", task.feature_id) : null;

    const contracts = task
      ? await db.all(
        "SELECT target_type, target_id, relationship FROM task_contract_links WHERE task_id = ?", task.id)
      : [];
    const dependencies = task
      ? await db.all(
        `SELECT t.id, t.name, t.status, d.dependency_type
           FROM task_dependencies d JOIN tasks t ON t.id = d.depends_on_task_id
          WHERE d.task_id = ? AND t.status NOT IN ('complete','cancelled','superseded')`, task.id)
      : [];
    const openSubtasks = task
      ? await db.all(
        `SELECT id, name, status FROM tasks
          WHERE parent_task_id = ? AND status NOT IN ('complete','cancelled','superseded')
          ORDER BY sequence, id`, task.id)
      : [];
    const evidence = task
      ? await db.all(
        `SELECT id, evidence_type, summary, reference, result, status, recorded_at
           FROM verification_evidence WHERE task_id = ?
          ORDER BY recorded_at DESC LIMIT 5`, task.id)
      : [];

    const acceptance = feature
      ? await db.all(
        `SELECT id, criterion, verification_method, status FROM feature_acceptance_criteria
          WHERE feature_id = ? AND status = 'unmet' ORDER BY sequence LIMIT 20`, feature.id)
      : [];

    // Accepted and time-boxed decisions constrain the next agent. Project-wide
    // ones always apply; scoped ones only when they name this feature.
    const decisions = await db.all(
      `SELECT id, title, status, decision, observable_rationale, scope_type, scope_id, expires_at
         FROM decisions
        WHERE project_id = ? AND status IN ('accepted','time_boxed')
          AND (scope_id IS NULL OR scope_id = ?)
        ORDER BY updated_at DESC LIMIT 20`,
      session.project_id, feature?.id ?? "",
    );

    const questions = await db.all(
      `SELECT id, question, why_it_matters, recommendation, scope_type, scope_id
         FROM questions WHERE project_id = ? AND status = 'open'
        ORDER BY CASE WHEN scope_id = ? THEN 0 ELSE 1 END, created_at DESC LIMIT 10`,
      session.project_id, feature?.id ?? "",
    );

    const pendingDocumentation = await db.all(
      `SELECT id, kind, path, sync_status FROM documents
        WHERE project_id = ? AND sync_status IN ('manual_edit_pending','missing')
        ORDER BY path LIMIT 20`,
      session.project_id,
    );

    const recentActivity = await db.all(
      `SELECT id, event_type, summary, actor_label, created_at, sequence
         FROM activity_events
        WHERE project_id = ? AND (session_id = ? OR (task_id IS NOT NULL AND task_id = ?))
        ORDER BY sequence DESC LIMIT 15`,
      session.project_id, session.id, task?.id ?? null,
    );

    const memory = await recallOn(db, session.project_id, { sessionId: session.id, limit: 12 });
    const blockers = await recallOn(db, session.project_id, {
      kinds: ["blocker", "unresolved_question"],
      taskId: task?.id,
      limit: 8,
    });

    return {
      generatedAt: nowIso(),
      session: {
        id: session.id,
        projectId: session.project_id,
        objective: session.objective,
        status: session.status,
        startedAt: session.started_at,
        lastActivityAt: session.last_activity_at,
        endedAt: session.ended_at,
        outcome: session.outcome,
        handoff: session.handoff,
      },
      developer: developer && { id: developer.id, displayName: developer.display_name, status: developer.status },
      agent: agent && { id: agent.id, harness: agent.harness, modelLabel: agent.model_label, status: agent.status, lastSeenAt: agent.last_seen_at },
      branch: branch && { id: branch.id, name: branch.name, headRevision: branch.head_revision, dirty: Boolean(branch.dirty), status: branch.status },
      activeTask: task && {
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        description: task.description,
        expectedOutcome: task.expected_outcome,
        whyNeeded: task.why_needed,
        completionCriteria: json(task.completion_criteria_json),
        verificationRequirements: json(task.verification_requirements_json),
        affectedBoundaries: json(task.affected_boundaries_json),
        blockReason: task.block_reason,
        enabling: Boolean(task.enabling),
        enabledFeatureId: task.enabled_feature_id,
        contracts,
        dependencies,
        openSubtasks,
      },
      feature: feature && {
        id: feature.id,
        name: feature.name,
        purpose: feature.purpose,
        status: feature.status,
        specDepth: feature.spec_depth,
        riskLevel: feature.risk_level,
        whatWorksNow: feature.what_works_now,
        whatRemains: feature.what_remains,
        nextAction: feature.next_action,
        unmetAcceptanceCriteria: acceptance,
      },
      governingDecisions: decisions,
      openQuestions: questions,
      blockers,
      memory,
      evidence,
      pendingDocumentation,
      recentActivity,
      nextAction: session.next_action ?? feature?.next_action ?? null,
      note: `Memory in this packet is ${RECALL_NOTE.charAt(0).toLowerCase()}${RECALL_NOTE.slice(1)}`,
    };
  });
}

// ---------------------------------------------------------------------- seam

/**
 * The seam a remote memory service plugs into later. Every function takes and
 * returns ids that already exist elsewhere (SES-, TASK-, FEAT-, MEM-), so
 * swapping the store cannot change a task or a project identity, and a remote
 * store only has to satisfy these six calls.
 */
export const localMemory = {
  remember: rememberLocal,
  recall: recallLocal,
  link: linkLocal,
  supersede: supersedeLocal,
  handoff: handoffLocal,
  verify: verifyLocal,
};

let backend = localMemory;

/** Swap the memory store. Passing nothing restores the local one. */
export function useMemoryStore(store) {
  backend = store ?? localMemory;
  return backend;
}

export const remember = (root, entry) => backend.remember(root, entry);
export const recall = (root, options) => backend.recall(root, options);
export const linkMemory = (root, memoryId, targetType, targetId, relationship) =>
  backend.link(root, memoryId, targetType, targetId, relationship);
export const supersede = (root, memoryId, replacementId, opts) =>
  backend.supersede(root, memoryId, replacementId, opts);
export const handoffPacket = (root, sessionId) => backend.handoff(root, sessionId);
export const verifyRecall = (root, memoryId) => backend.verify(root, memoryId);
