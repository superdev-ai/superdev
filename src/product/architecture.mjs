// Writing the parts of a product that are not goals, features or tasks.
//
// Eleven record types could be read, rendered in the control centre, derived from
// and reported on, and nothing in the product could create any of them. Surfaces,
// workflows and their steps, data entities, API operations and services,
// integrations, non-functional requirements, test plans, schema migrations and the
// glossary. This module is their author.
//
// The consequence was larger than eleven empty views. `standard` spec depth
// requires surfaces, an API or a data entity, a workflow and an observability
// requirement; `full` adds a migration with a rollback and a security and privacy
// analysis. Five of those six had no author, so any feature declared at standard or
// full depth could never be accepted. The refusal said "Record them, or lower the
// depth", and recording them was impossible: the depth ladder had one usable rung
// and nothing anywhere said so.
//
// Every function here follows the shape the rest of the product uses. It plans by
// default and writes only with `apply`. It refuses with a sentence that names the
// remedy rather than letting a constraint fail. It records history. Nothing invents
// a field to fill a shape: what the reader did not say stays absent, because a
// plausible default in a specification is worse than a gap somebody can see.

import { create, mutate, patch, query, recordActivity, json } from "../db/store.mjs";
import { sanitizeExternal } from "../model/screening.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  EXISTS: "E_ALREADY_EXISTS",
  REQUIRED: "E_FIELD_REQUIRED",
  NOT_ALLOWED: "E_NOT_ALLOWED",
};

export class ArchitectureError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "ArchitectureError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const clean = (value, max = 600) => {
  const text = sanitizeExternal(String(value ?? "")).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const list = (values, max = 300) =>
  (Array.isArray(values) ? values : values === undefined || values === null ? [] : [values])
    .map((v) => clean(v, max))
    .filter(Boolean);

/** The next sequence within a parent, so ordering is stable across runs. */
async function nextSequence(db, table, column, id) {
  const row = await db.get(`SELECT MAX(sequence) AS n FROM ${table} WHERE ${column} = ?`, id);
  return Number(row?.n ?? -1) + 1;
}

/**
 * The feature and the module a record hangs from.
 *
 * Most of these tables require a module and accept a feature. A reader naming a
 * feature should not also have to name its module, so the module is read from the
 * feature when only the feature is given. Getting this wrong would attach a surface
 * to the wrong part of the product, which is worse than refusing.
 */
async function placement(db, { featureId = null, moduleId = null } = {}) {
  let feature = null;
  if (featureId) {
    feature = await db.get("SELECT id, module_id, name FROM features WHERE id = ?", featureId);
    if (!feature) {
      throw new ArchitectureError(E.NOT_FOUND,
        `There is no feature ${featureId}. List them with superdev feature list.`);
    }
  }
  const resolvedModule = moduleId ?? feature?.module_id ?? null;
  if (!resolvedModule) {
    throw new ArchitectureError(E.REQUIRED,
      "Say which part of the product this belongs to: --feature <FEAT-id>, or --module <MOD-id>.");
  }
  const module = await db.get("SELECT id, project_id, name FROM modules WHERE id = ?", resolvedModule);
  if (!module) {
    throw new ArchitectureError(E.NOT_FOUND,
      `There is no module ${resolvedModule}. List them with superdev module list.`);
  }
  return { feature, module };
}

/** Refuse a duplicate by name within its scope, naming the record that has it. */
async function refuseDuplicate(db, table, column, scopeId, name, what) {
  const existing = await db.get(
    `SELECT id FROM ${table} WHERE ${column} = ? AND name = ?`, scopeId, name);
  if (existing) {
    throw new ArchitectureError(E.EXISTS, `${existing.id} is already the ${what} called ${JSON.stringify(name)}.`);
  }
}

// ------------------------------------------------------------------ surfaces

const SURFACE_TYPES = ["screen", "panel", "modal", "sheet", "page", "view", "drawer", "toast", "cli", "email"];

