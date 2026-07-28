// Write a feature's specification.
//
// The depth gate refuses to accept a feature until it carries what its depth
// promises, and `feature depth` says exactly what is missing and how to close
// it. Nothing could close it. Every fix line named a database record, and no
// command wrote one, so a feature drafted by init stayed at purpose only and
// could never be accepted. The feature skill's step 8 says to fill the
// contracts the depth requires, and was not a thing anyone could do.
//
// This writes the six microspec covers, which is what stands between a drafted
// feature and an acceptable one: purpose, who wants it, what is in and out of
// scope, the primary flow, the acceptance criteria and the edge cases. Deeper
// covers hang off records that already have their own commands and their own
// homes, and are not duplicated here.
//
// Repeated values replace rather than accumulate. Specifying a flow twice means
// the flow was rewritten, not that the feature now has two of them.

import { create, mutate, json } from "../db/store.mjs";
import { EDGE_CASE_CATEGORIES } from "../model/vocabulary.mjs";
import { sanitizeExternal } from "../model/screening.mjs";

export const E = {
  NOT_FOUND: "E_FEATURE_NOT_FOUND",
  UNKNOWN_CATEGORY: "E_UNKNOWN_EDGE_CATEGORY",
  NOT_SPECIFIABLE: "E_FEATURE_NOT_SPECIFIABLE",
  NOTHING_GIVEN: "E_NOTHING_TO_SPECIFY",
};

export class SpecError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "SpecError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const clean = (value, max = 600) => {
  const text = sanitizeExternal(String(value ?? "")).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/**
 * Apply a specification to a feature.
 *
 * Everything is one transaction, so a specification that fails halfway leaves
 * the feature as it was rather than half rewritten.
 */
export async function specifyFeature(root, featureId, input = {}, { actor = "superdev", sessionId = null, apply = false } = {}) {
  const {
    purpose = null, userStatement = null, scopeIn = [], scopeOut = [],
    flow = [], criteria = [], edgeCases = [],
  } = input;

  const given = [
    purpose, userStatement,
    scopeIn.length ? scopeIn : null, scopeOut.length ? scopeOut : null,
    flow.length ? flow : null, criteria.length ? criteria : null,
    edgeCases.length ? edgeCases : null,
  ].filter(Boolean);
  if (!given.length) {
    throw new SpecError(E.NOTHING_GIVEN,
      "Nothing to specify. Pass at least one of --purpose, --user, --in, --out, --flow, --criterion or --edge.");
  }

  for (const edge of edgeCases) {
    if (!EDGE_CASE_CATEGORIES.includes(edge.category)) {
      throw new SpecError(E.UNKNOWN_CATEGORY,
        `${edge.category} is not an edge-case category. The list is fixed so a reader can walk it: ${EDGE_CASE_CATEGORIES.join(", ")}.`);
    }
  }

  const summary = {
    featureId,
    purpose: Boolean(purpose),
    userStatement: Boolean(userStatement),
    scopeIn: scopeIn.length,
    scopeOut: scopeOut.length,
    flow: flow.length,
    criteria: criteria.length,
    edgeCases: edgeCases.length,
  };
  if (!apply) return { applied: false, ...summary };

  return mutate(root, async (db) => {
    const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
    if (!feature) throw new SpecError(E.NOT_FOUND, `There is no feature ${featureId}. Run superdev feature list to see them.`);
    // An accepted feature is a contract others have linked work to. Changing it
    // is a Change, recorded through the change surface, not an edit.
    if (feature.status === "accepted" || feature.status === "complete") {
      throw new SpecError(E.NOT_SPECIFIABLE,
        `${featureId} is ${feature.status} and tasks may already implement it. Record what is moving with superdev change record, then specify it again.`);
    }

    const meta = (text) => ({
      projectId: feature.project_id, actor, sessionId,
      activityType: "specification_changed", activitySummary: clean(text, 200),
    });

    const fields = {};
    if (purpose) fields.purpose = clean(purpose, 1000);
    if (userStatement) fields.user_statement = clean(userStatement, 1000);
    if (scopeIn.length) fields.scope_in_json = JSON.stringify(scopeIn.map((x) => clean(x, 300)).filter(Boolean));
    if (scopeOut.length) fields.scope_out_json = JSON.stringify(scopeOut.map((x) => clean(x, 300)).filter(Boolean));
    if (Object.keys(fields).length) {
      const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
      await db.run(`UPDATE features SET ${sets} WHERE id = ?`, ...Object.values(fields), featureId);
    }

    if (flow.length) {
      await db.run("DELETE FROM feature_flows WHERE feature_id = ?", featureId);
      for (const [index, step] of flow.entries()) {
        await create(db, "feature_flow", {
          feature_id: featureId, sequence: index + 1, step: clean(step, 400),
        }, meta(`Primary flow recorded for ${featureId}`));
      }
    }

    if (criteria.length) {
      // Criteria already carrying evidence are left alone: deleting one would
      // orphan the proof that it was met.
      const proven = await db.all(
        "SELECT id, criterion FROM feature_acceptance_criteria WHERE feature_id = ? AND evidence_id IS NOT NULL",
        featureId,
      );
      const keep = new Set(proven.map((c) => c.criterion));
      await db.run(
        "DELETE FROM feature_acceptance_criteria WHERE feature_id = ? AND evidence_id IS NULL",
        featureId,
      );
      let sequence = proven.length;
      for (const criterion of criteria) {
        const text = clean(criterion.criterion ?? criterion, 500);
        if (!text || keep.has(text)) continue;
        sequence += 1;
        await create(db, "feature_acceptance_criterion", {
          feature_id: featureId,
          criterion: text,
          verification_method: clean(criterion.verification ?? "Checked by hand against the running product.", 300),
          status: "unmet",
          sequence,
        }, meta(`Acceptance criterion recorded for ${featureId}`));
      }
    }

    if (edgeCases.length) {
      for (const edge of edgeCases) {
        const notApplicable = edge.applicability === "not_applicable";
        const behavior = clean(edge.behavior, 500);
        // One row per category, so specifying the same category twice is the
        // same question answered again rather than asked twice.
        await db.run(
          "DELETE FROM feature_edge_cases WHERE feature_id = ? AND category = ?",
          featureId, edge.category,
        );
        await create(db, "feature_edge_case", {
          feature_id: featureId,
          category: edge.category,
          applicability: notApplicable ? "not_applicable" : "applicable",
          behavior: notApplicable ? null : behavior,
          reason_not_applicable: notApplicable ? behavior : null,
        }, meta(`Edge case recorded for ${featureId}: ${edge.category}`));
      }
    }

    const after = await db.get("SELECT * FROM features WHERE id = ?", featureId);
    return {
      applied: true,
      ...summary,
      feature: {
        id: after.id,
        name: after.name,
        status: after.status,
        depth: after.spec_depth,
        scopeIn: json(after.scope_in_json, []).length,
        scopeOut: json(after.scope_out_json, []).length,
      },
    };
  });
}

