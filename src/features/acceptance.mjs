// The spec-depth gate. Brief section 9.2.
//
// Depth comes from risk, and it is a promise about how much of the contract is
// written down before anyone builds against it. A feature marked `full` that
// carries microspec content is worse than one honestly marked `microspec`,
// because the depth is what a reader trusts when deciding whether to ask more
// questions.
//
// So depth is checked at the one moment it matters: acceptance. Before that a
// feature is a draft and may be as thin as it likes.

import { mutate, query, setStatus, currentProject, json, DbError } from "../db/store.mjs";
import { DEPTH_REQUIREMENTS, SPEC_DEPTHS } from "../model/vocabulary.mjs";

export const E = {
  NOT_FOUND: "E_FEATURE_NOT_FOUND",
  DEPTH_UNMET: "E_SPEC_DEPTH_UNMET",
  UNKNOWN_DEPTH: "E_UNKNOWN_SPEC_DEPTH",
};

/**
 * What each requirement means, in the words used when one is missing, plus how
 * to satisfy it. The check is deliberately shallow: it asks whether the record
 * exists, never whether it is any good. Judging quality is a person's job and
 * pretending otherwise would make the gate a nuisance rather than a help.
 */
const CHECKS = {
  purpose: {
    says: "what this feature is for",
    fix: "Set the feature's purpose.",
    met: (s) => Boolean(s.feature.purpose?.trim()),
  },
  user_statement: {
    says: "who wants it and what they are trying to do",
    fix: "Set the feature's user statement.",
    met: (s) => Boolean(s.feature.user_statement?.trim()),
  },
  scope: {
    says: "what is in scope and what is deliberately out",
    fix: "Record at least one in-scope and one out-of-scope item.",
    met: (s) => json(s.feature.scope_in_json, []).length > 0 && json(s.feature.scope_out_json, []).length > 0,
  },
  flow: {
    says: "the primary flow, step by step",
    fix: "Record the numbered primary flow.",
    met: (s) => s.flows.length > 0,
  },
  acceptance_criteria: {
    says: "how anyone can tell it works",
    fix: "Record at least one acceptance criterion with a verification method.",
    met: (s) => s.criteria.length > 0,
  },
  edge_cases: {
    says: "what happens when things go wrong",
    fix: "Walk the edge-case categories, marking each one specified or not applicable with a reason.",
    met: (s) => s.edgeCases.length > 0,
  },
  surfaces: {
    says: "the surfaces and actions a person touches",
    fix: "Record the surfaces this feature owns, or record an edge case in the platform_variance category saying it has no interface.",
    met: (s) =>
      s.surfaces.length > 0 || s.edgeCases.some((e) => e.category === "platform_variance"),
  },
  api_or_data: {
    says: "the API operations or data entities behind it",
    fix: "Record an API operation or a data entity.",
    met: (s) => s.apis.length > 0 || s.entities.length > 0,
  },
  workflow: {
    says: "the workflow and its steps",
    fix: "Record a workflow with its ordered steps.",
    met: (s) => s.workflows.length > 0 && s.steps.length > 0,
  },
  observability: {
    says: "the signals that prove it works in the open",
    fix: "Record an observability requirement, or set the workflow's observability.",
    met: (s) =>
      s.nfrs.some((n) => /observab|monitor|telemetry|logging|alert/i.test(n.category ?? "")) ||
      s.workflows.some((w) => Boolean(w.observability?.trim())),
  },
  test_plan: {
    says: "how it will be tested",
    fix: "Give each acceptance criterion a verification method, or record the module test plan.",
    met: (s) => s.criteria.length > 0 && s.criteria.every((c) => Boolean(c.verification_method?.trim())),
  },
  decision: {
    says: "the decision that governs the load-bearing choice",
    fix: "Record a decision scoped to this feature.",
    met: (s) => s.decisions.length > 0,
  },
  migration_or_rollback: {
    says: "how the data moves and how the release is undone",
    fix: "Give every schema migration a rollback plan, or record an edge case in the data_migration_states category saying why none applies.",
    // Every migration needs its rollback, not just one of them, and a feature
    // that changes no schema says so deliberately rather than by silence.
    met: (s) =>
      (s.migrations.length > 0 && s.migrations.every((m) => Boolean(m.rollback_plan?.trim()))) ||
      s.edgeCases.some((e) => e.category === "data_migration_states"),
  },
  security_privacy: {
    says: "the security and privacy analysis",
    fix: "Record a security or privacy requirement for this feature.",
    met: (s) => s.nfrs.some((n) => /secur|privac|complian/i.test(n.category ?? "")),
  },
};

