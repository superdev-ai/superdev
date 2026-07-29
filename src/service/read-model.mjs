// One function per GET route in MODULE_CONTRACT.md.
//
// The control center reads nothing but these payloads and never touches the
// filesystem, so every question a screen asks has to be answerable from here.
// Each function opens one readonly connection, builds its whole payload inside
// it, and stamps the revision it was built from. Two payloads never disagree
// because each is a single pinned snapshot.
//
// Progress is never recomputed here. It comes from ../progress/index.mjs, which
// the CLI also uses, so the number in the terminal is the number in the browser.

import {
  query,
  json,
  DbError,
} from "../db/store.mjs";
import {
  featureProgress,
  moduleProgress,
  milestoneProgress,
  goalProgress,
  projectProgress,
  readiness,
  freshness,
  nextAction,
  alignmentWarnings,
  honestPercent,
  SESSION_STALE_MS,
} from "../progress/index.mjs";
import { MODULE_STEPS, agrees, count, titleCase, AMBIENT_EVENTS } from "../model/vocabulary.mjs";

const marks = (n) => Array.from({ length: n }, () => "?").join(",");
const nowIso = () => new Date().toISOString();

/** A session quiet for longer than this is Idle rather than Live. */
const LIVE_WITHIN_MS = 5 * 60 * 1000;

/** How many plain-language lines the overview lists before it stops. */
const OVERVIEW_LINES = 8;

/**
 * Every `*_json` column is stored as text and consumed as structured data. The
 * interface types declare arrays and objects, so the parse happens once here
 * rather than in every component.
 */
function hydrate(row) {
  if (!row) return row ?? null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = key.endsWith("_json") ? json(value, null) : value;
  }
  return out;
}

const hydrateAll = (rows) => rows.map(hydrate);

/**
 * The progress shape the interface renders.
 *
 * `counts` is the NOUN the totals are counted in, because the interface builds
 * "5 of 47 readiness items addressed" from it and then pluralizes it. The
 * per-component breakdown travels separately as a list: joining the breakdown
 * into this field produced a run-on headline with a pluralizing "s" stuck on
 * the end of the last sentence, which is what the lists are for avoiding.
 */
function toProgress(p) {
  return {
    ...p,
    counts: p.unit ?? "tracked item",
    countsBreakdown: p.whatCounts ?? [],
    remainsBreakdown: p.whatRemains ?? [],
    // Joined with a space, three clauses ran together as one unreadable line:
    // "Accepted features delivered: 1 outstanding Milestones reached: 2
    // outstanding Goal success criteria met: 2 outstanding".
    remains: p.whatRemains?.length ? p.whatRemains.join("; ") : null,
    computedAt: p.generatedAt,
  };
}

async function revisionOf(db) {
  return (await db.value("SELECT max(sequence) FROM activity_events")) ?? 0;
}

async function projectOf(db) {
  const project = await db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
  if (!project) {
    throw new DbError(
      "E_NOT_FOUND",
      "This directory has no Superdev project yet. Run `superdev init` in the project root, then reload.",
    );
  }
  return project;
}

/**
 * Run one read and wrap it in the freshness envelope. The revision is read from
 * the same pinned snapshot the payload came from, so it always describes
 * exactly the data that is being returned.
 */
async function envelope(root, build) {
  return query(root, async (db) => {
    const project = await projectOf(db);
    const data = await build(db, project);
    const revision = await revisionOf(db);
    return {
      data,
      meta: {
        revision,
        lastEventSequence: revision,
        generatedAt: nowIso(),
        // A fresh connection per read is pinned to the present, so a payload
        // that was just built cannot already lag the database.
        stale: false,
      },
    };
  });
}

/** Saved canvas positions for one blueprint surface. */
async function layoutFor(db, projectId, canvas) {
  const rows = await db.all(
    "SELECT * FROM layout_positions WHERE project_id = ? AND canvas = ?",
    projectId,
    canvas,
  );
  return rows.map((r) => ({ id: r.record_id, recordType: r.record_type, x: r.x, y: r.y }));
}

/** The primary flow lives in its own table, so features carry it as a list. */
async function flowsByFeature(db, featureIds) {
  const map = new Map(featureIds.map((id) => [id, []]));
  if (!featureIds.length) return map;
  const rows = await db.all(
    `SELECT * FROM feature_flows WHERE feature_id IN (${marks(featureIds.length)})
      ORDER BY feature_id, sequence`,
    ...featureIds,
  );
  for (const row of rows) map.get(row.feature_id)?.push(row.step);
  return map;
}

// ------------------------------------------------------------------ overview

export function overview(root) {
  return envelope(root, async (db, project) => {
    const [progress, fresh, next, warnings] = [
      await projectProgress(db, project.id),
      await freshness(db, project.id),
      await nextAction(db, project.id),
      await alignmentWarnings(db, project.id),
    ];

    const features = hydrateAll(await db.all("SELECT * FROM features WHERE project_id = ?", project.id));
    const tasks = await db.all("SELECT * FROM tasks WHERE project_id = ?", project.id);
    const milestones = await db.all("SELECT * FROM milestones WHERE project_id = ?", project.id);
    const questions = await db.all(
      "SELECT * FROM questions WHERE project_id = ? AND status = 'open'",
      project.id,
    );

    const liveFeatures = features.filter((f) => !["cancelled", "superseded"].includes(f.status));
    const openTasks = tasks.filter((t) => !["complete", "cancelled", "superseded"].includes(t.status));
    const inFlight = openTasks.filter((t) => ["in_progress", "in_review", "verifying"].includes(t.status));
    const blockedTasks = openTasks.filter((t) => t.status === "blocked");

    const headline = [
      { label: "Features in scope", value: liveFeatures.length, unit: "feature", href: "#/product" },
      {
        label: "Features complete",
        value: liveFeatures.filter((f) => f.status === "complete").length,
        unit: "feature",
        href: "#/product",
      },
      { label: "Work in progress", value: inFlight.length, unit: "task", href: "#/tasks" },
      { label: "Blocked", value: blockedTasks.length, unit: "task", href: "#/tasks" },
      { label: "Open tasks", value: openTasks.length, unit: "task", href: "#/tasks" },
      { label: "Open questions", value: questions.length, unit: "question", href: "#/discovery" },
      {
        label: "Milestones reached",
        value: milestones.filter((m) => ["complete", "accepted", "delivered"].includes(m.status)).length,
        unit: "milestone",
        href: "#/product",
      },
    ];

    const whatWorks = [];
    for (const feature of liveFeatures) {
      if (feature.what_works_now) whatWorks.push(`${feature.name}: ${feature.what_works_now}`);
      else if (feature.status === "complete") whatWorks.push(`${feature.name} is complete.`);
      if (whatWorks.length >= OVERVIEW_LINES) break;
    }

    const whatIsBlocked = blockedTasks
      .slice(0, OVERVIEW_LINES)
      .map((t) => `${t.name}: ${t.block_reason ?? "blocked with no reason recorded."}`);
    for (const warning of warnings) {
      if (whatIsBlocked.length >= OVERVIEW_LINES) break;
      if (warning.severity === "high") whatIsBlocked.push(`${warning.title}: ${warning.detail}`);
    }

    const activeWork = await activeWorkItems(db, inFlight, features);

    return {
      project: hydrate(project),
      headline,
      whatWorks,
      whatIsBlocked,
      activeWork,
      nextAction: {
        ...next,
        summary: next.title,
        reason: next.detail,
        targetType: next.recordType,
        targetId: next.recordId,
        href: hrefFor(next.recordType, next.recordId),
      },
      warnings,
      progress: toProgress(progress),
      // Two series the overview draws, computed here because the interface must not
      // do arithmetic on records it cannot see all of.
      //
      // Movement over time answers a question no count answers: whether the project
      // is going anywhere. A project can read 40 percent for a month and the figure
      // alone never says so. Ambient events are excluded for the same reason they do
      // not move the content revision: a note that files changed is not the project
      // moving.
      activity: await dailyActivity(db, project.id),
      // The distribution of open work, so a wall of "3 blocked" reads as a shape.
      // Terminal states are separate from open ones because mixing them makes a
      // finished project look busy.
      taskShape: [
        { state: "in_progress", label: "In Progress", count: inFlight.length },
        { state: "blocked", label: "Blocked", count: blockedTasks.length },
        { state: "ready", label: "Ready", count: openTasks.filter((t) => t.status === "ready").length },
        { state: "draft", label: "Draft", count: openTasks.filter((t) => t.status === "draft").length },
        { state: "paused", label: "Paused", count: openTasks.filter((t) => t.status === "paused").length },
        { state: "complete", label: "Complete", count: tasks.filter((t) => t.status === "complete").length },
      ].filter((slice) => slice.count > 0),
      freshness: {
        ...fresh,
        databaseRevision: fresh.revision,
        activeSessionHeartbeatAt: fresh.lastSessionHeartbeatAt,
        branchHead: fresh.branches[0]?.headRevision ?? null,
        staleEvidenceCount: fresh.staleEvidence.length,
        pendingDocProposalCount: fresh.pendingDocumentProposals.length,
      },
    };
  });
}

