// Reversible answers, and what would make each worth revisiting.
//
// Section 8.4 says "I do not know" is a valid answer, that Superdev may
// recommend a reversible assumption, and that it must record the assumption
// and its review trigger. Without a place to put one, an assumption becomes an
// undocumented guess: nobody knows it was assumed rather than decided, and
// nobody knows when to check it again.
//
// The review trigger is required for exactly that reason. An assumption with no
// trigger is never reviewed and quietly hardens into a fact nobody chose.

import { create, mutate, query, setStatus } from "../db/store.mjs";
import { assertStorable } from "../model/screening.mjs";

export const E = { NOT_FOUND: "E_NOT_FOUND", INVALID: "E_INVALID" };

export class AssumptionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AssumptionError";
    this.code = code;
  }
}

export const ASSUMPTION_STATUSES = ["holding", "confirmed", "overturned", "expired"];

/**
 * Record an assumption.
 *
 * Three things are required and each earns its place: the statement, because
 * an unstated assumption cannot be checked; why it was assumed rather than
 * decided, because that is what separates it from a decision nobody wrote down;
 * and the review trigger, because without one it is never revisited.
 */
export async function recordAssumption(root, input = {}) {
  const statement = String(input.statement ?? "").trim();
  const whyAssumed = String(input.whyAssumed ?? "").trim();
  const reviewTrigger = String(input.reviewTrigger ?? "").trim();

  if (!statement) throw new AssumptionError(E.INVALID, "An assumption needs its statement.");
  if (!whyAssumed) {
    throw new AssumptionError(E.INVALID,
      "Say why this is assumed rather than decided. Without that it reads as a decision nobody recorded.");
  }
  if (!reviewTrigger) {
    throw new AssumptionError(E.INVALID,
      "An assumption needs its review trigger. Without one nobody knows when to check it, and it hardens into a fact nobody chose.");
  }

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new AssumptionError(E.NOT_FOUND, "There is no project to record an assumption against.");

    if (input.questionId) {
      const q = await db.get("SELECT id FROM questions WHERE id = ?", input.questionId);
      if (!q) throw new AssumptionError(E.NOT_FOUND, `There is no question ${input.questionId}.`);
    }

    return create(db, "assumption", {
      project_id: project.id,
      statement: assertStorable("statement", statement),
      why_assumed: assertStorable("why_assumed", whyAssumed),
      review_trigger: assertStorable("review_trigger", reviewTrigger),
      consequence_if_wrong: input.consequenceIfWrong
        ? assertStorable("consequence_if_wrong", String(input.consequenceIfWrong)) : null,
      scope_type: input.scopeType ?? null,
      scope_id: input.scopeId ?? null,
      question_id: input.questionId ?? null,
      status: "holding",
    }, {
      projectId: project.id,
      actor: input.actor ?? "superdev",
      sessionId: input.sessionId ?? null,
      activityType: "assumption_recorded",
      activitySummary: `Assumption recorded: ${statement}`.slice(0, 200),
    });
  });
}

/**
 * Resolve an assumption, saying what it turned out to be.
 *
 * Confirmed and overturned are both resolutions worth recording. An overturned
 * assumption that leaves no trace is how a project forgets that it once
 * believed something and acted on it.
 */
export async function resolveAssumption(root, assumptionId, { to, resolution, actor = "superdev" } = {}) {
  if (!ASSUMPTION_STATUSES.includes(to)) {
    throw new AssumptionError(E.INVALID,
      `"${to}" is not an assumption status. Use one of: ${ASSUMPTION_STATUSES.join(", ")}.`);
  }
  if (to !== "holding" && !String(resolution ?? "").trim()) {
    throw new AssumptionError(E.INVALID,
      "Say what it turned out to be. A resolved assumption with no resolution loses the answer it was standing in for.");
  }

  return mutate(root, async (db) => {
    const row = await db.get("SELECT * FROM assumptions WHERE id = ?", assumptionId);
    if (!row) throw new AssumptionError(E.NOT_FOUND, `There is no assumption ${assumptionId}.`);
    if (row.status === to) {
      throw new AssumptionError(E.INVALID, `${assumptionId} is already ${to}.`);
    }
    await db.run(
      "UPDATE assumptions SET resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?",
      resolution ? assertStorable("resolution", String(resolution)) : null,
      actor, new Date().toISOString(), assumptionId,
    );
    return setStatus(db, "assumption", assumptionId, to, { actor, reason: resolution ?? null });
  });
}

/** Every assumption, the ones still holding first because those are live. */
export async function listAssumptions(root, { status = null } = {}) {
  return query(root, (db) => db.all(
    `SELECT * FROM assumptions
      ${status ? "WHERE status = ?" : ""}
      ORDER BY CASE status WHEN 'holding' THEN 0 ELSE 1 END, created_at DESC`,
    ...(status ? [status] : []),
  ));
}
