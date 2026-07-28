// The product map commands: reading the model back out.
//
// Section 12.4 of the requirements document names fifteen of these and none
// existed. The records were all there, and the only way to see a module, a
// goal, a milestone, a workflow, the schema or the API surface was to open the
// control centre, which means a terminal session or a harness with no browser
// could write the model and never read it back.
//
// These are all read only. Every one answers a question the product promises an
// answer to in section 2.3, and each says plainly when the answer is nothing.

import { query } from "../db/store.mjs";
import * as R from "./render.mjs";

const json = (value, fallback) => {
  try {
    const parsed = JSON.parse(value ?? "null");
    return parsed ?? fallback;
  } catch { return fallback; }
};

const list = (values) => (values ?? []).filter(Boolean).join(", ") || null;
const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** Nothing recorded is an answer, and a useful one, so it is never blank. */
const nothing = (what) => R.wrap(`Nothing recorded yet for ${what}.`);

// ------------------------------------------------------------------ modules

export async function moduleList(root) {
  const rows = await query(root, (db) => db.all(
    `SELECT m.*, (SELECT COUNT(*) FROM features f WHERE f.module_id = m.id) AS features
       FROM modules m ORDER BY m.sequence, m.id`));
  if (!rows.length) return { data: { modules: [] }, text: nothing("modules") };
  return {
    data: { modules: rows },
    text: R.stitch([
      R.heading(`Modules (${rows.length})`),
      R.table(["Id", "Name", "Features", "Status"],
        rows.map((m) => [m.id, m.name, String(m.features), R.status(m.status)])),
    ]),
  };
}

export async function moduleShow(root, id) {
  const found = await query(root, async (db) => {
    const module = await db.get("SELECT * FROM modules WHERE id = ?", id);
    if (!module) return null;
    return {
      module,
      features: await db.all("SELECT id, name, status FROM features WHERE module_id = ? ORDER BY id", id),
      entities: await db.all("SELECT id, name FROM data_entities WHERE module_id = ? ORDER BY id", id),
      operations: await db.all("SELECT id, name FROM api_operations WHERE module_id = ? ORDER BY id", id),
      surfaces: await db.all("SELECT id, name FROM surfaces WHERE module_id = ? ORDER BY id", id),
      integrations: await db.all("SELECT id, name FROM integrations WHERE module_id = ? ORDER BY id", id),
    };
  });
  if (!found) throw new Error(`There is no module ${id}.`);
  const { module, features, entities, operations, surfaces, integrations } = found;
  return {
    data: found,
    text: R.stitch([
      R.heading(`${module.name}  ${module.id}`),
      R.pairs([
        ["Status", R.status(module.status)],
        ["Purpose", module.purpose ?? "Not recorded"],
        ["Outside its scope", module.out_of_scope ?? "Not recorded"],
      ]),
      "",
      R.block(`Features (${features.length})`, features.length
        ? R.bullets(features.map((f) => `${f.id}  ${f.name}  [${R.status(f.status)}]`))
        : "  None."),
      entities.length ? R.block(`Data it owns (${entities.length})`, R.bullets(entities.map((e) => `${e.id}  ${e.name}`))) : null,
      operations.length ? R.block(`Operations (${operations.length})`, R.bullets(operations.map((o) => `${o.id}  ${o.name}`))) : null,
      surfaces.length ? R.block(`Surfaces (${surfaces.length})`, R.bullets(surfaces.map((s) => `${s.id}  ${s.name}`))) : null,
      integrations.length ? R.block(`Integrations (${integrations.length})`, R.bullets(integrations.map((i) => `${i.id}  ${i.name}`))) : null,
    ]),
  };
}

// -------------------------------------------------------------------- goals

export async function goalList(root) {
  const rows = await query(root, (db) => db.all(
    `SELECT g.*,
            (SELECT COUNT(*) FROM feature_goals fg WHERE fg.goal_id = g.id) AS features,
            (SELECT COUNT(*) FROM goal_success_criteria c WHERE c.goal_id = g.id) AS criteria,
            (SELECT COUNT(*) FROM goal_success_criteria c WHERE c.goal_id = g.id AND c.status = 'met') AS met
       FROM goals g ORDER BY g.sequence, g.id`));
  if (!rows.length) return { data: { goals: [] }, text: nothing("goals") };
  return {
    data: { goals: rows },
    text: R.stitch([
      R.heading(`Goals (${rows.length})`),
      R.table(["Id", "Name", "Features", "Criteria met"],
        rows.map((g) => [g.id, g.name, String(g.features), `${g.met} of ${g.criteria}`])),
    ]),
  };
}