/**
 * How many things happened on each of the last fourteen days.
 *
 * Fourteen because a fortnight covers a working rhythm without turning the shape
 * into noise, and because a day with nothing in it is itself a reading: a flat run
 * says the project has stopped, which no total can tell you.
 *
 * Every day in the window is present even when nothing happened, so the gaps are
 * visible rather than compressed away. Counting only days that have rows would draw
 * a busy line over a quiet fortnight.
 */
async function dailyActivity(db, projectId, days = 14) {
  const rows = await db.all(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM activity_events
      WHERE project_id = ?
        AND event_type NOT LIKE 'documentation_%'
        AND event_type NOT IN (${AMBIENT_EVENTS.map(() => "?").join(", ")})
      GROUP BY day ORDER BY day DESC LIMIT ?`,
    projectId, ...AMBIENT_EVENTS, days,
  );
  const byDay = new Map(rows.map((r) => [r.day, Number(r.n)]));
  const series = [];
  const cursor = new Date();
  for (let back = days - 1; back >= 0; back -= 1) {
    const at = new Date(cursor.getTime() - back * 24 * 60 * 60 * 1000);
    const day = at.toISOString().slice(0, 10);
    series.push({ day, count: byDay.get(day) ?? 0 });
  }
  return series;
}

function hrefFor(recordType, recordId) {
  if (!recordType || !recordId) return null;
  const route = {
    task: "#/tasks",
    feature: "#/features",
    module: "#/product",
    milestone: "#/product",
    goal: "#/product",
    question: "#/discovery",
    decision: "#/decisions",
    verification_evidence: "#/tasks",
    feature_acceptance_criterion: "#/features",
  }[recordType];
  return route ? `${route}/${recordId}` : null;
}

async function activeWorkItems(db, tasks, features) {
  if (!tasks.length) return [];
  const featureName = new Map(features.map((f) => [f.id, f.name]));
  const assignments = await db.all(
    `SELECT * FROM task_assignments WHERE active = 1 AND task_id IN (${marks(tasks.length)})`,
    ...tasks.map((t) => t.id),
  );
  const byTask = new Map(assignments.map((a) => [a.task_id, a]));
  const developers = new Map(
    (await db.all("SELECT * FROM developers")).map((d) => [d.id, d.display_name]),
  );
  const agents = new Map(
    (await db.all("SELECT * FROM agents")).map((a) => [a.id, a.model_label ?? a.harness]),
  );
  const branches = new Map((await db.all("SELECT * FROM branches")).map((b) => [b.id, b.name]));
  const sessions = await db.all("SELECT * FROM work_sessions WHERE status = 'active'");
  const sessionByTask = new Map(sessions.filter((s) => s.active_task_id).map((s) => [s.active_task_id, s]));

  return tasks.map((task) => {
    const assignment = byTask.get(task.id);
    const session = sessionByTask.get(task.id);
    return {
      taskId: task.id,
      taskName: task.name,
      featureId: task.feature_id,
      featureName: featureName.get(task.feature_id) ?? null,
      status: task.status,
      actor:
        (assignment && (developers.get(assignment.developer_id) ?? agents.get(assignment.agent_id))) ??
        null,
      branch: assignment ? branches.get(assignment.branch_id) ?? null : null,
      startedAt: task.started_at,
      lastActivityAt: session?.last_activity_at ?? task.updated_at,
    };
  });
}

// ----------------------------------------------------------------- discovery

export function discovery(root) {
  return envelope(root, async (db, project) => {
    const items = hydrateAll(
      await db.all(
        "SELECT * FROM discovery_items WHERE project_id = ? ORDER BY created_at, id",
        project.id,
      ),
    );
    const ids = items.map((i) => i.id);
    const links = ids.length
      ? await db.all(
          `SELECT * FROM discovery_links WHERE from_id IN (${marks(ids.length)})`,
          ...ids,
        )
      : [];

    return {
      sources: hydrateAll(
        await db.all(
          "SELECT * FROM source_material WHERE project_id = ? ORDER BY received_at, id",
          project.id,
        ),
      ),
      items,
      links,
      questions: hydrateAll(
        await db.all("SELECT * FROM questions WHERE project_id = ? ORDER BY created_at, id", project.id),
      ),
      assumptions: items.filter((i) => i.kind === "assumption"),
      risks: items.filter((i) => i.kind === "risk"),
      // A concept dragged on the mind map keeps its position on the item row;
      // the layout table covers records that have no position of their own.
      layout: [
        ...items
          .filter((i) => i.position_x !== null && i.position_y !== null)
          .map((i) => ({ id: i.id, recordType: "discovery_item", x: i.position_x, y: i.position_y })),
        ...(await layoutFor(db, project.id, "discovery")),
      ],
    };
  });
}

// ------------------------------------------------------------------- product

export function product(root) {
  return envelope(root, async (db, project) => {
    const goals = hydrateAll(
      await db.all("SELECT * FROM goals WHERE project_id = ? ORDER BY sequence, id", project.id),
    );
    const milestones = hydrateAll(
      await db.all("SELECT * FROM milestones WHERE project_id = ? ORDER BY sequence, id", project.id),
    );
    const modules = hydrateAll(
      await db.all("SELECT * FROM modules WHERE project_id = ? ORDER BY sequence, id", project.id),
    );
    const features = hydrateAll(
      await db.all("SELECT * FROM features WHERE project_id = ? ORDER BY module_id, name", project.id),
    );

    const criteria = goals.length
      ? await db.all(
          `SELECT * FROM goal_success_criteria WHERE goal_id IN (${marks(goals.length)})
            ORDER BY goal_id, sequence`,
          ...goals.map((g) => g.id),
        )
      : [];
    const featureGoals = await db.all("SELECT * FROM feature_goals");
    const flows = await flowsByFeature(db, features.map((f) => f.id));
    const scope = await db.all(
      "SELECT * FROM project_scope_items WHERE project_id = ? ORDER BY direction, sequence",
      project.id,
    );

    return {
      goals: await Promise.all(
        goals.map(async (goal) => ({
          ...goal,
          successCriteria: criteria.filter((c) => c.goal_id === goal.id),
          progress: toProgress(await goalProgress(db, goal.id)),
        })),
      ),
      milestones: await Promise.all(
        milestones.map(async (m) => ({ ...m, progress: toProgress(await milestoneProgress(db, m.id)) })),
      ),
      modules: await Promise.all(
        modules.map(async (m) => ({ ...m, progress: toProgress(await moduleProgress(db, m.id)) })),
      ),
      features: await Promise.all(
        features.map(async (f) => ({
          ...f,
          primary_flow_json: flows.get(f.id) ?? [],
          goalIds: featureGoals.filter((fg) => fg.feature_id === f.id).map((fg) => fg.goal_id),
          progress: toProgress(await featureProgress(db, f.id)),
        })),
      ),
      scope,
      // The blueprint canvas draws from this payload and reads its saved
      // positions out of `layout`. Without this the canvas asked for a layout
      // on every load, always got nothing, and every arrangement anyone made
      // was lost on refresh.
      layout: await layoutFor(db, project.id, "blueprint"),
      progress: toProgress(await projectProgress(db, project.id)),
    };
  });
}

// ------------------------------------------------------------ feature detail

export function feature(root, featureId) {
  return envelope(root, async (db) => {
    const row = await db.get("SELECT * FROM features WHERE id = ?", featureId);
    if (!row) {
      throw new DbError("E_NOT_FOUND", `There is no feature ${featureId}. Check the id, or open the Product view to pick one.`);
    }
    const record = hydrate(row);
    const flows = await flowsByFeature(db, [featureId]);

    const workflows = hydrateAll(
      await db.all("SELECT * FROM workflows WHERE feature_id = ? ORDER BY name", featureId),
    );
    const surfaces = hydrateAll(
      await db.all("SELECT * FROM surfaces WHERE feature_id = ? ORDER BY name", featureId),
    );
    const uiActions = surfaces.length
      ? hydrateAll(
          await db.all(
            `SELECT * FROM ui_actions WHERE surface_id IN (${marks(surfaces.length)}) ORDER BY surface_id, name`,
            ...surfaces.map((s) => s.id),
          ),
        )
      : [];
    const surfaceStates = surfaces.length
      ? await db.all(
          `SELECT * FROM surface_states WHERE surface_id IN (${marks(surfaces.length)})`,
          ...surfaces.map((s) => s.id),
        )
      : [];

    const goalIds = (await db.all("SELECT * FROM feature_goals WHERE feature_id = ?", featureId)).map(
      (fg) => fg.goal_id,
    );

    const migrations = await db.all(
      "SELECT * FROM schema_migrations WHERE feature_id = ? ORDER BY sequence",
      featureId,
    );

    return {
      feature: { ...record, primary_flow_json: flows.get(featureId) ?? [], goalIds },
      module: hydrate(await db.get("SELECT * FROM modules WHERE id = ?", record.module_id)),
      milestone: record.milestone_id
        ? hydrate(await db.get("SELECT * FROM milestones WHERE id = ?", record.milestone_id))
        : null,
      goals: goalIds.length
        ? hydrateAll(await db.all(`SELECT * FROM goals WHERE id IN (${marks(goalIds.length)})`, ...goalIds))
        : [],
      acceptanceCriteria: await db.all(
        "SELECT * FROM feature_acceptance_criteria WHERE feature_id = ? ORDER BY sequence",
        featureId,
      ),
      edgeCases: await db.all(
        "SELECT * FROM feature_edge_cases WHERE feature_id = ? ORDER BY category",
        featureId,
      ),
      workflows,
      surfaces,
      surfaceStates,
      uiActions,
      apiOperations: hydrateAll(
        await db.all("SELECT * FROM api_operations WHERE feature_id = ? ORDER BY name", featureId),
      ),
      dataEntities: hydrateAll(
        await db.all("SELECT * FROM data_entities WHERE feature_id = ? ORDER BY name", featureId),
      ),
      migrations,
      integrations: hydrateAll(
        await db.all("SELECT * FROM integrations WHERE feature_id = ? ORDER BY name", featureId),
      ),
      jobs: hydrateAll(await db.all("SELECT * FROM jobs WHERE feature_id = ? ORDER BY name", featureId)),
      webhooks: hydrateAll(
        await db.all("SELECT * FROM webhooks WHERE feature_id = ? ORDER BY name", featureId),
      ),
      nfrs: await db.all(
        "SELECT * FROM non_functional_requirements WHERE feature_id = ? ORDER BY category",
        featureId,
      ),
      decisions: hydrateAll(
        await db.all(
          `SELECT d.* FROM decisions d
             WHERE (d.scope_type = 'feature' AND d.scope_id = ?)
                OR d.id IN (SELECT decision_id FROM decision_links
                             WHERE target_type = 'feature' AND target_id = ?)
             ORDER BY d.created_at`,
          featureId,
          featureId,
        ),
      ),
      tasks: hydrateAll(
        await db.all("SELECT * FROM tasks WHERE feature_id = ? ORDER BY sequence, id", featureId),
      ),
      evidence: await db.all(
        "SELECT * FROM verification_evidence WHERE feature_id = ? ORDER BY recorded_at DESC",
        featureId,
      ),
      progress: toProgress(await featureProgress(db, featureId)),
    };
  });
}

// ----------------------------------------------------------------- workflows

export function workflows(root) {
  return envelope(root, async (db, project) => {
    const rows = hydrateAll(
      await db.all(
        `SELECT w.* FROM workflows w
           JOIN features f ON f.id = w.feature_id
          WHERE f.project_id = ? ORDER BY w.name`,
        project.id,
      ),
    );
    const ids = rows.map((w) => w.id);

    const actorRows = ids.length
      ? await db.all(
          `SELECT * FROM workflow_actors WHERE workflow_id IN (${marks(ids.length)}) ORDER BY workflow_id, sequence`,
          ...ids,
        )
      : [];
    const steps = ids.length
      ? await db.all(
          `SELECT * FROM workflow_steps WHERE workflow_id IN (${marks(ids.length)}) ORDER BY workflow_id, sequence`,
          ...ids,
        )
      : [];
    const branches = ids.length
      ? await db.all(`SELECT * FROM workflow_branches WHERE workflow_id IN (${marks(ids.length)})`, ...ids)
      : [];

    // The execution overlay: which tasks claim to implement each step.
    const stepLinks = await db.all(
      "SELECT * FROM task_contract_links WHERE target_type = 'workflow_step'",
    );
    const tasksByStep = new Map();
    for (const link of stepLinks) {
      if (!tasksByStep.has(link.target_id)) tasksByStep.set(link.target_id, []);
      tasksByStep.get(link.target_id).push(link.task_id);
    }
    const taskStatus = new Map(
      (await db.all("SELECT id, status FROM tasks WHERE project_id = ?", project.id)).map((t) => [
        t.id,
        t.status,
      ]),
    );

    const machines = await db.all(
      `SELECT * FROM state_machines
        WHERE module_id IN (SELECT id FROM modules WHERE project_id = ?)
           OR feature_id IN (SELECT id FROM features WHERE project_id = ?)`,
      project.id,
      project.id,
    );
    const machineIds = machines.map((m) => m.id);

    return {
      workflows: rows.map((w) => ({
        ...w,
        actors_json: actorRows.filter((a) => a.workflow_id === w.id).map((a) => a.actor),
      })),
      steps: steps.map((s) => ({
        ...s,
        taskIds: tasksByStep.get(s.id) ?? [],
        taskStatuses: (tasksByStep.get(s.id) ?? []).map((id) => taskStatus.get(id) ?? "unknown"),
      })),
      branches,
      actors: [...new Set(actorRows.map((a) => a.actor))].sort(),
      stateMachines: machines,
      states: machineIds.length
        ? hydrateAll(
            await db.all(
              `SELECT * FROM states WHERE state_machine_id IN (${marks(machineIds.length)}) ORDER BY state_machine_id, sequence`,
              ...machineIds,
            ),
          )
        : [],
      transitions: machineIds.length
        ? await db.all(
            `SELECT * FROM state_transitions WHERE state_machine_id IN (${marks(machineIds.length)})`,
            ...machineIds,
          )
        : [],
      layout: await layoutFor(db, project.id, "workflow"),
    };
  });
}

// ---------------------------------------------------------------------- data

export function data(root) {
  return envelope(root, async (db, project) => {
    const entities = hydrateAll(
      await db.all(
        `SELECT e.* FROM data_entities e
           JOIN modules m ON m.id = e.module_id
          WHERE m.project_id = ? ORDER BY e.name`,
        project.id,
      ),
    );
    const ids = entities.map((e) => e.id);

    return {
      entities,
      fields: ids.length
        ? hydrateAll(
            await db.all(
              `SELECT * FROM data_fields WHERE entity_id IN (${marks(ids.length)}) ORDER BY entity_id, sequence`,
              ...ids,
            ),
          )
        : [],
      relationships: ids.length
        ? await db.all(
            `SELECT * FROM data_relationships WHERE from_entity_id IN (${marks(ids.length)})`,
            ...ids,
          )
        : [],
      migrations: await db.all(
        "SELECT * FROM schema_migrations WHERE project_id = ? ORDER BY sequence",
        project.id,
      ),
      migrationEntities: await db.all(
        `SELECT * FROM schema_migration_entities
          WHERE migration_id IN (SELECT id FROM schema_migrations WHERE project_id = ?)`,
        project.id,
      ),
      layout: [
        ...entities
          .filter((e) => e.position_x !== null && e.position_y !== null)
          .map((e) => ({ id: e.id, recordType: "data_entity", x: e.position_x, y: e.position_y })),
        ...(await layoutFor(db, project.id, "data")),
      ],
    };
  });
}

// -------------------------------------------------------------- architecture

export function architecture(root) {
  return envelope(root, async (db, project) => {
    const pieces = await db.all(
      "SELECT * FROM runtime_pieces WHERE project_id = ? ORDER BY sequence, name",
      project.id,
    );
    const pieceIds = pieces.map((p) => p.id);
    const edges = pieceIds.length
      ? await db.all(
          `SELECT * FROM runtime_piece_edges WHERE from_piece_id IN (${marks(pieceIds.length)})`,
          ...pieceIds,
        )
      : [];

    const modules = hydrateAll(
      await db.all("SELECT * FROM modules WHERE project_id = ? ORDER BY sequence, id", project.id),
    );
    const dependencies = moduleDependencies(modules);
    const entities = await db.all(
      `SELECT id, name, module_id FROM data_entities
        WHERE module_id IN (SELECT id FROM modules WHERE project_id = ?)`,
      project.id,
    );

    return {
      pieces: pieces.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.runs_where ?? "component",
        purpose: null,
        runsWhere: p.runs_where,
        evidenceRef: p.evidence_ref,
        moduleId: null,
        status: "specified",
      })),
      edges: edges.map((e) => ({
        id: `${e.from_piece_id}->${e.to_piece_id}`,
        from_id: e.from_piece_id,
        to_id: e.to_piece_id,
        relationship: e.protocol ? `talks to over ${e.protocol}` : "talks to",
        protocol: e.protocol,
      })),
      modules: modules.map((m) => ({
        id: m.id,
        name: m.name,
        purpose: m.purpose,
        status: m.status,
        owns: m.owns_json ?? [],
        consumes: m.consumes_json ?? [],
        ownsEntityIds: entities.filter((e) => e.module_id === m.id).map((e) => e.id),
      })),
      moduleDependencies: dependencies,
      criticalPath: criticalPath(modules, dependencies),
      integrations: hydrateAll(
        await db.all(
          `SELECT * FROM integrations
            WHERE module_id IN (SELECT id FROM modules WHERE project_id = ?) ORDER BY name`,
          project.id,
        ),
      ),
      layout: await layoutFor(db, project.id, "architecture"),
    };
  });
}

const normalize = (value) => String(value ?? "").trim().toLowerCase();

/**
 * A module dependency is not stored as an edge. It is implied: one module
 * consumes what another owns. Deriving it keeps the two lists honest, because a
 * consumed thing nobody owns shows up as an absent edge rather than as a lie.
 */
function moduleDependencies(modules) {
  const owners = new Map();
  for (const module of modules) {
    for (const owned of module.owns_json ?? []) {
      const key = normalize(owned);
      if (key) owners.set(key, module.id);
    }
  }
  const out = [];
  const seen = new Set();
  for (const module of modules) {
    for (const consumed of module.consumes_json ?? []) {
      const owner = owners.get(normalize(consumed));
      if (!owner || owner === module.id) continue;
      const key = `${module.id}->${owner}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        from_module_id: module.id,
        to_module_id: owner,
        reason: `${module.name} consumes ${consumed}, which ${
          modules.find((m) => m.id === owner)?.name ?? owner
        } owns.`,
        critical: false,
      });
    }
  }
  return out;
}