async function gather(db, featureId) {
  const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
  if (!feature) throw new DbError(E.NOT_FOUND, `There is no feature ${featureId}.`);
  const all = (sql, ...p) => db.all(sql, ...p);
  const workflows = await all("SELECT * FROM workflows WHERE feature_id = ?", featureId);
  const steps = workflows.length
    ? await all(
        `SELECT * FROM workflow_steps WHERE workflow_id IN (${workflows.map(() => "?").join(",")})`,
        ...workflows.map((w) => w.id),
      )
    : [];
  return {
    feature,
    flows: await all("SELECT * FROM feature_flows WHERE feature_id = ?", featureId),
    criteria: await all("SELECT * FROM feature_acceptance_criteria WHERE feature_id = ?", featureId),
    edgeCases: await all("SELECT * FROM feature_edge_cases WHERE feature_id = ?", featureId),
    surfaces: await all("SELECT * FROM surfaces WHERE feature_id = ?", featureId),
    apis: await all("SELECT * FROM api_operations WHERE feature_id = ?", featureId),
    entities: await all("SELECT * FROM data_entities WHERE feature_id = ?", featureId),
    workflows,
    steps,
    nfrs: await all("SELECT * FROM non_functional_requirements WHERE feature_id = ?", featureId),
    migrations: await all("SELECT * FROM schema_migrations WHERE feature_id = ?", featureId),
    decisions: await all(
      `SELECT d.* FROM decisions d
        WHERE (d.scope_type = 'feature' AND d.scope_id = ?)
           OR EXISTS (SELECT 1 FROM decision_links l
                       WHERE l.decision_id = d.id AND l.target_type = 'feature' AND l.target_id = ?)`,
      featureId, featureId,
    ),
  };
}

/** What the declared depth requires, and which parts are present. */
export async function depthReadiness(db, featureId) {
  const state = await gather(db, featureId);
  const depth = String(state.feature.spec_depth ?? "standard");
  const required = DEPTH_REQUIREMENTS[depth];
  if (!required) {
    throw new DbError(E.UNKNOWN_DEPTH, `"${depth}" is not a spec depth. Use one of: ${SPEC_DEPTHS.join(", ")}.`);
  }
  const components = required.map((key) => {
    const check = CHECKS[key];
    return {
      requirement: key,
      says: check.says,
      met: Boolean(check.met(state)),
      fix: check.fix,
    };
  });
  const missing = components.filter((c) => !c.met);
  return {
    featureId,
    name: state.feature.name,
    depth,
    status: state.feature.status,
    required: components.length,
    met: components.length - missing.length,
    components,
    missing,
    acceptable: missing.length === 0,
  };
}

/**
 * Accept a feature, refusing while its declared depth is unmet.
 *
 * The refusal names every missing part at once rather than one at a time: being
 * sent back four times in a row for four separate reasons is how a gate teaches
 * people to route around it.
 */
export async function acceptFeature(root, featureId, { apply = false, actor = "superdev" } = {}) {
  const report = await query(root, (db) => depthReadiness(db, featureId));

  if (!report.acceptable) {
    throw new DbError(
      E.DEPTH_UNMET,
      `${report.name} is declared ${report.depth} depth, and ${report.missing.length} of the ${report.required} things that depth promises are missing: ` +
        report.missing.map((m) => m.says).join("; ") +
        `. Record them, or lower the depth to match what this feature actually is.`,
      { featureId, depth: report.depth, missing: report.missing },
    );
  }

  if (!apply) return { ...report, applied: false };

  await mutate(root, async (db) => {
    // Re-checked inside the transaction that accepts. Reading the gate on one
    // connection and applying on another leaves a window where the rows that
    // satisfied it can disappear between the two.
    const confirmed = await depthReadiness(db, featureId);
    if (!confirmed.acceptable) {
      throw new DbError(
        E.DEPTH_UNMET,
        `${confirmed.name} changed while it was being accepted and no longer carries what ${confirmed.depth} depth promises: ${confirmed.missing.map((x) => x.says).join("; ")}.`,
        { featureId, missing: confirmed.missing },
      );
    }
    const project = await currentProject(db);
    await setStatus(db, "feature", featureId, "accepted", {
      projectId: project?.id,
      actor,
      note: `Accepted at ${report.depth} depth with all ${report.required} requirements recorded`,
      activityType: "specification_changed",
      activitySummary: `Accepted ${report.name} at ${report.depth} depth`,
    });
  });
  return { ...report, status: "accepted", applied: true };
}