/**
 * Record a screen, panel or modal somebody touches, and what they can do on it.
 *
 * The control centre's UI Surfaces area told readers that surfaces "appear here
 * once a feature has had its interface specified, which normally happens during
 * planning". Nothing could specify an interface, so that sentence described a
 * process that did not exist, which is the most misleading kind of empty state:
 * it asks somebody to wait rather than to act.
 */
export async function recordSurface(root, { name, featureId = null, moduleId = null, surfaceType = "screen", route = null, purpose = null, role = null, actions = [], responsive = null, accessibility = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) {
    throw new ArchitectureError(E.REQUIRED, "A surface needs a name, which is what a person would call the screen.");
  }
  if (!SURFACE_TYPES.includes(surfaceType)) {
    throw new ArchitectureError(E.NOT_ALLOWED,
      `A surface is one of: ${SURFACE_TYPES.join(", ")}. ${JSON.stringify(surfaceType)} is none of them.`);
  }
  const plan = {
    name: clean(name, 200),
    surfaceType,
    route: clean(route, 300),
    purpose: clean(purpose, 1000),
    role: clean(role, 200),
    actions: list(actions),
    responsive: clean(responsive, 500),
    accessibility: clean(accessibility, 500),
    featureId, moduleId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    await refuseDuplicate(db, "surfaces", "module_id", module.id, plan.name, "surface");
    const row = await create(db, "surface", {
      feature_id: feature?.id ?? null,
      module_id: module.id,
      name: plan.name,
      surface_type: plan.surfaceType,
      route: plan.route,
      purpose: plan.purpose,
      primary_role: plan.role,
      // The actions are what a person can do here, which is the half of a surface
      // that makes it more than a picture.
      components_json: JSON.stringify(plan.actions),
      entities_shown_json: JSON.stringify([]),
      responsive_behavior: plan.responsive,
      accessibility_notes: plan.accessibility,
      status: "planned",
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Surface recorded: ${plan.name}`, 200),
    });
    return { applied: true, surface: row, module: module.name, feature: feature?.name ?? null };
  });
}

// -------------------------------------------------------------- data entities

/** Record something the product stores, and what losing it would cost. */
export async function recordEntity(root, { name, featureId = null, moduleId = null, purpose = null, store = null, sensitivity = null, retention = null, deletion = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) {
    throw new ArchitectureError(E.REQUIRED, "A data entity needs a name, which is the thing it holds.");
  }
  const plan = {
    name: clean(name, 200),
    purpose: clean(purpose, 1000),
    store: clean(store, 200),
    sensitivity: clean(sensitivity, 200),
    retention: clean(retention, 500),
    deletion: clean(deletion, 500),
    featureId, moduleId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    await refuseDuplicate(db, "data_entities", "module_id", module.id, plan.name, "data entity");
    const row = await create(db, "data_entity", {
      module_id: module.id,
      feature_id: feature?.id ?? null,
      name: plan.name,
      purpose: plan.purpose,
      store: plan.store,
      sensitivity_class: plan.sensitivity,
      retention_rule: plan.retention,
      deletion_semantics: plan.deletion,
      status: "planned",
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Data entity recorded: ${plan.name}`, 200),
    });
    return { applied: true, entity: row, module: module.name };
  });
}

// ------------------------------------------------------------ api operations

