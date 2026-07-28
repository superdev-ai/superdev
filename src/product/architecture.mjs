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
      components_json: JSON.stringify([]),
      entities_shown_json: JSON.stringify([]),
      responsive_behavior: plan.responsive,
      accessibility_notes: plan.accessibility,
      status: "planned",
    }, { projectId: module.project_id, activity: false });

    // The actions go in ui_actions, which is where the interface reads them.
    //
    // They were first written into surfaces.components_json, and every count in the
    // UI Surfaces area reads the ui_actions table, so a surface recorded that way
    // showed zero actions and counted as a surface with no action recorded. That is
    // the exact figure the reader was asking about when this whole gap was found, so
    // shipping it again would have been the same defect in a new place. Found by
    // auditing every record kind for a writer, not by reading this code.
    const actions = [];
    for (const name of plan.actions) {
      actions.push(await create(db, "ui_action", {
        surface_id: row.id,
        name,
        label: name,
        status: "planned",
      }, { projectId: module.project_id, activity: false }));
    }

    await recordActivity(db, module.project_id, {
      type: "specification_changed",
      actor,
      featureId: feature?.id ?? null,
      summary: clean(`Surface recorded: ${plan.name}${actions.length ? `, ${actions.length} action${actions.length === 1 ? "" : "s"}` : ""}`, 200),
      metadata: { surface: row.id, actions: actions.length },
    });
    return { applied: true, surface: row, actionsRecorded: actions.length, module: module.name, feature: feature?.name ?? null };
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

// ------------------------------------------------------- the detail records
//
// Every one of these is a part of something the previous section can already
// write, and every one was read by the control centre with nothing able to create
// it. They are small on purpose: a field of an entity, a transition between two
// states, the empty state of a screen. The reason they matter is that the parent
// without them is a name. An entity with no fields does not describe data, a state
// machine with no transitions is a list, and a screen with no empty state is the
// one that ships blank.