export async function goalShow(root, id) {
  const found = await query(root, async (db) => {
    const goal = await db.get("SELECT * FROM goals WHERE id = ?", id);
    if (!goal) return null;
    return {
      goal,
      criteria: await db.all("SELECT * FROM goal_success_criteria WHERE goal_id = ? ORDER BY sequence", id),
      features: await db.all(
        `SELECT f.id, f.name, f.status FROM features f
           JOIN feature_goals fg ON fg.feature_id = f.id WHERE fg.goal_id = ? ORDER BY f.id`, id),
    };
  });
  if (!found) throw new Error(`There is no goal ${id}.`);
  const { goal, criteria, features } = found;
  return {
    data: found,
    text: R.stitch([
      R.heading(`${goal.name}  ${goal.id}`),
      R.pairs([
        ["Status", R.status(goal.status)],
        ["Outcome", goal.description ?? "Not recorded"],
        ["Why it matters", goal.why_it_matters ?? "Not recorded"],
      ]),
      "",
      R.block(`How it is measured (${criteria.length})`, criteria.length
        ? R.bullets(criteria.map((c) =>
            `[${R.status(c.status)}] ${c.criterion}${c.target ? `. Target: ${c.target}` : ""}${c.measurement_method ? `. Read by: ${c.measurement_method}` : ""}`))
        : "  Nothing measurable is recorded, so nothing can show whether this goal was reached."),
      R.block(`Features serving it (${features.length})`, features.length
        ? R.bullets(features.map((f) => `${f.id}  ${f.name}  [${R.status(f.status)}]`))
        : "  None, so nothing being built moves this goal."),
    ]),
  };
}

// --------------------------------------------------------------- milestones

export async function milestoneList(root) {
  const rows = await query(root, (db) => db.all(
    `SELECT m.*, (SELECT COUNT(*) FROM features f WHERE f.milestone_id = m.id) AS features
       FROM milestones m ORDER BY m.sequence, m.id`));
  if (!rows.length) return { data: { milestones: [] }, text: nothing("milestones") };
  return {
    data: { milestones: rows },
    text: R.stitch([
      R.heading(`Milestones (${rows.length})`),
      R.table(["Id", "Name", "Features", "Status"],
        rows.map((m) => [m.id, m.name, String(m.features), R.status(m.status)])),
    ]),
  };
}

export async function milestoneShow(root, id) {
  const found = await query(root, async (db) => {
    const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", id);
    if (!milestone) return null;
    return {
      milestone,
      features: await db.all("SELECT id, name, status FROM features WHERE milestone_id = ? ORDER BY id", id),
    };
  });
  if (!found) throw new Error(`There is no milestone ${id}.`);
  const { milestone, features } = found;
  // Both shapes are read: a plain string from before conditions could be
  // judged, and the object a judged condition is stored as now.
  const asCondition = (c) => (typeof c === "string" ? { condition: c, met: false, reading: null, check: null } : c);
  const exits = json(milestone.exit_conditions_json, []).map(asCondition);
  // Entry conditions were stored and never shown, so a milestone could be
  // blocked from starting by something the reader had no way to see.
  const entries = json(milestone.entry_conditions_json, []).map(asCondition);
  const met = exits.filter((c) => c.met).length;
  const entryMet = entries.filter((c) => c.met).length;
  const done = features.filter((f) => ["complete", "delivered", "implemented"].includes(f.status)).length;
  return {
    data: found,
    text: R.stitch([
      R.heading(`${milestone.name}  ${milestone.id}`),
      R.pairs([
        ["Status", R.status(milestone.status)],
        ["Delivers", milestone.outcome ?? "Not recorded"],
        ["Scheduled features", `${done} of ${features.length} complete`],
      ]),
      "",
      // A condition is stored as an object carrying its verdict and the reading
      // that decided it, and was being printed straight into a bullet, which
      // rendered twenty five of them as [object Object]. The control centre
      // normalises the same shape; the command line was never taught to.
      entries.length
        ? R.block(`Entry conditions (${entryMet} of ${entries.length} met)`,
            entries.map((c) => `  [${c.met ? "met" : "not met"}] ${c.condition}`).join("\n"))
        : null,
      R.block(`Exit conditions (${met} of ${exits.length} met)`, exits.length
        ? exits.map((c) => R.stitch([
            `  [${c.met ? "met" : "not met"}] ${c.condition}`,
            c.reading ? R.wrap(c.reading, R.WIDTH, "      ") : null,
            c.check ? `      Decided again by: ${c.check}` : null,
          ])).join("\n")
        : "  None recorded, so nothing says when this is reached."),
      R.block(`Scheduled features (${features.length})`, features.length
        ? R.bullets(features.map((f) => `${f.id}  ${f.name}  [${R.status(f.status)}]`))
        : "  Nothing is scheduled into it."),
    ]),
  };
}

