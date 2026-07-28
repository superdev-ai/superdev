// The front door: initialization, adoption, and the plan you see before either
// one touches anything.
//
// Two rules run through this file. Initialization is re-runnable: every step
// checks what is already there and reports it instead of writing over it, so
// running `init` twice is a report rather than a reset. And a repository that
// already has documentation is never initialized over, it is adopted, because
// the one thing this tool must never do is become a second writable copy of
// somebody's existing docs.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { ensureDatabase, mutate, paths, query, create, patch, setStatus, recordActivity } from "../db/store.mjs";
import { slugify, uniqueSlug } from "../model/ids.mjs";
import { sanitizeExternal } from "../model/screening.mjs";
import { CAPABILITY_AREAS, SYSTEM_TASK_CATEGORIES, count } from "../model/vocabulary.mjs";
import { buildConceptMap, detectProjectKind, ingestSources, inspectEvidence, splitLabel, titleOf } from "./discovery.mjs";
import {
  MATERIAL_AREAS,
  STACK_SLOTS,
  materialQuestions,
  questionCatalog,
  seedCapabilityAreas,
  seedModuleCompleteness,
  seedTaskCategories,
} from "./questions.mjs";

export class InitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InitError";
    this.code = code;
  }
}

/** Brief 8.1. The plan prints these, and `applyInit` reports against them. */
const STEPS = [
  "Detect new project versus existing project",
  "Inspect the repository before asking anything",
  "Check specialist provider readiness",
  "Start brainstorming when it is available",
  "Create a discovery session and immutable source records",
  "Build the initial concept map",
  "Ask the smallest set of material questions",
  "Recommend a default for every question",
  "Accept an honest \"I do not know\" as a reversible assumption",
  "Produce a high-level plan before creating implementation tasks",
  "Generate draft foundations, modules, goals, milestones and feature candidates",
  "Present the plan and material decisions for acceptance",
  "Store accepted content in the database",
  "Generate the Markdown documentation",
  "Generate implementation tasks from accepted specifications",
  "Start the local control center",
];

const nowIso = () => new Date().toISOString();

const clean = (text) => {
  if (text === null || text === undefined) return null;
  const out = sanitizeExternal(String(text)).trim();
  return out || null;
};

const trim = (text, max) => {
  const value = clean(text);
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
};

// ------------------------------------------------------------------ planInit

/**
 * Exactly what initialization will do, before it does any of it.
 *
 * This writes nothing, opens no database it would have to create, and can be
 * run on a directory that has never seen Superdev. The question wording is real
 * rather than a count, because the whole value of confirming a plan is seeing
 * what you are about to be asked.
 */
export async function planInit(root, opts = {}) {
  const at = resolve(root);
  const detection = detectProjectKind(at);
  const evidence = inspectEvidence(at);
  const providers = await checkProviders(at);
  const brainstorming = brainstormingAvailability(at);

  const existing = await inspectExisting(at);
  const answered = MATERIAL_AREAS.filter((area) => evidence.answers[area]);
  const unanswered = MATERIAL_AREAS.filter((area) => !evidence.answers[area]);

  // A project that already exists knows which questions are genuinely left; a
  // fresh directory gets the same catalog, predicted from the evidence alone.
  const questions = existing.project
    ? await query(at, (db) => materialQuestions(db, existing.project.id))
    : questionCatalog(unanswered);

  const sources = (opts.sources ?? []).map((path) => ({
    path,
    action: existsSync(resolve(at, path)) ? "record as immutable evidence" : "skip, file not found",
  }));

  const warnings = [];
  if (evidence.truncated) {
    warnings.push("The repository is larger than the inspection limit, so the evidence below is a sample rather than a census.");
  }
  if (detection.route === "adopt") {
    // Name a command, never a function. This said "adoptProject leaves those
    // files exactly where they are", which is the internal function, so the
    // refusal told the reader the remedy in a vocabulary they cannot type. It
    // also stayed silent about the confidence, and a low-confidence detection is
    // exactly the case where the reader should know to override it.
    warnings.push([
      `This repository already has documentation (profile ${detection.docsProfile}, ${detection.confidence} confidence).`,
      "Initialization is refused here. Run superdev adopt, which leaves every existing file exactly where it is.",
      detection.confidence === "low" || detection.confidence === "unknown"
        ? "If those documents are input rather than a record of this project, for example a brief you are initializing from, run superdev init --adopt to say so and initialization will proceed."
        : null,
    ].filter(Boolean).join(" "));
  }
  if (existing.project) {
    warnings.push(`Project ${existing.project.id} already exists. Initialization will report what is present and create only what is missing.`);
  }
  if (!clean(opts.idea) && !sources.length && !existing.project) {
    warnings.push("No idea and no source material were supplied, so the concept map will consist mostly of explicit unknowns.");
  }

  const seeds = {
    capabilityAreas: existing.counts.capabilityAreas ? 0 : CAPABILITY_AREAS.length,
    stackSlots: existing.counts.stackSlots ? 0 : STACK_SLOTS.length,
    taskCategories: existing.counts.taskCategories ? 0 : SYSTEM_TASK_CATEGORIES.length,
  };

  const actions = STEPS.map((name, index) => planStep(index + 1, name, {
    detection, evidence, providers, brainstorming, existing, questions, sources, seeds, opts,
  }));

  return {
    root: at,
    at: opts.at ?? nowIso(),
    route: detection.route,
    kind: detection.kind,
    detection,
    evidence: {
      answers: evidence.answers,
      findings: evidence.findings,
      context: evidence.context,
      stacks: evidence.stacks,
      truncated: evidence.truncated,
      counts: evidence.counts ?? { files: 0, directories: 0 },
    },
    providers,
    brainstorming,
    existing,
    answeredByEvidence: answered.map((area) => ({ area, ...evidence.answers[area] })),
    questions,
    sources,
    creates: seeds,
    steps: actions,
    warnings,
  };
}

