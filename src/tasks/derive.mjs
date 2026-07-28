// Task derivation, brief section 11.
//
// Work comes from accepted specifications, never from a feature title. The unit
// is an outcome that can be assigned, implemented and verified, so rows that
// cannot ship apart are combined into one task, and rows that can be delivered
// or blocked on their own stay separate.
//
// Re-derivation is a diff, not a rewrite. A task nobody has started is brought
// back in line with the specification; a task already in flight only gains the
// contract links it is missing and its wording drift is reported; a completed
// task is never edited, it is followed by a new task or left alone.

import { DbError, create, mutate, patch, query, recordActivity, setStatus } from "../db/store.mjs";

/** Where a contract link points. Used to validate links and detect dead ones. */
export const TARGET_TABLE = {
  workflow_step: "workflow_steps",
  ui_action: "ui_actions",
  api_operation: "api_operations",
  data_entity: "data_entities",
  schema_migration: "schema_migrations",
  integration: "integrations",
  job: "jobs",
  webhook: "webhooks",
  nfr: "non_functional_requirements",
  document: "documents",
  decision: "decisions",
  acceptance_criterion: "feature_acceptance_criteria",
  surface: "surfaces",
  state_transition: "state_transitions",
  permission: "permissions",
};

const TERMINAL = new Set(["complete", "cancelled", "superseded"]);
/** Only a task nobody has picked up yet may have its derived wording replaced. */
const REWRITABLE = new Set(["draft", "ready"]);
/** A specification row in one of these states is no longer work to be done. */
const DROPPED = new Set(["rejected", "superseded", "deprecated", "cancelled", "not_applicable"]);
/** A group bundling this many independently implementable rows earns subtasks. */
const SPLIT_AT = 4;

const alive = (rows) => rows.filter((r) => !DROPPED.has(r.status));
const ids = (rows) => rows.map((r) => r.id).join(", ");
const listOf = (values) => values.filter(Boolean).join(" ");

// -------------------------------------------------------------- loading spec

async function loadSpec(db, featureId) {
  const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
  if (!feature) throw new DbError("E_NOT_FOUND", `Feature ${featureId} does not exist.`);
  const module = await db.get("SELECT * FROM modules WHERE id = ?", feature.module_id);
  const projectId = feature.project_id;

  const workflows = alive(await db.all("SELECT * FROM workflows WHERE feature_id = ? ORDER BY id", featureId));
  const steps = new Map();
  for (const wf of workflows) {
    steps.set(wf.id, alive(await db.all("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY sequence", wf.id)));
  }

  const surfaces = alive(await db.all("SELECT * FROM surfaces WHERE feature_id = ? ORDER BY id", featureId));
  const actions = new Map();
  const surfaceStates = new Map();
  for (const s of surfaces) {
    actions.set(s.id, alive(await db.all("SELECT * FROM ui_actions WHERE surface_id = ? ORDER BY id", s.id)));
    surfaceStates.set(s.id, await db.all("SELECT state_type FROM surface_states WHERE surface_id = ? ORDER BY state_type", s.id));
  }

  const machines = alive(await db.all("SELECT * FROM state_machines WHERE feature_id = ? ORDER BY id", featureId));
  const transitions = new Map();
  for (const m of machines) {
    transitions.set(m.id, await db.all("SELECT * FROM state_transitions WHERE state_machine_id = ? ORDER BY id", m.id));
  }

  const entities = alive(await db.all("SELECT * FROM data_entities WHERE feature_id = ? ORDER BY id", featureId));
  const fields = new Map();
  for (const e of entities) {
    fields.set(e.id, await db.all("SELECT name, sensitivity_class FROM data_fields WHERE entity_id = ? ORDER BY sequence, name", e.id));
  }
  const migrations = alive(await db.all("SELECT * FROM schema_migrations WHERE feature_id = ? ORDER BY sequence, id", featureId));
  const migrationEntities = await db.all(
    `SELECT me.migration_id, me.entity_id FROM schema_migration_entities me
       JOIN schema_migrations m ON m.id = me.migration_id
      WHERE m.feature_id = ?`,
    featureId,
  );

  return {
    feature,
    module,
    projectId,
    criteria: (await db.all(
      "SELECT * FROM feature_acceptance_criteria WHERE feature_id = ? ORDER BY sequence, id", featureId,
    )).filter((c) => c.status !== "waived"),
    workflows, steps, surfaces, actions, surfaceStates, machines, transitions,
    apis: alive(await db.all("SELECT * FROM api_operations WHERE feature_id = ? ORDER BY id", featureId)),
    entities, fields, migrations, migrationEntities,
    integrations: alive(await db.all("SELECT * FROM integrations WHERE feature_id = ? ORDER BY id", featureId)),
    jobs: alive(await db.all("SELECT * FROM jobs WHERE feature_id = ? ORDER BY id", featureId)),
    webhooks: alive(await db.all("SELECT * FROM webhooks WHERE feature_id = ? ORDER BY id", featureId)),
    nfrs: alive(await db.all(
      "SELECT * FROM non_functional_requirements WHERE feature_id = ? ORDER BY category, id", featureId,
    )),
    permissions: await db.all(
      `SELECT p.*, r.name AS role_name FROM permissions p JOIN roles r ON r.id = p.role_id
        WHERE r.project_id = ? AND p.scope_type = 'feature' AND p.scope_id = ?
        ORDER BY r.name, p.id`,
      projectId, featureId,
    ),
    documents: await db.all(
      "SELECT * FROM documents WHERE project_id = ? AND scope_type = 'feature' AND scope_id = ? ORDER BY path",
      projectId, featureId,
    ),
    decisions: await db.all(
      `SELECT id, title FROM decisions
        WHERE project_id = ? AND scope_type = 'feature' AND scope_id = ?
          AND status IN ('accepted','time_boxed') ORDER BY id`,
      projectId, featureId,
    ),
  };
}