/**
 * The longest chain of dependent modules. Anything shorter can be built in
 * parallel with it, so this is the ordering that actually bounds delivery.
 * Cycles are broken rather than followed, because a dependency cycle is a
 * modelling error that must not hang the request.
 */
function criticalPath(modules, dependencies) {
  const out = new Map(modules.map((m) => [m.id, []]));
  for (const dep of dependencies) out.get(dep.from_module_id)?.push(dep.to_module_id);

  const memo = new Map();
  const visiting = new Set();
  const longest = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return [id];
    visiting.add(id);
    let best = [];
    for (const next of out.get(id) ?? []) {
      const chain = longest(next);
      if (chain.length > best.length) best = chain;
    }
    visiting.delete(id);
    const path = [id, ...best];
    memo.set(id, path);
    return path;
  };

  let winner = [];
  for (const module of modules) {
    const path = longest(module.id);
    if (path.length > winner.length) winner = path;
  }
  // A single module is not a path worth drawing.
  const chain = winner.length > 1 ? winner : [];
  const onPath = new Set(chain.map((id, i) => `${id}->${chain[i + 1]}`));
  for (const dep of dependencies) {
    if (onPath.has(`${dep.from_module_id}->${dep.to_module_id}`)) dep.critical = true;
  }
  return chain;
}