/** Add a field to a data entity. An entity with no fields does not describe data. */
export async function addField(root, entityId, { name, type, nullable = false, sensitivity = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A field needs a name.");
  if (!clean(type)) {
    throw new ArchitectureError(E.REQUIRED, "Say what type it is. A field with no type is a word.");
  }
  const plan = { entityId, name: clean(name, 120), type: clean(type, 120), nullable: Boolean(nullable), sensitivity: clean(sensitivity, 60) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const entity = await db.get(
      `SELECT e.id, e.name, m.project_id FROM data_entities e
         JOIN modules m ON m.id = e.module_id WHERE e.id = ?`, entityId);
    if (!entity) {
      throw new ArchitectureError(E.NOT_FOUND, `There is no data entity ${entityId}. List them with superdev schema show.`);
    }
    const existing = await db.get("SELECT id FROM data_fields WHERE entity_id = ? AND name = ?", entityId, plan.name);
    if (existing) throw new ArchitectureError(E.EXISTS, `${entity.name} already has a field called ${JSON.stringify(plan.name)}.`);
    const row = await create(db, "data_field", {
      entity_id: entityId,
      name: plan.name,
      type: plan.type,
      nullable: plan.nullable ? 1 : 0,
      sensitivity_class: plan.sensitivity,
      sequence: await nextSequence(db, "data_fields", "entity_id", entityId),
    }, {
      projectId: entity.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Field added to ${entity.name}: ${plan.name}`, 200),
    });
    const total = await db.get("SELECT COUNT(*) AS n FROM data_fields WHERE entity_id = ?", entityId);
    return { applied: true, field: row, entity: entity.name, total: Number(total.n) };
  });
}

/** Record how two entities relate, and what happens when one is deleted. */
export async function addRelationship(root, { from, to, name, cardinality = null, onDelete = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "Say what the relationship is called.");
  const plan = { from, to, name: clean(name, 120), cardinality: clean(cardinality, 60), onDelete: clean(onDelete, 120) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const ends = [];
    for (const id of [from, to]) {
      const entity = await db.get(
        `SELECT e.id, e.name, m.project_id FROM data_entities e
           JOIN modules m ON m.id = e.module_id WHERE e.id = ?`, id);
      if (!entity) throw new ArchitectureError(E.NOT_FOUND, `There is no data entity ${id}.`);
      ends.push(entity);
    }
    const row = await create(db, "data_relationship", {
      from_entity_id: from,
      to_entity_id: to,
      name: plan.name,
      cardinality: plan.cardinality,
      on_delete: plan.onDelete,
    }, {
      projectId: ends[0].project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`${ends[0].name} relates to ${ends[1].name}: ${plan.name}`, 200),
    });
    return { applied: true, relationship: row, from: ends[0].name, to: ends[1].name };
  });
}

/** Group operations under a service, so an API has a shape rather than a list. */
export async function recordService(root, { name, moduleId = null, purpose = null, style = null, basePath = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A service needs a name.");
  const plan = { name: clean(name, 200), moduleId, purpose: clean(purpose, 1000), style: clean(style, 60), basePath: clean(basePath, 200) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ArchitectureError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    let module = null;
    if (moduleId) ({ module } = await placement(db, { moduleId }));
    await refuseDuplicate(db, "api_services", "project_id", project.id, plan.name, "service");
    const row = await create(db, "api_service", {
      project_id: project.id,
      module_id: module?.id ?? null,
      name: plan.name,
      purpose: plan.purpose,
      style: plan.style,
      base_path: plan.basePath,
      status: "planned",
      sequence: await nextSequence(db, "api_services", "project_id", project.id),
    }, {
      projectId: project.id, actor, activityType: "specification_changed",
      activitySummary: clean(`Service recorded: ${plan.name}`, 200),
    });
    return { applied: true, service: row };
  });
}

/** Record a transition between two states, and what causes it. */
export async function addTransition(root, machineId, { from, to, event, guard = null, actor = "superdev", apply = false } = {}) {
  if (!clean(event)) {
    throw new ArchitectureError(E.REQUIRED, "Say what causes the transition. A transition with no event is an edge nobody can trigger.");
  }
  const plan = { machineId, from: clean(from, 120), to: clean(to, 120), event: clean(event, 200), guard: clean(guard, 300) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const machine = await db.get(
      `SELECT s.id, s.entity_name, m.project_id FROM state_machines s
         JOIN modules m ON m.id = s.module_id WHERE s.id = ?`, machineId);
    if (!machine) throw new ArchitectureError(E.NOT_FOUND, `There is no state machine ${machineId}.`);
    const named = [];
    for (const wanted of [plan.from, plan.to]) {
      const state = await db.get(
        "SELECT id, name FROM states WHERE state_machine_id = ? AND name = ?", machineId, wanted);
      if (!state) {
        const all = await db.all("SELECT name FROM states WHERE state_machine_id = ? ORDER BY sequence", machineId);
        throw new ArchitectureError(E.NOT_FOUND,
          `${machine.entity_name} has no state called ${JSON.stringify(wanted)}. Its states are: ${all.map((s) => s.name).join(", ")}.`);
      }
      named.push(state);
    }
    const row = await create(db, "state_transition", {
      state_machine_id: machineId,
      from_state_id: named[0].id,
      to_state_id: named[1].id,
      event: plan.event,
      guard: plan.guard,
    }, {
      projectId: machine.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`${machine.entity_name}: ${named[0].name} to ${named[1].name} on ${plan.event}`, 200),
    });
    return { applied: true, transition: row, entity: machine.entity_name, from: named[0].name, to: named[1].name };
  });
}

const SURFACE_STATES = ["empty", "loading", "error", "partial", "stale", "offline", "unauthorized", "success"];

/** Record what a screen does when it has nothing, is waiting, or has failed. */
export async function addSurfaceState(root, surfaceId, { stateType, behavior = null, copy = null, actor = "superdev", apply = false } = {}) {
  if (!SURFACE_STATES.includes(stateType)) {
    throw new ArchitectureError(E.NOT_ALLOWED,
      `A surface state is one of: ${SURFACE_STATES.join(", ")}. ${JSON.stringify(stateType)} is none of them.`);
  }
  if (!clean(behavior) && !clean(copy)) {
    throw new ArchitectureError(E.REQUIRED,
      "Say what it does, or what it says: --behaviour \"<what happens>\" or --copy \"<the words>\". A named state with neither is the blank screen it was meant to prevent.");
  }
  const plan = { surfaceId, stateType, behavior: clean(behavior, 500), copy: clean(copy, 500) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const surface = await db.get(
      `SELECT s.id, s.name, m.project_id FROM surfaces s
         JOIN modules m ON m.id = s.module_id WHERE s.id = ?`, surfaceId);
    if (!surface) throw new ArchitectureError(E.NOT_FOUND, `There is no surface ${surfaceId}.`);
    const existing = await db.get(
      "SELECT id FROM surface_states WHERE surface_id = ? AND state_type = ?", surfaceId, stateType);
    if (existing) {
      throw new ArchitectureError(E.EXISTS, `${surface.name} already describes its ${stateType} state.`);
    }
    const row = await create(db, "surface_state", {
      surface_id: surfaceId,
      state_type: stateType,
      behavior: plan.behavior,
      copy: plan.copy,
    }, {
      projectId: surface.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`${surface.name}: ${stateType} state described`, 200),
    });
    return { applied: true, state: row, surface: surface.name };
  });
}

/** Record who or what carries out part of a workflow. */
export async function addWorkflowActor(root, workflowId, { actorName, actorType = "person", actor = "superdev", apply = false } = {}) {
  if (!clean(actorName)) throw new ArchitectureError(E.REQUIRED, "Say who or what acts.");
  const plan = { workflowId, actorName: clean(actorName, 200), actorType: clean(actorType, 60) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const workflow = await db.get(
      `SELECT w.id, w.name, f.project_id FROM workflows w
         JOIN features f ON f.id = w.feature_id WHERE w.id = ?`, workflowId);
    if (!workflow) throw new ArchitectureError(E.NOT_FOUND, `There is no workflow ${workflowId}.`);
    const row = await create(db, "workflow_actor", {
      workflow_id: workflowId,
      actor: plan.actorName,
      actor_type: plan.actorType,
      sequence: await nextSequence(db, "workflow_actors", "workflow_id", workflowId),
    }, {
      projectId: workflow.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`${workflow.name}: ${plan.actorName} acts`, 200),
    });
    return { applied: true, workflowActor: row, workflow: workflow.name };
  });
}

/** Record where a workflow forks, on what condition. */
export async function addWorkflowBranch(root, workflowId, { fromStep, condition, toStep = null, actor = "superdev", apply = false } = {}) {
  if (!clean(condition)) {
    throw new ArchitectureError(E.REQUIRED, "Say what decides the branch. A fork with no condition is two paths and no rule.");
  }
  const plan = { workflowId, fromStep: Number(fromStep), condition: clean(condition, 500), toStep: toStep === null ? null : Number(toStep) };
  if (!Number.isInteger(plan.fromStep)) {
    throw new ArchitectureError(E.REQUIRED, "Say which step it branches from, by its number: --from-step <n>.");
  }
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const workflow = await db.get(
      `SELECT w.id, w.name, f.project_id FROM workflows w
         JOIN features f ON f.id = w.feature_id WHERE w.id = ?`, workflowId);
    if (!workflow) throw new ArchitectureError(E.NOT_FOUND, `There is no workflow ${workflowId}.`);
    const step = async (n) => (n === null ? null : await db.get(
      "SELECT id, action FROM workflow_steps WHERE workflow_id = ? AND sequence = ?", workflowId, n));
    const from = await step(plan.fromStep);
    if (!from) {
      const all = await db.all("SELECT sequence, action FROM workflow_steps WHERE workflow_id = ? ORDER BY sequence", workflowId);
      throw new ArchitectureError(E.NOT_FOUND,
        `${workflow.name} has no step ${plan.fromStep}. Its steps are: ${all.map((s) => `${s.sequence} ${s.action}`).join("; ")}.`);
    }
    const to = await step(plan.toStep);
    const row = await create(db, "workflow_branch", {
      workflow_id: workflowId,
      from_step_id: from.id,
      to_step_id: to?.id ?? null,
      condition: plan.condition,
    }, {
      projectId: workflow.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`${workflow.name} branches after ${from.action}: ${plan.condition}`, 200),
    });
    return { applied: true, branch: row, workflow: workflow.name, from: from.action };
  });
}

/** Record something that runs on a schedule or in the background. */
export async function recordJob(root, { name, featureId = null, moduleId = null, trigger = null, retry = null, observability = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A job needs a name.");
  if (!clean(trigger)) {
    throw new ArchitectureError(E.REQUIRED, "Say what starts it. A job with no trigger never runs, or runs for a reason nobody wrote down.");
  }
  const plan = { name: clean(name, 200), trigger: clean(trigger, 300), retry: clean(retry, 300), observability: clean(observability, 300), featureId, moduleId };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    await refuseDuplicate(db, "jobs", "module_id", module.id, plan.name, "job");
    const row = await create(db, "job", {
      feature_id: feature?.id ?? null,
      module_id: module.id,
      name: plan.name,
      trigger: plan.trigger,
      retry_policy: plan.retry,
      observability: plan.observability,
      status: "planned",
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`Job recorded: ${plan.name}`, 200),
    });
    return { applied: true, job: row, module: module.name };
  });
}

const DIRECTIONS = ["incoming", "outgoing"];

/** Record an event this sends or receives, and how it is trusted. */
export async function recordWebhook(root, { name, direction, featureId = null, moduleId = null, endpoint = null, verification = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A webhook needs a name.");
  if (!DIRECTIONS.includes(direction)) {
    throw new ArchitectureError(E.NOT_ALLOWED, `A webhook is ${DIRECTIONS.join(" or ")}, not ${JSON.stringify(direction)}.`);
  }
  if (direction === "inbound" && !clean(verification)) {
    throw new ArchitectureError(E.REQUIRED,
      "An inbound webhook needs to say how the sender is verified: --verification \"<how>\". An unverified inbound event is anybody's event.");
  }
  const plan = { name: clean(name, 200), direction, endpoint: clean(endpoint, 300), verification: clean(verification, 300), featureId, moduleId };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const { feature, module } = await placement(db, { featureId, moduleId });
    await refuseDuplicate(db, "webhooks", "module_id", module.id, plan.name, "webhook");
    const row = await create(db, "webhook", {
      feature_id: feature?.id ?? null,
      module_id: module.id,
      name: plan.name,
      direction: plan.direction,
      endpoint_or_registration: plan.endpoint,
      identity_verification: plan.verification,
      status: "planned",
    }, {
      projectId: module.project_id, actor, activityType: "specification_changed",
      activitySummary: clean(`${plan.direction} webhook recorded: ${plan.name}`, 200),
    });
    return { applied: true, webhook: row, module: module.name };
  });
}

/** Record a piece of the running system, and where it runs. */
export async function recordRuntimePiece(root, { name, runsWhere = null, evidence = null, actor = "superdev", apply = false } = {}) {
  if (!clean(name)) throw new ArchitectureError(E.REQUIRED, "A runtime piece needs a name.");
  const plan = { name: clean(name, 200), runsWhere: clean(runsWhere, 300), evidence: clean(evidence, 300) };
  if (!apply) return { applied: false, ...plan };

  return mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) throw new ArchitectureError(E.NOT_FOUND, "There is no project here yet. Run superdev init first.");
    await refuseDuplicate(db, "runtime_pieces", "project_id", project.id, plan.name, "runtime piece");
    const row = await create(db, "runtime_piece", {
      project_id: project.id,
      name: plan.name,
      runs_where: plan.runsWhere,
      evidence_ref: plan.evidence,
      sequence: await nextSequence(db, "runtime_pieces", "project_id", project.id),
    }, {
      projectId: project.id, actor, activityType: "specification_changed",
      activitySummary: clean(`Runtime piece recorded: ${plan.name}`, 200),
    });
    return { applied: true, piece: row };
  });
}