function planStep(step, name, ctx) {
  const { detection, evidence, providers, brainstorming, existing, questions, sources, seeds, opts } = ctx;
  const done = (detail) => ({ step, name, action: "already done", detail });
  const willDo = (detail) => ({ step, name, action: "create", detail });
  const skip = (detail) => ({ step, name, action: "skip", detail });

  switch (step) {
    case 1: return done(`${detection.kind}, documentation profile ${detection.docsProfile}, route ${detection.route}`);
    case 2: return done(`${count(evidence.findings.length, "finding")} over ${count(evidence.counts?.files ?? 0, "file")}; ${count(Object.keys(evidence.answers).length, "capability area")} already answered`);
    case 3: return providers.checked
      ? done(`${count(providers.ready.length, "provider")} ready, ${providers.missing.length} not installed; nothing will be installed`)
      : skip(providers.reason);
    case 4: return brainstorming.available
      ? willDo("brainstorming is available and will be offered, never started silently")
      : skip(brainstorming.reason);
    case 5: return willDo(`${count(sources.filter((s) => s.action.startsWith("record")).length, "source file")}, plus one discovery session`);
    case 6: return willDo(clean(opts.idea) || sources.length
      ? "concept map from the stated idea, the supplied sources and the repository evidence"
      : "concept map from repository evidence only, with an explicit unknown for every cover nothing answers");
    case 7: return questions.length ? willDo(`${count(questions.length, "material question")}`) : skip("the evidence already answers every material area");
    case 8: return questions.length ? willDo("every question carries a recommended default, alternatives and its deferral consequence") : skip("no questions to recommend defaults for");
    case 9: return done("an unknown answer is recorded as a reversible assumption and the question stays open");
    case 10: return done("this plan");
    case 11: return willDo("goals, modules and features from accepted concept-map candidates, plus one draft milestone when goals exist");
    case 12: return willDo("this plan is the presentation; applyInit stores nothing until it is called");
    case 13: return existing.project ? done(`project ${existing.project.id} exists; only missing records are created`) : willDo(`seed ${count(seeds.capabilityAreas, "capability area")}, ${count(seeds.stackSlots, "stack slot")}, ${count(seeds.taskCategories, "task category", "task categories")}`);
    case 14: return opts.generateDocs === false ? skip("documentation generation was turned off for this run") : willDo("Markdown generated from accepted database content only");
    case 15: return opts.deriveTasks === false ? skip("task derivation was turned off for this run") : willDo("implementation tasks derived from accepted specifications");
    default: return typeof opts.startControlCenter === "function"
      ? willDo("the caller supplied a control-center starter and it will be invoked")
      : skip("init does not hold a long-lived process open; start the control center separately");
  }
}

/** What is already on disk and in the database. Read only, never creates. */
async function inspectExisting(root) {
  const p = paths(root);
  const out = {
    database: existsSync(p.db),
    adapter: existsSync(join(root, "talks", "project.yaml")),
    gitignored: gitignoresSuperdev(root),
    project: null,
    counts: { capabilityAreas: 0, stackSlots: 0, taskCategories: 0, discoveryItems: 0, questions: 0, sources: 0, modules: 0, features: 0, goals: 0, tasks: 0, documents: 0 },
  };
  if (!out.database) return out;

  return query(root, async (db) => {
    const project = await db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
    if (!project) return out;
    const count = async (sql, ...params) => Number((await db.value(sql, ...params)) ?? 0);
    out.project = project;
    out.counts = {
      capabilityAreas: await count("SELECT count(*) FROM capability_areas WHERE project_id = ? AND catalog = 'readiness'", project.id),
      stackSlots: await count("SELECT count(*) FROM capability_areas WHERE project_id = ? AND catalog = 'stack_slot'", project.id),
      taskCategories: await count("SELECT count(*) FROM task_categories WHERE project_id = ?", project.id),
      discoveryItems: await count("SELECT count(*) FROM discovery_items WHERE project_id = ?", project.id),
      questions: await count("SELECT count(*) FROM questions WHERE project_id = ?", project.id),
      sources: await count("SELECT count(*) FROM source_material WHERE project_id = ?", project.id),
      modules: await count("SELECT count(*) FROM modules WHERE project_id = ?", project.id),
      features: await count("SELECT count(*) FROM features WHERE project_id = ?", project.id),
      goals: await count("SELECT count(*) FROM goals WHERE project_id = ?", project.id),
      tasks: await count("SELECT count(*) FROM tasks WHERE project_id = ?", project.id),
      documents: await count("SELECT count(*) FROM documents WHERE project_id = ?", project.id),
    };
    return out;
  });
}