/**
 * A non functional requirement is filed under what it is about, not under a
 * catch-all. Quality remains the honest answer when the category names nothing
 * more specific.
 */
function nfrCategory(category) {
  const c = String(category ?? "").toLowerCase();
  if (/secur|privac/.test(c)) return "Security";
  if (/perf|latency|throughput|capacity|speed/.test(c)) return "Performance";
  if (/accessib|a11y/.test(c)) return "Accessibility";
  if (/observab|monitor|telemetry|logging|alert/.test(c)) return "Observability";
  if (/complian|regulat|retention|gdpr|hipaa|pci/.test(c)) return "Compliance";
  return "Quality";
}

// ------------------------------------------------------------ plan item shape

function item(key, anchor, over) {
  return {
    key,
    anchor,
    category: "Feature",
    priority: "normal",
    links: [anchor],
    dependsOn: [],
    subtasks: [],
    boundaries: [],
    criteria: [],
    verification: [],
    children: [],
    enabling: false,
    ...over,
  };
}

const link = (target_type, target_id, relationship = "implements") => ({ target_type, target_id, relationship });

/**
 * Split a bundled group into subtasks only when it carries enough independently
 * implementable rows that a single task would hide the real work.
 */
function withSubtasks(it) {
  const kids = it.children ?? [];
  it.children = [];
  if (kids.length < SPLIT_AT) return it;
  it.subtasks = kids.map((c) => item(`${it.key}/${c.id}`, link(c.type, c.id), {
    name: c.name,
    category: it.category,
    priority: it.priority,
    risk: it.risk,
    why_needed: `Part of "${it.name}". It is split out because it can be picked up and verified on its own.`,
    expected_outcome: c.outcome,
    description: `Implements ${c.type.replace(/_/g, " ")} ${c.id}.`,
    criteria: [`${c.id} behaves exactly as the accepted specification states.`],
    verification: [`Exercise ${c.id} against its specification and record the observed result.`],
    boundaries: it.boundaries,
  }));
  return it;
}

// ------------------------------------------------------------------ builders

/**
 * ponytail: nothing in the schema links a UI action to the API operation behind
 * it, so the pairing is inferred from the action naming the operation in its
 * own text. Ceiling: an action that describes its call in other words leaves the
 * operation as a separate task, which loses a grouping but never invents a wrong
 * one. Upgrade path is a real column on ui_actions.
 */
function apiReferencedBy(actions, api) {
  const needles = [api.id, api.name, api.path_or_topic]
    .filter((v) => typeof v === "string" && v.length > 2)
    .map((v) => v.toLowerCase());
  return actions.some((a) => {
    const hay = `${a.effect ?? ""} ${a.side_effects_json ?? ""} ${a.input_contract ?? ""}`.toLowerCase();
    return needles.some((n) => hay.includes(n));
  });
}

