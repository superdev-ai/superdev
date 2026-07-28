// Adding to the product map after it has been initialized.
//
// Every product record could only be created during `init`. After that a project
// was frozen: no command added a goal, a success criterion, a milestone, an exit
// condition, a module or a feature, and nothing could move a feature to a
// different module or milestone.
//
// The consequence was not obvious from the command list, because the read side
// was complete. `goal list` showed goals and `goal show` showed one in full, so
// the surface looked finished while nothing could write to it. A goal recorded
// with no success criteria can never be met, and progress counts goal criteria,
// so a project could carry a goal that permanently reported nothing.
//
// The evidence for this being real rather than theoretical is in this project's
// own activity trail: 2531 specification events by a self-hosting script against
// 104 by the product's own commands. Its product map was written around the
// product, because there was no way to write it through the product.
//
// Nothing here invents structure. Each function writes one record with the
// fields its table requires, refuses what the schema would refuse with a sentence
// instead of a constraint violation, and leaves history behind like every other
// write.

import { create, mutate, patch, query, recordActivity, setStatus, json } from "../db/store.mjs";
import { slugify, uniqueSlug } from "../model/ids.mjs";
import { sanitizeExternal } from "../model/screening.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  EXISTS: "E_ALREADY_EXISTS",
  REQUIRED: "E_FIELD_REQUIRED",
  NOT_EDITABLE: "E_NOT_EDITABLE",
};

export class AuthoringError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "AuthoringError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const clean = (value, max = 600) => {
  const text = sanitizeExternal(String(value ?? "")).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const nowIso = () => new Date().toISOString();

/** The next sequence for a table scoped to something, so ordering stays stable. */
async function nextSequence(db, table, column, id) {
  const row = await db.get(`SELECT MAX(sequence) AS n FROM ${table} WHERE ${column} = ?`, id);
  return Number(row?.n ?? -1) + 1;
}

// -------------------------------------------------------------------- goals

/**
 * Record a goal: a lasting outcome, not a feature.
 *
 * A goal with no success criteria is counted as unmeasurable rather than as
 * met, which is why this reports what to add next rather than treating the goal
 * as finished business.
 */
export async function recordGoal(root, { name, why = null, description = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) {
    throw new AuthoringError(E.REQUIRED, "A goal needs a name that states the outcome, not the work.");
  }
  const plan = { name: clean(name, 200), why: clean(why), description: clean(description, 1000) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new AuthoringError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    const existing = await db.get(
      "SELECT id FROM goals WHERE project_id = ? AND name = ?", project.id, plan.name);
    if (existing) {
      throw new AuthoringError(E.EXISTS, `${existing.id} is already called that. Show it with superdev goal show ${existing.id}.`);
    }
    const row = await create(db, "goal", {
      project_id: project.id,
      name: plan.name,
      description: plan.description,
      why_it_matters: plan.why,
      status: "draft",
      sequence: await nextSequence(db, "goals", "project_id", project.id),
    }, {
      projectId: project.id, actor, activityType: "scope_changed",
      activitySummary: clean(`Goal recorded: ${plan.name}`, 200),
    });
    return { applied: true, goal: row, criteria: 0 };
  });
}

/**
 * Add a success criterion to a goal, with how it is measured.
 *
 * The measurement is the point. "People find things faster" cannot be met by
 * anything; "the last handover is on screen within ten seconds" can, and the
 * difference decides whether progress means anything.
 */
export async function addGoalCriterion(root, goalId, { criterion, measurement = null, target = null, actor = "superdev", apply = false } = {}) {
  if (!clean(criterion)) {
    throw new AuthoringError(E.REQUIRED, "Say what has to be true. A criterion nobody can check is not one.");
  }
  const plan = {
    goalId,
    criterion: clean(criterion, 500),
    measurement: clean(measurement, 300),
    target: clean(target, 200),
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const goal = await db.get("SELECT id, project_id, name FROM goals WHERE id = ?", goalId);
    if (!goal) throw new AuthoringError(E.NOT_FOUND, `There is no goal ${goalId}. List them with superdev goal list.`);
    const row = await create(db, "goal_success_criterion", {
      goal_id: goalId,
      criterion: plan.criterion,
      measurement_method: plan.measurement,
      target: plan.target,
      status: "unmet",
      sequence: await nextSequence(db, "goal_success_criteria", "goal_id", goalId),
    }, {
      projectId: goal.project_id, actor, activityType: "scope_changed",
      activitySummary: clean(`Success criterion recorded for ${goal.name}`, 200),
    });
    const count = await db.get(
      "SELECT COUNT(*) AS n FROM goal_success_criteria WHERE goal_id = ?", goalId);
    return { applied: true, criterion: row, goal, total: Number(count.n) };
  });
}

