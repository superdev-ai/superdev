// Database to Markdown. The database is the source of truth; every file under
// talks/ is a projection of it.
//
// Three rules shape this module:
//
//   1. Deterministic. Stable ordering everywhere and no clock reading inside a
//      body, so re-rendering unchanged data produces an identical hash and git
//      stays quiet.
//   2. A document exists only when its capability is applicable. An absent file
//      is not a defect when nothing in the database calls for it.
//   3. A manual edit is never silently overwritten. An authored projection whose
//      body on disk is not exactly what we last generated raises a proposal. A
//      derived view (changelog, reports) is always rewritten, because a report
//      that can be trapped behind a proposal stops being a report.
//
// File writes happen outside the write transaction, always, because the engine
// holds a process-wide lock for the transaction's whole life.

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { query, mutate, create, recordActivity, currentProject, json } from "../db/store.mjs";
import { assertStorable } from "../model/screening.mjs";
import { slugify } from "../model/ids.mjs";
import { EDGE_CASE_CATEGORIES, MODULE_STEPS } from "../model/vocabulary.mjs";
import * as T from "./templates.mjs";

export const MARKER = "superdev:generated";

const MARKER_RE = /^<!--\s*superdev:generated\s+source=(\S+)\s+revision=(\d+)\s+hash=([0-9a-f]{64})\s*-->[ \t]*\r?\n?/;

const ROOT_DIR = "talks";

/** LF endings, no trailing whitespace on any line, exactly one terminal newline. */
export function normalizeBody(body) {
  const lines = String(body ?? "").replace(/\r\n?/g, "\n").split("\n");
  return `${lines.map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "")}\n`;
}

export const bodyHash = (body) => createHash("sha256").update(normalizeBody(body)).digest("hex");

/** Full file text: the marker line, then the normalized body. */
export function withMarker({ sourceId, revision, body }) {
  const normalized = normalizeBody(body);
  return `<!-- ${MARKER} source=${sourceId} revision=${revision} hash=${bodyHash(normalized)} -->\n${normalized}`;
}

export function parseMarker(text) {
  const raw = String(text ?? "");
  const m = MARKER_RE.exec(raw);
  if (!m) return null;
  return {
    sourceId: m[1],
    revision: Number(m[2]),
    hash: m[3],
    body: normalizeBody(raw.slice(m[0].length)),
  };
}

// ------------------------------------------------------------------ snapshot

// One read of everything the renderers need, cached against the connection that
// produced it. The cache dies with the connection, which is what keeps the
// "never cache a connection" rule intact: this caches rows, not a handle.
const cache = new WeakMap();

const rows = (db, sql, ...params) => db.all(sql, ...params);

async function snapshot(db, projectId) {
  const hit = cache.get(db);
  if (hit && hit.projectId === projectId) return hit;

  const s = { projectId };
  s.project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  // The revision a document is stamped with has to be the same one freshness
  // compares it against, or the two can never agree. Freshness deliberately
  // ignores documentation events, because a generate run records its own event
  // after rendering and comparing against the raw maximum would report every
  // document as stale the instant it was produced. Stamping with the raw
  // maximum here recreated exactly that: documents were written at a revision
  // that freshness would never consider current, so five sat permanently behind
  // while the documentation check confirmed all 295 matched the database.
  s.revision = (await db.value(
    `SELECT max(sequence) FROM activity_events
      WHERE project_id = ? AND event_type NOT IN
            ('documentation_generated','documentation_proposal_raised',
             'documentation_proposal_resolved','documentation_possibly_stale')`,
    projectId,
  )) ?? 0;

  s.goals = await rows(db, "SELECT * FROM goals WHERE project_id = ? ORDER BY sequence, id", projectId);
  s.goalCriteria = await rows(db, "SELECT * FROM goal_success_criteria ORDER BY goal_id, sequence, id");
  s.milestones = await rows(db, "SELECT * FROM milestones WHERE project_id = ? ORDER BY sequence, id", projectId);
  s.scopeItems = await rows(db, "SELECT * FROM project_scope_items WHERE project_id = ? ORDER BY direction, sequence, id", projectId);
  s.glossary = await rows(db, "SELECT * FROM glossary_terms WHERE project_id = ? ORDER BY term", projectId);
  s.pieces = await rows(db, "SELECT * FROM runtime_pieces WHERE project_id = ? ORDER BY sequence, name", projectId);
  s.pieceEdges = await rows(db, "SELECT * FROM runtime_piece_edges ORDER BY from_piece_id, to_piece_id");
  s.capabilities = await rows(db, "SELECT * FROM capability_areas WHERE project_id = ? ORDER BY catalog, sequence, area", projectId);

  s.modules = await rows(db, "SELECT * FROM modules WHERE project_id = ? ORDER BY sequence, slug", projectId);
  s.completeness = await rows(db, "SELECT * FROM module_completeness ORDER BY module_id, step");
  s.features = await rows(db, "SELECT * FROM features WHERE project_id = ? ORDER BY module_id, slug", projectId);
  s.flows = await rows(db, "SELECT * FROM feature_flows ORDER BY feature_id, sequence");
  s.acceptance = await rows(db, "SELECT * FROM feature_acceptance_criteria ORDER BY feature_id, sequence, id");
  s.edgeCases = await rows(db, "SELECT * FROM feature_edge_cases ORDER BY feature_id, category");
  s.featureGoals = await rows(db, "SELECT * FROM feature_goals ORDER BY feature_id, goal_id");

  s.workflows = await rows(db, "SELECT * FROM workflows ORDER BY feature_id, name, id");
  s.wfActors = await rows(db, "SELECT * FROM workflow_actors ORDER BY workflow_id, sequence, actor");
  s.wfSteps = await rows(db, "SELECT * FROM workflow_steps ORDER BY workflow_id, sequence");
  s.wfBranches = await rows(db, "SELECT * FROM workflow_branches ORDER BY workflow_id, from_step_id, condition");
  s.machines = await rows(db, "SELECT * FROM state_machines ORDER BY entity_name, id");
  s.states = await rows(db, "SELECT * FROM states ORDER BY state_machine_id, sequence, name");
  s.transitions = await rows(db, "SELECT * FROM state_transitions ORDER BY state_machine_id, from_state_id, event");

  s.surfaces = await rows(db, "SELECT * FROM surfaces ORDER BY module_id, name, id");
  s.surfaceStates = await rows(db, "SELECT * FROM surface_states ORDER BY surface_id, state_type");
  s.actions = await rows(db, "SELECT * FROM ui_actions ORDER BY surface_id, name, id");

  s.apis = await rows(db, "SELECT * FROM api_operations ORDER BY module_id, name, id");
  s.entities = await rows(db, "SELECT * FROM data_entities ORDER BY module_id, name, id");
  s.fields = await rows(db, "SELECT * FROM data_fields ORDER BY entity_id, sequence, name");
  s.relationships = await rows(db, "SELECT * FROM data_relationships ORDER BY from_entity_id, name");
  s.migrations = await rows(db, "SELECT * FROM schema_migrations WHERE project_id = ? ORDER BY sequence, id", projectId);
  s.migrationEntities = await rows(db, "SELECT * FROM schema_migration_entities ORDER BY migration_id, entity_id");

  s.integrations = await rows(db, "SELECT * FROM integrations ORDER BY module_id, name, id");
  s.jobs = await rows(db, "SELECT * FROM jobs ORDER BY module_id, name, id");
  s.webhooks = await rows(db, "SELECT * FROM webhooks ORDER BY module_id, name, id");

  s.roles = await rows(db, "SELECT * FROM roles WHERE project_id = ? ORDER BY sequence, name", projectId);
  s.permissions = await rows(db, "SELECT * FROM permissions ORDER BY role_id, scope_type, capability");
  s.nfrs = await rows(db, "SELECT * FROM non_functional_requirements WHERE project_id = ? ORDER BY category, id", projectId);

  s.decisions = await rows(db, "SELECT * FROM decisions WHERE project_id = ? ORDER BY id", projectId);
  s.decisionLinks = await rows(db, "SELECT * FROM decision_links ORDER BY decision_id, relationship, target_id");
  s.decisionTransitions = await rows(db, "SELECT * FROM decision_transitions ORDER BY decision_id, sequence");

  s.questions = await rows(db, "SELECT * FROM questions WHERE project_id = ? ORDER BY status, id", projectId);
  s.discovery = await rows(db, "SELECT * FROM discovery_items WHERE project_id = ? ORDER BY kind, id", projectId);
  s.documents = await rows(db, "SELECT * FROM documents WHERE project_id = ? ORDER BY path", projectId);
  s.evidence = await rows(db, "SELECT * FROM verification_evidence WHERE project_id = ? ORDER BY id", projectId);
  s.tasks = await rows(db, "SELECT id, feature_id, status FROM tasks WHERE project_id = ? ORDER BY id", projectId);
  s.events = await rows(
    db,
    `SELECT sequence, event_type, summary, actor_label, created_at FROM activity_events
     WHERE project_id = ? AND event_type NOT LIKE 'documentation_%'
     ORDER BY sequence DESC LIMIT 200`,
    projectId,
  );

  index(s);
  cache.set(db, s);
  return s;
}