// --------------------------------------------------------------------- tasks

export function tasks(root) {
  return envelope(root, async (db, project) => {
    const rows = hydrateAll(
      await db.all("SELECT * FROM tasks WHERE project_id = ? ORDER BY sequence, id", project.id),
    );
    const ids = rows.map((t) => t.id);

    const categories = await db.all(
      "SELECT * FROM task_categories WHERE project_id = ? ORDER BY sequence, name",
      project.id,
    );
    const contractLinks = ids.length
      ? await db.all(`SELECT * FROM task_contract_links WHERE task_id IN (${marks(ids.length)})`, ...ids)
      : [];
    const dependencies = ids.length
      ? await db.all(`SELECT * FROM task_dependencies WHERE task_id IN (${marks(ids.length)})`, ...ids)
      : [];
    const assignments = ids.length
      ? await db.all(
          `SELECT * FROM task_assignments WHERE task_id IN (${marks(ids.length)}) ORDER BY assigned_at DESC`,
          ...ids,
        )
      : [];
    const evidence = await db.all(
      "SELECT * FROM verification_evidence WHERE project_id = ? ORDER BY recorded_at DESC",
      project.id,
    );

    const featureName = new Map(
      (await db.all("SELECT id, name FROM features WHERE project_id = ?", project.id)).map((f) => [
        f.id,
        f.name,
      ]),
    );
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const activeAssignment = new Map(assignments.filter((a) => a.active).map((a) => [a.task_id, a]));
    const children = new Map();
    for (const task of rows) {
      if (!task.parent_task_id) continue;
      if (!children.has(task.parent_task_id)) children.set(task.parent_task_id, []);
      children.get(task.parent_task_id).push(task.id);
    }

    return {
      tasks: rows.map((task) => ({
        ...task,
        featureName: featureName.get(task.feature_id) ?? null,
        categoryName: categoryName.get(task.category_id) ?? null,
        statusLabel: titleCase(task.status),
        assignment: activeAssignment.get(task.id) ?? null,
        subtaskIds: children.get(task.id) ?? [],
        contractLinkCount: contractLinks.filter((l) => l.task_id === task.id).length,
      })),
      categories,
      contractLinks,
      dependencies,
      assignments,
      evidence,
      developers: await db.all("SELECT * FROM developers WHERE project_id = ?", project.id),
      agents: await db.all(
        `SELECT * FROM agents WHERE developer_id IN (SELECT id FROM developers WHERE project_id = ?)`,
        project.id,
      ),
      branches: await db.all("SELECT * FROM branches WHERE project_id = ?", project.id),
    };
  });
}