/** Entities and the migrations that touch them must ship together, so they are one task. */
function dataComponents(spec) {
  const parent = new Map();
  for (const e of spec.entities) parent.set(e.id, e.id);
  for (const m of spec.migrations) parent.set(m.id, m.id);
  const find = (x) => {
    let cur = x;
    while (parent.get(cur) !== cur) cur = parent.get(cur);
    return cur;
  };
  for (const l of spec.migrationEntities) {
    if (!parent.has(l.entity_id) || !parent.has(l.migration_id)) continue;
    const a = find(l.entity_id);
    const b = find(l.migration_id);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map();
  const push = (row, kind) => {
    const root = find(row.id);
    if (!groups.has(root)) groups.set(root, { entities: [], migrations: [] });
    groups.get(root)[kind].push(row);
  };
  for (const e of spec.entities) push(e, "entities");
  for (const m of spec.migrations) push(m, "migrations");
  return [...groups.values()];
}

function dataItems(spec) {
  const out = [];
  for (const group of dataComponents(spec)) {
    const head = group.entities[0] ?? group.migrations[0];
    const anchor = group.entities[0]
      ? link("data_entity", group.entities[0].id)
      : link("schema_migration", group.migrations[0].id);
    const names = group.entities.map((e) => e.name);
    const sensitive = group.entities.filter((e) => e.sensitivity_class !== "none");
    const it = item(`data:${head.id}`, anchor, {
      category: group.migrations.length && !group.entities.length ? "Migration" : "Data",
      name: names.length
        ? `Establish the ${names.join(" and ")} data model`
        : `Apply migration ${group.migrations[0].name}`,
      why_needed: `${spec.feature.name} cannot store or read what it promises until this data exists and can be migrated forward and back.`,
      expected_outcome: names.length
        ? `${names.join(", ")} exist with their fields, relationships and deletion semantics as specified, and the migration applies and rolls back cleanly.`
        : `The migration applies and rolls back cleanly with no loss of data already stored.`,
      description: listOf([
        names.length ? `Implements data entities ${ids(group.entities)}.` : "",
        group.migrations.length ? `Covers migrations ${ids(group.migrations)}.` : "",
      ]),
      links: [
        ...group.entities.map((e) => link("data_entity", e.id)),
        ...group.migrations.map((m) => link("schema_migration", m.id)),
      ],
      criteria: [
        ...group.entities.map((e) => `${e.name} stores every declared field with its declared nullability and constraints.`),
        ...group.migrations.map((m) => `Migration ${m.id} applies forward and rolls back to the previous shape without data loss.`),
        ...sensitive.map((e) => `${e.name} honours its ${e.sensitivity_class} retention rule and deletion semantics.`),
      ],
      verification: [
        "Apply the migration on a copy of real-shaped data, then roll it back, and record both results.",
        ...group.entities.map((e) => `Read and write ${e.name} through the code path that owns it and record the observed result.`),
      ],
      boundaries: [
        `Module ${spec.module?.name ?? spec.feature.module_id}`,
        ...group.entities.map((e) => `Data entity ${e.name} in ${e.store ?? "the project store"}`),
      ],
      children: group.entities.map((e) => ({
        id: e.id, type: "data_entity",
        name: `Implement the ${e.name} entity`,
        outcome: `${e.name} exists with its declared fields and relationships.`,
      })),
    });
    out.push(withSubtasks(it));
  }
  return out;
}

function surfaceItems(spec, usedApiIds) {
  return spec.surfaces.map((s) => {
    const acts = spec.actions.get(s.id) ?? [];
    const folded = spec.apis.filter((api) => apiReferencedBy(acts, api));
    for (const api of folded) usedApiIds.add(api.id);
    const states = (spec.surfaceStates.get(s.id) ?? []).map((r) => r.state_type);
    return withSubtasks(item(`surface:${s.id}`, link("surface", s.id), {
      category: "Design",
    name: `Deliver the ${s.name} ${s.surface_type ?? "surface"}`,
      why_needed: `${spec.feature.name} is not usable until ${s.name} exists and every action it offers works.`,
      expected_outcome: s.purpose
        ? s.purpose
        : `A person in the ${s.primary_role ?? "intended"} role can open ${s.name} and complete every action it declares.`,
      description: listOf([
        `Implements surface ${s.id} (${s.name})${s.route ? ` at ${s.route}` : ""}.`,
        acts.length ? `Includes UI actions ${ids(acts)}.` : "It declares no actions of its own.",
        folded.length ? `The operations behind those actions (${ids(folded)}) ship with it because they cannot be released apart.` : "",
      ]),
      links: [
        link("surface", s.id),
        ...acts.map((a) => link("ui_action", a.id)),
        ...folded.map((a) => link("api_operation", a.id)),
      ],
      criteria: [
        ...acts.map((a) => `${a.name} enforces ${a.permission ?? "its declared permission"} at ${a.enforcement_point ?? "the server"} and reports success and failure as specified.`),
        states.length
          ? `The ${states.join(", ")} states of ${s.name} each render their specified behaviour and copy.`
          : `Loading, empty and error states of ${s.name} are specified before this task closes.`,
        s.accessibility_notes
          ? `Accessibility holds: ${s.accessibility_notes}`
          : `Every action has an accessible name, a visible focus state and works from the keyboard.`,
        s.responsive_behavior ? `Responsive behaviour holds: ${s.responsive_behavior}` : null,
      ].filter(Boolean),
      verification: [
        `Walk ${s.name} through each declared state and record what was observed.`,
        ...acts.map((a) => `Trigger ${a.name} as a permitted and as a forbidden role and record both outcomes.`),
      ],
      boundaries: [
        `Module ${spec.module?.name ?? spec.feature.module_id}`,
        s.route ? `Route ${s.route}` : `Surface ${s.name}`,
        ...folded.map((a) => `Operation ${a.method_or_procedure ?? a.style} ${a.path_or_topic ?? a.name}`),
      ],
      children: acts.map((a) => ({
        id: a.id, type: "ui_action",
        name: `Implement the ${a.name} action on ${s.name}`,
        outcome: a.effect ?? `${a.name} produces its declared effect and reports the result to the person.`,
      })),
    }));
  });
}

function apiItems(spec, usedApiIds) {
  return spec.apis.filter((a) => !usedApiIds.has(a.id)).map((a) =>
    item(`api:${a.id}`, link("api_operation", a.id), {
      name: `Implement ${a.method_or_procedure ?? a.style} ${a.path_or_topic ?? a.name}`,
      why_needed: a.purpose
        ? `${a.purpose} Nothing that depends on this contract can be built before it exists.`
        : `${spec.feature.name} depends on this operation, and no caller can be built against a contract that does not exist yet.`,
      expected_outcome: `${a.name} accepts its declared request, returns its declared response, and returns every declared error rather than a generic failure.`,
      description: `Implements API operation ${a.id} (${a.name}).`,
      criteria: [
        `The request and response contracts match ${a.id} exactly, including the declared error cases.`,
        `${a.auth_requirement ?? "The declared authentication"} is required and ${a.permission ?? "the declared permission"} is enforced at ${a.enforcement_point ?? "the server"}.`,
        a.idempotency ? `Idempotency holds: ${a.idempotency}` : null,
        a.limits ? `Declared limits hold: ${a.limits}` : null,
      ].filter(Boolean),
      verification: [
        `Call ${a.id} with a valid request, an unauthorized request and each declared error case, and record the responses.`,
      ],
      boundaries: [
        `Module ${spec.module?.name ?? spec.feature.module_id}`,
        a.implementation_path ? `Implementation ${a.implementation_path}` : `Operation ${a.name}`,
      ],
    }),
  );
}

function workflowItems(spec) {
  return spec.workflows.map((wf) => {
    const wfSteps = spec.steps.get(wf.id) ?? [];
    return withSubtasks(item(`workflow:${wf.id}`, link("workflow_step", wfSteps[0]?.id ?? wf.id), {
      name: `Make the ${wf.name} flow work end to end`,
      why_needed: wf.purpose
        ? `${wf.purpose} A flow that only works step by step is not a flow.`
        : `${spec.feature.name} promises this flow, and the steps only deliver value when they run end to end.`,
      expected_outcome: wf.completion_criteria ?? `${wf.name} runs from its trigger to its completion for every declared actor.`,
      description: listOf([
        `Implements workflow ${wf.id} (${wf.name}), steps ${ids(wfSteps)}.`,
        wf.trigger ? `Triggered by ${wf.trigger}.` : "",
        wf.observability ? `Instrumentation required: ${wf.observability}` : "",
      ]),
      links: wfSteps.length ? wfSteps.map((s) => link("workflow_step", s.id)) : [link("workflow_step", wf.id)],
      criteria: [
        ...wfSteps.map((s) => `Step ${s.sequence} (${s.action}) produces ${s.expected_result ?? "its declared result"} and handles failure by ${s.failure_behavior ?? "its declared failure behaviour"}.`),
        wf.observability ? `The flow emits ${wf.observability} so a failure is visible without reading the code.` : null,
      ].filter(Boolean),
      verification: [
        `Run ${wf.name} end to end for each declared actor and record where it succeeded and where it stopped.`,
        `Force each declared failure branch and record that the specified failure behaviour happened.`,
      ],
      boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `Workflow ${wf.name}`],
      children: wfSteps.map((s) => ({
        id: s.id, type: "workflow_step",
        name: `Implement step ${s.sequence} of ${wf.name}: ${s.action}`,
        outcome: s.expected_result ?? `Step ${s.sequence} produces its declared result.`,
      })),
    }));
  });
}