/**
 * Which specialist providers are installed. Nothing is ever installed here: an
 * absent provider is reported as absent so the person decides, which is brief
 * 8.1 step 3 read literally.
 */
async function checkProviders(root) {
  try {
    const { detectAll } = await import("../../scripts/providers/detect.mjs");
    const report = detectAll({ rootReal: resolve(root) });
    const rows = report?.providers ?? [];
    return {
      checked: true,
      installed: false,
      ready: rows.filter((r) => r.ready).map((r) => r.id),
      missing: rows.filter((r) => !r.ready).map((r) => r.id),
      harness: report?.harness ?? null,
      reason: "nothing was installed; an absent provider stays absent until you ask for it",
    };
  } catch (err) {
    return { checked: false, ready: [], missing: [], reason: `provider readiness could not be determined: ${clean(err.message) ?? "unknown error"}` };
  }
}

/** Superpowers brainstorming, if this installation has it. Never auto-started. */
function brainstormingAvailability(root) {
  const candidates = [
    join(root, ".claude", "skills", "brainstorming"),
    join(root, "skills", "brainstorming"),
  ];
  const found = candidates.find((path) => existsSync(path));
  return found
    ? { available: true, path: found.replace(resolve(root), "."), note: "Offered, never started on your behalf." }
    : { available: false, reason: "the brainstorming skill is not installed here, so discovery proceeds from evidence and questions alone" };
}

// ----------------------------------------------------------------- applyInit

/**
 * Run brief 8.1 steps 1 to 16 and report what actually happened.
 *
 * Every step is guarded by an existence check, so a second run creates nothing
 * and returns the same shape describing what was already there.
 */
