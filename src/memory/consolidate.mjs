// Keeping memory worth reading.
//
// Section 15.9 asks the memory system to periodically merge duplicates, connect
// related memories, supersede outdated statements, discard low value noise,
// detect contradictions, preserve provenance and recalculate retrieval
// metadata. Without that, memory grows until recall returns everything and
// therefore nothing.
//
// Nothing here deletes a memory that carries a claim. Superseding keeps the
// statement and marks what replaced it, because a memory that was believed and
// turned out wrong is itself worth knowing. Only memories that carry no claim,
// the operational noise section 15.9 names, are removed outright.
//
// Every judgement is structural rather than semantic: identical content, an
// exact contradiction of an earlier statement, a link to a record that no
// longer exists. A consolidation pass that guessed at meaning would quietly
// rewrite what the project believes.

import { mutate, query } from "../db/store.mjs";
import { tokenize } from "./index.mjs";

/** Memory kinds that carry a claim worth keeping even once superseded. */
const CLAIM_KINDS = new Set(["decision", "learned_fact", "outcome", "blocker", "unresolved_question"]);

/** How stale a session-scoped summary has to be before it is noise. */
const NOISE_AFTER_DAYS = 30;

const DAY = 86_400_000;

/**
 * Run a consolidation pass.
 *
 * Without `apply` nothing changes, which makes this safe to run at any time and
 * is the mode worth putting in front of a person: it says what would be merged
 * and what contradicts what, without changing the answer.
 */
export async function consolidate(root, { apply = false, now = Date.now() } = {}) {
  const state = await query(root, async (db) => ({
    entries: await db.all(
      `SELECT id, project_id, kind, title, content, content_hash, epistemic_status,
              superseded_by, created_at, session_id, task_id, feature_id
         FROM memory_entries ORDER BY created_at, id`),
    links: await db.all("SELECT memory_id, target_type, target_id FROM memory_links"),
    terms: await db.all("SELECT memory_id, COUNT(*) n FROM memory_search_terms GROUP BY memory_id"),
  }));

  const live = state.entries.filter((e) => !e.superseded_by);
  const termCount = new Map(state.terms.map((t) => [t.memory_id, t.n]));

  // Duplicates: the same content said twice. The earliest is kept because it is
  // the one other records may already point at, and the later ones are marked
  // as superseded by it rather than deleted.
  const byHash = new Map();
  const duplicates = [];
  for (const entry of live) {
    const key = entry.content_hash || `${entry.kind}:${String(entry.content ?? "").trim()}`;
    if (!key) continue;
    if (byHash.has(key)) duplicates.push({ duplicate: entry, keep: byHash.get(key) });
    else byHash.set(key, entry);
  }

  // Contradictions: two live memories about the same records saying opposite
  // things. Detected structurally, by one statement negating another that
  // shares its subject, never by judging which is true.
  const linksByMemory = new Map();
  for (const l of state.links) {
    if (!linksByMemory.has(l.memory_id)) linksByMemory.set(l.memory_id, new Set());
    linksByMemory.get(l.memory_id).add(`${l.target_type}:${l.target_id}`);
  }
  const contradictions = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      const sharedTargets = [...(linksByMemory.get(a.id) ?? [])]
        .filter((t) => (linksByMemory.get(b.id) ?? new Set()).has(t));
      if (sharedTargets.length === 0) continue;
      if (!negates(a.content, b.content)) continue;
      contradictions.push({ earlier: a.id, later: b.id, about: sharedTargets[0] });
    }
  }

  // Noise: a session summary old enough that its session is long over, carrying
  // no claim and linked to nothing. Section 15.9 asks for these to be
  // discarded, and they are the only thing here that is.
  const linked = new Set(state.links.map((l) => l.memory_id));
  const noise = live.filter((e) =>
    !CLAIM_KINDS.has(e.kind)
    && !linked.has(e.id)
    && now - Date.parse(e.created_at || 0) > NOISE_AFTER_DAYS * DAY);

  // Retrieval metadata that was never built. A memory with no search terms
  // cannot be found lexically, which is the first retrieval stage 15.7 names.
  const missingTerms = live.filter((e) => !termCount.get(e.id));

  // Links pointing at records that no longer exist. Section 14.2 says memory
  // links cannot reference missing records.
  const danglingLinks = await query(root, async (db) => {
    const out = [];
    const tables = {
      goal: "goals", milestone: "milestones", module: "modules", feature: "features",
      workflow: "workflows", task: "tasks", decision: "decisions", data_entity: "data_entities",
      surface: "surfaces", api_operation: "api_operations", integration: "integrations",
      change: "changes", assumption: "assumptions", question: "questions",
    };
    for (const l of state.links) {
      const table = tables[l.target_type];
      if (!table) continue;
      const hit = await db.get(`SELECT 1 AS ok FROM ${table} WHERE id = ?`, l.target_id);
      if (!hit) out.push(l);
    }
    return out;
  });

  const plan = {
    applied: apply,
    live: live.length,
    duplicatesMerged: duplicates.length,
    contradictionsFound: contradictions.length,
    noiseDiscarded: noise.length,
    retrievalTermsRebuilt: missingTerms.length,
    danglingLinksRemoved: danglingLinks.length,
    contradictions: contradictions.slice(0, 10),
  };

  if (!apply) return plan;

  await mutate(root, async (db) => {
    const at = new Date().toISOString();

    for (const { duplicate, keep } of duplicates) {
      await db.run("UPDATE memory_entries SET superseded_by = ? WHERE id = ?", keep.id, duplicate.id);
    }

    // A contradiction is not resolved here. Both statements stay, and the
    // earlier one is marked contradicted so recall can warn rather than pick a
    // side, which is what 15.8 asks of a recalled memory.
    for (const c of contradictions) {
      await db.run("UPDATE memory_entries SET epistemic_status = ? WHERE id = ?", "contradicted", c.earlier);
    }

    for (const entry of noise) {
      await db.run("DELETE FROM memory_search_terms WHERE memory_id = ?", entry.id);
      await db.run("DELETE FROM memory_entries WHERE id = ?", entry.id);
    }

    for (const entry of missingTerms) {
      if (noise.some((n) => n.id === entry.id)) continue;
      await indexTerms(db, entry);
    }

    for (const l of danglingLinks) {
      await db.run(
        "DELETE FROM memory_links WHERE memory_id = ? AND target_type = ? AND target_id = ?",
        l.memory_id, l.target_type, l.target_id);
    }

    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (project) {
      await db.run(
        `INSERT INTO activity_events (id, project_id, actor_label, event_type, summary, created_at, sequence)
         VALUES ((SELECT 'EVT-' || printf('%04d', COALESCE(MAX(CAST(SUBSTR(id, 5) AS INTEGER)), 0) + 1) FROM activity_events),
                 ?, ?, ?, ?, ?,
                 (SELECT COALESCE(MAX(sequence), 0) + 1 FROM activity_events))`,
        project.id, "superdev", "memory_consolidated",
        `Memory consolidated: ${duplicates.length} duplicates merged, ${contradictions.length} contradictions marked, ${noise.length} discarded.`,
        at,
      );
    }
  });

  return plan;
}