function stateMachineItems(spec) {
  return spec.machines.map((m) => {
    const trans = spec.transitions.get(m.id) ?? [];
    if (!trans.length) return null;
    return item(`state:${m.id}`, link("state_transition", trans[0].id), {
      name: `Enforce the ${m.entity_name} state machine`,
      why_needed: `Without enforcement, ${m.entity_name} can reach a state the specification forbids, and every downstream rule stops being true.`,
      expected_outcome: `Only declared transitions of ${m.entity_name} are possible, and a forbidden transition is refused with a reason.`,
      description: `Implements state machine ${m.id} for ${m.entity_name}, transitions ${ids(trans)}.`,
      links: trans.map((t) => link("state_transition", t.id)),
      criteria: [
        `${m.entity_name} starts at ${m.initial_state ?? "its declared initial state"}.`,
        ...trans.map((t) => `The ${t.event} transition is allowed only when ${t.guard ?? "its declared guard"} holds, and is enforced at ${t.enforcement_point ?? "the server"}.`),
        `A transition that is not declared is refused and the refusal says why.`,
      ],
      verification: [
        `Attempt every declared transition and at least one undeclared transition, and record what happened.`,
      ],
      boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `Entity ${m.entity_name}`],
    });
  }).filter(Boolean);
}

function integrationItems(spec) {
  return spec.integrations.map((i) =>
    item(`integration:${i.id}`, link("integration", i.id), {
      category: "Integration",
      name: `Wire the ${i.name} integration`,
      why_needed: i.purpose
        ? `${i.purpose} It stays unverified until it is configured and proven against the real provider.`
        : `${spec.feature.name} depends on ${i.provider ?? i.name}, and an unverified integration is an outage waiting for a user to find it.`,
      expected_outcome: `${i.name} is configured for every declared environment, verified against the provider, and fails the way the specification says it should.`,
      description: `Implements integration ${i.id} with ${i.provider ?? "the declared provider"}.`,
      criteria: [
        `Credentials are supplied by configuration and never stored in the repository or in a record.`,
        `Authentication uses ${i.auth_approach ?? "the declared approach"} and refreshes without manual work.`,
        `Failure behaviour holds: ${i.failure_behavior ?? "the declared failure behaviour"}.`,
      ],
      verification: [
        `Call ${i.name} against the provider in each declared environment and record the result, then move verification_status off unverified.`,
        `Force a provider failure and record that the declared failure behaviour happened.`,
      ],
      boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `Provider ${i.provider ?? i.name}`],
    }),
  );
}

function jobItems(spec) {
  const jobs = spec.jobs.map((j) =>
    item(`job:${j.id}`, link("job", j.id), {
      category: "Infrastructure",
      name: `Run the ${j.name} job reliably`,
      why_needed: `Background work that runs twice, or silently not at all, is worse than no background work, so this ships with its retry and failure route.`,
      expected_outcome: `${j.name} runs on ${j.trigger ?? "its declared trigger"}, is ${j.idempotency ?? "idempotent"}, and a failure lands somewhere a human will see it.`,
      description: `Implements job ${j.id} (${j.name}).`,
      criteria: [
        `Delivery is ${j.delivery_guarantee ?? "undeclared"} and the implementation matches that claim.`,
        `Retries follow ${j.retry_policy ?? "the declared retry policy"} and exhausted work lands in ${j.failure_destination ?? "the declared failure destination"}.`,
        j.timeout ? `The job stops at ${j.timeout} rather than running forever.` : null,
        j.observability ? `The job emits ${j.observability}.` : null,
      ].filter(Boolean),
      verification: [
        `Run the job twice with the same input and record that the second run changed nothing.`,
        `Force a failure and record where the work landed and what a human would see.`,
      ],
      boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `Job ${j.name}`],
    }),
  );
  const hooks = spec.webhooks.map((w) =>
    item(`webhook:${w.id}`, link("webhook", w.id), {
      category: "Integration",
      name: `Handle the ${w.name} ${w.direction} webhook`,
      why_needed: `A webhook without identity checks and replay protection is an open endpoint, and out of order delivery corrupts state quietly.`,
      expected_outcome: `${w.name} verifies identity, refuses replays, and handles out of order delivery as specified.`,
      description: `Implements webhook ${w.id} (${w.name}), direction ${w.direction}.`,
      criteria: [
        `Identity is verified by ${w.identity_verification ?? "the declared method"} before any work happens.`,
        `Replay protection holds: ${w.replay_protection ?? "the declared protection"}.`,
        `Ordering behaviour holds: ${w.ordering_behavior ?? "the declared behaviour"}.`,
        `A failure is visible through ${w.failure_visibility ?? "the declared failure visibility"}.`,
      ],
      verification: [
        `Deliver a valid payload, a replayed payload and a payload with a bad signature, and record all three outcomes.`,
      ],
      boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `Webhook ${w.name}`],
    }),
  );
  return [...jobs, ...hooks];
}