export async function applyInit(root, opts = {}) {
  const at = resolve(root);
  const stamp = opts.at ?? nowIso();
  const actor = clean(opts.actor) ?? "superdev";
  const plan = await planInit(at, opts);
  const happened = [];
  const record = (step, outcome, detail) => happened.push({ step, name: STEPS[step - 1], outcome, detail });

  if (plan.route === "adopt" && opts.adopt !== true) {
    throw new InitError(
      "E_EXISTING_DOCS",
      `This repository already documents itself with the ${plan.detection.docsProfile} profile, detected at ${plan.detection.docsRoot ?? "docs"}. Initializing here would create a second source of truth for the same facts. Run superdev adopt instead, which writes only the adapter and the control layer and leaves every existing file untouched. If those documents are input rather than a projection, for example a requirements document you are initializing from, pass --adopt to say so and init will proceed.`,
    );
  }

  record(1, "done", `${plan.detection.kind}, route ${plan.detection.route}`);
  record(2, "done", `${count(plan.evidence.findings.length, "finding")}; ${count(Object.keys(plan.evidence.answers).length, "capability area")} answered by the repository`);

  // Detection already ran while building the plan; running it again would only
  // risk reporting something different from what was confirmed.
  const providers = plan.providers;
  record(3, providers.checked ? "done" : "skipped", providers.checked ? `${providers.ready.length} ready, ${providers.missing.length} absent, none installed` : providers.reason);
  record(4, plan.brainstorming.available ? "available" : "skipped", plan.brainstorming.available ? plan.brainstorming.note : plan.brainstorming.reason);

  // Step 13 in schedule order: the database and the project row have to exist
  // before anything else can hang off them.
  const migration = await ensureDatabase(at, { apply: true });
  const evidence = plan.evidence;

  const created = await mutate(at, async (db) => {
    const existing = await db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
    const project = existing ?? await createProject(db, at, opts, stamp, actor);
    const areas = await seedCapabilityAreas(db, project.id, { evidence, at: stamp, actor, owner: opts.owner });
    const categories = await seedTaskCategories(db, project.id, { actor });
    return { project, reused: Boolean(existing), areas, categories };
  });
  record(13, created.reused ? "already existed" : "done",
    created.reused
      ? `project ${created.project.id} was already initialized; ${count(created.areas.areas.length, "area")} and ${count(created.categories.created.length, "category", "categories")} added`
      : `project ${created.project.id}, ${count(created.areas.areas.length, "capability area")}, ${count(created.areas.stackSlots.length, "stack slot")}, ${created.categories.created.length} task categories`);

  // Step 5. The session shells out to git, so it runs in its own transaction.
  const started = await runQuietly(async () => {
    const { startSession } = await import("../runtime/session.mjs");
    return startSession(at, { objective: "Product discovery", actor, at: stamp });
  }, "the discovery session could not be started");
  const session = started.error ? null : started;
  const ingested = await ingestSources(at, opts.sources ?? [], { projectId: created.project.id, actor, at: stamp });
  record(5, session ? "done" : "partial",
    `${session ? `session ${session.id}` : started.error}; ${count(ingested.ingested.length, "source")} recorded, ${ingested.alreadyPresent.length} already present, ${ingested.skipped.length} skipped`);

  // Step 6.
  const conceptMap = await buildConceptMap(at, {
    idea: opts.idea,
    sources: [...ingested.ingested, ...ingested.alreadyPresent],
    evidence,
    actor,
    at: stamp,
  });
  record(6, "done", `${count(conceptMap.created.length, "discovery item")}, ${count(conceptMap.unknowns, "explicit unknown")}, ${conceptMap.duplicates} already present`);

  // Steps 7 to 9.
  const questions = await mutate(at, async (db) => {
    const descriptors = await materialQuestions(db, created.project.id);
    const rows = [];
    for (const descriptor of descriptors) {
      const row = await create(db, "question", {
        project_id: created.project.id,
        scope_type: descriptor.scopeType,
        scope_id: descriptor.scopeId,
        question: descriptor.question,
        why_it_matters: descriptor.whyItMatters,
        recommendation: descriptor.recommendation,
        alternatives_json: JSON.stringify(descriptor.alternatives ?? []),
        status: "open",
        created_at: stamp,
      }, { projectId: created.project.id, activity: false });
      // The area points at its question so readiness can tell an owned gap from
      // a silent one, which is the whole test in brief 8.2.
      if (descriptor.areaId) {
        const area = await db.get("SELECT * FROM capability_areas WHERE id = ?", descriptor.areaId);
        if (area) {
          await patch(db, "capability_area", area.id, area.version, { question_id: row.id }, {
            projectId: created.project.id, activity: false, at: stamp,
          });
        }
      }
      rows.push(row);
    }
    if (rows.length) {
      await recordActivity(db, created.project.id, {
        type: "specification_changed",
        summary: `Raised ${count(rows.length, "material question")} for the project owner`,
        actor,
        metadata: { questions: rows.map((r) => r.id) },
      });
    }
    return rows;
  });
  record(7, questions.length ? "done" : "skipped", questions.length ? `${count(questions.length, "question")} raised: ${questions.map((q) => q.id).join(", ")}` : "every material area is answered by the repository or already asked");
  record(8, "done", "each question carries why it matters, a recommended default, alternatives and its deferral consequence");
  record(9, "ready", "answerQuestion records an unknown answer as a reversible assumption and leaves the question open");
  record(10, "done", "the plan returned by planInit was produced before any of this ran");

  // Step 11 and 12: the draft product, only from what the concept map holds.
  const draft = await draftProduct(at, created.project, { actor, at: stamp, milestones: opts.milestones });
  record(11, draft.created ? "done" : "skipped", draft.detail);
  record(12, "done", "planInit is the presentation step; calling applyInit is the acceptance");

  // Step 14 and 15 run outside every transaction: both open their own.
  // `notRun` rather than `skipped`: both generate and deriveAll return their own
  // `skipped` collection, and an empty array is still truthy.
  let tasks = { notRun: "task derivation was turned off for this run" };
  if (opts.deriveTasks !== false) {
    tasks = await runQuietly(async () => {
      const { deriveAll } = await import("../tasks/derive.mjs");
      return deriveAll(at, { apply: true, actor });
    }, "tasks could not be derived");
  }
  record(15, outcomeOf(tasks), tasks.error ?? tasks.notRun ?? summarize(tasks));

  // Step 16. A function that returns cannot own a listening socket, so the
  // control center is started by whoever called this, not from inside it.
  let controlCenter = { started: false, reason: "init does not hold a process open; start the control center separately" };
  if (typeof opts.startControlCenter === "function") {
    const result = await runQuietly(() => opts.startControlCenter(at), "the control center could not be started");
    controlCenter = result.error ? { started: false, reason: result.error } : { started: true, detail: result };
  }
  record(16, controlCenter.started ? "done" : "deferred", controlCenter.reason ?? "the supplied starter returned");

  await mutate(at, (db) => recordActivity(db, created.project.id, {
    type: "project_initialized",
    summary: created.reused
      ? `Re-ran initialization for ${created.project.name}; existing records were reported, not replaced`
      : `Initialized ${created.project.name}`,
    actor,
    metadata: { route: plan.route, questions: questions.length, discoveryItems: conceptMap.created.length, reused: created.reused },
  }));

  // Documents are generated last, after every record and every event init will
  // write, and the step is still reported as 14 because the brief's order is
  // what a reader follows.
  //
  // It ran before task derivation and before the closing event, so a document
  // was stamped with a revision lower than the project's own, and freshness
  // compares the two. Every project therefore began its life reporting that its
  // documentation was built from an older database revision, seconds after init
  // wrote it, and no command the user could run would clear it. A gate that is
  // red on arrival teaches the reader that red means nothing.
  let documents = { notRun: "documentation generation was turned off for this run" };
  if (opts.generateDocs !== false) {
    documents = await runQuietly(async () => {
      const { generate } = await import("../docs/render.mjs");
      return generate(at, { apply: true });
    }, "documentation could not be generated");
  }
  record(14, outcomeOf(documents), documents.error ?? documents.notRun ?? summarize(documents));

  return {
    root: at,
    project: created.project,
    reused: created.reused,
    migration,
    plan,
    // Recorded in execution order, reported in brief order, because the two
    // differ: the database has to exist before step 5 can write to it.
    steps: happened.slice().sort((a, b) => a.step - b.step),
    session,
    sources: ingested,
    conceptMap,
    questions,
    capabilityAreas: created.areas,
    taskCategories: created.categories,
    draft,
    documents,
    tasks,
    controlCenter,
  };
}