/** Lookup maps. Built once so no renderer ever scans a whole table. */
function index(s) {
  s.byId = new Map();
  for (const key of ["modules", "features", "workflows", "machines", "surfaces", "apis",
                     "entities", "integrations", "jobs", "webhooks", "roles", "decisions", "milestones", "goals"]) {
    for (const row of s[key]) s.byId.set(row.id, row);
  }
  s.moduleOf = (row) => {
    if (row?.module_id) return s.byId.get(row.module_id) ?? null;
    const feature = row?.feature_id ? s.byId.get(row.feature_id) : null;
    return feature ? s.byId.get(feature.module_id) ?? null : null;
  };
  s.featureModule = (feature) => (feature ? s.byId.get(feature.module_id) ?? null : null);
  s.workflowFeature = (w) => s.byId.get(w.feature_id) ?? null;
}

const by = (list, key) => {
  const map = new Map();
  for (const row of list) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
};

const pick = (map, key) => map.get(key) ?? [];

// ---------------------------------------------------------------------- plan

const AUTHORED = "authored_projection";
const DERIVED = "derived_view";

/** A slug that is unique inside one folder, allocated in the order given. */
function folderSlug(used, name, fallback) {
  const base = slugify(name, fallback);
  let candidate = base;
  for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`;
  used.add(candidate);
  return candidate;
}

/**
 * Every document this project should have, and nothing more. Paths follow brief
 * section 9.1. A project-level artifact appears only when the database holds the
 * records that fill it; a per-record artifact appears because the record exists.
 */
const REPORT_KINDS = new Set(["project_summary", "status", "drift"]);

export async function documentPlan(db, projectId, { includeReports = false } = {}) {
  const s = await snapshot(db, projectId);
  if (!s.project) return [];
  if (s.plan) return includeReports ? s.plan : s.plan.filter((entry) => !REPORT_KINDS.has(entry.kind));

  const plan = [];
  const add = (kind, scopeType, scopeId, path, template, mode = AUTHORED, label = null) => {
    plan.push({ kind, projectId, scopeType, scopeId, sourceId: scopeId ?? projectId, path, template, regenerationMode: mode, label });
  };

  const F = `${ROOT_DIR}/foundations`;
  add("foundations_product", "project", null, `${F}/product.md`, "foundations.md", AUTHORED, "Product");
  if (s.roles.length) add("foundations_users", "project", null, `${F}/users-and-roles.md`, "foundations.md", AUTHORED, "Users and roles");
  if (s.permissions.length) add("roles_permissions", "project", null, `${F}/roles-and-permissions.md`, "roles-permissions.md", AUTHORED, "Roles and permissions");
  if (s.scopeItems.length) add("foundations_scope", "project", null, `${F}/scope.md`, "foundations.md", AUTHORED, "Scope");
  if (s.modules.length || s.pieces.length) add("architecture", "project", null, `${F}/architecture.md`, "architecture.md", AUTHORED, "Architecture");
  if (s.capabilities.some((c) => c.catalog === "stack_slot")) add("foundations_stack", "project", null, `${F}/stack.md`, "foundations.md", AUTHORED, "Stack");
  if (s.glossary.length) add("foundations_glossary", "project", null, `${F}/glossary.md`, "foundations.md", AUTHORED, "Glossary");
  if (s.nfrs.length) add("nfrs", "project", null, `${F}/nfrs.md`, "nfr.md", AUTHORED, "Non-functional requirements");
  // Compliance is written only where regulated data or a declared regime exists.
  // Generating it otherwise would invent a regime, which the template forbids.
  const sensitive = s.fields.filter((f) => f.sensitivity_class !== "none")
    .concat(s.entities.filter((e) => e.sensitivity_class !== "none"));
  if (sensitive.length || complianceDecisions(s).length) {
    add("compliance", "project", null, `${F}/compliance.md`, "compliance.md", AUTHORED, "Compliance");
  }

  if (s.modules.length) add("module_inventory", "project", null, `${ROOT_DIR}/modules/module-inventory.md`, "module-inventory.md", AUTHORED, "Module inventory");

  const featuresByModule = by(s.features, "module_id");
  for (const m of s.modules) {
    const root = `${ROOT_DIR}/modules/${m.slug}`;
    add("module", "module", m.id, `${root}/module.md`, "module.md", AUTHORED, m.name);

    for (const f of pick(featuresByModule, m.id)) {
      add("feature", "feature", f.id, `${root}/features/${f.slug}.md`, "feature.md", AUTHORED, f.name);
    }

    const moduleFeatureIds = new Set(pick(featuresByModule, m.id).map((f) => f.id));
    const used = { workflows: new Set(), surfaces: new Set(), apis: new Set(), data: new Set(), integrations: new Set(), jobs: new Set() };

    const workflows = s.workflows.filter((w) => moduleFeatureIds.has(w.feature_id));
    for (const w of workflows) {
      add("workflow", "workflow", w.id, `${root}/workflows/${folderSlug(used.workflows, w.name, "workflow")}.md`, "workflow-state-machine.md", AUTHORED, w.name);
    }
    // A state machine that no workflow document already covers still needs a home.
    const coveredFeatures = new Set(workflows.map((w) => w.feature_id));
    for (const machine of s.machines) {
      const owner = s.moduleOf(machine);
      if (owner?.id !== m.id) continue;
      if (machine.feature_id && coveredFeatures.has(machine.feature_id)) continue;
      add("state_machine", "state_machine", machine.id,
        `${root}/workflows/${folderSlug(used.workflows, `${machine.entity_name}-states`, "states")}.md`,
        "workflow-state-machine.md", AUTHORED, machine.entity_name);
    }

    for (const surface of s.surfaces.filter((x) => x.module_id === m.id)) {
      add("surface", "surface", surface.id, `${root}/surfaces/${folderSlug(used.surfaces, surface.name, "surface")}.md`, "pages-ui-actions.md", AUTHORED, surface.name);
    }
    for (const api of s.apis.filter((x) => x.module_id === m.id)) {
      add("api", "api_operation", api.id, `${root}/apis/${folderSlug(used.apis, api.name, "operation")}.md`, "api.md", AUTHORED, api.name);
    }
    for (const entity of s.entities.filter((x) => x.module_id === m.id)) {
      add("data_entity", "data_entity", entity.id, `${root}/data/${folderSlug(used.data, entity.name, "entity")}.md`, "data-schema.md", AUTHORED, entity.name);
    }
    for (const integration of s.integrations.filter((x) => x.module_id === m.id)) {
      add("integration", "integration", integration.id, `${root}/integrations/${folderSlug(used.integrations, integration.name, "integration")}.md`, "integration.md", AUTHORED, integration.name);
    }
    for (const job of s.jobs.filter((x) => x.module_id === m.id)) {
      add("job", "job", job.id, `${root}/jobs/${folderSlug(used.jobs, job.name, "job")}.md`, "jobs-webhooks.md", AUTHORED, job.name);
    }
    for (const hook of s.webhooks.filter((x) => x.module_id === m.id)) {
      add("webhook", "webhook", hook.id, `${root}/jobs/${folderSlug(used.jobs, hook.name, "webhook")}.md`, "jobs-webhooks.md", AUTHORED, hook.name);
    }

    if (observabilityData(s, m, "").signals.length) {
      add("observability", "module", m.id, `${root}/observability.md`, "observability.md", AUTHORED, `${m.name} observability`);
    }
    if (moduleFeatureIds.size) {
      add("test_plan", "module", m.id, `${root}/test-plan.md`, "test-plan.md", AUTHORED, `${m.name} test plan`);
    }
  }

  const usedDecisions = new Set();
  for (const d of s.decisions) {
    const slug = folderSlug(usedDecisions, `${d.id}-${d.title}`, d.id.toLowerCase());
    add("adr", "decision", d.id, `${ROOT_DIR}/decisions/${slug}.md`, "adr.md", AUTHORED, d.id);
  }

  add("changelog", "project", null, `${ROOT_DIR}/changes/changelog.md`, "changelog.md", DERIVED, "Changelog");
  add("project_summary", "project", null, `${ROOT_DIR}/reports/project-summary.md`, "project-summary.md", DERIVED, "Project summary");
  add("status", "project", null, `${ROOT_DIR}/reports/status.md`, "status.md", DERIVED, "Status");
  add("drift", "project", null, `${ROOT_DIR}/reports/drift.md`, "change-impact-drift-report.md", DERIVED, "Drift");

  plan.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  s.plan = plan;
  if (!includeReports) return plan.filter((entry) => !REPORT_KINDS.has(entry.kind));
  // Keyed by kind, not scope type: a module owns three documents (module,
  // observability, test plan) and they must not overwrite each other here.
  s.pathOf = new Map(plan.map((p) => [`${p.kind}:${p.scopeId ?? ""}`, p]));
  return plan;
}

/** Link from one document to another, relative, or a bare label when unplanned. */
function refTo(s, fromPath, kind, scopeId, label) {
  const target = s.pathOf?.get(`${kind}:${scopeId ?? ""}`);
  if (!target) return { label: label ?? scopeId ?? "not documented" };
  return { label: label ?? target.label ?? scopeId, link: posix.relative(posix.dirname(fromPath), target.path) };
}

// -------------------------------------------------------------------- render

/**
 * Render one planned document. Returns the body without the marker, plus a
 * fingerprint of the records that fed it so staleness can be judged without
 * re-rendering.
 */
export async function renderDocument(db, plan) {
  const s = await snapshot(db, plan.projectId);
  if (!s.plan) await documentPlan(db, plan.projectId);
  const data = buildData(s, plan);
  const body = RENDERERS[plan.kind](data);
  // ponytail: fingerprint over the assembled input. It moves when an unrelated
  // column on a source row moves, which costs one harmless re-render; a
  // per-column fingerprint would be the upgrade if that ever shows up as churn.
  return { path: plan.path, body: normalizeBody(body), sourceFingerprint: fingerprint(data) };
}

const fingerprint = (data) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

const RENDERERS = {
  foundations_product: T.foundationsProduct,
  foundations_users: T.foundationsUsersAndRoles,
  roles_permissions: T.foundationsRolesAndPermissions,
  foundations_scope: T.foundationsScope,
  architecture: T.foundationsArchitecture,
  foundations_stack: T.foundationsStack,
  foundations_glossary: T.foundationsGlossary,
  nfrs: T.foundationsNfrs,
  compliance: T.foundationsCompliance,
  module_inventory: T.moduleInventory,
  module: T.moduleSpec,
  feature: T.featureSpec,
  workflow: T.workflowSpec,
  state_machine: T.workflowSpec,
  surface: T.surfaceSpec,
  api: T.apiSpec,
  data_entity: T.dataEntitySpec,
  integration: T.integrationSpec,
  job: T.asyncSpec,
  webhook: T.asyncSpec,
  observability: T.observabilitySpec,
  test_plan: T.testPlan,
  adr: T.adr,
  changelog: T.changelog,
  project_summary: T.projectSummary,
  status: T.statusReport,
  drift: T.driftReport,
};

const scopeItems = (s, direction) => s.scopeItems.filter((i) => i.direction === direction);
const capabilities = (s, catalog) => s.capabilities.filter((c) => c.catalog === catalog);
const slot = (s, pattern) => capabilities(s, "stack_slot").find((c) => pattern.test(c.area));
const complianceDecisions = (s) =>
  s.decisions.filter((d) => d.scope_type === "compliance" || /compliance|privacy|gdpr|regime/i.test(d.title));
const dateOf = (value) => (value ? String(value).slice(0, 10) : null);
const readable = (value) => String(value ?? "").replace(/_/g, " ");

function buildData(s, plan) {
  const p = plan.path;
  switch (plan.kind) {
    case "foundations_product": return productData(s);
    case "foundations_users": return usersData(s, p);
    case "roles_permissions": return permissionsData(s, p);
    case "foundations_scope": return scopeData(s, p);
    case "architecture": return architectureData(s);
    case "foundations_stack": return stackData(s);
    case "foundations_glossary": return { project: s.project, terms: s.glossary };
    case "nfrs": return nfrData(s);
    case "compliance": return complianceData(s);
    case "module_inventory": return inventoryData(s, p);
    case "module": return moduleData(s, s.byId.get(plan.scopeId), p);
    case "feature": return featureData(s, s.byId.get(plan.scopeId), p);
    case "workflow": return workflowData(s, s.byId.get(plan.scopeId), null, p);
    case "state_machine": return workflowData(s, null, s.byId.get(plan.scopeId), p);
    case "surface": return surfaceData(s, s.byId.get(plan.scopeId), p);
    case "api": return apiData(s, s.byId.get(plan.scopeId), p);
    case "data_entity": return entityData(s, s.byId.get(plan.scopeId), p);
    case "integration": return integrationData(s, s.byId.get(plan.scopeId), p);
    case "job": return asyncData(s, s.byId.get(plan.scopeId), null, p);
    case "webhook": return asyncData(s, null, s.byId.get(plan.scopeId), p);
    case "observability": return observabilityData(s, s.byId.get(plan.scopeId), p);
    case "test_plan": return testPlanData(s, s.byId.get(plan.scopeId));
    case "adr": return adrData(s, s.byId.get(plan.scopeId), p);
    case "changelog": return changelogData(s);
    case "project_summary": return summaryData(s, p);
    case "status": return statusData(s, p);
    case "drift": return driftData(s, p);
    default: throw new Error(`no renderer for document kind: ${plan.kind}`);
  }
}

// ------------------------------------------------------------ project sources

function productData(s) {
  const goalName = new Map(s.goals.map((g) => [g.id, g.name]));
  return {
    project: s.project,
    nonGoals: scopeItems(s, "non_goal"),
    goals: s.goals,
    successCriteria: s.goalCriteria
      .filter((c) => goalName.has(c.goal_id))
      .map((c) => ({ ...c, goal: goalName.get(c.goal_id) })),
    milestones: s.milestones.map((m) => ({
      ...m, entry: json(m.entry_conditions_json), exit: json(m.exit_conditions_json),
    })),
  };
}

function usersData(s, path) {
  return {
    project: s.project,
    roles: s.roles,
    users: s.discovery.filter((d) => d.kind === "user" && d.status !== "rejected"),
    permissionsDoc: refTo(s, path, "roles_permissions", null, "roles and permissions"),
  };
}

function permissionsData(s, path) {
  const roleName = new Map(s.roles.map((r) => [r.id, r.name]));
  const moduleName = new Map(s.modules.map((m) => [m.id, m.name]));

  const visibility = s.modules.map((m) => {
    const access = {};
    for (const perm of s.permissions) {
      if (perm.scope_type !== "module" || perm.scope_id !== m.id) continue;
      const role = roleName.get(perm.role_id);
      if (role) access[role] = perm.access_level;
    }
    return { module: m.name, access };
  });

  const entityName = new Map(s.entities.map((e) => [e.id, e.name]));
  const sensitiveFields = s.fields
    .filter((f) => f.sensitivity_class !== "none" && entityName.has(f.entity_id))
    .map((f) => {
      const access = {};
      for (const perm of s.permissions) {
        if (perm.scope_type !== "field" || perm.scope_id !== f.id) continue;
        const role = roleName.get(perm.role_id);
        if (role) access[role] = perm.access_level;
      }
      return { field: `${entityName.get(f.entity_id)}.${f.name}`, sensitivity_class: f.sensitivity_class, access };
    });

  return {
    project: s.project,
    roles: s.roles,
    visibility,
    capabilities: s.permissions.map((perm) => ({
      role: roleName.get(perm.role_id) ?? perm.role_id,
      scope: perm.scope_id ? `${perm.scope_type} ${perm.scope_id}` : perm.scope_type,
      capability: perm.capability,
      access_level: perm.access_level,
      enforcement_point: perm.enforcement_point,
    })),
    sensitiveFields,
    moduleDocs: s.surfaces.length
      ? s.modules.map((m) => refTo(s, path, "module", m.id, moduleName.get(m.id))) : [],
    enforcementPoints: [...new Set(s.permissions.map((perm) => perm.enforcement_point).filter(Boolean))],
  };
}

function scopeData(s, path) {
  return {
    project: s.project,
    inScope: scopeItems(s, "in"),
    outScope: scopeItems(s, "out"),
    nonGoals: scopeItems(s, "non_goal"),
    featureScope: s.features.map((f) => ({
      doc: refTo(s, path, "feature", f.id, f.name),
      module: s.featureModule(f)?.name,
      in: json(f.scope_in_json),
      out: json(f.scope_out_json),
    })),
  };
}

function architectureData(s) {
  const pieceName = new Map(s.pieces.map((x) => [x.id, x.name]));
  const moduleBySlug = new Map(s.modules.map((m) => [slugify(m.name, m.slug), m]));

  const moduleEdges = [];
  for (const m of s.modules) {
    for (const consumed of json(m.consumes_json)) {
      const target = moduleBySlug.get(slugify(String(consumed), "")) ??
        s.modules.find((x) => x.name === consumed || x.slug === consumed);
      if (target) moduleEdges.push({ from: m.slug, to: target.slug });
    }
  }

  const firstWorkflow = s.workflows[0];
  const criticalPath = firstWorkflow
    ? s.wfSteps.filter((step) => step.workflow_id === firstWorkflow.id).map((step, i, all) => ({
        from: step.owner_ref || step.owner_type,
        to: all[i + 1]?.owner_ref || all[i + 1]?.owner_type || step.owner_ref || step.owner_type,
        action: step.action,
      }))
    : [];

  return {
    project: s.project,
    shape: s.project.statement,
    actors: s.roles.map((r) => r.name),
    externals: s.integrations.map((i) => i.provider || i.name),
    contextClaim: `${s.roles.length} recorded roles reach the product, which depends on ${s.integrations.length} recorded external integrations.`,
    pieces: s.pieces.map((piece) => ({
      ...piece,
      talksTo: s.pieceEdges.filter((e) => e.from_piece_id === piece.id)
        .map((e) => `${pieceName.get(e.to_piece_id) ?? e.to_piece_id}${e.protocol ? ` (${e.protocol})` : ""}`),
    })),
    modules: s.modules,
    moduleEdges,
    moduleClaim: moduleEdges.length
      ? "Every arrow is a recorded consumes relationship. An arrow the code adds is drift."
      : "No module declares a dependency on another.",
    ownership: s.modules.map((m) => ({
      module: m.name,
      entities: s.entities.filter((e) => e.module_id === m.id).map((e) => e.name),
      consumers: json(m.consumes_json),
    })).filter((o) => o.entities.length),
    criticalPath,
    criticalClaim: firstWorkflow ? `The ${firstWorkflow.name} workflow, step by step.` : "No workflow recorded yet.",
    boundaries: capabilities(s, "boundary"),
  };
}

function stackData(s) {
  const slots = capabilities(s, "stack_slot");
  const design = slots.find((c) => /design|accessib/i.test(c.area));
  return {
    project: s.project,
    slots,
    designDirection: design ? (design.state === "specified" ? design.choice : `${readable(design.state)}: ${design.reason}`) : null,
  };
}

function nfrData(s) {
  const scopeLabel = (n) => {
    if (n.feature_id) return s.byId.get(n.feature_id)?.name ?? n.feature_id;
    if (n.module_id) return s.byId.get(n.module_id)?.name ?? n.module_id;
    return "project";
  };
  const nfrs = s.nfrs.map((n) => ({ ...n, scope: scopeLabel(n) }));
  return { project: s.project, nfrs, open: nfrs.filter((n) => !n.target_source || !n.target) };
}

function complianceData(s) {
  const entityName = new Map(s.entities.map((e) => [e.id, e.name]));
  const moduleName = new Map(s.modules.map((m) => [m.id, m.name]));
  const inventory = s.fields
    .filter((f) => f.sensitivity_class !== "none")
    .map((f) => {
      const entity = s.entities.find((e) => e.id === f.entity_id);
      return {
        field: `${entityName.get(f.entity_id) ?? f.entity_id}.${f.name}`,
        sensitivity_class: f.sensitivity_class,
        modules: entity ? [moduleName.get(entity.module_id) ?? entity.module_id] : [],
      };
    });

  const rules = [];
  for (const e of s.entities.filter((x) => x.retention_rule || x.deletion_semantics)) {
    if (e.retention_rule) rules.push({ concern: `Retention of ${e.name}`, rule: e.retention_rule, enforced_at: e.store });
    if (e.deletion_semantics) rules.push({ concern: `Deletion of ${e.name}`, rule: e.deletion_semantics, enforced_at: e.store });
  }
  for (const perm of s.permissions.filter((x) => x.access_level === "redacted")) {
    rules.push({ concern: `Access control on ${perm.capability}`, rule: "redacted for this role", enforced_at: perm.enforcement_point });
  }

  const gaps = s.questions
    .filter((q) => q.status === "open" && /privacy|compliance|retention|security|personal|regulat/i.test(`${q.question} ${q.why_it_matters}`))
    .map((q) => ({ gap: q.question, risk: q.why_it_matters, question: q.recommendation ?? q.id }));
  for (const c of capabilities(s, "readiness").filter((x) => /compliance|privacy|security/i.test(x.area) && x.state !== "specified")) {
    gaps.push({ gap: c.area, risk: c.consequence ?? c.reason, question: c.revisit_trigger ?? c.reason });
  }

  return {
    project: s.project,
    regimes: complianceDecisions(s).map((d) => ({ label: `${d.id} ${d.title}` })),
    inventory,
    rules,
    gaps,
  };
}

// -------------------------------------------------------------------- modules

function inventoryData(s, path) {
  return {
    project: s.project,
    modules: s.modules.map((m) => ({
      ...m,
      primary_users: json(m.primary_users_json),
      owns: json(m.owns_json),
      doc: refTo(s, path, "module", m.id, `modules/${m.slug}/module.md`),
    })),
    exclusions: s.discovery.filter((d) => d.kind === "exclusion").map((d) => d.statement),
  };
}

function moduleData(s, m, path) {
  const features = s.features.filter((f) => f.module_id === m.id);
  const featureIds = new Set(features.map((f) => f.id));
  const surfaces = s.surfaces.filter((x) => x.module_id === m.id);
  const actionsBySurface = by(s.actions, "surface_id");

  const wiring = [];
  for (const surface of surfaces) {
    for (const action of pick(actionsBySurface, surface.id)) {
      const effects = json(action.side_effects_json);
      wiring.push({
        action: action.label ?? action.name,
        path: [surface.name, action.effect ?? "no handler recorded", effects.length ? effects.join(" and ") : "no side effects recorded"]
          .join(" -> "),
      });
    }
  }

  const machines = s.machines.filter((x) => s.moduleOf(x)?.id === m.id);
  const statesByMachine = by(s.states, "state_machine_id");

  const events = [
    ...s.webhooks.filter((x) => x.module_id === m.id).map((w) => ({
      event: w.name, direction: w.direction === "incoming" ? "consumes" : "emits",
      owner: m.name, consumers: [w.endpoint_or_registration].filter(Boolean),
    })),
    ...s.jobs.filter((x) => x.module_id === m.id).map((j) => ({
      event: j.name, direction: "job", owner: m.name, consumers: [j.trigger].filter(Boolean),
    })),
  ];

  const edgeByCategory = new Map();
  for (const ec of s.edgeCases.filter((x) => featureIds.has(x.feature_id))) {
    if (!edgeByCategory.has(ec.category)) edgeByCategory.set(ec.category, []);
    edgeByCategory.get(ec.category).push(ec);
  }
  const edgeCases = EDGE_CASE_CATEGORIES.filter((c) => edgeByCategory.has(c)).map((category) => {
    const list = edgeByCategory.get(category);
    const applicable = list.filter((x) => x.applicability === "applicable");
    return {
      category,
      outcome: applicable.length
        ? applicable.map((x) => x.behavior).filter(Boolean).join("; ") || "applicable, no behavior recorded"
        : `N/A - ${list[0].reason_not_applicable}`,
      features: [...new Set(list.map((x) => s.byId.get(x.feature_id)?.name).filter(Boolean))],
    };
  });

  const stored = new Map(s.completeness.filter((c) => c.module_id === m.id).map((c) => [c.step, c]));
  const steps = MODULE_STEPS.map((name, i) => stored.get(i + 1) ?? { step: i + 1, step_name: name, state: "open" });

  return {
    module: m,
    primaryUsers: json(m.primary_users_json),
    owns: json(m.owns_json),
    consumes: json(m.consumes_json),
    surfaces: surfaces.map((x) => ({ ...x, doc: refTo(s, path, "surface", x.id, x.name) })),
    apis: s.apis.filter((x) => x.module_id === m.id).map((x) => ({ ...x, doc: refTo(s, path, "api", x.id, x.name) })),
    entities: s.entities.filter((x) => x.module_id === m.id)
      .map((x) => ({ ...x, role: "owner", doc: refTo(s, path, "data_entity", x.id, x.name) })),
    wiring,
    stateMachines: machines.map((x) => ({
      ...x, stateCount: pick(statesByMachine, x.id).length,
      doc: refTo(s, path, x.feature_id && s.workflows.some((w) => w.feature_id === x.feature_id) ? "workflow" : "state_machine",
        x.feature_id && s.workflows.some((w) => w.feature_id === x.feature_id)
          ? s.workflows.find((w) => w.feature_id === x.feature_id).id : x.id,
        x.entity_name),
    })),
    events,
    edgeCases,
    steps,
  };
}

// -------------------------------------------------------------------- feature

function featureData(s, f, path) {
  const module = s.featureModule(f);
  const surfaces = s.surfaces.filter((x) => x.feature_id === f.id);
  const actionsBySurface = by(s.actions, "surface_id");
  const apis = s.apis.filter((x) => x.feature_id === f.id);
  const entities = s.entities.filter((x) => x.feature_id === f.id);
  const workflows = s.workflows.filter((x) => x.feature_id === f.id);
  const machines = s.machines.filter((x) => x.feature_id === f.id);
  const roleName = new Map(s.roles.map((r) => [r.id, r.name]));
  const goalIds = new Set(s.featureGoals.filter((g) => g.feature_id === f.id).map((g) => g.goal_id));

  const branches = s.wfBranches.filter((b) => workflows.some((w) => w.id === b.workflow_id));
  const stepName = new Map(s.wfSteps.map((step) => [step.id, `${step.sequence} ${step.action}`]));

  const entityIds = new Set(entities.map((e) => e.id));

  return {
    feature: f,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    milestone: f.milestone_id ? s.byId.get(f.milestone_id)?.name ?? f.milestone_id : null,
    goals: s.goals.filter((g) => goalIds.has(g.id)).map((g) => ({ label: `${g.id} ${g.name}` })),
    scopeIn: json(f.scope_in_json),
    scopeOut: json(f.scope_out_json),
    contracts: [
      ...apis.map((a) => refTo(s, path, "api", a.id, a.name)),
      ...entities.map((e) => refTo(s, path, "data_entity", e.id, e.name)),
      ...surfaces.map((x) => refTo(s, path, "surface", x.id, x.name)),
    ],
    flow: s.flows.filter((x) => x.feature_id === f.id).map((x) => x.step),
    acceptance: s.acceptance.filter((x) => x.feature_id === f.id),
    edgeCases: s.edgeCases.filter((x) => x.feature_id === f.id),
    evidence: s.evidence.filter((x) => x.feature_id === f.id),
    surfaces: surfaces.map((x) => ({
      ...x, actionCount: pick(actionsBySurface, x.id).length, doc: refTo(s, path, "surface", x.id, x.name),
    })),
    apiAndData: [
      ...apis.map((a) => ({ kind: "API", name: a.name, purpose: a.purpose, doc: refTo(s, path, "api", a.id, a.name) })),
      ...entities.map((e) => ({ kind: "Entity", name: e.name, purpose: e.purpose, doc: refTo(s, path, "data_entity", e.id, e.name) })),
    ],
    permissions: s.permissions.filter((perm) => perm.scope_type === "feature" && perm.scope_id === f.id)
      .map((perm) => ({ ...perm, role: roleName.get(perm.role_id) ?? perm.role_id })),
    workflows: [
      ...workflows.map((w) => ({ name: w.name, trigger: w.trigger, doc: refTo(s, path, "workflow", w.id, w.name) })),
      ...machines.map((x) => ({
        name: `${x.entity_name} states`, trigger: x.initial_state,
        doc: workflows.length ? refTo(s, path, "workflow", workflows[0].id, workflows[0].name) : refTo(s, path, "state_machine", x.id, x.entity_name),
      })),
    ],
    failurePaths: branches.filter((b) => b.branch_type !== "alternate").map((b) => ({
      workflow: s.byId.get(b.workflow_id)?.name,
      step: stepName.get(b.from_step_id),
      condition: b.condition,
      behavior: b.failure_policy ?? b.branch_type,
    })),
    observability: [
      ...workflows.map((w) => w.observability).filter(Boolean),
      ...s.jobs.filter((j) => j.feature_id === f.id).map((j) => j.observability).filter(Boolean),
      ...s.nfrs.filter((n) => n.feature_id === f.id && /observab|telemetry|monitor/i.test(n.category)).map((n) => n.requirement),
    ],
    rollout: null,
    testPlanDoc: refTo(s, path, "test_plan", module?.id, `${module?.name} test plan`),
    decisions: s.decisions.filter((d) => (d.scope_type === "feature" && d.scope_id === f.id) ||
      s.decisionLinks.some((l) => l.decision_id === d.id && l.target_type === "feature" && l.target_id === f.id))
      .map((d) => ({ ...d, doc: refTo(s, path, "adr", d.id, `${d.id} ${d.title}`) })),
    migrations: s.migrations.filter((m) => m.feature_id === f.id),
    sensitive: s.fields.filter((x) => entityIds.has(x.entity_id) && x.sensitivity_class !== "none").map((x) => ({
      field: `${s.byId.get(x.entity_id)?.name ?? x.entity_id}.${x.name}`,
      sensitivity_class: x.sensitivity_class,
      retention_rule: s.byId.get(x.entity_id)?.retention_rule,
    })),
    nfrs: s.nfrs.filter((n) => n.feature_id === f.id),
    recovery: branches.map((b) => b.failure_policy).filter(Boolean),
    compatibility: apis.map((a) => a.versioning).filter(Boolean),
    architectureNote: null,
  };
}

// ------------------------------------------------------- workflow and machine

function machineBlock(s, machine) {
  const states = s.states.filter((x) => x.state_machine_id === machine.id);
  const stateName = new Map(states.map((x) => [x.id, x.name]));
  const transitions = s.transitions.filter((x) => x.state_machine_id === machine.id).map((t) => ({
    ...t,
    from: stateName.get(t.from_state_id) ?? t.from_state_id,
    to: stateName.get(t.to_state_id) ?? t.to_state_id,
  }));
  return {
    machine,
    initialState: machine.initial_state,
    states: states.map((x) => ({ ...x, permitted: json(x.permitted_actions_json) })),
    transitions,
    terminalStates: states.filter((x) => x.terminal).map((x) => x.name),
    timeouts: transitions.filter((t) => t.timeout_rule).map((t) => `${t.from} ${t.timeout_rule}`),
    enforcementPoints: [...new Set(transitions.map((t) => t.enforcement_point).filter(Boolean))],
  };
}

function workflowData(s, workflow, machine, path) {
  const feature = workflow ? s.workflowFeature(workflow) : (machine?.feature_id ? s.byId.get(machine.feature_id) : null);
  const module = workflow || machine ? s.moduleOf(workflow ?? machine) : null;
  const machines = workflow
    ? s.machines.filter((x) => x.feature_id === workflow.feature_id)
    : machine ? [machine] : [];

  const stepName = new Map(s.wfSteps.map((step) => [step.id, `${step.sequence} ${step.action}`]));

  return {
    workflow: workflow ?? null,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    featureDoc: feature ? refTo(s, path, "feature", feature.id, feature.name) : null,
    actors: workflow ? s.wfActors.filter((a) => a.workflow_id === workflow.id) : [],
    preconditions: workflow ? json(workflow.preconditions_json) : [],
    steps: workflow ? s.wfSteps.filter((x) => x.workflow_id === workflow.id) : [],
    branches: workflow
      ? s.wfBranches.filter((b) => b.workflow_id === workflow.id).map((b) => ({
          ...b, from: stepName.get(b.from_step_id) ?? b.from_step_id, to: stepName.get(b.to_step_id) ?? "end",
        }))
      : [],
    machines: machines.map((x) => machineBlock(s, x)),
  };
}

// ------------------------------------------------------- surfaces and actions

const REQUIRED_SURFACE_STATES = ["loading", "empty", "error", "success"];

function surfaceData(s, surface, path) {
  const module = s.byId.get(surface.module_id);
  const feature = surface.feature_id ? s.byId.get(surface.feature_id) : null;
  const states = s.surfaceStates.filter((x) => x.surface_id === surface.id);
  const stateBehavior = new Map(states.map((x) => [x.state_type, x.behavior]));
  const roleName = new Map(s.roles.map((r) => [r.id, r.name]));

  const acceptance = feature
    ? s.acceptance.filter((a) => a.feature_id === feature.id).map((a) => a.id).join(", ")
    : null;
  const telemetry = feature
    ? s.nfrs.filter((n) => n.feature_id === feature.id && /observab|telemetry/i.test(n.category)).map((n) => n.requirement).join("; ")
    : null;

  const actions = s.actions.filter((x) => x.surface_id === surface.id).map((a) => ({
    ...a,
    who: `${a.role ?? "any role"}, enforced at ${a.enforcement_point ?? "no enforcement point recorded"}`,
    input: [a.input_contract, a.validation].filter(Boolean).join("; "),
    side_effects: json(a.side_effects_json).join(", "),
    empty: stateBehavior.get("empty"),
    offline: stateBehavior.get("offline"),
    responsive: surface.responsive_behavior,
    telemetry: telemetry || "none approved",
    acceptance,
  }));

  const matrix = actions.map((a) => {
    const access = {};
    for (const perm of s.permissions) {
      if (perm.scope_type !== "ui_action" || perm.scope_id !== a.id) continue;
      const role = roleName.get(perm.role_id);
      if (role) access[role] = perm.access_level;
    }
    for (const r of s.roles) {
      if (access[r.name]) continue;
      if (a.role && a.role === r.name) access[r.name] = "full";
    }
    return { action: a.label ?? a.name, access };
  });

  return {
    surface,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    featureDoc: feature ? refTo(s, path, "feature", feature.id, feature.name) : null,
    components: json(surface.components_json),
    entities: json(surface.entities_shown_json),
    actions,
    roles: s.roles,
    matrix,
    states,
    missingStates: REQUIRED_SURFACE_STATES.filter((x) => !stateBehavior.has(x)),
  };
}

// ------------------------------------------------------------------------ api

/** Contract JSON arrives in several honest shapes. Read them all, invent none. */
function contractRows(value, keys) {
  const parsed = json(value, null) ?? json(value, {});
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.fields) ? parsed.fields
    : Object.entries(parsed ?? {}).map(([name, spec]) => (spec && typeof spec === "object" ? { name, ...spec } : { name, type: spec }));
  return list.map((item) => {
    if (typeof item === "string") return { [keys[0]]: item };
    const row = {};
    for (const key of keys) row[key] = item[key] ?? null;
    row[keys[0]] = row[keys[0]] ?? item.name ?? item.field ?? item.code ?? null;
    return row;
  });
}

function apiData(s, api, path) {
  const module = s.byId.get(api.module_id);
  const feature = api.feature_id ? s.byId.get(api.feature_id) : null;
  const callers = s.actions.filter((a) => `${a.effect ?? ""}`.includes(api.id) || `${a.effect ?? ""}`.includes(api.name));
  const surfaceOf = new Map(s.surfaces.map((x) => [x.id, x]));

  return {
    api,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    featureDoc: feature ? refTo(s, path, "feature", feature.id, feature.name) : null,
    callers: callers.map((a) => refTo(s, path, "surface", a.surface_id, `${surfaceOf.get(a.surface_id)?.name ?? "surface"}: ${a.label ?? a.name}`)),
    sideEffects: json(api.side_effects_json),
    request: contractRows(api.request_contract_json, ["name", "type", "required", "rules"]),
    response: contractRows(api.response_contract_json, ["name", "type", "notes"]),
    errors: contractRows(api.error_contract_json, ["code", "meaning", "behavior"]),
    tests: feature ? s.evidence.filter((e) => e.feature_id === feature.id) : [],
  };
}

// ---------------------------------------------------------------- data entity

function entityData(s, entity, path) {
  const module = s.byId.get(entity.module_id);
  const name = new Map(s.entities.map((e) => [e.id, e.name]));
  const fields = s.fields.filter((f) => f.entity_id === entity.id).map((f) => ({ ...f, constraints: json(f.constraints_json) }));

  const relationships = [
    ...s.relationships.filter((r) => r.from_entity_id === entity.id).map((r) => ({
      ...r, direction: "outgoing", target: name.get(r.to_entity_id) ?? r.to_entity_id,
      fromName: entity.name, toName: name.get(r.to_entity_id) ?? r.to_entity_id,
    })),
    ...s.relationships.filter((r) => r.to_entity_id === entity.id).map((r) => ({
      ...r, direction: "incoming", target: name.get(r.from_entity_id) ?? r.from_entity_id,
      fromName: name.get(r.from_entity_id) ?? r.from_entity_id, toName: entity.name,
    })),
  ];

  const touching = s.apis.filter((a) =>
    a.module_id === entity.module_id &&
    new RegExp(entity.name.replace(/[^A-Za-z0-9]+/g, ".?"), "i").test(`${a.name} ${a.purpose ?? ""} ${a.path_or_topic ?? ""}`));
  const creates = (a) => /^(post|put)$/i.test(a.method_or_procedure ?? "") || /create|add|register/i.test(a.name);

  const migrationIds = new Set(s.migrationEntities.filter((m) => m.entity_id === entity.id).map((m) => m.migration_id));

  return {
    entity,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    fields,
    relationships,
    createdBy: touching.filter(creates).map((a) => refTo(s, path, "api", a.id, a.name)),
    updatedBy: touching.filter((a) => !creates(a)).map((a) => refTo(s, path, "api", a.id, a.name)),
    constraints: fields.flatMap((f) => f.constraints.map((c) => `${f.name}: ${c}`)),
    migrations: s.migrations.filter((m) => migrationIds.has(m.id)),
  };
}

// ---------------------------------------------------------------- integration

function integrationData(s, integration, path) {
  const module = s.byId.get(integration.module_id);
  const feature = integration.feature_id ? s.byId.get(integration.feature_id) : null;
  return {
    integration,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    featureDoc: feature ? refTo(s, path, "feature", feature.id, feature.name) : null,
    environments: json(integration.environments_json),
    contractRefs: json(integration.contract_refs_json),
    evidence: feature ? s.evidence.filter((e) => e.feature_id === feature.id) : [],
  };
}

// ---------------------------------------------------------- jobs and webhooks

function asyncData(s, job, webhook, path) {
  const row = job ?? webhook;
  const module = s.byId.get(row.module_id);
  const feature = row.feature_id ? s.byId.get(row.feature_id) : null;
  const mechanism = slot(s, /async|queue|job|event/i);
  return {
    job: job ?? null,
    webhook: webhook ?? null,
    moduleDoc: refTo(s, path, "module", module?.id, module?.name),
    featureDoc: feature ? refTo(s, path, "feature", feature.id, feature.name) : null,
    mechanism: mechanism?.state === "specified" ? mechanism.choice : null,
    input: job ? contractRows(job.input_contract_json, ["name", "type"]).map((f) => `${f.name}${f.type ? `: ${f.type}` : ""}`) : [],
  };
}

// -------------------------------------------------------------- observability

function observabilityData(s, module, path) {
  const featureIds = new Set(s.features.filter((f) => f.module_id === module.id).map((f) => f.id));
  const tooling = slot(s, /observab|monitor|logging|telemetry/i);

  const signals = [
    ...s.workflows.filter((w) => featureIds.has(w.feature_id) && w.observability)
      .map((w) => ({ capability: w.name, signal: w.observability, where: module.name })),
    ...s.jobs.filter((j) => j.module_id === module.id && j.observability)
      .map((j) => ({ capability: j.name, signal: j.observability, where: module.name })),
    ...s.nfrs.filter((n) => n.module_id === module.id && /observab|telemetry|monitor|log/i.test(n.category))
      .map((n) => ({ capability: n.category, signal: n.requirement, where: n.measurement_method })),
  ];

  const alerts = s.nfrs
    .filter((n) => n.module_id === module.id && /availab|error|latency|alert|uptime/i.test(`${n.category} ${n.requirement}`))
    .map((n) => ({ condition: n.requirement, threshold: `${n.target ?? "no target"} (${n.target_source ?? "no source"})`, destination: "not recorded" }));

  return {
    scopeName: module.name,
    tooling: tooling?.state === "specified" ? [tooling.choice] : [],
    signals,
    views: s.surfaces.filter((x) => x.module_id === module.id && /dashboard|report|monitor/i.test(`${x.surface_type} ${x.name}`))
      .map((x) => ({ view: x.name, shows: x.purpose, where: x.route })),
    alerts,
    firstResponse: s.wfSteps
      .filter((step) => step.failure_behavior && s.workflows.some((w) => w.id === step.workflow_id && featureIds.has(w.feature_id)))
      .map((step) => ({ failure: step.action, signal: step.failure_behavior })),
    path,
  };
}

// ------------------------------------------------------------------ test plan

function testPlanData(s, module) {
  const features = s.features.filter((f) => f.module_id === module.id);
  const featureIds = new Set(features.map((f) => f.id));
  const featureName = new Map(features.map((f) => [f.id, f.name]));
  const acceptance = s.acceptance.filter((a) => featureIds.has(a.feature_id))
    .map((a) => ({ ...a, feature: featureName.get(a.feature_id) }));
  const evidence = s.evidence.filter((e) => featureIds.has(e.feature_id));
  const edges = s.edgeCases.filter((e) => featureIds.has(e.feature_id) && e.applicability === "applicable");
  const permissions = s.permissions.filter((perm) => perm.scope_type === "module" && perm.scope_id === module.id);
  const machines = s.machines.filter((x) => s.moduleOf(x)?.id === module.id);
  const transitions = s.transitions.filter((t) => machines.some((m) => m.id === t.state_machine_id));
  const levels = [...new Set(evidence.map((e) => e.evidence_type))].join(", ") || "not recorded";
  const state = (n) => (n === 0 ? "missing" : evidence.length ? "exists" : "planned");
  const tooling = slot(s, /test|quality|ci/i);

  return {
    module,
    tooling: tooling?.state === "specified" ? [tooling.choice] : [],
    acceptance,
    coverage: [
      { area: "Happy paths per feature", level: levels, cases: features.length, status: state(features.length) },
      { area: "Applicable edge-case categories", level: levels, cases: edges.length, status: state(edges.length) },
      { area: "Permission boundaries", level: levels, cases: permissions.length, status: state(permissions.length) },
      { area: "State machines including illegal transitions", level: levels, cases: transitions.length, status: state(transitions.length) },
    ],
    evidence,
  };
}

// ------------------------------------------------------------------------ adr

function adrData(s, d, path) {
  const links = s.decisionLinks.filter((l) => l.decision_id === d.id);
  const linkRef = (l) => {
    const label = l.scope_note ? `${l.target_id} (${l.scope_note})` : l.target_id;
    return l.target_type === "decision" ? refTo(s, path, "adr", l.target_id, label) : { label: `${l.target_type} ${label}` };
  };
  const consequences = json(d.consequences_json, {});

  return {
    decision: d,
    date: dateOf(d.accepted_at ?? d.created_at),
    evidence: json(d.evidence_json),
    criteria: json(d.criteria_json),
    options: json(d.options_json),
    consequences: {
      positive: [].concat(consequences.positive ?? []),
      negative: [].concat(consequences.negative ?? []),
      neutral: [].concat(consequences.neutral ?? []),
    },
    risks: json(d.risks_json),
    enforcement: json(d.enforcement_json),
    revisitTriggers: json(d.revisit_triggers_json),
    supersedes: [
      ...(d.supersedes_id ? [refTo(s, path, "adr", d.supersedes_id, d.supersedes_id)] : []),
      ...links.filter((l) => l.relationship === "supersedes").map(linkRef),
    ],
    supersededBy: d.superseded_by_id ? [refTo(s, path, "adr", d.superseded_by_id, d.superseded_by_id)] : [],
    partiallySupersedes: links.filter((l) => l.relationship === "partially_supersedes").map(linkRef),
    related: links.filter((l) => !["supersedes", "partially_supersedes"].includes(l.relationship)).map(linkRef),
    transitions: s.decisionTransitions.filter((t) => t.decision_id === d.id),
  };
}

// -------------------------------------------------------------- derived views

function changelogData(s) {
  return {
    project: s.project,
    entries: s.events.map((e) => ({
      sequence: e.sequence, date: dateOf(e.created_at), summary: e.summary, actor: e.actor_label,
    })),
  };
}

function summaryData(s, path) {
  const complete = s.tasks.filter((t) => t.status === "complete").length;
  const machines = s.machines.length;
  return {
    project: s.project,
    roles: s.roles,
    modules: s.modules.map((m) => ({
      name: m.name,
      features: s.features.filter((f) => f.module_id === m.id).map((f) => f.name),
      doc: refTo(s, path, "module", m.id, m.name),
    })),
    stack: capabilities(s, "stack_slot").map((c) => ({
      area: c.area, choice: c.state === "specified" ? c.choice : `${readable(c.state)}: ${c.reason}`,
      evidence: c.decision_id ?? c.evidence_ref ?? "none",
    })),
    pieces: s.pieces.map((x) => `${x.name} (${x.runs_where ?? "runtime not recorded"})`),
    environments: [...new Set(s.integrations.flatMap((i) => json(i.environments_json)))],
    integrations: s.integrations.map((i) => i.name),
    state: [
      { measure: "Modules", value: s.modules.length },
      { measure: "Features", value: s.features.length },
      { measure: "Acceptance criteria met", value: `${s.acceptance.filter((a) => a.status === "met").length} of ${s.acceptance.length}` },
      { measure: "Verification evidence", value: s.evidence.length },
      { measure: "Tasks complete", value: `${complete} of ${s.tasks.length}` },
      { measure: "State machines", value: machines },
      { measure: "Open questions", value: s.questions.filter((q) => q.status === "open").length },
      { measure: "Documents pending review", value: s.documents.filter((d) => d.sync_status === "manual_edit_pending").length },
    ],
    unknowns: [
      ...s.questions.filter((q) => q.status === "open").map((q) => ({ item: q.question, resolution: q.recommendation })),
      ...capabilities(s, "readiness").filter((c) => c.state === "awaiting_decision")
        .map((c) => ({ item: c.area, resolution: c.reason })),
    ],
  };
}

function statusData(s, path) {
  const openTasks = s.tasks.filter((t) => !["complete", "cancelled", "superseded"].includes(t.status));
  const stepsFilled = (moduleId) => {
    const list = s.completeness.filter((c) => c.module_id === moduleId && c.state !== "open");
    return `${list.length} of ${MODULE_STEPS.length}`;
  };
  return {
    project: s.project,
    headline: [
      { measure: "Modules", value: s.modules.length },
      { measure: "Features", value: s.features.length },
      { measure: "Features accepted", value: s.features.filter((f) => f.accepted_at).length },
      { measure: "Open tasks", value: openTasks.length },
      { measure: "Blocked tasks", value: s.tasks.filter((t) => t.status === "blocked").length },
      { measure: "Open questions", value: s.questions.filter((q) => q.status === "open").length },
      { measure: "Decisions accepted", value: s.decisions.filter((d) => d.status === "accepted").length },
    ],
    milestones: s.milestones.map((m) => {
      const features = s.features.filter((f) => f.milestone_id === m.id);
      return {
        name: m.name, status: m.status, features: features.length,
        complete: features.filter((f) => f.status === "implemented" || f.accepted_at).length,
      };
    }),
    modules: s.modules.map((m) => ({
      name: m.name, status: m.status,
      features: s.features.filter((f) => f.module_id === m.id).length,
      steps: stepsFilled(m.id),
    })),
    attention: s.features.filter((f) => f.next_action || f.status === "blocked")
      .map((f) => ({ doc: refTo(s, path, "feature", f.id, f.name), status: f.status, next_action: f.next_action })),
    questions: s.questions.filter((q) => q.status === "open")
      .map((q) => ({ question: q.question, why_it_matters: q.why_it_matters, scope: `${q.scope_type} ${q.scope_id ?? ""}`.trim() })),
  };
}

function driftData(s, path) {
  const impact = s.documents
    .filter((d) => d.sync_status !== "generated" && d.sync_status !== "accepted")
    .map((d) => ({
      doc: { label: d.path, link: posix.relative(posix.dirname(path), d.path) },
      sync_status: d.sync_status,
      scope: `${d.scope_type} ${d.scope_id ?? ""}`.trim(),
      action: d.sync_status === "manual_edit_pending" ? "review the proposed edit" : "regenerate",
    }));

  const findings = [];
  for (const f of s.features) {
    const open = s.acceptance.filter((a) => a.feature_id === f.id && a.status === "unmet");
    if (f.status === "implemented" && open.length) {
      findings.push({
        class: "implemented-without-evidence", database: `${f.id} ${f.name}`,
        document: `${open.length} unmet acceptance criteria`, owner: "code",
      });
    }
  }
  for (const c of capabilities(s, "readiness").filter((x) => x.state === "awaiting_decision")) {
    findings.push({ class: "capability-awaiting-decision", database: c.area, document: c.reason ?? "no reason recorded", owner: "decision" });
  }
  for (const m of s.modules) {
    const open = s.completeness.filter((x) => x.module_id === m.id && x.state === "open");
    if (open.length) {
      findings.push({
        class: "module-loop-incomplete", database: m.name,
        document: `${open.length} of ${MODULE_STEPS.length} steps still open`, owner: "docs",
      });
    }
  }
  for (const n of s.nfrs.filter((x) => x.status === "unmeasured")) {
    findings.push({ class: "requirement-unmeasured", database: n.id, document: n.requirement, owner: "code" });
  }
  for (const d of s.decisions.filter((x) => x.status === "revisit_required" || (x.expires_at && x.status === "time_boxed"))) {
    findings.push({ class: "decision-needs-revisit", database: `${d.id} ${d.title}`, document: d.expires_at ?? "revisit requested", owner: "decision" });
  }
  // A planned document that is not on disk yet is not drift: the run that
  // renders this report is the run that creates it. Reporting it would make the
  // first generation contradict itself and force a second write.

  return {
    project: s.project,
    impact,
    findings,
    contradictions: s.discovery.filter((d) => d.epistemic_status === "contradicted")
      .map((d) => ({ sides: d.kind, detail: d.statement, blocking: d.status === "proposed" ? "yes" : "no" })),
    pending: s.documents.filter((d) => d.sync_status === "manual_edit_pending").map((d) => d.path),
  };
}

// ------------------------------------------------------------------- generate

const matches = (plan, only) => {
  if (!only) return true;
  const needles = (Array.isArray(only) ? only : [only]).map((x) => String(x));
  return needles.some((n) => plan.kind === n || plan.path.includes(n) || plan.scopeId === n);
};

const readIfPresent = async (file) => {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
};

/**
 * Render the whole project. With `apply` the files are written and the document
 * rows recorded; without it nothing is touched and the caller sees what would
 * happen. `only` narrows the run to matching kinds, paths or record ids.
 */
export async function generate(root, { apply = false, only = null, includeReports = false } = {}) {
  const prepared = await query(root, async (db) => {
    const project = await currentProject(db);
    if (!project) return null;
    const plan = (await documentPlan(db, project.id, { includeReports })).filter((entry) => matches(entry, only));
    const s = await snapshot(db, project.id);
    const documents = new Map(s.documents.map((d) => [d.path, d]));
    const rendered = [];
    for (const entry of plan) rendered.push({ entry, ...(await renderDocument(db, entry)) });
    return {
      project, plan, rendered, documents, revision: s.revision,
      allPaths: new Set(s.plan.map((x) => x.path)),
    };
  });

  const result = { written: [], unchanged: [], proposals: [], skipped: [], retired: [] };
  if (!prepared) return result;

  const { project, rendered, documents, revision, allPaths } = prepared;
  const writes = [];

  for (const { entry, path, body, sourceFingerprint } of rendered) {
    const file = join(root, path);
    const onDisk = await readIfPresent(file);
    const parsed = onDisk === null ? null : parseMarker(onDisk);
    const diskBody = onDisk === null ? null : parsed ? parsed.body : normalizeBody(onDisk);
    const diskHash = diskBody === null ? null : bodyHash(diskBody);
    const hash = bodyHash(body);
    const row = documents.get(path);

    const write = { entry, path, file, body, hash, sourceFingerprint, row };

    // Identical body: leave the file alone even when the marker's revision has
    // moved on. Rewriting a file to bump a number nobody reads is pure churn.
    // The row is still refreshed, which is what clears a proposal the author
    // resolved by reverting their edit.
    if (diskHash === hash) {
      result.unchanged.push(path);
      // The row is refreshed when it disagrees with what is on disk, and also
      // when it is simply stamped with an older revision. Re-rendering at this
      // revision produced an identical body, so the document is current as of
      // now; leaving the old number behind would report it as permanently out
      // of date and no later run could ever clear it.
      if (!row || row.sync_status !== "generated" || row.generated_hash !== hash
        || (row.database_revision ?? 0) < revision) {
        writes.push({ ...write, mode: "record" });
      }
      continue;
    }

    if (diskHash !== null && entry.regenerationMode !== DERIVED) {
      const untouched = row?.generated_hash ? diskHash === row.generated_hash : parsed?.hash === diskHash;
      if (!untouched) {
        result.proposals.push({ path, kind: entry.kind, generatedHash: hash, onDiskHash: diskHash });
        writes.push({ ...write, mode: "proposal", manualHash: diskHash });
        continue;
      }
    }

    result.written.push(path);
    writes.push({ ...write, mode: "write" });
  }

  for (const d of documents.values()) {
    if (!allPaths.has(d.path)) {
      // A document whose record is gone is not merely skipped. Left as
      // generated it keeps the revision it was written at, so freshness counts
      // it behind forever and no later run can clear it: five documents from
      // an earlier schema sat at revision 681 while every other document and
      // the documentation check agreed the projection matched the database.
      //
      // Retired says what is true. The row stays queryable so the history of
      // what was once documented is not lost, and the file is removed because
      // a document describing a record that no longer exists is a false
      // statement sitting in the repository.
      result.retired.push({ path: d.path, id: d.id, reason: "the record it described no longer exists" });
    }
  }

  if (!apply) return result;

  // Files first. No filesystem work may happen inside the write transaction.
  for (const w of writes) {
    if (w.mode !== "write") continue;
    await mkdir(dirname(w.file), { recursive: true });
    await writeFile(w.file, withMarker({ sourceId: w.entry.sourceId, revision, body: w.body }), "utf8");
  }

  // A document whose record is gone describes something that does not exist, so
  // the file goes. A hand edited one is left alone: the edit is somebody's work
  // and deleting it would destroy it without asking.
  for (const r of result.retired) {
    const row = documents.get(r.path);
    if (row?.sync_status === "manual_edit_pending") { r.keptFile = "it carries an unresolved hand edit"; continue; }
    await rm(join(root, r.path), { force: true }).catch(() => {});
  }

  const at = new Date().toISOString();
  await mutate(root, async (db) => {
    for (const r of result.retired) {
      // Kept queryable rather than deleted, so what was once documented stays
      // answerable, and marked so freshness stops counting it behind.
      await db.run(
        "UPDATE documents SET sync_status = 'retired', database_revision = ? WHERE id = ?",
        revision, r.id,
      );
    }
    for (const w of writes) {
      if (w.mode === "proposal") {
        if (w.row) {
          await db.run(
            "UPDATE documents SET sync_status = 'manual_edit_pending', manual_hash = ? WHERE id = ?",
            w.manualHash, w.row.id,
          );
        } else {
          await create(db, "document", {
            project_id: project.id, kind: w.entry.kind, scope_type: w.entry.scopeType,
            scope_id: w.entry.scopeId, path: w.path, template: w.entry.template,
            regeneration_mode: w.entry.regenerationMode, sync_status: "manual_edit_pending",
            manual_hash: w.manualHash, database_revision: revision,
          }, { projectId: project.id, activity: false });
        }
        continue;
      }

      const values = {
        database_revision: revision,
        generated_body: storable(w.body),
        generated_hash: w.hash,
        manual_hash: null,
        source_fingerprint: w.sourceFingerprint,
        sync_status: "generated",
        generated_at: at,
        template: w.entry.template,
        regeneration_mode: w.entry.regenerationMode,
      };
      if (w.row) {
        // `patch` cannot be used here: documents has no optimistic version
        // column, so a versioned update would fail. The activity event for the
        // whole run is recorded below instead.
        const cols = Object.keys(values);
        await db.run(
          `UPDATE documents SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
          ...cols.map((c) => values[c]), w.row.id,
        );
      } else {
        await create(db, "document", {
          project_id: project.id, kind: w.entry.kind, scope_type: w.entry.scopeType,
          scope_id: w.entry.scopeId, path: w.path, ...values,
        }, { projectId: project.id, activity: false });
      }
    }

    // A run that changed nothing records nothing. Otherwise every `docs
    // generate` and every `doctor` would append an event, moving the project
    // revision for no change in content and making the timeline unreadable.
    if (result.written.length || result.proposals.length) {
      await recordActivity(db, project.id, {
        type: "documentation_generated",
        summary: `Generated ${result.written.length} documents, ${result.unchanged.length} unchanged, ${result.proposals.length} awaiting review`,
        metadata: { written: result.written, unchanged: result.unchanged.length, proposals: result.proposals.map((p) => p.path) },
      });
    }

    if (result.proposals.length) {
      await recordActivity(db, project.id, {
        type: "documentation_proposal_raised",
        summary: `${result.proposals.length} generated documents were edited by hand and were not overwritten`,
        metadata: { paths: result.proposals.map((p) => p.path) },
      });
    }
  });

  return result;
}

/**
 * The body is cached in the row so a proposal can be diffed without a re-render.
 *
 * A body that fails the storage screen used to be dropped to null while the row
 * was still written as a healthy generated document. That was worse than
 * failing: the file was already on disk, so only the evidence was lost, and the
 * document became permanently unrejectable because rejecting needs the cached
 * body it no longer had. The renderer builds bodies out of already-screened
 * records, so a failure here means a real defect in a renderer, and it is
 * reported rather than hidden.
 */
function storable(body) {
  assertStorable("generated_body", body);
  return body;
}
