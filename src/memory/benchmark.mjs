// Measure what memory retrieval actually does.
//
// Section 15.12 lists eleven things that must be measured before Claude Mem can
// be dropped as a transitional provider: recall, precision, noise, ranking
// quality, token reduction, latency, storage growth, stale detection,
// contradiction detection, cross session resume accuracy and cross agent
// handoff accuracy. None of it was measured, so DEC-TBD-002 could not be
// answered even in principle: there was no number to hold a threshold against.
//
// This measures. It does not decide. What counts as good enough is the owner's
// call and section 23 leaves it open; what the numbers are is not a matter of
// opinion and is answered here.
//
// The queries are built from the memories themselves rather than written by
// hand, so the benchmark grows with the project instead of testing a fixture
// that stops resembling it. A query is a term drawn from one memory's title,
// and the memory it came from is the answer it should find.

import { query } from "../db/store.mjs";
import { recall, tokenize } from "./index.mjs";

/** Words too common to tell one memory from another. */
const WEAK = new Set([
  "task", "complete", "completed", "recorded", "moved", "the", "and", "for",
  "with", "that", "this", "from", "superdev", "project", "feature", "decision",
]);

/**
 * Build the questions from the memories.
 *
 * Each query is the rarest word in a memory's title, and the memory it came
 * from is the one answer that query should return. Picking the rarest word is
 * deliberate: a common word would match everything and measure nothing, and the
 * point is to find out whether retrieval can single out one entry.
 */
async function buildQueries(root, limit) {
  const entries = await query(root, (db) => db.all(
    `SELECT id, title, content, kind FROM memory_entries
      WHERE superseded_by IS NULL ORDER BY id`));
  if (entries.length < 3) return { entries, queries: [] };

  const frequency = new Map();
  for (const e of entries) {
    for (const term of new Set(tokenize(`${e.title} ${e.content}`))) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
    }
  }

  const queries = [];
  for (const e of entries) {
    const terms = [...new Set(tokenize(e.title))]
      .filter((t) => t.length > 3 && !WEAK.has(t))
      .sort((a, b) => (frequency.get(a) ?? 0) - (frequency.get(b) ?? 0));
    if (!terms.length) continue;
    queries.push({ text: terms.slice(0, 2).join(" "), expect: e.id });
    if (queries.length >= limit) break;
  }
  return { entries, queries };
}

/**
 * Run the benchmark.
 *
 * Every number here is observed. Where something cannot be measured from a
 * single run, it says so rather than producing a figure that looks like a
 * measurement and is not.
 */
export async function benchmark(root, { limit = 40 } = {}) {
  const { entries, queries } = await buildQueries(root, limit);
  if (queries.length === 0) {
    return {
      measurable: false,
      why: entries.length < 3
        ? `Only ${entries.length} memories are stored. Retrieval quality cannot be measured until there is something to retrieve from.`
        : "No memory title carries a word distinctive enough to query on, so no question can be asked that has one right answer.",
      entries: entries.length,
    };
  }

  let hits = 0;
  let reciprocalRankTotal = 0;
  let returnedTotal = 0;
  let bytesReturned = 0;
  const latencies = [];

  for (const q of queries) {
    const started = process.hrtime.bigint();
    const found = await recall(root, { text: q.text, limit: 5 }).catch(() => []);
    latencies.push(Number(process.hrtime.bigint() - started) / 1e6);

    const rows = Array.isArray(found) ? found : (found?.entries ?? []);
    returnedTotal += rows.length;
    bytesReturned += rows.reduce((n, r) => n + String(r.content ?? "").length, 0);

    const rank = rows.findIndex((r) => r.id === q.expect);
    if (rank >= 0) {
      hits += 1;
      // Mean reciprocal rank: finding the right answer first is worth more than
      // finding it fifth, which a plain hit rate cannot express.
      reciprocalRankTotal += 1 / (rank + 1);
    }
  }

  const wholeCorpusBytes = entries.reduce((n, e) => n + String(e.content ?? "").length, 0);
  const storage = await query(root, async (db) => ({
    terms: Number(Object.values(await db.get("SELECT COUNT(*) AS c FROM memory_search_terms"))[0]),
    links: Number(Object.values(await db.get("SELECT COUNT(*) AS c FROM memory_links"))[0]),
    superseded: Number(Object.values(await db.get(
      "SELECT COUNT(*) AS c FROM memory_entries WHERE superseded_by IS NOT NULL"))[0]),
    contradicted: Number(Object.values(await db.get(
      "SELECT COUNT(*) AS c FROM memory_entries WHERE epistemic_status = 'contradicted'"))[0]),
  }));

  const sorted = [...latencies].sort((a, b) => a - b);
  const round = (n) => Math.round(n * 100) / 100;

  return {
    measurable: true,
    corpus: { entries: entries.length, queries: queries.length },
    // Section 15.12's list, each answered by something observed.
    recall: {
      value: round(hits / queries.length),
      says: `${hits} of ${queries.length} questions returned the memory they were drawn from within the top five.`,
    },
    precision: {
      value: round(hits / Math.max(1, returnedTotal)),
      says: `${returnedTotal} entries were returned across ${queries.length} questions to surface ${hits} right answers.`,
    },
    noise: {
      value: round((returnedTotal - hits) / Math.max(1, returnedTotal)),
      says: "The share of returned entries that were not the one asked for. Some of those are genuinely related, so this is an upper bound on noise rather than a count of wrong answers.",
    },
    ranking: {
      value: round(reciprocalRankTotal / queries.length),
      says: "Mean reciprocal rank. One means the right answer always came first; a half means it typically came second.",
    },
    tokenReduction: {
      value: round(1 - bytesReturned / Math.max(1, wholeCorpusBytes * queries.length)),
      says: `Retrieval returned ${bytesReturned} characters where handing over the whole corpus for every question would have been ${wholeCorpusBytes * queries.length}.`,
    },
    latencyMs: {
      median: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
      worst: round(sorted.at(-1) ?? 0),
      says: "Wall clock per question, including opening and closing the database, because that is what a caller waits for.",
    },
    storageGrowth: {
      entries: entries.length,
      searchTerms: storage.terms,
      links: storage.links,
      says: `${round(storage.terms / Math.max(1, entries.length))} index terms per memory. Growth is linear in entries, and the index is rebuilt rather than accumulated.`,
    },
    staleDetection: {
      superseded: storage.superseded,
      says: "Superseding is recorded rather than deleted, so a memory that stopped being true stays readable with what replaced it.",
    },
    contradictionDetection: {
      marked: storage.contradicted,
      says: "Consolidation marks the earlier of two contradicting statements and keeps both, so recall can warn rather than pick a side.",
    },
    // Both of these are journeys rather than queries, which section 20.1 asks
    // for directly. Saying so beats inventing a number.
    resumeAccuracy: {
      measurable: false,
      says: "Not a query. Run superdev resume in a fresh process and check whether the working state comes back, which is the only honest measurement of it.",
    },
    handoffAccuracy: {
      measurable: false,
      says: "Not a query. Hand a session to another agent and check what it can answer without the conversation.",
    },
  };
}