/** Rebuild the lexical index for one entry, which is retrieval stage three. */
async function indexTerms(db, entry) {
  const fields = [["title", entry.title, 3], ["content", entry.content, 1]];
  const counts = new Map();
  for (const [field, text, weight] of fields) {
    for (const term of tokenize(text ?? "")) {
      const key = `${field}:${term}`;
      counts.set(key, { field, term, weight, n: (counts.get(key)?.n ?? 0) + 1 });
    }
  }
  for (const { field, term, weight, n } of counts.values()) {
    await db.run(
      `INSERT OR REPLACE INTO memory_search_terms (memory_id, term, field, frequency, field_weight)
       VALUES (?, ?, ?, ?, ?)`,
      entry.id, term, field, n, weight,
    );
  }
}

/**
 * Does one statement negate another?
 *
 * Structural only: the same words with a negation on one side and not the
 * other. This finds "the service holds the lock" against "the service does not
 * hold the lock" and finds nothing clever, which is the intent. Judging meaning
 * would let a consolidation pass rewrite what the project believes.
 */
function negates(a, b) {
  const NEG = /\b(not|never|no longer|cannot|does not|is not|was not)\b/i;
  const strip = (t) => String(t ?? "").toLowerCase().replace(NEG, " ").replace(/\s+/g, " ").trim();
  const aNeg = NEG.test(String(a ?? ""));
  const bNeg = NEG.test(String(b ?? ""));
  if (aNeg === bNeg) return false;
  const sa = strip(a);
  const sb = strip(b);
  if (!sa || !sb) return false;
  // The remaining words have to be substantially the same statement, not merely
  // on the same topic.
  const wa = new Set(sa.split(" ").filter((w) => w.length > 3));
  const wb = new Set(sb.split(" ").filter((w) => w.length > 3));
  if (wa.size < 3 || wb.size < 3) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size) > 0.7;
}

/**
 * What the memory system currently holds, and what it cannot do.
 *
 * Section 15.11 requires saying plainly that semantic retrieval is a bounded
 * scan when the engine has no vector index, and never describing it as indexed
 * vector search. That sentence is here rather than in a comment because it is
 * the answer to a question a person asks this command.
 */
export async function memoryStatus(root) {
  const s = await query(root, async (db) => ({
    total: (await db.get("SELECT COUNT(*) n FROM memory_entries")).n,
    live: (await db.get("SELECT COUNT(*) n FROM memory_entries WHERE superseded_by IS NULL")).n,
    superseded: (await db.get("SELECT COUNT(*) n FROM memory_entries WHERE superseded_by IS NOT NULL")).n,
    byKind: await db.all("SELECT kind, COUNT(*) n FROM memory_entries WHERE superseded_by IS NULL GROUP BY kind ORDER BY n DESC"),
    byStatus: await db.all("SELECT epistemic_status, COUNT(*) n FROM memory_entries WHERE superseded_by IS NULL GROUP BY epistemic_status ORDER BY n DESC"),
    links: (await db.get("SELECT COUNT(*) n FROM memory_links")).n,
    terms: (await db.get("SELECT COUNT(*) n FROM memory_search_terms")).n,
    indexed: (await db.get("SELECT COUNT(DISTINCT memory_id) n FROM memory_search_terms")).n,
    embeddings: (await db.get("SELECT COUNT(*) n FROM memory_embeddings")).n,
    oldest: (await db.get("SELECT MIN(created_at) t FROM memory_entries")).t,
    newest: (await db.get("SELECT MAX(created_at) t FROM memory_entries")).t,
  }));

  return {
    ...s,
    notIndexedForSearch: Math.max(0, s.live - s.indexed),
    retrieval: {
      // Section 15.7's stages, and which of them this actually performs.
      stages: ["structured filters", "record relationships", "lexical retrieval", "recency",
               "memory type weighting", "epistemic status weighting"],
      semantic: s.embeddings > 0
        ? "A bounded scan over stored vectors. The local engine has no vector index, so this is not indexed vector search."
        : "Not in use. No embeddings are stored, and section 15.11 leaves the provider undecided.",
    },
  };
}