function permissionItems(spec) {
  if (!spec.permissions.length) return [];
  const roles = [...new Set(spec.permissions.map((p) => p.role_name))];
  return [item(`permissions:${spec.feature.id}`, link("permission", spec.permissions[0].id), {
    category: "Security",
    name: `Enforce ${spec.feature.name} permissions for ${roles.join(", ")}`,
    why_needed: `Permissions written down but not enforced read as a promise the product does not keep, and the gap is only found by whoever exploits it.`,
    expected_outcome: `Every declared capability is allowed at its declared access level and refused otherwise, enforced on the server rather than only in the interface.`,
    description: `Implements permissions ${ids(spec.permissions)} for roles ${roles.join(", ")}.`,
    links: spec.permissions.map((p) => link("permission", p.id)),
    criteria: spec.permissions.map((p) =>
      `${p.role_name} has ${p.access_level} access to ${p.capability}, enforced at ${p.enforcement_point ?? "the server"}.`),
    verification: [
      `Exercise each capability as a permitted role and as a role without that access, and record both results.`,
    ],
    boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, "Authorization enforcement"],
  })];
}

function nfrItems(spec) {
  const byCategory = new Map();
  for (const n of spec.nfrs) {
    if (!byCategory.has(n.category)) byCategory.set(n.category, []);
    byCategory.get(n.category).push(n);
  }
  return [...byCategory].map(([category, rows]) =>
    item(`nfr:${category}:${rows[0].id}`, link("nfr", rows[0].id), {
      category: nfrCategory(category),
      name: `Meet the ${category} requirements of ${spec.feature.name}`,
      why_needed: `An unmeasured requirement is an assumption. These carry targets, so they can be measured and either met or reported honestly as unmet.`,
      expected_outcome: `Each ${category} requirement is measured by its declared method and its measured value is recorded against its target.`,
      description: `Implements non functional requirements ${ids(rows)} in category ${category}.`,
      links: rows.map((n) => link("nfr", n.id)),
      criteria: rows.map((n) => `${n.requirement} reaches ${n.target ?? "its declared target"}.`),
      verification: rows.map((n) =>
        `Measure ${n.id} using ${n.measurement_method ?? "its declared measurement method"} and record the value, not an impression.`),
      boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `${category} of ${spec.feature.name}`],
    }),
  );
}

function documentationItems(spec) {
  const pending = spec.documents.filter((d) => d.sync_status === "manual_edit_pending" || d.sync_status === "missing");
  if (!pending.length) return [];
  return [item(`docs:${spec.feature.id}`, link("document", pending[0].id), {
    category: "Documentation",
    name: `Reconcile the ${spec.feature.name} documentation`,
    why_needed: `A document that is missing, or edited by hand and never folded back into the record, makes the generated set untrustworthy for everyone after you.`,
    expected_outcome: `Every document for this feature is generated from the record, and any manual edit has been accepted into the record or rejected with a reason.`,
    description: `Covers documents ${pending.map((d) => d.path).join(", ")}.`,
    links: pending.map((d) => link("document", d.id, "synchronizes")),
    criteria: pending.map((d) =>
      d.sync_status === "missing"
        ? `${d.path} is generated and its hash matches the record.`
        : `The manual edit in ${d.path} is accepted into the record or rejected with a stated reason.`),
    verification: ["Regenerate the documents and record that no proposal remains open for this feature."],
    boundaries: pending.map((d) => `Document ${d.path}`),
  })];
}

function rolloutItems(spec) {
  const risky = ["R2", "R3", "R4"].includes(spec.feature.risk_level);
  if (!risky && !spec.migrations.length) return [];
  const links = [
    ...spec.migrations.map((m) => link("schema_migration", m.id, "rolls_back")),
    ...spec.integrations.map((i) => link("integration", i.id, "rolls_out")),
    ...spec.decisions.map((d) => link("decision", d.id, "governed_by")),
  ];
  if (!links.length) return [];
  return [item(`rollout:${spec.feature.id}`, links[0], {
    category: "Release",
    name: `Prove rollout and rollback for ${spec.feature.name}`,
    why_needed: `This is ${spec.feature.risk_level} work. A release that cannot be reversed is a decision made once, under pressure, with no way back.`,
    expected_outcome: `The feature can be released in stages and withdrawn without data loss, and the withdrawal has been performed at least once rather than assumed.`,
    description: `Covers rollout and rollback for ${spec.feature.id}.`,
    links,
    criteria: [
      "The release order is written down and each step names what proves it worked.",
      "Rollback has been performed on real-shaped data and the result recorded.",
      spec.migrations.length ? `Migrations ${ids(spec.migrations)} roll back without losing data written after they applied.` : null,
    ].filter(Boolean),
    verification: ["Perform the rollback end to end and record the observed state before and after."],
    boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, "Release and rollback"],
  })];
}