// ----------------------------------------------------------------- features

export async function featureList(root, { module: moduleId = null, status = null } = {}) {
  const where = [];
  const params = [];
  if (moduleId) { where.push("f.module_id = ?"); params.push(moduleId); }
  if (status) { where.push("f.status = ?"); params.push(status); }
  const rows = await query(root, (db) => db.all(
    `SELECT f.*, m.name AS module,
            (SELECT COUNT(*) FROM feature_acceptance_criteria c WHERE c.feature_id = f.id) AS criteria,
            (SELECT COUNT(*) FROM feature_acceptance_criteria c WHERE c.feature_id = f.id AND c.status = 'met') AS met
       FROM features f LEFT JOIN modules m ON m.id = f.module_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY f.id`, ...params));
  if (!rows.length) return { data: { features: [] }, text: nothing("features") };
  return {
    data: { features: rows },
    text: R.stitch([
      R.heading(`Features (${rows.length})`),
      R.table(["Id", "Name", "Module", "Depth", "Criteria met", "Status"],
        rows.map((f) => [f.id, f.name, f.module ?? "", f.spec_depth ?? "", `${f.met} of ${f.criteria}`, R.status(f.status)])),
    ]),
  };
}

export async function featureShow(root, id) {
  const found = await query(root, async (db) => {
    const feature = await db.get("SELECT * FROM features WHERE id = ?", id);
    if (!feature) return null;
    return {
      feature,
      module: feature.module_id ? await db.get("SELECT id, name FROM modules WHERE id = ?", feature.module_id) : null,
      milestone: feature.milestone_id ? await db.get("SELECT id, name FROM milestones WHERE id = ?", feature.milestone_id) : null,
      goals: await db.all(
        `SELECT g.id, g.name FROM goals g JOIN feature_goals fg ON fg.goal_id = g.id WHERE fg.feature_id = ?`, id),
      criteria: await db.all("SELECT * FROM feature_acceptance_criteria WHERE feature_id = ? ORDER BY sequence", id),
      workflows: await db.all("SELECT id, name, status FROM workflows WHERE feature_id = ? ORDER BY id", id),
      tasks: await db.all("SELECT id, name, status FROM tasks WHERE feature_id = ? ORDER BY id", id),
      plans: await db.all("SELECT id, name, status FROM test_plans WHERE feature_id = ? ORDER BY id", id),
    };
  });
  if (!found) throw new Error(`There is no feature ${id}.`);
  const { feature, module, milestone, goals, criteria, workflows, tasks, plans } = found;
  return {
    data: found,
    text: R.stitch([
      R.heading(`${feature.name}  ${feature.id}`),
      R.pairs([
        ["Status", R.status(feature.status)],
        ["Declared depth", feature.spec_depth ?? "not set"],
        ["Module", module ? `${module.name} (${module.id})` : "None"],
        ["Milestone", milestone ? `${milestone.name} (${milestone.id})` : "Not scheduled"],
        ["Goals served", list(goals.map((g) => g.id)) ?? "None"],
        ["Purpose", feature.purpose ?? "Not recorded"],
        ["Who wants it", feature.user_statement ?? "Not recorded"],
      ]),
      "",
      R.block(`Acceptance criteria (${criteria.length})`, criteria.length
        ? R.bullets(criteria.map((c) => `[${R.status(c.status)}] ${c.criterion}`))
        : "  None, so nothing says what done means."),
      workflows.length ? R.block(`Workflows (${workflows.length})`, R.bullets(workflows.map((w) => `${w.id}  ${w.name}`))) : null,
      plans.length ? R.block(`Test plans (${plans.length})`, R.bullets(plans.map((p) => `${p.id}  ${p.name}  [${R.status(p.status)}]`))) : null,
      R.block(`Tasks (${tasks.length})`, tasks.length
        ? R.bullets(tasks.map((t) => `${t.id}  ${t.name}  [${R.status(t.status)}]`))
        : "  None derived yet."),
    ]),
  };
}

// ---------------------------------------------------------------- workflows