async function createProject(db, root, opts, at, actor) {
  // What the owner said it is called, then what the brief calls itself, and
  // only then the directory. A document that opens with the product's name has
  // already answered this, and the directory it was initialized in usually has
  // not: a brief titled "Kitchen Handover" in a folder called `journey`
  // produced a product named Journey.
  const name = clean(opts.name) ?? briefTitle(root, opts.sources ?? []) ?? titleFrom(basename(root));
  const base = slugify(name, "project");
  let slug = base;
  for (let n = 2; await db.get("SELECT 1 FROM projects WHERE slug = ?", slug); n++) slug = `${base}-${n}`;

  return create(db, "project", {
    name,
    slug,
    // The idea, as stated, is the problem this exists to solve. The success
    // statement is deliberately left empty so the material question still asks.
    problem: trim(opts.idea, 2000),
    statement: trim(opts.statement, 2000),
    status: "draft",
    working_mode: clean(opts.workingMode) ?? "guided",
    docs_profile: clean(opts.docsProfile) ?? "talks-v1",
    local_authority: 1,
    created_at: at,
    updated_at: at,
  }, { activity: false, actor });
}

/** The first heading of the first readable brief, or nothing. */
function briefTitle(root, sources) {
  for (const raw of sources) {
    const path = isAbsolute(raw) ? raw : join(root, raw);
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const title = titleOf(text);
    // A heading long enough to be a sentence is describing the product, not
    // naming it, so the directory remains the better answer.
    if (title && title.length <= 60) return clean(title);
  }
  return null;
}

const titleFrom = (name) =>
  String(name).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Project";

/**
 * Turn accepted concept-map candidates into goals, modules and features.
 *
 * Only candidates are converted. Nothing is invented to fill a shape: a project
 * with no goal candidates gets no goals, and the gap stays visible as the
 * unknown the concept map already wrote down.
 */
/**
 * The module a feature names, or nothing.
 *
 * Matching is on the module's name appearing in the feature's own words, which is
 * how a brief actually signals ownership: "Read the previous shift's handover"
 * belongs to "Handover", and says so. A single common word is not a signal, so
 * short and structural words are ignored, and nothing matching means nothing is
 * claimed.
 */
const STRUCTURAL = new Set(["the", "and", "for", "with", "data", "core", "app", "api", "web", "ui", "service", "client", "server", "module", "system"]);

function ownerFor(modules, statement) {
  const text = String(statement ?? "").toLowerCase();
  let best = null;
  for (const module of modules) {
    const words = String(module.name).toLowerCase().split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STRUCTURAL.has(word));
    if (!words.length) continue;
    const hits = words.filter((word) => text.includes(word)).length;
    // Every distinctive word of the module's name has to appear, so "Shot log"
    // does not claim a feature that merely mentions a shot.
    if (hits === words.length && (!best || words.length > best.words)) {
      best = { module, words: words.length };
    }
  }
  return best?.module ?? null;
}

