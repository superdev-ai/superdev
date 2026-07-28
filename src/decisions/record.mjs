// Record a decision, and supersede one that no longer holds.
//
// The decisions table, its transitions, its supersession chain and the reports
// built on them all existed. Nothing could write a row. There was no CLI
// command, no service mutation, and convertDiscovery turns accepted content
// into goals, modules and features only, so a decision could be transitioned,
// governed by, reported on and expired, but never made.
//
// That is why the twenty decisions in this project's own database were written
// by a script reading the ADR files rather than by the product.
//
// The rules here are the ones the rest of the system already assumes:
//
//   A decision states what was decided and why in observable terms. The
//   rationale is what a reader can check, not what a model was thinking.
//
//   Superseding is a link in both directions plus a status move on the old
//   decision, done in one transaction. Half of that leaves the reports
//   disagreeing about what governs.
//
//   A partial supersession says which part stops applying. Without that nobody
//   can tell what the old decision still governs, which is the same rule
//   transitionDecision already enforces.

import { create, mutate, query, setStatus } from "../db/store.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  INVALID: "E_INVALID",
  ALREADY_SUPERSEDED: "E_ALREADY_SUPERSEDED",
};

export class DecisionError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "DecisionError";
    this.code = code;
    this.detail = detail;
  }
}

const asList = (value) => {
  if (value === null || value === undefined) return [];
  return (Array.isArray(value) ? value : [value])
    .map((v) => String(v).trim())
    .filter(Boolean);
};

/**
 * Record a decision.
 *
 * A title and the decision itself are required, because a record with neither
 * is a heading nobody can act on. Everything else is optional and defaults to
 * the empty shape the schema already declares.
 */
export async function recordDecision(root, input = {}) {
  const title = String(input.title ?? "").trim();
  const decision = String(input.decision ?? "").trim();
  if (!title) {
    throw new DecisionError(E.INVALID, "A decision needs a title, in plain language, so it can be found again.");
  }
  if (!decision) {
    throw new DecisionError(E.INVALID,
      "A decision needs to say what was decided. A title alone records that a choice happened, not what it was.");
  }

  const {
    context = null, rationale = null, verification = null,
    scopeType = null, scopeId = null, status = "proposed",
    acceptedBy = null, expiresAt = null, actor = "superdev", sessionId = null,
  } = input;

  if (scopeType && !scopeId) {
    throw new DecisionError(E.INVALID, `A decision scoped to a ${scopeType} has to name which one.`);
  }

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new DecisionError(E.NOT_FOUND, "There is no project to record a decision against.");

    const row = await create(db, "decision", {
      project_id: project.id,
      title,
      decision,
      context,
      observable_rationale: rationale,
      verification,
      scope_type: scopeType,
      scope_id: scopeId,
      status,
      accepted_by: acceptedBy,
      accepted_at: status === "accepted" ? new Date().toISOString() : null,
      expires_at: expiresAt,
      evidence_json: JSON.stringify(asList(input.evidence)),
      criteria_json: JSON.stringify(asList(input.criteria)),
      options_json: JSON.stringify(asList(input.options)),
      risks_json: JSON.stringify(asList(input.risks)),
      enforcement_json: JSON.stringify(asList(input.enforcement)),
      revisit_triggers_json: JSON.stringify(asList(input.revisitTriggers)),
    }, {
      projectId: project.id,
      actor,
      sessionId,
      activityType: "decision_recorded",
      activitySummary: `Decision recorded: ${title}`,
    });

    // A decision that governs something says so, or the reports that ask what
    // binds a module find nothing and report that nothing does.
    for (const target of asList(input.governs)) {
      const [targetType, targetId] = target.split(":");
      if (!targetType || !targetId) {
        throw new DecisionError(E.INVALID,
          `"${target}" is not a link. Write it as <type>:<id>, for example module:MOD-0001.`);
      }
      await create(db, "decision_link", {
        decision_id: row.id,
        target_type: targetType,
        target_id: targetId,
        relationship: "governs",
        scope_note: "The record this decision binds. Changing it here means superseding the decision, not editing around it.",
      }, { projectId: project.id, actor, sessionId, activityType: "decision_recorded",
           activitySummary: `${row.id} governs ${targetId}` });
    }

    return row;
  });
}

/**
 * Record a decision that replaces an earlier one.
 *
 * Both directions of the link and the old decision's status move happen in one
 * transaction. Writing the new decision first and the supersession afterwards
 * leaves a window where two decisions both claim to govern the same thing, and
 * whichever report runs in that window is wrong.
 */
export async function supersedeDecision(root, supersededId, input = {}) {
  const scopeDelta = String(input.scopeDelta ?? "").trim();
  const partial = Boolean(input.partial);
  if (partial && !scopeDelta) {
    throw new DecisionError(E.INVALID,
      "A partial supersession has to say which part stops applying, otherwise nobody can tell what still governs.");
  }

  const existing = await query(root, (db) => db.get("SELECT * FROM decisions WHERE id = ?", supersededId));
  if (!existing) throw new DecisionError(E.NOT_FOUND, `There is no decision ${supersededId}.`);
  if (existing.superseded_by_id) {
    throw new DecisionError(E.ALREADY_SUPERSEDED,
      `${supersededId} was already superseded by ${existing.superseded_by_id}. Supersede that one instead, so the chain stays a chain.`);
  }

  const replacement = await recordDecision(root, {
    ...input,
    status: input.status ?? "accepted",
  });

  return mutate(root, async (db) => {
    await db.run("UPDATE decisions SET supersedes_id = ? WHERE id = ?", supersededId, replacement.id);
    await db.run("UPDATE decisions SET superseded_by_id = ? WHERE id = ?", replacement.id, supersededId);
    await setStatus(db, "decision", supersededId, partial ? "partially_superseded" : "superseded", {
      actor: input.actor ?? "superdev",
      reason: scopeDelta || `Superseded by ${replacement.id}.`,
    });
    return { ...replacement, supersedes: supersededId, partial };
  });
}