export async function workflowList(root) {
  const rows = await query(root, (db) => db.all(
    `SELECT w.*, f.name AS feature,
            (SELECT COUNT(*) FROM workflow_steps s WHERE s.workflow_id = w.id) AS steps
       FROM workflows w LEFT JOIN features f ON f.id = w.feature_id ORDER BY w.id`));
  if (!rows.length) return { data: { workflows: [] }, text: nothing("workflows") };
  return {
    data: { workflows: rows },
    text: R.stitch([
      R.heading(`Workflows (${rows.length})`),
      R.table(["Id", "Name", "Steps", "Status"],
        rows.map((w) => [w.id, w.name, String(w.steps), R.status(w.status)])),
    ]),
  };
}

export async function workflowShow(root, id) {
  const found = await query(root, async (db) => {
    const workflow = await db.get("SELECT * FROM workflows WHERE id = ?", id);
    if (!workflow) return null;
    return {
      workflow,
      feature: workflow.feature_id ? await db.get("SELECT id, name FROM features WHERE id = ?", workflow.feature_id) : null,
      steps: await db.all("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY sequence", id),
    };
  });
  if (!found) throw new Error(`There is no workflow ${id}.`);
  const { workflow, feature, steps } = found;
  return {
    data: found,
    text: R.stitch([
      R.heading(`${workflow.name}  ${workflow.id}`),
      R.pairs([
        ["Status", R.status(workflow.status)],
        ["Feature", feature ? `${feature.name} (${feature.id})` : "None"],
        ["Trigger", workflow.trigger ?? "Not recorded"],
        ["Complete when", workflow.completion_criteria ?? "Not recorded"],
      ]),
      "",
      R.heading(`Steps (${steps.length})`),
      steps.length
        ? steps.map((s) => R.stitch([
            `${s.sequence}. ${s.action}`,
            R.wrap(`Expected: ${s.expected_result ?? "not recorded"}`, R.WIDTH, "   "),
            s.failure_behavior ? R.wrap(`On failure: ${s.failure_behavior}`, R.WIDTH, "   ") : null,
          ])).join("\n")
        : R.wrap("No steps recorded, so following this workflow proves nothing."),
    ]),
  };
}

// ------------------------------------------------------------- architecture

export async function architectureShow(root) {
  const a = await query(root, async (db) => ({
    pieces: await db.all("SELECT * FROM runtime_pieces ORDER BY sequence, id"),
    edges: await db.all("SELECT * FROM runtime_piece_edges"),
    modules: await db.all("SELECT id, name, status FROM modules ORDER BY sequence, id"),
    integrations: await db.all("SELECT id, name, purpose, configuration_status FROM integrations ORDER BY id"),
  }));
  const nameOf = new Map(a.pieces.map((p) => [p.id, p.name]));
  return {
    data: a,
    text: R.stitch([
      R.heading(`Runtime pieces (${a.pieces.length})`),
      a.pieces.length
        ? R.table(["Name", "Runs where", "Shown by"],
            a.pieces.map((p) => [p.name, p.runs_where ?? "", p.evidence_ref ?? ""]))
        : R.wrap("Nothing recorded, so the architecture is undescribed."),
      "",
      R.block(`Connections (${a.edges.length})`, a.edges.length
        ? R.bullets(a.edges.map((e) => `${nameOf.get(e.from_piece_id) ?? e.from_piece_id} to ${nameOf.get(e.to_piece_id) ?? e.to_piece_id}: ${e.protocol ?? "unspecified"}`))
        : "  None recorded."),
      R.block(`Modules (${a.modules.length})`, R.bullets(a.modules.map((m) => `${m.id}  ${m.name}`))),
      R.block(`Integrations (${a.integrations.length})`, a.integrations.length
        ? R.bullets(a.integrations.map((i) => `${i.name} [${R.status(i.configuration_status)}]: ${i.purpose ?? ""}`))
        : "  None recorded."),
    ]),
  };
}

// ------------------------------------------------------------------- schema