async function draftProduct(root, project, { actor, at, milestones }) {
  const outcome = await mutate(root, async (db) => {
    const items = await db.all(
      "SELECT * FROM discovery_items WHERE project_id = ? AND status = 'proposed' ORDER BY created_at, id",
      project.id,
    );
    const moduleCandidates = items.filter((i) => i.kind === "feature_candidate" && i.statement.startsWith("Module candidate:"));
    const featureCandidates = items.filter((i) => i.kind === "feature_candidate" && !i.statement.startsWith("Module candidate:"));
    const goalCandidates = items.filter((i) => i.kind === "goal_candidate");

    const goals = [];
    for (const [index, item] of goalCandidates.entries()) {
      const name = trim(item.statement, 120);
      if (!name || await db.get("SELECT 1 FROM goals WHERE project_id = ? AND name = ?", project.id, name)) continue;
      const goal = await create(db, "goal", {
        project_id: project.id,
        name,
        description: item.statement,
        why_it_matters: item.provenance,
        status: "draft",
        sequence: index,
      }, { projectId: project.id, activity: false });
      goals.push(goal);
      await convert(db, item, "goal", goal.id, at);
    }

    const modules = [];
    for (const [index, item] of moduleCandidates.entries()) {
      const stated = item.statement.replace(/^Module candidate:\s*/, "");
      // The name is the label the brief gave the part, and the sentence after it
      // is what the part does. Both used to become the name.
      const { name: label, description } = splitLabel(stated);
      const name = trim(label, 120);
      if (!name) continue;
      const module = await createModule(db, project, name, description ?? stated, index, at);
      if (!module) continue;
      modules.push(module);
      await convert(db, item, "module", module.id, at);
    }
    // Features cannot exist without a module, so one home module is created
    // when candidates exist and nothing named a module.
    if (!modules.length && featureCandidates.length) {
      const module = await createModule(db, project, project.name, `Everything ${project.name} does, until the parts are named.`, 0, at);
      if (module) modules.push(module);
    }

    const features = [];
    const unowned = [];
    for (const item of featureCandidates) {
      const { name: label } = splitLabel(item.statement);
      const name = trim(label, 120);
      if (!name || !modules.length) continue;
      if (await db.get("SELECT 1 FROM features WHERE project_id = ? AND name = ?", project.id, name)) continue;
      const slug = await uniqueSlug(db, "features", project.id, name, "feature");
      // Which module owns this feature is read from the feature, never from where
      // it happened to sit in the list.
      //
      // It was `modules[index % modules.length]`, so feature n went to module n.
      // Four features that were all screens landed on four different modules, one
      // per supporting library, and the result was defensible only because the
      // two lists happened to be the same length and in a compatible order.
      // Reorder either list in the brief and the map becomes nonsense that reads
      // as deliberate.
      const matched = ownerFor(modules, item.statement);
      const owner = matched ?? modules[0];
      const feature = await create(db, "feature", {
        project_id: project.id,
        module_id: owner.id,
        name,
        slug,
        purpose: item.statement,
        user_statement: item.provenance,
        spec_depth: "microspec",
        risk_level: "R1",
        status: "draft",
        created_at: at,
        updated_at: at,
      }, { projectId: project.id, activity: false });
      features.push(feature);
      // An unmatched feature still needs a module, so it gets the first one and
      // the guess is written down as a question rather than left to look decided.
      if (!matched && modules.length > 1) unowned.push({ feature, owner });
      await convert(db, item, "feature", feature.id, at);
    }

    // What the brief said is out of scope, stored where the product reads it.
    //
    // An "Out of scope" section became a discovery item of kind `exclusion` and
    // stopped there. project_scope_items, the table the product document reads,
    // was written by nothing at all, so the generated foundations said "None
    // declared. An empty list here is a gap, not a statement" to somebody who had
    // just declared three. The most valuable section of a brief was parsed,
    // stored as a proposal, and contradicted in the same run.
    const exclusions = items.filter((i) => i.kind === "exclusion");
    const scope = [];
    for (const [index, item] of exclusions.entries()) {
      const { name: statement, description: why } = splitLabel(item.statement);
      if (!statement) continue;
      const already = await db.get(
        "SELECT id FROM project_scope_items WHERE project_id = ? AND statement = ?", project.id, statement);
      if (already) continue;
      const row = await create(db, "project_scope_item", {
        project_id: project.id,
        direction: "non_goal",
        statement,
        why: why ?? item.provenance ?? null,
        sequence: index,
      }, { projectId: project.id, activity: false });
      scope.push(row);
      await convert(db, item, "project_scope_item", row.id, at);
    }

    // Every guess about ownership, asked rather than assumed.
    for (const { feature, owner } of unowned) {
      await create(db, "question", {
        project_id: project.id,
        scope_type: "feature",
        scope_id: feature.id,
        question: `Which module owns ${feature.name}?`,
        why_it_matters: `The brief named ${modules.length} modules and none of them appears in this feature, so it was placed in ${owner.name} to have a home. Module ownership decides which test plan covers it and which documentation directory it is written to.`,
        recommendation: `Leave it in ${owner.name} if that is right, or run superdev feature move ${feature.id} --module <MOD-id>.`,
        alternatives_json: JSON.stringify(modules.filter((m) => m.id !== owner.id).map((m) => m.name)),
        status: "open",
        created_at: at,
      }, { projectId: project.id, activity: false });
    }

    const created = [];
    for (const [index, supplied] of (milestones ?? []).entries()) {
      created.push(await createMilestone(db, project, clean(supplied.name), clean(supplied.outcome), index, at));
    }
    // One draft milestone when goals exist and none was supplied: a goal with
    // nothing to reach it by is the shape this rebuild exists to avoid. It is
    // marked draft precisely because nobody has agreed to it yet.
    if (!created.length && goals.length) {
      const milestone = await createMilestone(db, project, "First outcome", `The project can demonstrate: ${goals[0].name}`, 0, at);
      if (milestone) created.push(milestone);
    }

    for (const module of modules) await seedModuleCompleteness(db, module.id, { at });

    if (goals.length || modules.length || features.length || created.length || scope.length) {
      await recordActivity(db, project.id, {
        type: "specification_changed",
        summary: `Drafted ${count(goals.length, "goal")}, ${count(modules.length, "module")}, ${count(features.length, "feature")}, ${count(created.filter(Boolean).length, "milestone")} and ${count(scope.length, "non-goal")} from the concept map`,
        actor,
        metadata: { goals: goals.length, modules: modules.length, features: features.length, milestones: created.filter(Boolean).length, nonGoals: scope.length },
      });
    }

    return { goals, modules, features, milestones: created.filter(Boolean), nonGoals: scope };
  });

  const total = outcome.goals.length + outcome.modules.length + outcome.features.length + outcome.nonGoals.length;
  return {
    ...outcome,
    created: total > 0,
    detail: total
      ? `${count(outcome.goals.length, "goal")}, ${count(outcome.modules.length, "module")}, ${count(outcome.features.length, "feature")}, ${count(outcome.milestones.length, "milestone")}, ${count(outcome.nonGoals.length, "non-goal")}`
      : "the concept map held no candidates to convert, so nothing was invented to fill the gap",
  };
}