// ---------------------------------------------------------------------- team

export function team(root) {
  return envelope(root, async (db, project) => {
    const developers = await db.all(
      "SELECT * FROM developers WHERE project_id = ? ORDER BY display_name",
      project.id,
    );
    const agents = await db.all(
      `SELECT * FROM agents WHERE developer_id IN (SELECT id FROM developers WHERE project_id = ?)
        ORDER BY last_seen_at DESC`,
      project.id,
    );
    const branches = await db.all(
      "SELECT * FROM branches WHERE project_id = ? ORDER BY last_seen_at DESC",
      project.id,
    );
    const sessions = await db.all(
      "SELECT * FROM work_sessions WHERE project_id = ? ORDER BY started_at DESC",
      project.id,
    );

    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    const developerName = new Map(developers.map((d) => [d.id, d.display_name]));
    const now = Date.now();

    const presence = [];
    const seen = new Set();
    for (const session of sessions.filter((s) => s.status === "active")) {
      const at = Date.parse(session.last_activity_at ?? session.started_at ?? "");
      const kind = session.agent_id ? "agent" : "developer";
      const actorId = session.agent_id ?? session.developer_id;
      if (!actorId || seen.has(actorId)) continue;
      seen.add(actorId);
      const agent = agents.find((a) => a.id === session.agent_id);
      presence.push({
        actorId,
        actorName:
          kind === "agent"
            ? agent?.model_label ?? agent?.harness ?? actorId
            : developerName.get(actorId) ?? actorId,
        actorKind: kind,
        presence: presenceLabel(now - at),
        lastActivityAt: session.last_activity_at ?? session.started_at ?? null,
        activeTaskId: session.active_task_id,
        branchName: branchName.get(session.branch_id) ?? null,
        sessionId: session.id,
        objective: session.objective,
      });
    }

    return {
      developers,
      agents,
      branches,
      sessions,
      presence,
      handoffs: sessions
        .filter((s) => s.handoff)
        .map((s) => ({
          sessionId: s.id,
          handoff: s.handoff,
          nextAction: s.next_action,
          outcome: s.outcome,
          endedAt: s.ended_at,
        })),
      conflicts: hydrateAll(
        await db.all(
          "SELECT * FROM sync_conflicts WHERE project_id = ? AND status = 'open' ORDER BY detected_at DESC",
          project.id,
        ),
      ),
    };
  });
}

function presenceLabel(ageMs) {
  if (!Number.isFinite(ageMs)) return "Offline";
  if (ageMs < LIVE_WITHIN_MS) return "Live";
  if (ageMs < SESSION_STALE_MS) return "Idle";
  return "Offline";
}

// ----------------------------------------------------------------- decisions

export function decisions(root) {
  return envelope(root, async (db, project) => {
    const rows = hydrateAll(
      await db.all("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at, id", project.id),
    );
    const ids = rows.map((d) => d.id);
    const links = ids.length
      ? await db.all(`SELECT * FROM decision_links WHERE decision_id IN (${marks(ids.length)})`, ...ids)
      : [];
    const transitions = ids.length
      ? await db.all(
          `SELECT * FROM decision_transitions WHERE decision_id IN (${marks(ids.length)})
            ORDER BY decision_id, sequence`,
          ...ids,
        )
      : [];

    return {
      decisions: rows.map((d) => ({ ...d, statusLabel: titleCase(d.status) })),
      links,
      transitions,
      conflicts: decisionConflicts(rows, links),
    };
  });
}

/**
 * A conflict is a decision that is still being treated as binding while
 * something about it has stopped being true. Each one names the decision, what
 * is being asked of it, and where the clash is, so it can be acted on rather
 * than merely noticed.
 */