// --------------------------------------------------------------- milestones

/** Record a delivery stage. Its exit conditions are what make it reachable. */
export async function recordMilestone(root, { name, outcome = null, targetDate = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) {
    throw new AuthoringError(E.REQUIRED, "A milestone needs a name that says what is delivered by it.");
  }
  const plan = { name: clean(name, 200), outcome: clean(outcome, 1000), targetDate: clean(targetDate, 40) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new AuthoringError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    const existing = await db.get(
      "SELECT id FROM milestones WHERE project_id = ? AND name = ?", project.id, plan.name);
    if (existing) {
      throw new AuthoringError(E.EXISTS, `${existing.id} is already called that. Show it with superdev milestone show ${existing.id}.`);
    }
    const row = await create(db, "milestone", {
      project_id: project.id,
      name: plan.name,
      outcome: plan.outcome,
      entry_conditions_json: JSON.stringify([]),
      exit_conditions_json: JSON.stringify([]),
      target_date: plan.targetDate,
      status: "planned",
      sequence: await nextSequence(db, "milestones", "project_id", project.id),
    }, {
      projectId: project.id, actor, activityType: "scope_changed",
      activitySummary: clean(`Milestone recorded: ${plan.name}`, 200),
    });
    return { applied: true, milestone: row };
  });
}

/**
 * Add an exit condition to a milestone.
 *
 * Stored as an object rather than a string, because a condition that cannot
 * carry a verdict can never be met, and a milestone whose conditions can never
 * be met is unreachable by construction. That was true of every milestone here
 * once, and it is the shape this refuses to recreate.
 */
export async function addMilestoneCondition(root, milestoneId, { condition, check = null, entry = false, actor = "superdev", apply = false } = {}) {
  if (!clean(condition)) {
    throw new AuthoringError(E.REQUIRED, "Say what has to hold before this milestone is reached.");
  }
  const column = entry ? "entry_conditions_json" : "exit_conditions_json";
  const kind = entry ? "Entry" : "Exit";
  const plan = { milestoneId, condition: clean(condition, 500), check: clean(check, 200), entry };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const milestone = await db.get(
      `SELECT id, project_id, name, ${column} AS conditions, version FROM milestones WHERE id = ?`, milestoneId);
    if (!milestone) {
      throw new AuthoringError(E.NOT_FOUND, `There is no milestone ${milestoneId}. List them with superdev milestone list.`);
    }
    const conditions = json(milestone.conditions, []).map((c) =>
      typeof c === "string" ? { condition: c, met: false, reading: null, check: null } : c);
    if (conditions.some((c) => c.condition === plan.condition)) {
      throw new AuthoringError(E.EXISTS, `${milestoneId} already carries that condition.`);
    }
    conditions.push({ condition: plan.condition, met: false, reading: null, check: plan.check });
    await patch(db, "milestone", milestoneId, milestone.version, {
      [column]: JSON.stringify(conditions),
    }, {
      projectId: milestone.project_id, actor, activityType: "scope_changed",
      activitySummary: clean(`${kind} condition recorded for ${milestone.name}`, 200),
    });
    return { applied: true, milestoneId, total: conditions.length, condition: plan.condition, entry };
  });
}

/**
 * Rename a milestone, restate what it delivers, or move its date.
 *
 * A milestone init could not name was created as "First outcome", and nothing
 * could rename it, so a placeholder became permanent on every project that had
 * goals and no stated delivery stages.
 */