/** Declare how much specification this feature owes before it can be accepted. */
export async function setDepth(root, featureId, depth, { actor = "superdev", apply = false } = {}) {
  const { SPEC_DEPTHS } = await import("../model/vocabulary.mjs");
  if (!SPEC_DEPTHS.includes(depth)) {
    throw new SpecError(E.NOT_SPECIFIABLE,
      `${depth} is not a specification depth. Section 9.2 names three: ${SPEC_DEPTHS.join(", ")}.`);
  }
  return mutate(root, async (db) => {
    const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
    if (!feature) throw new SpecError(E.NOT_FOUND, `There is no feature ${featureId}.`);
    if (feature.spec_depth === depth) {
      return { applied: false, unchanged: true, featureId, depth, name: feature.name };
    }
    if (!apply) {
      return { applied: false, featureId, name: feature.name, from: feature.spec_depth, depth };
    }
    await db.run("UPDATE features SET spec_depth = ? WHERE id = ?", depth, featureId);
    return { applied: true, featureId, name: feature.name, from: feature.spec_depth, depth };
  });
}

/**
 * Set an acceptance criterion aside, with the reason on the record.
 *
 * The schema has carried a waived status since the first migration and nothing
 * could set it, while two refusals told the reader to waive a criterion. A
 * status no command can reach is the same as no status at all, except that it
 * makes the refusal a dead end.
 *
 * The reason is required. A waived criterion with no reason is indistinguishable
 * from one somebody quietly gave up on, which is the thing evidence gating
 * exists to prevent.
 */
export async function waiveCriterion(root, criterionId, { reason, actor = "superdev", sessionId = null, apply = false } = {}) {
  const text = clean(reason, 500);
  if (!text) {
    throw new SpecError(E.NOTHING_GIVEN,
      "Say why this criterion is being set aside. A waiver without a reason reads the same as forgetting.");
  }
  return mutate(root, async (db) => {
    const criterion = await db.get("SELECT * FROM feature_acceptance_criteria WHERE id = ?", criterionId);
    if (!criterion) throw new SpecError(E.NOT_FOUND, `There is no acceptance criterion ${criterionId}.`);
    if (criterion.status === "met") {
      throw new SpecError(E.NOT_SPECIFIABLE,
        `${criterionId} is already met, so there is nothing to waive. Retract the evidence first if it should not be.`);
    }
    const feature = await db.get("SELECT id, project_id, name FROM features WHERE id = ?", criterion.feature_id);
    if (!apply) {
      return { applied: false, criterionId, criterion: criterion.criterion, feature: feature?.id ?? null, reason: text };
    }
    await db.run(
      "UPDATE feature_acceptance_criteria SET status = 'waived', waiver_reason = ? WHERE id = ?",
      text, criterionId,
    );
    const { recordActivity } = await import("../db/store.mjs");
    await recordActivity(db, feature.project_id, {
      type: "specification_changed",
      actor,
      sessionId,
      featureId: feature.id,
      summary: `${criterionId} waived on ${feature.name}: ${text}`.slice(0, 200),
      metadata: { criterion: criterionId, reason: text },
    });
    return { applied: true, criterionId, criterion: criterion.criterion, feature: feature.id, reason: text };
  });
}