/** Record an operation something outside this code can call. */
export async function recordOperation(root, { name, featureId = null, moduleId = null, style = null, method = null, path = null, purpose = null, auth = null, permission = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) {
    throw new ArchitectureError(E.REQUIRED, "An operation needs a name, which is what it does.");
  }
  const plan = {
    name: clean(name, 200),
    style: clean(style, 100),
    method: clean(method, 100),
    path: clean(path, 300),
    purpose: clean(purpose, 1000),
    auth: clean(auth, 300),
    permission: clean(permission, 200),
    featureId, moduleId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    await refuseDuplicate(db, "api_operations", "module_id", module.id, plan.name, "operation");
    const row = await create(db, "api_operation", {
      feature_id: feature?.id ?? null,
      module_id: module.id,
      name: plan.name,
      style: plan.style,
      method_or_procedure: plan.method,
      path_or_topic: plan.path,
      purpose: plan.purpose,
      auth_requirement: plan.auth,
      permission: plan.permission,
      status: "planned",
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Operation recorded: ${plan.name}`, 200),
    });
    return { applied: true, operation: row, module: module.name };
  });
}

// ----------------------------------------------------------------- workflows

/**
 * Record a workflow and its ordered steps.
 *
 * A workflow with no steps satisfies nothing: the depth gate asks for a workflow
 * *and* its steps, because a named process with no sequence is a title. So the
 * steps come in with it rather than through a second command that somebody might
 * never run.
 */
export async function recordWorkflow(root, { featureId, name, purpose = null, trigger = null, steps = [], completion = null, observability = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A workflow needs a name.");
  const ordered = list(steps, 500);
  if (!ordered.length) {
    throw new ArchitectureError(E.REQUIRED,
      "A workflow needs its steps, in order: --step \"<what happens>\", repeated. A named process with no sequence is a title.");
  }
  const plan = {
    featureId,
    name: clean(name, 200),
    purpose: clean(purpose, 1000),
    trigger: clean(trigger, 300),
    steps: ordered,
    completion: clean(completion, 500),
    observability: clean(observability, 500),
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const feature = await db.get("SELECT id, project_id, name FROM features WHERE id = ?", featureId);
    if (!feature) {
      throw new ArchitectureError(E.NOT_FOUND,
        `There is no feature ${featureId}. A workflow belongs to a feature; list them with superdev feature list.`);
    }
    await refuseDuplicate(db, "workflows", "feature_id", feature.id, plan.name, "workflow");
    const workflow = await create(db, "workflow", {
      feature_id: feature.id,
      name: plan.name,
      purpose: plan.purpose,
      trigger: plan.trigger,
      preconditions_json: JSON.stringify([]),
      completion_criteria: plan.completion,
      observability: plan.observability,
      status: "planned",
    }, { projectId: feature.project_id, activity: false });

    const written = [];
    for (const [index, action] of plan.steps.entries()) {
      written.push(await create(db, "workflow_step", {
        workflow_id: workflow.id,
        sequence: index,
        action,
        owner_type: "person",
        status: "planned",
      }, { projectId: feature.project_id, activity: false }));
    }

    await recordActivity(db, feature.project_id, {
      type: "specification_changed",
      actor,
      featureId: feature.id,
      summary: clean(`Workflow recorded: ${plan.name}, ${written.length} step${written.length === 1 ? "" : "s"}`, 200),
      metadata: { workflow: workflow.id, steps: written.length },
    });
    return { applied: true, workflow, steps: written.length, feature: feature.name };
  });
}

/** Add a step to a workflow that already exists, at the end of its sequence. */
export async function addWorkflowStep(root, workflowId, { action, expected = null, failure = null, actor = "superdev", apply = false } = {}) {
  if (!clean(action)) throw new ArchitectureError(E.REQUIRED, "A step needs to say what happens.");
  const plan = { workflowId, action: clean(action, 500), expected: clean(expected, 500), failure: clean(failure, 500) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const workflow = await db.get(
      `SELECT w.id, w.name, f.project_id, f.id AS feature_id
         FROM workflows w JOIN features f ON f.id = w.feature_id WHERE w.id = ?`, workflowId);
    if (!workflow) {
      throw new ArchitectureError(E.NOT_FOUND, `There is no workflow ${workflowId}. List them with superdev workflow list.`);
    }
    const row = await create(db, "workflow_step", {
      workflow_id: workflowId,
      sequence: await nextSequence(db, "workflow_steps", "workflow_id", workflowId),
      action: plan.action,
      expected_result: plan.expected,
      failure_behavior: plan.failure,
      owner_type: "person",
      status: "planned",
    }, {
      projectId: workflow.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Step added to ${workflow.name}`, 200),
    });
    const total = await db.get("SELECT COUNT(*) AS n FROM workflow_steps WHERE workflow_id = ?", workflowId);
    return { applied: true, step: row, workflow: workflow.name, total: Number(total.n) };
  });
}