export async function updateMilestone(root, milestoneId, { name = null, outcome = null, targetDate = null, actor = "superdev", apply = false } = {}) {
  const changes = {};
  if (clean(name)) changes.name = clean(name, 200);
  if (clean(outcome)) changes.outcome = clean(outcome, 1000);
  if (clean(targetDate)) changes.target_date = clean(targetDate, 40);
  if (!Object.keys(changes).length) {
    throw new AuthoringError(E.REQUIRED, "Say what to change: --name, --outcome or --target.");
  }
  const plan = { milestoneId, changes };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const milestone = await db.get("SELECT id, project_id, name, version FROM milestones WHERE id = ?", milestoneId);
    if (!milestone) {
      throw new AuthoringError(E.NOT_FOUND, `There is no milestone ${milestoneId}. List them with superdev milestone list.`);
    }
    if (changes.name && changes.name !== milestone.name) {
      const clash = await db.get(
        "SELECT id FROM milestones WHERE project_id = ? AND name = ? AND id <> ?",
        milestone.project_id, changes.name, milestoneId);
      if (clash) throw new AuthoringError(E.EXISTS, `${clash.id} is already called that.`);
    }
    await patch(db, "milestone", milestoneId, milestone.version, changes, {
      projectId: milestone.project_id, actor, activityType: "scope_changed",
      activitySummary: clean(changes.name && changes.name !== milestone.name
        ? `Milestone ${milestone.name} renamed to ${changes.name}`
        : `Milestone ${milestone.name} updated`, 200),
    });
    return { applied: true, milestoneId, was: milestone.name, changes };
  });
}

// ------------------------------------------------------------------ modules

/** Record a module: a slice of the product that owns some of it. */
export async function recordModule(root, { name, purpose = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new AuthoringError(E.REQUIRED, "A module needs a name.");
  const plan = { name: clean(name, 200), purpose: clean(purpose, 1000) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new AuthoringError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    const existing = await db.get(
      "SELECT id FROM modules WHERE project_id = ? AND name = ?", project.id, plan.name);
    if (existing) {
      throw new AuthoringError(E.EXISTS, `${existing.id} is already called that.`);
    }
    const row = await create(db, "module", {
      project_id: project.id,
      name: plan.name,
      slug: await uniqueSlug(db, "modules", project.id, plan.name, "module"),
      purpose: plan.purpose,
      primary_users_json: JSON.stringify([]),
      owns_json: JSON.stringify([]),
      consumes_json: JSON.stringify([]),
      status: "planned",
      sequence: await nextSequence(db, "modules", "project_id", project.id),
    }, {
      projectId: project.id, actor, activityType: "scope_changed",
      activitySummary: clean(`Module recorded: ${plan.name}`, 200),
    });
    return { applied: true, module: row };
  });
}

// ----------------------------------------------------------------- features

/**
 * Add a feature to a module.
 *
 * It lands in draft carrying only what was given, because the depth gate decides
 * when it is ready and `feature specify` is what fills it. Creating one already
 * acceptable would route around the gate.
 */