/**
 * Acceptance and product tests are one outcome: the feature is demonstrably
 * accepted. Product test work comes from the accepted test plan, never from a
 * blanket instruction to write tests.
 */
function acceptanceItems(spec) {
  const testPlans = spec.documents.filter((d) => /test/i.test(d.kind));
  const unmet = spec.criteria.filter((c) => c.status !== "met");
  if (!unmet.length && !testPlans.length) return [];
  const links = [
    ...unmet.map((c) => link("acceptance_criterion", c.id, "verifies")),
    ...testPlans.map((d) => link("document", d.id, "executes")),
  ];
  return [item(`acceptance:${spec.feature.id}`, links[0], {
    category: "Quality",
    category: "Testing",
    name: `Prove ${spec.feature.name} meets its acceptance criteria`,
    why_needed: `A feature is finished when its acceptance criteria are shown to hold with evidence, not when the last implementation task closes.`,
    expected_outcome: `Every acceptance criterion is met or waived with a reason, each backed by recorded evidence.`,
    description: listOf([
      unmet.length ? `Verifies acceptance criteria ${ids(unmet)}.` : "",
      testPlans.length ? `Executes the accepted product test plan in ${testPlans.map((d) => d.path).join(", ")}.` : "",
    ]),
    links,
    criteria: [
      ...unmet.map((c) => `${c.criterion} is shown to hold by ${c.verification_method ?? "its declared verification method"}.`),
      ...testPlans.map((d) => `The product tests described in ${d.path} run and their result is recorded.`),
    ],
    verification: [
      "Attach evidence for each criterion and record a pass, a fail or an inconclusive result rather than an opinion.",
    ],
    boundaries: [`Module ${spec.module?.name ?? spec.feature.module_id}`, `Acceptance of ${spec.feature.name}`],
  })];
}

// --------------------------------------------------------------- the plan

function buildPlan(spec) {
  const usedApiIds = new Set();
  const surfaces = surfaceItems(spec, usedApiIds);
  const data = dataItems(spec);
  const apis = apiItems(spec, usedApiIds);
  const workflows = workflowItems(spec);
  const machines = stateMachineItems(spec);
  const integrations = integrationItems(spec);
  const jobs = jobItems(spec);
  const permissions = permissionItems(spec);
  const nfrs = nfrItems(spec);
  const docs = documentationItems(spec);
  const rollout = rolloutItems(spec);
  const acceptance = acceptanceItems(spec);

  // Order is delivery order, and it is also where the dependencies come from:
  // nothing above a task can be waited on by it.
  const items = [
    ...data, ...apis, ...surfaces, ...workflows, ...machines,
    ...integrations, ...jobs, ...permissions, ...nfrs, ...docs, ...rollout, ...acceptance,
  ].filter((it) => it.links.length);

  const keys = (list) => list.map((it) => it.key);
  const dependOn = (list, on) => {
    for (const it of list) it.dependsOn = [...new Set([...it.dependsOn, ...on])].filter((k) => k !== it.key);
  };
  dependOn(apis, keys(data));
  dependOn(surfaces, [...keys(data), ...keys(apis)]);
  dependOn(workflows, [...keys(surfaces), ...keys(apis)]);
  dependOn(machines, keys(data));
  dependOn(jobs, keys(integrations));
  dependOn(permissions, [...keys(apis), ...keys(surfaces)]);
  dependOn(rollout, [...keys(data), ...keys(integrations)]);
  dependOn(acceptance, keys(items).filter((k) => !k.startsWith("acceptance:")));

  const risk = spec.feature.risk_level;
  const priority = spec.feature.priority ?? "normal";
  const decisions = spec.decisions.length
    ? ` Governing decisions: ${spec.decisions.map((d) => d.id).join(", ")}.`
    : "";
  const docImpact = `Documentation for ${spec.feature.id} is regenerated and no edit proposal is left open.`;
  for (const it of items) {
    for (const node of [it, ...it.subtasks]) {
      node.risk = node.risk ?? risk;
      node.priority = node.priority === "normal" ? priority : node.priority;
      node.description = `${node.description}${decisions}`;
      node.criteria = [...node.criteria, docImpact];
      if (!node.verification.length) node.verification = [`Demonstrate the outcome of ${node.key} and record what was observed.`];
    }
  }
  return items;
}

/** The proposed task set for one accepted feature. Read only, no writes. */
export async function derivationPlan(db, featureId) {
  const spec = await loadSpec(db, featureId);
  const accepted = spec.feature.status === "accepted";
  return {
    featureId,
    feature: spec.feature,
    accepted,
    reason: accepted ? null : `Feature ${featureId} is ${spec.feature.status}. Tasks are derived from accepted specifications only.`,
    items: accepted ? buildPlan(spec) : [],
  };
}

// ------------------------------------------------------------------- the diff

const COMPARED = [
  "name", "description", "expected_outcome", "why_needed",
  "completion_criteria_json", "verification_requirements_json", "affected_boundaries_json",
  "priority", "risk",
];

function columnsFor(it, feature) {
  return {
    name: it.name,
    description: it.description,
    expected_outcome: it.expected_outcome,
    why_needed: it.why_needed,
    completion_criteria_json: JSON.stringify(it.criteria),
    verification_requirements_json: JSON.stringify(it.verification),
    affected_boundaries_json: JSON.stringify(it.boundaries),
    priority: it.priority,
    risk: it.risk ?? null,
    enabling: it.enabling ? 1 : 0,
    enabled_feature_id: it.enabling ? feature.id : null,
    enabling_rationale: it.enabling ? it.enabling_rationale ?? null : null,
  };
}