async function createModule(db, project, name, purpose, sequence, at) {
  const moduleName = trim(name, 120);
  if (!moduleName) return null;
  if (await db.get("SELECT 1 FROM modules WHERE project_id = ? AND name = ?", project.id, moduleName)) return null;
  return create(db, "module", {
    project_id: project.id,
    name: moduleName,
    slug: await uniqueSlug(db, "modules", project.id, moduleName, "module"),
    purpose: trim(purpose, 400),
    status: "planned",
    sequence,
    created_at: at,
    updated_at: at,
  }, { projectId: project.id, activity: false });
}

async function createMilestone(db, project, name, outcome, sequence, at) {
  if (!name) return null;
  if (await db.get("SELECT 1 FROM milestones WHERE project_id = ? AND name = ?", project.id, name)) return null;
  return create(db, "milestone", {
    project_id: project.id,
    name,
    outcome: trim(outcome, 400),
    status: "draft",
    sequence,
    created_at: at,
    updated_at: at,
  }, { projectId: project.id, activity: false });
}

/** A converted candidate keeps its provenance and stops being proposed. */
async function convert(db, item, type, id, at) {
  const moved = await setStatus(db, "discovery_item", item.id, "converted", {
    projectId: item.project_id, activity: false, at, note: `converted to ${type} ${id}`,
  });
  await patch(db, "discovery_item", item.id, moved.version, {
    converted_type: type, converted_id: id, accepted_at: at,
  }, { projectId: item.project_id, activity: false, at });
}

async function runQuietly(fn, message) {
  try {
    return await fn();
  } catch (err) {
    // A failure here is reported, never thrown: documentation and task
    // derivation are downstream of a project that has already been created,
    // and losing the whole initialization to a render bug helps nobody.
    return { error: `${message}: ${clean(err.message) ?? "unknown error"}` };
  }
}

const outcomeOf = (result) => (result.error ? "failed" : result.notRun ? "skipped" : "done");

const summarize = (result) => {
  if (!result || typeof result !== "object") return "done";
  const counts = Object.entries(result)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => `${value.length} ${key}`);
  return counts.length ? counts.join(", ") : "done";
};

// -------------------------------------------------------------- adoptProject

/**
 * Adopt a repository that already documents itself.
 *
 * Adoption writes exactly two things: the adapter that records where the
 * documentation already lives, and the control layer under `.superdev/`. No
 * existing file is moved, rewritten, copied into the database, or registered as
 * a generated document, because any of those would create a second editable
 * copy of a fact the repository already owns.
 */