// -------------------------------------------------- non-functional requirements

const NFR_STATUS = ["met", "unmet", "unmeasured", "not_applicable"];

/**
 * Record a requirement about how the product behaves rather than what it does.
 *
 * This is where a security review, a privacy obligation, a performance target and
 * an observability signal live. `full` depth asks for a security and privacy
 * analysis and `standard` asks for observability, and both were unreachable
 * because this table had no author. So the product asked every project for a
 * security review and gave nobody a way to record one.
 */
export async function recordRequirement(root, { category, requirement, featureId = null, moduleId = null, target = null, measurement = null, status = "unmeasured", actor = "superdev", apply = false } = {}) {
  if (!clean(category)) {
    throw new ArchitectureError(E.REQUIRED,
      "Say what kind of requirement this is: security, privacy, performance, observability, accessibility, availability, and so on. The depth gate reads this word.");
  }
  if (!clean(requirement)) {
    throw new ArchitectureError(E.REQUIRED, "Say what has to hold. A category with no requirement measures nothing.");
  }
  if (!NFR_STATUS.includes(status)) {
    throw new ArchitectureError(E.NOT_ALLOWED, `A requirement is ${NFR_STATUS.join(", ")}, not ${JSON.stringify(status)}.`);
  }
  const plan = {
    category: clean(category, 100).toLowerCase(),
    requirement: clean(requirement, 1000),
    target: clean(target, 300),
    measurement: clean(measurement, 500),
    status,
    featureId, moduleId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ArchitectureError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    let feature = null;
    let module = null;
    if (featureId || moduleId) ({ feature, module } = await placement(db, { featureId, moduleId }));
    const row = await create(db, "non_functional_requirement", {
      project_id: project.id,
      module_id: module?.id ?? null,
      feature_id: feature?.id ?? null,
      category: plan.category,
      requirement: plan.requirement,
      target: plan.target,
      measurement_method: plan.measurement,
      status: plan.status,
    }, {
      projectId: project.id, actor, activityType: "specification_changed",
      activitySummary: clean(`${plan.category} requirement recorded: ${plan.requirement}`, 200),
    });
    return { applied: true, requirement: row, feature: feature?.name ?? null };
  });
}

// -------------------------------------------------------------- integrations