const sameLink = (a, b) => a.target_type === b.target_type && a.target_id === b.target_id;

function compare(task, it, existingLinks, feature) {
  const wanted = columnsFor(it, feature);
  const fields = {};
  for (const key of COMPARED) {
    if ((task[key] ?? null) !== (wanted[key] ?? null)) fields[key] = wanted[key];
  }
  const addLinks = it.links.filter((l) => !existingLinks.some((e) => sameLink(e, l)));
  const dropLinks = existingLinks.filter((e) => !it.links.some((l) => sameLink(e, l)));
  return { fields, addLinks, dropLinks };
}

async function deadLinks(db, links) {
  const dead = [];
  for (const l of links) {
    const table = TARGET_TABLE[l.target_type];
    if (!table) continue;
    const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, l.target_id);
    if (!row || DROPPED.has(row.status)) dead.push(l);
  }
  return dead;
}

async function diff(db, featureId) {
  const plan = await derivationPlan(db, featureId);
  const feature = plan.feature;
  const out = {
    featureId, feature, accepted: plan.accepted, reason: plan.reason,
    created: [], updated: [], recreated: [], driftOnly: [], unchanged: [],
    superseded: [], orphaned: [], applied: false,
  };
  if (!plan.accepted) return out;

  // Open tasks claim a plan item before finished ones, and a parent before its
  // children, so re-derivation converges instead of oscillating.
  const existing = await db.all(
    `SELECT * FROM tasks WHERE feature_id = ?
      ORDER BY (parent_task_id IS NOT NULL), (status IN ('complete','cancelled','superseded')), id`,
    featureId,
  );
  const linksByTask = new Map(existing.map((t) => [t.id, []]));
  if (existing.length) {
    const rows = await db.all(
      `SELECT * FROM task_contract_links WHERE task_id IN (${existing.map(() => "?").join(",")})`,
      ...existing.map((t) => t.id),
    );
    for (const r of rows) linksByTask.get(r.task_id).push(r);
  }

  // The position in delivery order is the task's sequence, so a task added by a
  // later derivation still sorts where the work actually belongs.
  const flat = [];
  for (const it of plan.items) {
    it.order = flat.length;
    flat.push(it);
    for (const sub of it.subtasks) flat.push({ ...sub, parentKey: it.key, order: flat.length });
  }

  const claimed = new Map();
  const matched = new Map();
  for (const t of existing) {
    const tlinks = linksByTask.get(t.id) ?? [];
    const found = flat.find((it) => !claimed.has(it.key) && tlinks.some((l) => sameLink(l, it.anchor)));
    if (!found) continue;
    claimed.set(found.key, t);
    matched.set(t.id, found);
  }

  for (const it of flat) {
    const task = claimed.get(it.key);
    if (!task) {
      out.created.push({ item: it, reason: "the specification declares work that no task covers" });
      continue;
    }
    const changes = compare(task, it, linksByTask.get(task.id) ?? [], feature);
    const textChanged = Object.keys(changes.fields).length > 0;
    const contractChanged = changes.addLinks.length > 0 || changes.dropLinks.length > 0;
    if (!textChanged && !contractChanged) {
      out.unchanged.push({ item: it, task });
    } else if (TERMINAL.has(task.status)) {
      // A finished task is never edited. Only a contract change earns a follow-on.
      if (contractChanged) {
        out.recreated.push({ item: it, follows: task, reason: `${task.id} is ${task.status} and its contract changed` });
      } else {
        out.unchanged.push({ item: it, task, drift: changes.fields });
      }
    } else if (REWRITABLE.has(task.status)) {
      out.updated.push({ item: it, task, changes });
    } else {
      out.driftOnly.push({ item: it, task, changes, reason: `${task.id} is ${task.status}, so its wording is left alone` });
    }
  }

  for (const t of existing) {
    if (matched.has(t.id)) continue;
    if (TERMINAL.has(t.status)) continue;
    const tlinks = linksByTask.get(t.id) ?? [];
    const dead = await deadLinks(db, tlinks);
    const orphanedByDelete = tlinks.length > 0 && dead.length === tlinks.length;
    // Only a never-started task whose whole contract has been deleted is
    // superseded. Anything else may be work a person added on purpose.
    if (orphanedByDelete && REWRITABLE.has(t.status) && !t.enabling) {
      out.superseded.push({ task: t, reason: "every contract row this task implemented has been removed from the specification" });
    } else {
      out.orphaned.push({ task: t, reason: "no derived plan item matches this task, so it is left for a person to judge" });
    }
  }
  return out;
}

// ------------------------------------------------------------------ applying

async function categoryMap(db, projectId) {
  const rows = await db.all("SELECT id, name FROM task_categories WHERE project_id = ? AND active = 1", projectId);
  return new Map(rows.map((r) => [r.name, r.id]));
}

async function writeLinks(db, taskId, links) {
  for (const l of links) {
    if (!TARGET_TABLE[l.target_type]) continue;
    await db.run(
      `INSERT OR IGNORE INTO task_contract_links (task_id, target_type, target_id, relationship) VALUES (?,?,?,?)`,
      taskId, l.target_type, l.target_id, l.relationship ?? "implements",
    );
  }
}