export async function createFeature(root, { moduleId, name, purpose = null, milestoneId = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new AuthoringError(E.REQUIRED, "A feature needs a name that states what somebody can do.");
  if (!moduleId) {
    throw new AuthoringError(E.REQUIRED,
      "A feature belongs to exactly one module. Pass --module, and see them with superdev module list.");
  }
  const plan = { moduleId, milestoneId, name: clean(name, 200), purpose: clean(purpose, 1000) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const module = await db.get("SELECT id, project_id, name FROM modules WHERE id = ?", moduleId);
    if (!module) {
      throw new AuthoringError(E.NOT_FOUND, `There is no module ${moduleId}. List them with superdev module list.`);
    }
    if (plan.milestoneId) {
      const milestone = await db.get("SELECT id FROM milestones WHERE id = ?", plan.milestoneId);
      if (!milestone) {
        throw new AuthoringError(E.NOT_FOUND, `There is no milestone ${plan.milestoneId}.`);
      }
    }
    const existing = await db.get(
      "SELECT id FROM features WHERE project_id = ? AND name = ?", module.project_id, plan.name);
    if (existing) {
      throw new AuthoringError(E.EXISTS, `${existing.id} is already called that. Extend it with superdev feature specify ${existing.id}.`);
    }
    const row = await create(db, "feature", {
      project_id: module.project_id,
      module_id: moduleId,
      milestone_id: plan.milestoneId,
      name: plan.name,
      slug: await uniqueSlug(db, "features", module.project_id, plan.name, "feature"),
      purpose: plan.purpose,
      spec_depth: "microspec",
      risk_level: "R1",
      scope_in_json: JSON.stringify([]),
      scope_out_json: JSON.stringify([]),
      status: "draft",
      created_at: nowIso(),
      updated_at: nowIso(),
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Feature drafted in ${module.name}: ${plan.name}`, 200),
    });
    return { applied: true, feature: row, module };
  });
}

/**
 * Move a feature to a different module or milestone.
 *
 * The reason this exists is that initialization guesses. A brief with one
 * heading puts every feature under one module, and a brief with several pairs
 * each feature with whichever module its wording resembled. Neither guess is
 * always right, and until now neither could be corrected through the product.
 */
export async function moveFeature(root, featureId, { moduleId = null, milestoneId = null, actor = "superdev", apply = false } = {}) {
  if (!moduleId && !milestoneId) {
    throw new AuthoringError(E.REQUIRED, "Say where it is going: --module, --milestone, or both.");
  }
  const before = await query(root, (db) =>
    db.get(`SELECT f.*, m.name AS module_name, s.name AS milestone_name
              FROM features f
              LEFT JOIN modules m ON m.id = f.module_id
              LEFT JOIN milestones s ON s.id = f.milestone_id
             WHERE f.id = ?`, featureId));
  if (!before) throw new AuthoringError(E.NOT_FOUND, `There is no feature ${featureId}.`);

  const plan = {
    featureId,
    name: before.name,
    fromModule: before.module_name,
    fromMilestone: before.milestone_name,
    moduleId,
    milestoneId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
    const fields = {};
    if (moduleId) {
      const module = await db.get("SELECT id, name FROM modules WHERE id = ?", moduleId);
      if (!module) throw new AuthoringError(E.NOT_FOUND, `There is no module ${moduleId}.`);
      fields.module_id = moduleId;
      plan.toModule = module.name;
    }
    if (milestoneId) {
      const milestone = await db.get("SELECT id, name FROM milestones WHERE id = ?", milestoneId);
      if (!milestone) throw new AuthoringError(E.NOT_FOUND, `There is no milestone ${milestoneId}.`);
      fields.milestone_id = milestoneId;
      plan.toMilestone = milestone.name;
    }
    await patch(db, "feature", featureId, feature.version, fields, {
      projectId: feature.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(
        `${featureId} moved${plan.toModule ? ` to module ${plan.toModule}` : ""}${plan.toMilestone ? ` into ${plan.toMilestone}` : ""}`, 200),
    });
    return { applied: true, ...plan };
  });
}

/** Take a goal or a milestone out of scope without deleting its history. */
export async function retire(root, recordId, { reason, actor = "superdev", apply = false } = {}) {
  if (!clean(reason)) {
    throw new AuthoringError(E.REQUIRED, "Say why it is being retired. Without a reason nobody can tell later whether it was decided or forgotten.");
  }
  const kind = recordId?.startsWith("GOAL-") ? "goal" : recordId?.startsWith("MS-") ? "milestone" : null;
  if (!kind) {
    throw new AuthoringError(E.NOT_EDITABLE, `${recordId} is not a goal or a milestone. Retiring is for those.`);
  }
  const table = kind === "goal" ? "goals" : "milestones";
  const row = await query(root, (db) => db.get(`SELECT id, project_id, name, status FROM ${table} WHERE id = ?`, recordId));
  if (!row) throw new AuthoringError(E.NOT_FOUND, `There is no ${kind} ${recordId}.`);
  if (!apply) return { applied: false, recordId, kind, name: row.name, reason: clean(reason) };

  return mutate(root, async (db) => {
    await setStatus(db, kind, recordId, "retired", {
      projectId: row.project_id, actor, note: clean(reason),
      activityType: "scope_changed",
      activitySummary: clean(`${row.name} retired: ${reason}`, 200),
    });
    return { applied: true, recordId, kind, name: row.name, reason: clean(reason) };
  });
}

/**
 * Say which goal a feature advances, or stop saying it.
 *
 * feature_goals has existed since the first migration, the alignment report has
 * always warned that a feature serving no goal is scope nobody can justify when
 * scope is cut, and nothing could write the link. The warning named a problem
 * with no remedy, which teaches a reader to ignore warnings.
 */
export async function linkFeatureGoal(root, featureId, goalId, { remove = false, actor = "superdev", apply = false } = {}) {
  const found = await query(root, async (db) => ({
    feature: await db.get("SELECT id, project_id, name FROM features WHERE id = ?", featureId),
    goal: await db.get("SELECT id, name, status FROM goals WHERE id = ?", goalId),
    linked: await db.get(
      "SELECT 1 AS yes FROM feature_goals WHERE feature_id = ? AND goal_id = ?", featureId, goalId),
  }));
  if (!found.feature) throw new AuthoringError(E.NOT_FOUND, `There is no feature ${featureId}.`);
  if (!found.goal) throw new AuthoringError(E.NOT_FOUND, `There is no goal ${goalId}. List them with superdev goal list.`);
  if (!remove && found.goal.status === "retired") {
    throw new AuthoringError(E.NOT_EDITABLE,
      `${goalId} is retired, so work pointed at it would count toward nothing. Record a current goal, or reopen that one.`);
  }
  if (!remove && found.linked) {
    return { applied: false, unchanged: true, featureId, goalId, name: found.feature.name, goal: found.goal.name };
  }
  const plan = { featureId, goalId, name: found.feature.name, goal: found.goal.name, remove };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    if (remove) {
      await db.run("DELETE FROM feature_goals WHERE feature_id = ? AND goal_id = ?", featureId, goalId);
    } else {
      await db.run(
        "INSERT OR IGNORE INTO feature_goals (feature_id, goal_id) VALUES (?, ?)", featureId, goalId);
    }
    await recordActivity(db, found.feature.project_id, {
      type: "specification_changed",
      actor,
      featureId,
      summary: clean(remove
        ? `${featureId} no longer serves ${found.goal.name}`
        : `${featureId} now serves ${found.goal.name}`, 200),
      metadata: { featureId, goalId, removed: remove },
    });
    return { applied: true, ...plan };
  });
}

/**
 * Rename a module, or restate what it owns.
 *
 * A module's name reaches the filesystem as the directory its documentation is
 * written to, so a bad one from a brief parse was permanent in the record and in
 * committed paths. Existing documents keep their old directory until the next
 * generation, which is why the result says so.
 */
export async function renameModule(root, moduleId, { name = null, purpose = null, actor = "superdev", apply = false } = {}) {
  const changes = {};
  if (clean(name)) changes.name = clean(name, 200);
  if (clean(purpose)) changes.purpose = clean(purpose, 1000);
  if (!Object.keys(changes).length) {
    throw new AuthoringError(E.REQUIRED, "Say what to change: --name or --purpose.");
  }
  const plan = { moduleId, changes };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const module = await db.get("SELECT id, project_id, name, version FROM modules WHERE id = ?", moduleId);
    if (!module) {
      throw new AuthoringError(E.NOT_FOUND, `There is no module ${moduleId}. List them with superdev module list.`);
    }
    if (changes.name && changes.name !== module.name) {
      const clash = await db.get(
        "SELECT id FROM modules WHERE project_id = ? AND name = ? AND id <> ?",
        module.project_id, changes.name, moduleId);
      if (clash) throw new AuthoringError(E.EXISTS, `${clash.id} is already called that.`);
    }
    await patch(db, "module", moduleId, module.version, changes, {
      projectId: module.project_id, actor, activityType: "scope_changed",
      activitySummary: clean(changes.name && changes.name !== module.name
        ? `Module ${module.name} renamed to ${changes.name}`
        : `Module ${module.name} updated`, 200),
    });
    return { applied: true, moduleId, was: module.name, changes };
  });
}

// ------------------------------------------------------------------- scope

const DIRECTIONS = new Set(["in", "out", "non_goal"]);

const SAID = { in: "in scope", out: "out of scope", non_goal: "a non-goal" };

/**
 * Record what the product deliberately does or does not do.
 *
 * project_scope_items was written by nothing. The product document reads it, the
 * requirement template asks the reader to fill it in, and the generated
 * foundations told them "None declared. An empty list here is a gap, not a
 * statement" even when their brief had declared several, because the parse landed
 * in a discovery item and stopped there.
 *
 * A non-goal is the only place where "we decided not to" is distinguishable from
 * "nobody thought of it", which is why it gets a command of its own rather than
 * being left to the one-shot parse.
 */
export async function recordScopeItem(root, { statement, direction = "non_goal", why = null, horizon = null, actor = "superdev", apply = false } = {}) {
  if (!clean(statement)) {
    throw new AuthoringError(E.REQUIRED, "Say what is in or out. A scope line nobody can read decides nothing.");
  }
  if (!DIRECTIONS.has(direction)) {
    throw new AuthoringError(E.REQUIRED, `A scope item is in, out or non_goal, not ${direction}.`);
  }
  const plan = {
    statement: clean(statement, 500),
    direction,
    why: clean(why, 500),
    horizon: clean(horizon, 200),
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new AuthoringError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    const existing = await db.get(
      "SELECT id, direction FROM project_scope_items WHERE project_id = ? AND statement = ?",
      project.id, plan.statement);
    if (existing) {
      throw new AuthoringError(E.EXISTS,
        `${existing.id} already says that, as ${SAID[existing.direction] ?? existing.direction}.`);
    }
    const row = await create(db, "project_scope_item", {
      project_id: project.id,
      direction: plan.direction,
      statement: plan.statement,
      why: plan.why,
      horizon: plan.horizon,
      sequence: await nextSequence(db, "project_scope_items", "project_id", project.id),
    }, {
      projectId: project.id, actor, activityType: "scope_changed",
      activitySummary: clean(`Recorded as ${SAID[plan.direction]}: ${plan.statement}`, 200),
    });
    return { applied: true, item: row, said: SAID[plan.direction] };
  });
}

/** Take a scope line back out, when it turns out not to have been decided. */
export async function removeScopeItem(root, itemId, { actor = "superdev", apply = false } = {}) {
  const found = await query(root, (db) =>
    db.get("SELECT * FROM project_scope_items WHERE id = ?", itemId));
  if (!found) throw new AuthoringError(E.NOT_FOUND, `There is no scope item ${itemId}. List them with superdev scope list.`);
  if (!apply) return { applied: false, itemId, statement: found.statement, said: SAID[found.direction] };

  return mutate(root, async (db) => {
    await db.run("DELETE FROM project_scope_items WHERE id = ?", itemId);
    await recordActivity(db, found.project_id, {
      type: "scope_changed",
      actor,
      summary: clean(`No longer recorded as ${SAID[found.direction]}: ${found.statement}`, 200),
      metadata: { itemId, direction: found.direction },
    });
    return { applied: true, itemId, statement: found.statement, said: SAID[found.direction] };
  });
}

/** What is in, what is out, and what is deliberately neither. */
export async function scopeList(root) {
  return query(root, (db) => db.all(
    "SELECT * FROM project_scope_items ORDER BY direction, sequence, id"));
}

// -------------------------------------------------------- capability areas

/** States a settled area can be in, and how each one reads. */
const SETTLED = { specified: "specified", not_applicable: "not applicable", deferred: "deferred" };

/**
 * Settle a readiness area: say what was chosen, or say it does not apply.
 *
 * The readiness checklist warned, at high severity, that an area was "awaiting a
 * decision with no question raised", and told the reader to "raise the question,
 * or record the area as not applicable with a reason". Neither was a command.
 * capability_areas was written by init and by answering a question that init had
 * linked to an area, so an area init left unquestioned could never move, and the
 * warning's own remedy was unreachable.
 *
 * Nothing here can quieten the checklist without saying something: specifying
 * needs the choice, and not applicable needs the reason.
 */
export async function settleCapabilityArea(root, areaId, { choice = null, evidence = null, reason = null, notApplicable = false, actor = "superdev", apply = false } = {}) {
  if (notApplicable && !clean(reason)) {
    throw new AuthoringError(E.REQUIRED,
      "Say why it does not apply. An area dismissed without a reason is indistinguishable from one nobody looked at.");
  }
  if (!notApplicable && !clean(choice)) {
    throw new AuthoringError(E.REQUIRED,
      "Say what was chosen. An area cannot be specified by declaring it specified.");
  }
  const found = await query(root, (db) => db.get("SELECT * FROM capability_areas WHERE id = ?", areaId));
  if (!found) {
    throw new AuthoringError(E.NOT_FOUND, `There is no capability area ${areaId}. List them with superdev capability list.`);
  }
  const plan = {
    areaId,
    area: found.area,
    was: found.state,
    state: notApplicable ? "not_applicable" : "specified",
    choice: clean(choice, 1000),
    evidence: clean(evidence, 500),
    reason: clean(reason, 1000),
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const area = await db.get("SELECT * FROM capability_areas WHERE id = ?", areaId);
    await patch(db, "capability_area", areaId, area.version, plan.state === "not_applicable"
      ? { state: "not_applicable", reason: plan.reason, choice: null, evidence_ref: plan.evidence, revisit_trigger: null }
      : { state: "specified", choice: plan.choice, evidence_ref: plan.evidence, reason: null, revisit_trigger: null },
      { projectId: area.project_id, actor, activityType: "specification_changed",
        activitySummary: clean(plan.state === "not_applicable"
          ? `${area.area} recorded as not applicable`
          : `${area.area} specified`, 200) });
    return { applied: true, ...plan };
  });
}

/** Every readiness area and stack slot, with what settled it. */
export async function capabilityList(root, { catalog = null, unsettled = false } = {}) {
  return query(root, (db) => db.all(
    `SELECT * FROM capability_areas
      WHERE (? IS NULL OR catalog = ?)
        AND (? = 0 OR state IN ('awaiting_decision','deferred'))
      ORDER BY catalog, sequence, id`,
    catalog, catalog, unsettled ? 1 : 0));
}

/**
 * Mark a milestone condition met, with the reading that decided it.
 *
 * Conditions could be added and never satisfied, so a milestone showed `0 of 5 met`
 * while four of the five were demonstrably true, and no command could move any of
 * them. A milestone that cannot be reached is a milestone that measures nothing.
 *
 * The reading is required, not decorative. "Met" on its own is an assertion; the
 * reading is what somebody else can check, and it is the same standard evidence is
 * held to everywhere else in this product.
 */
export async function markMilestoneCondition(root, milestoneId, { condition, reading, entry = false, actor = "superdev", apply = false } = {}) {
  if (!clean(condition)) {
    throw new AuthoringError(E.REQUIRED, "Say which condition, by its text. superdev milestone show lists them.");
  }
  if (!clean(reading)) {
    throw new AuthoringError(E.REQUIRED,
      "Say what was observed. A condition marked met with nothing to read is an assertion, not a measurement.");
  }
  const column = entry ? "entry_conditions_json" : "exit_conditions_json";
  const wanted = clean(condition, 500);

  const found = await query(root, (db) => db.get(
    `SELECT id, name, ${column} AS conditions FROM milestones WHERE id = ?`, milestoneId));
  if (!found) {
    throw new AuthoringError(E.NOT_FOUND, `There is no milestone ${milestoneId}. List them with superdev milestone list.`);
  }
  const conditions = json(found.conditions, []).map((c) =>
    typeof c === "string" ? { condition: c, met: false, reading: null, check: null } : c);
  const match = conditions.find((c) => c.condition === wanted)
    ?? conditions.find((c) => c.condition.toLowerCase().startsWith(wanted.toLowerCase()));
  if (!match) {
    throw new AuthoringError(E.NOT_FOUND,
      `${milestoneId} carries no ${entry ? "entry" : "exit"} condition matching ${JSON.stringify(wanted)}. Its conditions are: ${conditions.map((c) => JSON.stringify(c.condition)).join(", ") || "none"}.`);
  }
  if (match.met) {
    throw new AuthoringError(E.EXISTS, `That condition is already met: ${match.reading ?? "no reading recorded"}`);
  }

  const plan = { milestoneId, condition: match.condition, reading: clean(reading, 500), entry };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const milestone = await db.get(
      `SELECT id, project_id, name, ${column} AS conditions, version FROM milestones WHERE id = ?`, milestoneId);
    const rows = json(milestone.conditions, []).map((c) =>
      typeof c === "string" ? { condition: c, met: false, reading: null, check: null } : c);
    const target = rows.find((c) => c.condition === match.condition);
    target.met = true;
    target.reading = plan.reading;
    await patch(db, "milestone", milestoneId, milestone.version, {
      [column]: JSON.stringify(rows),
    }, {
      projectId: milestone.project_id, actor, activityType: "scope_changed",
      activitySummary: clean(`${entry ? "Entry" : "Exit"} condition met on ${milestone.name}: ${plan.reading}`, 200),
    });
    const met = rows.filter((c) => c.met).length;
    return { applied: true, ...plan, met, total: rows.length, name: milestone.name };
  });
}