export async function schemaShow(root, { entity = null } = {}) {
  if (entity) {
    const found = await query(root, async (db) => {
      const e = await db.get("SELECT * FROM data_entities WHERE id = ? OR name = ?", entity, entity);
      if (!e) return null;
      return {
        entity: e,
        fields: await db.all("SELECT * FROM data_fields WHERE entity_id = ? ORDER BY sequence", e.id),
        out: await db.all(
          `SELECT r.*, t.name AS target FROM data_relationships r
             JOIN data_entities t ON t.id = r.to_entity_id WHERE r.from_entity_id = ?`, e.id),
        in: await db.all(
          `SELECT r.*, s.name AS source FROM data_relationships r
             JOIN data_entities s ON s.id = r.from_entity_id WHERE r.to_entity_id = ?`, e.id),
      };
    });
    if (!found) throw new Error(`There is no data entity ${entity}.`);
    return {
      data: found,
      text: R.stitch([
        R.heading(`${found.entity.name}  ${found.entity.id}`),
        R.pairs([
          ["Status", R.status(found.entity.status)],
          ["Purpose", found.entity.purpose ?? "Not recorded"],
          ["Stored in", found.entity.store ?? "Nowhere yet"],
        ]),
        "",
        found.fields.length
          ? R.table(["Field", "Type", "Nullable", "Sensitivity"],
              found.fields.map((f) => [f.name, f.type, f.nullable ? "yes" : "no", f.sensitivity_class]))
          : R.wrap(found.entity.status === "planned"
              ? "No table exists for this yet, so it has no fields."
              : "No fields recorded."),
        found.out.length ? R.block("Points at", R.bullets(found.out.map((r) => `${r.name} to ${r.target} (${r.cardinality})`))) : null,
        found.in.length ? R.block("Pointed at by", R.bullets(found.in.map((r) => `${r.source}.${r.name} (${r.cardinality})`))) : null,
      ]),
    };
  }

  const s = await query(root, async (db) => ({
    entities: await db.all(
      `SELECT e.*, (SELECT COUNT(*) FROM data_fields f WHERE f.entity_id = e.id) AS fields
         FROM data_entities e ORDER BY e.name`),
    relationships: (await db.get("SELECT COUNT(*) n FROM data_relationships")).n,
    migrations: await db.all("SELECT version, name FROM applied_migrations ORDER BY version"),
  }));
  return {
    data: s,
    text: R.stitch([
      R.heading(`Data entities (${s.entities.length})`),
      s.entities.length
        ? R.table(["Id", "Name", "Fields", "Status"],
            s.entities.map((e) => [e.id, e.name, String(e.fields), R.status(e.status)]))
        : R.wrap("Nothing recorded."),
      "",
      R.pairs([
        ["Relationships", String(s.relationships)],
        ["Migrations applied", String(s.migrations.length)],
        ["Schema version", String(s.migrations.at(-1)?.version ?? 0)],
      ]),
      R.wrap("Pass an entity name or id to see its fields and relationships."),
    ]),
  };
}

// ---------------------------------------------------------------------- api

export async function apiShow(root) {
  const a = await query(root, async (db) => ({
    services: await db.all("SELECT * FROM api_services ORDER BY sequence, id"),
    operations: await db.all(
      `SELECT o.*, m.name AS module FROM api_operations o
         LEFT JOIN modules m ON m.id = o.module_id ORDER BY o.name`),
  }));
  const byService = new Map();
  for (const op of a.operations) {
    const key = op.api_service_id ?? "(no service)";
    if (!byService.has(key)) byService.set(key, []);
    byService.get(key).push(op);
  }
  return {
    data: a,
    text: R.stitch([
      R.heading(`API operations (${a.operations.length})`),
      a.operations.length
        ? R.table(["Name", "Style", "Changes state", "Status"],
            a.operations.slice(0, 60).map((o) => [
              o.name, o.style, o.side_effects_json && o.side_effects_json !== "[]" ? "yes" : "no", R.status(o.status)]))
        : R.wrap("Nothing recorded."),
      a.operations.length > 60 ? R.wrap(`Showing the first 60 of ${a.operations.length}. Use --json for all of them.`) : null,
      "",
      R.block(`Services (${a.services.length})`, a.services.length
        ? R.bullets(a.services.map((s) => `${s.id}  ${s.name}  ${count(byService.get(s.id)?.length ?? 0, "operation")}`))
        : "  None recorded, so every operation is loose rather than grouped under a boundary."),
    ]),
  };
}

// -------------------------------------------------------------- integrations

export async function integrationList(root) {
  const rows = await query(root, (db) => db.all(
    `SELECT i.*, m.name AS module FROM integrations i
       LEFT JOIN modules m ON m.id = i.module_id ORDER BY i.name`));
  if (!rows.length) return { data: { integrations: [] }, text: nothing("integrations") };
  return {
    data: { integrations: rows },
    text: R.stitch([
      R.heading(`Integrations (${rows.length})`),
      R.table(["Id", "Name", "Configured", "Verified"],
        rows.map((i) => [i.id, i.name, R.status(i.configuration_status), R.status(i.verification_status)])),
      "",
      R.block("What happens when one is absent", R.bullets(
        rows.filter((i) => i.failure_behavior).slice(0, 8).map((i) => `${i.name}: ${i.failure_behavior}`))),
    ]),
  };
}