async function createFromItem(db, it, feature, categories, sequence, parentId, actor) {
  const row = await create(db, "task", {
    ...columnsFor(it, feature),
    project_id: feature.project_id,
    feature_id: feature.id,
    parent_task_id: parentId ?? null,
    category_id: categories.get(it.category) ?? null,
    sequence,
  }, {
    projectId: feature.project_id,
    actor,
    activityType: "task_created",
    activitySummary: `Derived ${it.name}`,
  });
  await writeLinks(db, row.id, it.links);
  // The creation event already told the story; the move out of draft only needs
  // its history row, so it does not repeat itself in the activity feed.
  return setStatus(db, "task", row.id, "ready", {
    projectId: feature.project_id,
    actor,
    activity: false,
    note: "Derived from the accepted specification.",
  });
}

async function applyDelta(db, delta, actor) {
  if (!delta.accepted) return delta;
  const feature = delta.feature;
  const projectId = feature.project_id;
  const categories = await categoryMap(db, projectId);
  const idByKey = new Map();
  for (const e of [...delta.unchanged, ...delta.updated, ...delta.driftOnly]) idByKey.set(e.item.key, e.task.id);

  for (const entry of [...delta.created, ...delta.recreated]) {
    const it = entry.item;
    const parentId = it.parentKey ? idByKey.get(it.parentKey) ?? null : null;
    const row = await createFromItem(db, it, feature, categories, it.order ?? 0, parentId, actor);
    idByKey.set(it.key, row.id);
    entry.taskId = row.id;
    if (entry.follows) {
      await recordActivity(db, projectId, {
        type: "task_created",
        actor,
        taskId: row.id,
        featureId: feature.id,
        summary: `${row.id} follows ${entry.follows.id}, which stays ${entry.follows.status} because its contract changed after it closed.`,
        metadata: { follows: entry.follows.id },
      });
    }
  }

  for (const entry of delta.updated) {
    const { task, item: it, changes } = entry;
    if (changes.addLinks.length) await writeLinks(db, task.id, changes.addLinks);
    if (Object.keys(changes.fields).length) {
      entry.task = await patch(db, "task", task.id, task.version, changes.fields, {
        projectId, actor,
        activityType: "task_updated",
        activitySummary: `Re-derived ${task.id} from the accepted specification`,
      });
    }
    await dropStaleLinks(db, task.id, changes.dropLinks);
  }

  for (const entry of delta.driftOnly) {
    if (entry.changes.addLinks.length) await writeLinks(db, entry.task.id, entry.changes.addLinks);
  }

  for (const entry of delta.superseded) {
    entry.task = await setStatus(db, "task", entry.task.id, "superseded", {
      projectId, actor, note: entry.reason,
    });
  }

  // Dependencies last, when every plan key has a task id.
  for (const entry of [...delta.created, ...delta.recreated, ...delta.updated, ...delta.unchanged, ...delta.driftOnly]) {
    const taskId = entry.taskId ?? entry.task?.id;
    if (!taskId) continue;
    for (const key of entry.item.dependsOn) {
      const dependsOn = idByKey.get(key);
      if (!dependsOn || dependsOn === taskId) continue;
      await db.run(
        `INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?,?,'blocks')`,
        taskId, dependsOn,
      );
    }
  }

  await recordActivity(db, projectId, {
    type: "tasks_derived",
    actor,
    featureId: feature.id,
    summary: `Derived tasks for ${feature.id}: ${delta.created.length} new, ${delta.updated.length} updated, ${delta.superseded.length} superseded.`,
    metadata: {
      created: delta.created.length,
      recreated: delta.recreated.length,
      updated: delta.updated.length,
      driftOnly: delta.driftOnly.length,
      unchanged: delta.unchanged.length,
      superseded: delta.superseded.length,
      orphaned: delta.orphaned.length,
    },
  });
  delta.applied = true;
  return delta;
}

/** Never drop a link if it would leave a live task with no contract at all. */
async function dropStaleLinks(db, taskId, links) {
  if (!links.length) return;
  const total = await db.value("SELECT count(*) FROM task_contract_links WHERE task_id = ?", taskId);
  if (total - links.length < 1) return;
  for (const l of links) {
    await db.run(
      "DELETE FROM task_contract_links WHERE task_id = ? AND target_type = ? AND target_id = ?",
      taskId, l.target_type, l.target_id,
    );
  }
}

// -------------------------------------------------------------------- public

/**
 * Derive the task set for one feature. With `apply` false this is the plan
 * presented for acceptance and nothing is written; with `apply` true the plan is
 * the acceptance and the delta is committed in one transaction.
 */
export async function deriveTasks(root, featureId, { apply = false, actor = "superdev" } = {}) {
  if (!apply) return query(root, (db) => diff(db, featureId));
  return mutate(root, async (db) => applyDelta(db, await diff(db, featureId), actor));
}

/** The same, across every accepted feature, in one transaction when applying. */
export async function deriveAll(root, { apply = false, actor = "superdev" } = {}) {
  const run = async (db) => {
    const features = await db.all("SELECT id FROM features WHERE status = 'accepted' ORDER BY id");
    const results = [];
    for (const f of features) {
      const delta = await diff(db, f.id);
      results.push(apply ? await applyDelta(db, delta, actor) : delta);
    }
    return {
      features: features.length,
      created: results.reduce((n, r) => n + r.created.length, 0),
      updated: results.reduce((n, r) => n + r.updated.length, 0),
      superseded: results.reduce((n, r) => n + r.superseded.length, 0),
      applied: apply,
      results,
    };
  };
  return apply ? mutate(root, run) : query(root, run);
}

/** What re-derivation would change. Read only, so it is safe to show anywhere. */
export function derivationDelta(root, featureId) {
  if (!featureId) return deriveAll(root, { apply: false });
  return query(root, (db) => diff(db, featureId));
}