/** Every feature whose recorded depth is not backed by what it carries. */
export async function depthGaps(root) {
  return query(root, async (db) => {
    const features = await db.all("SELECT id FROM features ORDER BY id");
    const out = [];
    for (const { id } of features) {
      const report = await depthReadiness(db, id);
      // A draft is allowed to be thin. Anything already accepted is claiming
      // its depth is real, so a gap there is a live inaccuracy.
      if (!report.acceptable && report.status === "accepted") out.push(report);
    }
    return out;
  });
}

// --------------------------------------------------------------- completion

/**
 * Whether a feature's contract is satisfied, and what is missing when it is not.
 *
 * Section 6.3 says completion is derived, never asserted. This is the
 * derivation: every acceptance criterion under the feature is met or waived
 * with a reason, and every task against it is finished or deliberately stopped.
 * Nothing here reads the feature's own status, because that column is the thing
 * being decided rather than evidence about it.
 */
export async function completionReadiness(db, featureId) {
  const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
  if (!feature) throw new DbError(E.NOT_FOUND, `There is no feature ${featureId}.`);

  const criteria = await db.all(
    "SELECT id, criterion, status FROM feature_acceptance_criteria WHERE feature_id = ?", featureId);
  const tasks = await db.all(
    "SELECT id, name, status FROM tasks WHERE feature_id = ?", featureId);

  const unmet = criteria.filter((c) => !["met", "waived"].includes(c.status));
  const open = tasks.filter((t) => !["complete", "cancelled", "superseded"].includes(t.status));

  const missing = [
    criteria.length === 0
      ? { says: "no acceptance criterion, so nothing states what finishing it would mean", fix: `Record one with superdev feature specify ${featureId} --criterion.` }
      : null,
    unmet.length
      ? { says: `${unmet.length} acceptance criteria not yet met: ${unmet.map((c) => c.id).join(", ")}`,
          fix: `Attach passing evidence with superdev task evidence <task> --criterion, or waive one with superdev feature waive <AC-id> --reason.` }
      : null,
    open.length
      ? { says: `${open.length} tasks still open: ${open.map((t) => `${t.id} (${t.status})`).join(", ")}`,
          fix: "Complete or cancel them." }
      : null,
  ].filter(Boolean);

  return {
    featureId, name: feature.name, status: feature.status,
    criteria: criteria.length, tasks: tasks.length,
    complete: missing.length === 0,
    missing,
  };
}

/**
 * Move a feature to complete, and only ever because its contract says so.
 *
 * This exists because nothing did. A feature could be accepted and never
 * finished: `setStatus` was called for `accepted` and for nothing else, so the
 * only way a feature ever reached complete was a direct update that left no
 * history, which is precisely what section 7.4 forbids and what this module is
 * otherwise careful about. Eighty seven features carried a completion nobody
 * recorded, and four that genuinely were finished sat at accepted because there
 * was no way to say so.
 */
export async function completeFeature(root, featureId, { apply = false, actor = "superdev" } = {}) {
  const report = await query(root, (db) => completionReadiness(db, featureId));
  if (!report.complete) {
    throw new DbError(E.DEPTH_UNMET,
      `${report.name} is not finished: ${report.missing.map((m) => m.says).join("; ")}.`,
      { featureId, missing: report.missing });
  }
  if (report.status === "complete") return { ...report, applied: false, unchanged: true };
  if (!apply) return { ...report, applied: false };

  await mutate(root, async (db) => {
    const confirmed = await completionReadiness(db, featureId);
    if (!confirmed.complete) {
      throw new DbError(E.DEPTH_UNMET,
        `${confirmed.name} changed while it was being completed: ${confirmed.missing.map((m) => m.says).join("; ")}.`,
        { featureId });
    }
    const project = await currentProject(db);
    await setStatus(db, "feature", featureId, "complete", {
      projectId: project?.id,
      actor,
      note: `Every one of its ${confirmed.criteria} acceptance criteria is met or waived and all ${confirmed.tasks} tasks are finished`,
      activityType: "specification_changed",
      activitySummary: `${confirmed.name} is complete: its contract is satisfied`,
    });
  });
  return { ...report, status: "complete", applied: true };
}