function decisionConflicts(decisions, links) {
  const now = Date.now();
  const out = [];
  const governing = new Map();

  for (const decision of decisions) {
    if (decision.status === "accepted" && decision.expires_at && Date.parse(decision.expires_at) <= now) {
      out.push({
        decisionId: decision.id,
        request: "Continued reliance on a decision whose time box has run out",
        explanation: `${decision.title} was time boxed to ${decision.expires_at} and is still marked accepted. Re-accept it or replace it.`,
        targetType: decision.scope_type ?? null,
        targetId: decision.scope_id ?? null,
      });
    }
    if (decision.status === "revisit_required") {
      out.push({
        decisionId: decision.id,
        request: "Work continuing under a decision that asked to be revisited",
        explanation: `${decision.title} is marked revisit required${
          decision.revisit_triggers_json?.length ? `: ${decision.revisit_triggers_json.join("; ")}` : "."
        }`,
        targetType: decision.scope_type ?? null,
        targetId: decision.scope_id ?? null,
      });
    }
    if (decision.status === "partially_superseded" && !decision.superseded_by_id) {
      out.push({
        decisionId: decision.id,
        request: "Reading a partially superseded decision as if it were whole",
        explanation: `${decision.title} is partially superseded but names no successor, so which part still governs is unrecorded.`,
        targetType: decision.scope_type ?? null,
        targetId: decision.scope_id ?? null,
      });
    }
  }

  const byId = new Map(decisions.map((d) => [d.id, d]));
  for (const link of links) {
    if (link.relationship !== "governs") continue;
    if (byId.get(link.decision_id)?.status !== "accepted") continue;
    const key = `${link.target_type}:${link.target_id}`;
    if (!governing.has(key)) governing.set(key, []);
    governing.get(key).push(link.decision_id);
  }
  for (const [key, owners] of governing) {
    if (owners.length < 2) continue;
    const [type, id] = key.split(":");
    for (const decisionId of owners) {
      out.push({
        decisionId,
        request: `Two accepted decisions both govern ${id}`,
        explanation: `${owners.join(" and ")} each claim to govern ${type} ${id}. One of them has to supersede the other.`,
        targetType: type,
        targetId: id,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ activity

const ACTIVITY_PAGE = 100;
const ACTIVITY_MAX_PAGE = 500;

/** `%` and `_` are wildcards, so a searched literal has to escape them. */
const likeLiteral = (text) => text.replace(/[\\%_]/g, "\\$&");

export function activity(root, options = {}) {
  const before = Number.isFinite(options.before) && options.before > 0 ? Math.floor(options.before) : null;
  const limit = Math.min(
    Math.max(Number.isFinite(options.limit) ? Math.floor(options.limit) : ACTIVITY_PAGE, 1),
    ACTIVITY_MAX_PAGE,
  );
  const search = typeof options.search === "string" ? options.search.trim().slice(0, 200) : "";

  return envelope(root, async (db, project) => {
    const where = ["project_id = ?"];
    const params = [project.id];
    if (before !== null) {
      where.push("sequence < ?");
      params.push(before);
    }
    if (search) {
      where.push("(summary LIKE ? ESCAPE '\\' OR event_type LIKE ? ESCAPE '\\')");
      params.push(`%${likeLiteral(search)}%`, `%${likeLiteral(search)}%`);
    }

    // One row over the page size answers hasMore without a second count query.
    const rows = await db.all(
      `SELECT * FROM activity_events WHERE ${where.join(" AND ")} ORDER BY sequence DESC LIMIT ?`,
      ...params,
      limit + 1,
    );
    const hasMore = rows.length > limit;
    const events = hydrateAll(rows.slice(0, limit));

    const actorNames = new Map(
      (await db.all("SELECT id, display_name FROM developers WHERE project_id = ?", project.id)).map(
        (d) => [d.id, d.display_name],
      ),
    );

    const memory = hydrateAll(
      search
        ? await db.all(
            `SELECT * FROM memory_entries
              WHERE project_id = ? AND superseded_by IS NULL
                AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
              ORDER BY created_at DESC LIMIT ?`,
            project.id,
            `%${likeLiteral(search)}%`,
            `%${likeLiteral(search)}%`,
            limit,
          )
        : await db.all(
            `SELECT * FROM memory_entries WHERE project_id = ? AND superseded_by IS NULL
              ORDER BY created_at DESC LIMIT ?`,
            project.id,
            limit,
          ),
    );

    return {
      events: events.map((e) => ({
        ...e,
        actorName: actorNames.get(e.actor_id) ?? e.actor_label ?? null,
        typeLabel: titleCase(e.event_type),
      })),
      memory,
      sessions: await db.all(
        "SELECT * FROM work_sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT 50",
        project.id,
      ),
      page: {
        nextCursor: hasMore ? events.at(-1)?.sequence ?? null : null,
        hasMore,
        returned: events.length,
      },
    };
  });
}

// ----------------------------------------------------------------- readiness

export function readinessView(root) {
  return envelope(root, async (db, project) => {
    const report = await readiness(db, project.id);
    const fresh = await freshness(db, project.id);
    const warnings = await alignmentWarnings(db, project.id);

    const modules = await db.all(
      "SELECT * FROM modules WHERE project_id = ? ORDER BY sequence, id",
      project.id,
    );
    const steps = modules.length
      ? await db.all(
          `SELECT * FROM module_completeness WHERE module_id IN (${marks(modules.length)})
            ORDER BY module_id, step`,
          ...modules.map((m) => m.id),
        )
      : [];
    const questions = hydrateAll(
      await db.all(
        "SELECT * FROM questions WHERE project_id = ? AND status IN ('open','deferred') ORDER BY created_at",
        project.id,
      ),
    );
    const discoveryRisks = await db.all(
      "SELECT * FROM discovery_items WHERE project_id = ? AND kind = 'risk' AND status <> 'rejected'",
      project.id,
    );

    const moduleCompleteness = modules.map((module) => {
      const mine = steps.filter((s) => s.module_id === module.id);
      const byStep = new Map(mine.map((s) => [s.step, s]));
      const rendered = MODULE_STEPS.map((name, index) => {
        const step = byStep.get(index + 1);
        return {
          moduleId: module.id,
          step: index + 1,
          name: step?.step_name ?? name,
          state: step?.state ?? "open",
          summary: step?.summary ?? null,
          reason: step?.reason_not_applicable ?? null,
        };
      });
      const applicable = rendered.filter((s) => s.state !== "not_applicable");
      const filled = applicable.filter((s) => s.state === "filled").length;
      return {
        moduleId: module.id,
        moduleName: module.name,
        steps: rendered,
        progress: {
          completed: filled,
          total: applicable.length,
          percent: honestPercent(filled, applicable.length),
          measurable: applicable.length > 0,
          counts: `Module steps filled: ${filled} of ${applicable.length}.`,
          remains: applicable.length - filled
            ? `${count(applicable.length - filled, "step")} still open.`
            : null,
          sourceRevision: report.sourceRevision,
          computedAt: report.generatedAt,
        },
      };
    });

    const risks = [
      ...discoveryRisks.map((r) => ({
        id: r.id,
        statement: r.statement,
        severity: "Unassessed",
        mitigation: null,
        owner: null,
        source: "discovery",
      })),
      ...warnings.map((w) => ({
        id: w.recordId ?? w.code,
        statement: `${w.title}: ${w.detail}`,
        severity: titleCase(w.severity),
        mitigation: w.remedy,
        owner: null,
        source: "alignment",
      })),
    ];

    const blockers = [];
    const unresolved = report.areas.filter(
      (a) => a.state === "awaiting_decision" || a.state === "deferred",
    );
    if (unresolved.length) {
      blockers.push(`${count(unresolved.length, "capability area")} ${agrees(unresolved.length, "has", "have")} no answer yet.`);
    }
    const silent = report.areas.filter((a) => a.silentGap);
    if (silent.length) {
      blockers.push(
        `${silent.length} of those have no owner and no open question, which is a silent gap.`,
      );
    }
    const openSteps = moduleCompleteness.reduce(
      (n, m) => n + (m.progress.total - m.progress.completed),
      0,
    );
    if (openSteps) blockers.push(`${count(openSteps, "module completeness step")} ${agrees(openSteps, "is", "are")} still open.`);
    const open = questions.filter((q) => q.status === "open");
    if (open.length) blockers.push(`${count(open.length, "question")} are waiting on an answer.`);
    if (fresh.pendingDocumentProposals.length) {
      blockers.push(
        `${count(fresh.pendingDocumentProposals.length, "document")} were edited by hand and are unresolved.`,
      );
    }
    if (fresh.staleEvidence.length) {
      blockers.push(`${count(fresh.staleEvidence.length, "verification record")} ${agrees(fresh.staleEvidence.length, "is", "are")} out of date.`);
    }

    return {
      capabilityAreas: report.areas.map((a) => ({
        id: a.id,
        name: a.area,
        state: a.state,
        stateLabel: titleCase(a.state),
        choice: a.choice,
        reason: a.reason,
        owner: a.owner,
        revisitTrigger: a.revisitTrigger,
        consequence: a.consequence,
        decisionId: a.decisionId,
        silentGap: a.silentGap,
        questionIds: a.questionId ? [a.questionId] : [],
      })),
      areaCounts: report.areaCounts,
      modules: moduleCompleteness,
      openQuestions: questions,
      risks,
      releaseReadiness: {
        verdict: !report.measurable
          ? "Not measurable"
          : blockers.length
            ? "Not ready to release"
            : "Ready to release",
        explanation: !report.measurable
          ? "No readiness checklist has been recorded, so this cannot be answered yet. Run discovery to evaluate the capability areas."
          : blockers.length
            ? "Everything below has to be closed or explicitly accepted before this can be called ready."
            : "Every capability area is answered, every module step is filled or explicitly not applicable, and no question or document edit is outstanding.",
        blockers,
      },
      progress: toProgress(report),
    };
  });
}

/**
 * The interface a person touches, and the actions on it.
 *
 * Section 16.1 requires a UI Surfaces area. The records existed and nothing
 * served them, so twenty surfaces and their actions were in the database and
 * reachable from nowhere.
 */
async function surfacesView(root) {
  return envelope(root, async (db, project) => {
    const surfaces = await db.all(
      `SELECT s.*, m.name AS module_name, f.name AS feature_name
         FROM surfaces s
         LEFT JOIN modules m ON m.id = s.module_id
         LEFT JOIN features f ON f.id = s.feature_id
        ORDER BY s.name`);
    const actions = surfaces.length
      ? await db.all(
          `SELECT * FROM ui_actions WHERE surface_id IN (${marks(surfaces.length)}) ORDER BY name`,
          ...surfaces.map((s) => s.id))
      : [];
    const bySurface = new Map();
    for (const a of actions) {
      if (!bySurface.has(a.surface_id)) bySurface.set(a.surface_id, []);
      bySurface.get(a.surface_id).push(a);
    }
    return {
      surfaces: surfaces.map((s) => ({
        ...s,
        entities_shown_json: json(s.entities_shown_json, []),
        components_json: json(s.components_json, []),
        actions: bySurface.get(s.id) ?? [],
      })),
      counts: { surfaces: surfaces.length, actions: actions.length },
    };
  });
}

/**
 * The API surface: every operation and the boundary that groups it.
 *
 * Section 16.1 requires an APIs area. Seventy operations were recorded and the
 * control centre showed none of them.
 */
async function apisView(root) {
  return envelope(root, async (db, project) => {
    const services = await db.all(
      `SELECT s.*, m.name AS module_name FROM api_services s
         LEFT JOIN modules m ON m.id = s.module_id ORDER BY s.sequence, s.id`);
    const operations = await db.all(
      `SELECT o.*, m.name AS module_name, f.name AS feature_name
         FROM api_operations o
         LEFT JOIN modules m ON m.id = o.module_id
         LEFT JOIN features f ON f.id = o.feature_id
        ORDER BY o.name`);
    return {
      services,
      operations: operations.map((o) => ({
        ...o,
        side_effects_json: json(o.side_effects_json, []),
        changesState: json(o.side_effects_json, []).length > 0,
      })),
      counts: {
        services: services.length,
        operations: operations.length,
        // An operation with no service is loose: nothing says which boundary
        // owns it, which is the gap section 6.1 draws between the two objects.
        ungrouped: operations.filter((o) => !o.api_service_id).length,
      },
    };
  });
}

/**
 * What moved in accepted scope, and why.
 *
 * Section 16.1 requires a Changes area and 16.3 requires navigating from a
 * change to the records it affected.
 */
async function changesView(root) {
  return envelope(root, async (db, project) => {
    const changes = await db.all(
      `SELECT c.*, d.title AS decision_title FROM changes c
         LEFT JOIN decisions d ON d.id = c.decision_id
        ORDER BY c.created_at DESC, c.id DESC LIMIT 200`);
    const targets = changes.length
      ? await db.all(
          `SELECT * FROM change_targets WHERE change_id IN (${marks(changes.length)})`,
          ...changes.map((c) => c.id))
      : [];
    const byChange = new Map();
    for (const t of targets) {
      if (!byChange.has(t.change_id)) byChange.set(t.change_id, []);
      byChange.get(t.change_id).push(t);
    }
    const assumptions = await db.all("SELECT * FROM assumptions ORDER BY CASE status WHEN 'holding' THEN 0 ELSE 1 END, created_at DESC");
    return {
      changes: changes.map((c) => ({ ...c, targets: byChange.get(c.id) ?? [] })),
      assumptions,
      counts: {
        changes: changes.length,
        assumptions: assumptions.length,
        holding: assumptions.filter((a) => a.status === "holding").length,
      },
    };
  });
}

/**
 * What proves the product works.
 *
 * Section 16.1 requires an Evidence area, and 16.3 requires navigating from a
 * task to its evidence. Evidence was only ever visible inside one task at a
 * time, so nobody could see how much of the product was actually proven.
 */
async function evidenceView(root) {
  return envelope(root, async (db, project) => {
    const evidence = await db.all(
      `SELECT e.*, t.name AS task_name, t.status AS task_status, f.name AS feature_name
         FROM verification_evidence e
         LEFT JOIN tasks t ON t.id = e.task_id
         LEFT JOIN features f ON f.id = e.feature_id
        ORDER BY e.recorded_at DESC LIMIT 300`);
    const criteria = await db.all(
      `SELECT c.*, f.name AS feature_name FROM feature_acceptance_criteria c
         LEFT JOIN features f ON f.id = c.feature_id ORDER BY c.feature_id, c.sequence`);
    const plans = await db.all(
      `SELECT p.*, f.name AS feature_name FROM test_plans p
         LEFT JOIN features f ON f.id = p.feature_id ORDER BY p.id`);
    const cases = plans.length
      ? await db.all(`SELECT * FROM test_plan_cases WHERE test_plan_id IN (${marks(plans.length)}) ORDER BY sequence`,
          ...plans.map((p) => p.id))
      : [];
    const current = evidence.filter((e) => e.status === "current");
    return {
      evidence,
      criteria,
      testPlans: plans.map((p) => ({ ...p, cases: cases.filter((c) => c.test_plan_id === p.id) })),
      counts: {
        recorded: evidence.length,
        current: current.length,
        passing: current.filter((e) => e.result === "pass").length,
        failing: current.filter((e) => e.result === "fail").length,
        inconclusive: current.filter((e) => e.result === "inconclusive").length,
        stale: evidence.filter((e) => e.status === "stale").length,
        // Evidence that can be run again is the only kind that stays true on
        // its own. The rest is a sentence somebody wrote once.
        reRunnable: current.filter((e) => e.check_command).length,
        criteriaMet: criteria.filter((c) => c.status === "met").length,
        criteriaTotal: criteria.length,
      },
    };
  });
}

/**
 * What this installation is and how it is configured.
 *
 * Section 16.1 requires a Settings area. Nothing here is editable from the
 * browser: these are facts about the machine and the project, and changing them
 * belongs to the commands that own them.
 */
async function settingsView(root) {
  return envelope(root, async (db, project) => {
    const migrations = await db.all("SELECT version, name, applied_at FROM applied_migrations ORDER BY version");
    const categories = await db.all("SELECT * FROM task_categories ORDER BY sequence, id").catch(() => []);
    const counts = {};
    for (const table of ["goals", "milestones", "modules", "features", "workflows", "tasks",
                         "data_entities", "api_operations", "surfaces", "integrations",
                         "decisions", "questions", "assumptions", "changes",
                         "memory_entries", "verification_evidence", "activity_events", "documents"]) {
      counts[table] = (await db.get(`SELECT COUNT(*) n FROM ${table}`).catch(() => ({ n: 0 }))).n;
    }
    return {
      project,
      schema: {
        version: migrations.at(-1)?.version ?? 0,
        applied: migrations.length,
        migrations,
      },
      categories,
      counts,
      storage: {
        // Where things live, so a person can find them without reading source.
        database: ".superdev/superdev.db",
        backups: ".superdev/backups",
        exports: ".superdev/exports",
        documents: "talks",
      },
    };
  });
}

/**
 * Test plans: the agreed verification strategy, and the cases inside it.
 *
 * Section 6.1 defines a test plan and 9.3 gates task completion on the tests it
 * defines. It had no route of its own, so the strategy a task is judged against
 * was only visible bundled inside the evidence payload.
 */
/**
 * Synchronization, as it actually stands.
 *
 * Two questions matter here and both are easy to answer wrongly by omission:
 * what would leave this machine, and what never does. A page that showed only
 * a connection state would let a reader assume the answer to the second, and
 * section 18 makes that assumption the expensive kind.
 */
async function syncView(root) {
  return envelope(root, async (db, project) => {
    const { SHARED_TABLES, WITHHELD } = await import("../cloud/policy.mjs");
    const peer = await db.get("SELECT * FROM sync_peers ORDER BY connected_at DESC LIMIT 1");
    const conflicts = await db.all(
      "SELECT * FROM sync_conflicts ORDER BY status, detected_at DESC LIMIT 100").catch(() => []);
    const leases = await db.all(
      `SELECT a.task_id, a.lease_holder, a.lease_expires_at, a.origin_peer, t.name AS task_name
         FROM task_assignments a LEFT JOIN tasks t ON t.id = a.task_id
        WHERE a.active = 1 AND a.lease_holder IS NOT NULL`).catch(() => []);
    const tracked = await db.get(
      "SELECT COUNT(*) AS n FROM sync_base WHERE peer_id = ?", peer?.id ?? "").catch(() => ({ n: 0 }));

    return {
      peer: peer ?? null,
      conflicts,
      leases,
      trackedRecords: Number(tracked?.n ?? 0),
      shared: SHARED_TABLES,
      withheld: Object.entries(WITHHELD).map(([table, reason]) => ({ table, reason })),
      counts: {
        shared: SHARED_TABLES.length,
        withheld: Object.keys(WITHHELD).length,
        openConflicts: conflicts.filter((c) => c.status === "open").length,
        leases: leases.length,
      },
    };
  });
}

async function testPlansView(root) {
  return envelope(root, async (db, project) => {
    const plans = await db.all(
      `SELECT p.*, f.name AS feature_name, w.name AS workflow_name, m.name AS module_name,
              (SELECT COUNT(*) FROM verification_evidence e
                WHERE e.test_plan_id = p.id AND e.status = 'current' AND e.result = 'pass'
                  AND (e.last_check_result IS NULL OR e.last_check_result = 'pass')) AS passing_runs,
              (SELECT e.summary FROM verification_evidence e
                WHERE e.test_plan_id = p.id ORDER BY e.recorded_at DESC LIMIT 1) AS last_run_summary,
              (SELECT e.recorded_at FROM verification_evidence e
                WHERE e.test_plan_id = p.id ORDER BY e.recorded_at DESC LIMIT 1) AS last_run_at,
              (SELECT e.result FROM verification_evidence e
                WHERE e.test_plan_id = p.id ORDER BY e.recorded_at DESC LIMIT 1) AS last_run_result
         FROM test_plans p
         LEFT JOIN features f ON f.id = p.feature_id
         LEFT JOIN workflows w ON w.id = p.workflow_id
         LEFT JOIN modules m ON m.id = p.module_id
        ORDER BY p.id`);
    const cases = plans.length
      ? await db.all(`SELECT * FROM test_plan_cases WHERE test_plan_id IN (${marks(plans.length)}) ORDER BY sequence`,
          ...plans.map((p) => p.id))
      : [];
    return {
      testPlans: plans.map((p) => ({
        ...p,
        passing_runs: Number(p.passing_runs ?? 0),
        // Whether the plan has been run is the question section 9.3 makes it
        // answer, and the reason a task it covers can or cannot complete.
        satisfied: Number(p.passing_runs ?? 0) > 0,
        cases: cases.filter((c) => c.test_plan_id === p.id),
      })),
      counts: {
        plans: plans.length,
        accepted: plans.filter((p) => p.status === "accepted").length,
        unrun: plans.filter((p) => p.status === "accepted" && !Number(p.passing_runs ?? 0)).length,
        cases: cases.length,
        // A case with a command can be run by anyone. One without is a check
        // somebody performs, which is honest but not automatic.
        runnable: cases.filter((c) => c.command).length,
      },
    };
  });
}

/** Route table, so the server maps a path to a builder without a switch. */
export const routes = {
  "/api/test-plans": testPlansView,
  "/api/sync": syncView,
  "/api/surfaces": surfacesView,
  "/api/apis": apisView,
  "/api/changes": changesView,
  "/api/evidence": evidenceView,
  "/api/settings": settingsView,
  "/api/overview": overview,
  "/api/discovery": discovery,
  "/api/product": product,
  "/api/workflows": workflows,
  "/api/data": data,
  "/api/architecture": architecture,
  "/api/tasks": tasks,
  "/api/team": team,
  "/api/decisions": decisions,
  "/api/readiness": readinessView,
};