/** Record an outside service this depends on, and what happens when it is absent. */
export async function recordIntegration(root, { name, featureId = null, moduleId = null, purpose = null, whenAbsent = null, auth = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "An integration needs the name of the service.");
  if (!clean(whenAbsent)) {
    throw new ArchitectureError(E.REQUIRED,
      "Say what happens when it is unavailable: --when-absent \"<behaviour>\". Integration failure behaviour invented during the first outage is the thing this record exists to prevent.");
  }
  const plan = {
    name: clean(name, 200),
    purpose: clean(purpose, 1000),
    whenAbsent: clean(whenAbsent, 500),
    auth: clean(auth, 300),
    featureId, moduleId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    await refuseDuplicate(db, "integrations", "module_id", module.id, plan.name, "integration");
    // Named columns, not a conditional spread. Guarding on whether a column exists
    // would have quietly dropped the failure behaviour, because the column is
    // called failure_behavior and the guard asked for absence_behavior. A field
    // that silently keeps its default while the caller believes it was written is
    // the exact failure the store layer refuses unknown columns to prevent.
    const row = await create(db, "integration", {
      module_id: module.id,
      feature_id: feature?.id ?? null,
      name: plan.name,
      purpose: plan.purpose,
      failure_behavior: plan.whenAbsent,
      auth_approach: plan.auth,
      status: "planned",
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Integration recorded: ${plan.name}`, 200),
    });
    return { applied: true, integration: row, module: module.name };
  });
}

// ------------------------------------------------------------------ readers

/** Everything of one kind, for a surface that has to list it. */
export async function listOf(root, table) {
  return query(root, (db) => db.all(`SELECT * FROM ${table} ORDER BY id`));
}

// ---------------------------------------------------------------- test plans

/**
 * Record how something is tested, and how to run it.
 *
 * `how_to_run` is required. A test plan nobody can run is a promise, and section
 * 9.3 makes an accepted plan a completion condition, so a plan with no way to run
 * it would let a task complete on the strength of a title.
 */
export async function recordTestPlan(root, { name, strategy, howToRun, featureId = null, moduleId = null, passing = null, cases = [], actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A test plan needs a name.");
  if (!clean(strategy)) {
    throw new ArchitectureError(E.REQUIRED, "Say what the strategy is: what kind of testing this is and what it covers.");
  }
  if (!clean(howToRun)) {
    throw new ArchitectureError(E.REQUIRED,
      "Say how to run it. A plan nobody can run is a promise, and an accepted plan is a completion condition.");
  }
  const plan = {
    name: clean(name, 200),
    strategy: clean(strategy, 1000),
    howToRun: clean(howToRun, 1000),
    passing: clean(passing, 500),
    cases: list(cases, 500),
    featureId, moduleId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ArchitectureError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    let feature = null;
    let module = null;
    if (featureId || moduleId) ({ feature, module } = await placement(db, { featureId, moduleId }));
    await refuseDuplicate(db, "test_plans", "project_id", project.id, plan.name, "test plan");
    const row = await create(db, "test_plan", {
      project_id: project.id,
      feature_id: feature?.id ?? null,
      module_id: module?.id ?? null,
      name: plan.name,
      strategy: plan.strategy,
      how_to_run: plan.howToRun,
      passing_condition: plan.passing,
      status: "draft",
    }, { projectId: project.id, activity: false });

    for (const [index, expectation] of plan.cases.entries()) {
      await create(db, "test_plan_case", {
        test_plan_id: row.id,
        name: expectation.slice(0, 120),
        expectation,
        sequence: index,
      }, { projectId: project.id, activity: false });
    }

    await recordActivity(db, project.id, {
      type: "specification_changed",
      actor,
      featureId: feature?.id ?? null,
      summary: clean(`Test plan recorded: ${plan.name}`, 200),
      metadata: { plan: row.id, cases: plan.cases.length },
    });
    return { applied: true, plan: row, cases: plan.cases.length };
  });
}

// ----------------------------------------------------------- schema migrations

/**
 * Record a schema change and how it is rolled back.
 *
 * The rollback is required, because `full` depth asks for a migration with one and
 * the depth gate checks that every migration has a rollback rather than just one of
 * them. A migration with no way back is the thing that turns a bad deploy into an
 * outage.
 */
export async function recordMigration(root, { name, forward, rollback, featureId = null, compatibility = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A migration needs a name.");
  if (!clean(forward)) throw new ArchitectureError(E.REQUIRED, "Say what the migration does.");
  if (!clean(rollback)) {
    throw new ArchitectureError(E.REQUIRED,
      "Say how it is rolled back. A migration with no way back is what turns a bad deploy into an outage, and the depth gate asks for a rollback on every one.");
  }
  const plan = {
    name: clean(name, 200),
    forward: clean(forward, 1000),
    rollback: clean(rollback, 1000),
    compatibility: clean(compatibility, 500),
    featureId,
  };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ArchitectureError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    let feature = null;
    if (featureId) ({ feature } = await placement(db, { featureId }));
    await refuseDuplicate(db, "schema_migrations", "project_id", project.id, plan.name, "migration");
    const row = await create(db, "schema_migration", {
      project_id: project.id,
      feature_id: feature?.id ?? null,
      name: plan.name,
      sequence: await nextSequence(db, "schema_migrations", "project_id", project.id),
      forward_plan: plan.forward,
      rollback_plan: plan.rollback,
      compatibility_notes: plan.compatibility,
      status: "planned",
    }, {
      projectId: project.id, actor, activityType: "specification_changed",
      activitySummary: clean(`Migration recorded: ${plan.name}`, 200),
    });
    return { applied: true, migration: row, feature: feature?.name ?? null };
  });
}

// -------------------------------------------------------------- state machines

/** Record the states something moves through, and which of them are terminal. */
export async function recordStateMachine(root, { entity, states, featureId = null, moduleId = null, initial = null, actor = "superdev", apply = false } = {}) {
  if (!clean(entity)) {
    throw new ArchitectureError(E.REQUIRED, "Say what moves through these states: --entity \"<the thing>\".");
  }
  const named = list(states, 120);
  if (named.length < 2) {
    throw new ArchitectureError(E.REQUIRED,
      "A state machine needs at least two states: --state \"<name>\", repeated. One state is not a machine.");
  }
  const plan = { entity: clean(entity, 200), states: named, initial: clean(initial, 120) ?? named[0], featureId, moduleId };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    const existing = await db.get(
      "SELECT id FROM state_machines WHERE module_id = ? AND entity_name = ?", module.id, plan.entity);
    if (existing) {
      throw new ArchitectureError(E.EXISTS, `${existing.id} already describes the states of ${JSON.stringify(plan.entity)}.`);
    }
    const machine = await create(db, "state_machine", {
      module_id: module.id,
      feature_id: feature?.id ?? null,
      entity_name: plan.entity,
      initial_state: plan.initial,
      status: "planned",
    }, { projectId: module.project_id, activity: false });

    for (const [index, name] of plan.states.entries()) {
      await create(db, "state", {
        state_machine_id: machine.id,
        name,
        // Terminal is a claim about behaviour, so it is not guessed from a name.
        terminal: 0,
        permitted_actions_json: JSON.stringify([]),
        sequence: index,
      }, { projectId: module.project_id, activity: false });
    }

    await recordActivity(db, module.project_id, {
      type: "specification_changed",
      actor,
      featureId: feature?.id ?? null,
      summary: clean(`States recorded for ${plan.entity}: ${plan.states.join(", ")}`, 200),
      metadata: { machine: machine.id, states: plan.states.length },
    });
    return { applied: true, machine, states: plan.states.length, module: module.name };
  });
}

// ------------------------------------------------------------------- glossary

/** Record what a word means in this project. One meaning per term. */
export async function recordTerm(root, { term, meaning, source = null, actor = "superdev", apply = false } = {}) {
  if (!clean(term)) throw new ArchitectureError(E.REQUIRED, "Say which word.");
  if (!clean(meaning)) {
    throw new ArchitectureError(E.REQUIRED, "Say what it means here. A term with no meaning is the ambiguity it was meant to remove.");
  }
  const plan = { term: clean(term, 120), meaning: clean(meaning, 1000), source: clean(source, 300) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ArchitectureError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    const existing = await db.get(
      "SELECT id, meaning FROM glossary_terms WHERE project_id = ? AND term = ?", project.id, plan.term);
    if (existing) {
      throw new ArchitectureError(E.EXISTS,
        `${plan.term} already means: ${existing.meaning}. One meaning per term is the point of a glossary.`);
    }
    const row = await create(db, "glossary_term", {
      project_id: project.id,
      term: plan.term,
      meaning: plan.meaning,
      source_ref: plan.source,
    }, {
      projectId: project.id, actor, activityType: "specification_changed",
      activitySummary: clean(`Glossary: ${plan.term}`, 200),
    });
    return { applied: true, term: row };
  });
}