export async function adoptProject(root, { apply = false, ...opts } = {}) {
  const at = resolve(root);
  const stamp = opts.at ?? nowIso();
  const actor = clean(opts.actor) ?? "superdev";
  const detection = detectProjectKind(at);
  const evidence = inspectEvidence(at);
  const existing = await inspectExisting(at);

  const adapterPath = join("talks", "project.yaml");
  const name = clean(opts.name) ?? clean(detection.adapter?.project?.name) ?? titleFrom(basename(at));

  const actions = [
    { what: "database and control layer under .superdev/", action: existing.database ? "already present" : "create" },
    { what: adapterPath, action: existing.adapter ? "leave exactly as it is" : "create" },
    { what: ".gitignore entry for .superdev/", action: existing.gitignored ? "already present" : "append one line" },
    { what: "project record", action: existing.project ? `already present as ${existing.project.id}` : "create" },
    { what: "capability areas and stack slots", action: existing.counts.capabilityAreas ? "already present" : "seed" },
    { what: "task categories", action: existing.counts.taskCategories ? "already present" : "seed" },
  ];

  const refusals = [
    "Existing documentation is not moved, renamed, rewritten or copied into the database.",
    "Existing documents are not registered as generated documents, so nothing here can later be overwritten by a render.",
    "No Markdown is generated by adoption. The repository keeps the documentation it already has.",
  ];

  const plan = {
    root: at,
    at: stamp,
    apply,
    name,
    detection,
    evidence: { answers: evidence.answers, context: evidence.context, stacks: evidence.stacks },
    existing,
    actions,
    refusals,
    warnings: detection.docsProfile === "unknown"
      ? ["The documentation profile could not be detected, so the adapter will record it as custom and nothing will be assumed about the layout."]
      : [],
  };
  if (!apply) return plan;

  const migration = await ensureDatabase(at, { apply: true });
  const profile = detection.docsProfile === "unknown" || detection.docsProfile === "none" ? "custom" : detection.docsProfile;

  const result = await mutate(at, async (db) => {
    const found = await db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
    const project = found ?? await createProject(db, at, { ...opts, name, docsProfile: profile }, stamp, actor);
    const areas = await seedCapabilityAreas(db, project.id, { evidence, at: stamp, actor, owner: opts.owner });
    const categories = await seedTaskCategories(db, project.id, { actor });
    await recordActivity(db, project.id, {
      type: "project_initialized",
      summary: found
        ? `Re-ran adoption for ${project.name}; existing records were reported, not replaced`
        : `Adopted ${project.name} with the ${profile} documentation profile`,
      actor,
      metadata: { profile, docsRoot: detection.docsRoot, reused: Boolean(found) },
    });
    return { project, reused: Boolean(found), areas, categories };
  });

  const wroteAdapter = existing.adapter ? false : writeAdapter(at, { name, profile, docsRoot: detection.docsRoot, at: stamp });
  const wroteIgnore = existing.gitignored ? false : ignoreSuperdev(at);

  return {
    ...plan,
    applied: true,
    migration,
    project: result.project,
    reused: result.reused,
    capabilityAreas: result.areas,
    taskCategories: result.categories,
    wrote: [
      ...(wroteAdapter ? [adapterPath] : []),
      ...(wroteIgnore ? [".gitignore"] : []),
      ".superdev/superdev.db",
    ],
    untouched: (evidence.context ?? []).map((c) => c.evidence),
  };
}

/** The adapter records where documentation already lives. It never moves it. */
function writeAdapter(root, { name, profile, docsRoot, at }) {
  const path = join(root, "talks", "project.yaml");
  if (existsSync(path)) return false;
  mkdirSync(join(root, "talks"), { recursive: true });
  const lines = [
    "# Superdev project record configuration",
    "project:",
    `  name: "${String(name).replace(/"/g, "'")}"`,
    `  created: "${at}"`,
    "docs:",
    `  profile: ${profile}`,
    ...(docsRoot ? [`  canonicalRoot: ${docsRoot}`] : []),
    "  migrationStatus: none",
    "",
  ];
  writeFileSync(path, lines.join("\n"));
  return true;
}

const IGNORE_LINE = ".superdev/";

function gitignoresSuperdev(root) {
  const path = join(root, ".gitignore");
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf8").split(/\r?\n/).some((line) => line.trim().replace(/\/$/, "") === ".superdev");
  } catch {
    return false;
  }
}

/** One appended line, never a rewrite of somebody's ignore file. */
function ignoreSuperdev(root) {
  const path = join(root, ".gitignore");
  if (!existsSync(path)) {
    writeFileSync(path, `${IGNORE_LINE}\n`);
    return true;
  }
  const current = readFileSync(path, "utf8");
  appendFileSync(path, `${current.endsWith("\n") ? "" : "\n"}${IGNORE_LINE}\n`);
  return true;
}
