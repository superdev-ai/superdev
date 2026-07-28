// The one progress and readiness service. Brief section 16.
//
// It exists exactly once because the CLI imports it in process and the local
// HTTP service wraps the same functions, so "the number in the terminal is the
// number in the browser" is a property of the code rather than a claim in a
// document. Three divergent implementations is what this replaces.
//
// Two rules shape everything below:
//   - only applicable components count, so a backend feature with no UI is
//     never permanently stuck at five of six;
//   - a record with no declared completion contract is not measurable, and is
//     reported as such rather than as zero or one hundred percent.
//
// Every function takes an open connection (from query() or mutate()), never a
// project root, so a caller composes several of these inside one read.

import { json, DbError } from "../db/store.mjs";
import { agrees, count, AMBIENT_EVENTS } from "../model/vocabulary.mjs";

const DAY_MS = 86_400_000;

/** Evidence older than this stops counting as proof. Brief section 16.1. */
export const EVIDENCE_STALE_DAYS = 30;

/** A session quiet for longer than this is reported as no longer live. */
export const SESSION_STALE_MS = 4 * 60 * 60 * 1000;

/** Statuses that mean a record is finished, whichever table it lives in. */
const SETTLED = new Set([
  "accepted", "specified", "implemented", "complete", "completed", "delivered",
  "verified", "done", "met", "filled", "applied", "configured", "answered",
]);

/**
 * Statuses that take a record out of the totals. The record stays queryable and
 * stays in history; it simply stops being work that can be finished.
 */
const RETIRED = new Set([
  "cancelled", "superseded", "rejected", "deprecated", "withdrawn",
  "not_applicable", "waived", "declined", "abandoned",
]);

/**
 * Statuses that claim the work itself is finished. Narrower than SETTLED on
 * purpose: `accepted` means the specification was agreed, not that anything
 * was built, and conflating the two would accuse every accepted feature of
 * lying about its progress.
 */
const FINISHED = new Set(["complete", "completed", "delivered", "implemented", "verified", "done"]);

const settled = (status) => SETTLED.has(String(status ?? "").toLowerCase());
const retired = (status) => RETIRED.has(String(status ?? "").toLowerCase());
const finished = (status) => FINISHED.has(String(status ?? "").toLowerCase());

/** Component name used by every subject, kept in one place so parents can find it. */
const SPEC_COMPONENT = "Accepted specification";

const marks = (n) => Array.from({ length: n }, () => "?").join(",");
const iso = (ms) => new Date(ms).toISOString();

/**
 * Never round an unfinished thing up to complete, and never round started work
 * down to nothing. Both lies are the reason people stop trusting a percentage.
 *
 * Exported because it is a rule rather than a calculation: any caller that
 * rounds for itself will eventually round a project to finished.
 */
export function honestPercent(done, total) {
  if (!total) return null;
  const raw = Math.round((done / total) * 100);
  if (raw >= 100 && done < total) return 99;
  if (raw <= 0 && done > 0) return 1;
  return raw;
}

/** Count rows into a component, dropping retired rows from the total entirely. */
function tally(rows, isDone = (row) => settled(row.status)) {
  let done = 0;
  let total = 0;
  for (const row of rows) {
    if (retired(row.status)) continue;
    total += 1;
    if (isDone(row)) done += 1;
  }
  return { done, total };
}

const comp = (name, counts) => ({
  name,
  done: counts.done,
  total: counts.total,
  applies: counts.total > 0,
});

/**
 * Build the one progress shape. Nothing else in this file constructs that
 * object, so every value the product shows carries the same fields.
 */
function summarize({
  components,
  revision,
  measurable,
  now,
  whatCountsExtra = [],
  whatRemainsExtra = [],
  stale = false,
  reason = null,
  // The noun the totals are counted in, so a caller can say "5 of 47 readiness
  // items addressed". This is deliberately separate from whatCounts, which is
  // the per-component breakdown: putting the breakdown in the noun slot is how
  // a headline turns into an unreadable run-on sentence.
  unit = "tracked item",
}) {
  const applicable = components.filter((c) => c.applies);
  const completed = applicable.reduce((n, c) => n + c.done, 0);
  const total = applicable.reduce((n, c) => n + c.total, 0);

  const whatCounts = applicable.map((c) => `${c.name}: ${c.done} of ${c.total}`);
  whatCounts.push(...whatCountsExtra);
  const skipped = components.filter((c) => !c.applies).map((c) => c.name);
  if (skipped.length) whatCounts.push(`Does not apply here: ${skipped.join(", ")}.`);

  const whatRemains = applicable
    .filter((c) => c.done < c.total)
    .map((c) => `${c.name}: ${c.total - c.done} outstanding`);
  whatRemains.push(...whatRemainsExtra);
  if (!measurable) whatRemains.unshift(reason ?? "No declared completion contract.");

  return {
    percent: measurable ? honestPercent(completed, total) : null,
    completed,
    total,
    components,
    unit,
    whatCounts,
    whatRemains,
    sourceRevision: revision,
    measurable,
    // Freshness travels with the value. A percentage without an as-of is how a
    // stale snapshot gets read as the present.
    stale,
    generatedAt: iso(now),
  };
}

/** The database revision every value is reported against. */
async function revisionOf(db, projectId) {
  const value = await db.value(
    "SELECT max(sequence) FROM activity_events WHERE project_id = ?",
    projectId,
  );
  return value ?? 0;
}

function evidenceIsCurrent(row, now) {
  if (row.status !== "current") return false;
  if (row.stale_at && Date.parse(row.stale_at) <= now) return false;
  const at = Date.parse(row.recorded_at ?? "");
  // An unreadable timestamp means the age is unknown, and unknown age is not proof.
  if (!Number.isFinite(at)) return false;
  return now - at < EVIDENCE_STALE_DAYS * DAY_MS;
}

// ---------------------------------------------------------------- feature

/**
 * Progress for one feature, from the eleven components of brief section 16.1.
 * Components with a total of zero do not apply and are excluded from the maths
 * while staying visible in `components` so the reader can see why.
 */
export async function featureProgress(db, featureId) {
  const feature = await db.get("SELECT * FROM features WHERE id = ?", featureId);
  if (!feature) throw new DbError("E_NOT_FOUND", `Feature ${featureId} does not exist.`);
  return computeFeature(db, feature, await revisionOf(db, feature.project_id), Date.now());
}

async function computeFeature(db, feature, revision, now) {
  const id = feature.id;

  const criteria = await db.all(
    "SELECT * FROM feature_acceptance_criteria WHERE feature_id = ? ORDER BY sequence",
    id,
  );
  const workflows = await db.all("SELECT * FROM workflows WHERE feature_id = ?", id);
  const steps = workflows.length
    ? await db.all(
        `SELECT * FROM workflow_steps WHERE workflow_id IN (${marks(workflows.length)})`,
        ...workflows.map((w) => w.id),
      )
    : [];
  const surfaces = await db.all("SELECT * FROM surfaces WHERE feature_id = ?", id);
  const actions = surfaces.length
    ? await db.all(
        `SELECT * FROM ui_actions WHERE surface_id IN (${marks(surfaces.length)})`,
        ...surfaces.map((s) => s.id),
      )
    : [];
  const apis = await db.all("SELECT * FROM api_operations WHERE feature_id = ?", id);
  const entities = await db.all("SELECT * FROM data_entities WHERE feature_id = ?", id);
  const migrations = await db.all("SELECT * FROM schema_migrations WHERE feature_id = ?", id);
  const integrations = await db.all("SELECT * FROM integrations WHERE feature_id = ?", id);
  const nfrs = await db.all("SELECT * FROM non_functional_requirements WHERE feature_id = ?", id);
  const tasks = await db.all("SELECT * FROM tasks WHERE feature_id = ?", id);
  const evidence = await db.all("SELECT * FROM verification_evidence WHERE feature_id = ?", id);
  const documents = await db.all(
    "SELECT * FROM documents WHERE scope_type = 'feature' AND scope_id = ?",
    id,
  );

  const accepted = Boolean(feature.accepted_at) || settled(feature.status);
  const verifiable = criteria.filter((c) => !retired(c.status));
  const proven = new Set(
    evidence
      .filter((e) => e.acceptance_criterion_id && e.result === "pass" && evidenceIsCurrent(e, now))
      .map((e) => e.acceptance_criterion_id),
  );
  const staleEvidence = evidence.filter(
    (e) => e.status !== "superseded" && !evidenceIsCurrent(e, now),
  );

  const components = [
    comp(SPEC_COMPONENT, { done: accepted ? 1 : 0, total: 1 }),
    comp("Acceptance criteria", tally(criteria)),
    comp("Workflows and steps", tally([...workflows, ...steps])),
    comp("Surfaces and UI actions", tally([...surfaces, ...actions])),
    comp("APIs", tally(apis)),
    comp("Data and migrations", tally([...entities, ...migrations])),
    comp("Integrations", tally(integrations, (r) => r.verification_status === "verified")),
    comp("NFRs", tally(nfrs)),
    comp("Tasks", tally(tasks)),
    comp("Verification evidence", {
      done: verifiable.filter((c) => proven.has(c.id)).length,
      total: verifiable.length,
    }),
    comp("Documentation sync", tally(documents, (r) =>
      r.sync_status === "generated" || r.sync_status === "accepted")),
  ];

  // Acceptance of the specification is not itself a completion contract: a
  // feature whose only declared content is its own acceptance has nothing to
  // count, and saying zero percent about it would be an invented fact.
  const measurable = components.some((c) => c.applies && c.name !== SPEC_COMPONENT);

  const whatRemainsExtra = [];
  if (staleEvidence.length) {
    whatRemainsExtra.push(
      `${count(staleEvidence.length, "verification record")} ${agrees(staleEvidence.length, "is", "are")} older than ${EVIDENCE_STALE_DAYS} days and no longer count as proof.`,
    );
  }
  const retiredTasks = tasks.filter((t) => retired(t.status)).length;
  const whatCountsExtra = retiredTasks
    ? [`${count(retiredTasks, "cancelled or superseded task")} ${agrees(retiredTasks, "is", "are")} excluded from the totals and stay in history.`]
    : [];

  return {
    ...summarize({
      unit: "feature contract item",
      components,
      revision,
      measurable,
      now,
      whatCountsExtra,
      whatRemainsExtra,
      stale: staleEvidence.length > 0,
      reason:
        "This feature declares no completion contract yet: no acceptance criteria, workflows, surfaces, APIs, data, integrations, NFRs or tasks. Progress is not measurable.",
    }),
    subject: { type: "feature", id, name: feature.name, status: feature.status },
  };
}

// ----------------------------------------------------------------- parents

/**
 * Roll child progress up as delivered or not. A child with no completion
 * contract cannot be delivered, so it is named rather than quietly counted as
 * either done or outstanding.
 */
function delivered(progresses) {
  const measurable = progresses.filter((p) => p.measurable);
  return {
    done: measurable.filter((p) => p.percent === 100).length,
    total: measurable.length,
  };
}

const unmeasurableNote = (progresses, noun) => {
  const n = progresses.filter((p) => !p.measurable).length;
  if (!n) return [];
  // The noun arrives singular and is agreed with the count here, and so is the
  // verb: "1 feature(s) have no declared completion contract" is a sentence
  // that already knows the number and hedges about it anyway.
  return [
    `${count(n, noun)} ${n === 1 ? "has" : "have"} no declared completion contract and cannot count toward this number.`,
  ];
};

/** Sum the child components by name so a parent shows where the work sits. */
function sumComponents(progresses) {
  const byName = new Map();
  for (const p of progresses) {
    for (const c of p.components) {
      const current = byName.get(c.name) ?? { done: 0, total: 0 };
      current.done += c.done;
      current.total += c.total;
      byName.set(c.name, current);
    }
  }
  return [...byName.entries()].map(([name, counts]) => comp(name, counts));
}

/** Conditions stored as JSON. A plain string carries no state, so it is outstanding. */
function conditionCounts(list) {
  let done = 0;
  let total = 0;
  for (const entry of list) {
    if (entry && typeof entry === "object") {
      const status = entry.status ?? entry.state;
      if (retired(status)) continue;
      total += 1;
      if (entry.met === true || settled(status)) done += 1;
    } else if (String(entry ?? "").trim()) {
      total += 1;
    }
  }
  return { done, total };
}

/** Module progress derives from its features. Brief section 16.2. */
export async function moduleProgress(db, moduleId) {
  const module = await db.get("SELECT * FROM modules WHERE id = ?", moduleId);
  if (!module) throw new DbError("E_NOT_FOUND", `Module ${moduleId} does not exist.`);
  const revision = await revisionOf(db, module.project_id);
  const now = Date.now();
  const features = (await db.all("SELECT * FROM features WHERE module_id = ?", moduleId))
    .filter((f) => !retired(f.status));
  const progresses = [];
  for (const feature of features) progresses.push(await computeFeature(db, feature, revision, now));
  return moduleFrom(module, progresses, revision, now);
}

function moduleFrom(module, progresses, revision, now) {
  const components = sumComponents(progresses);
  const complete = delivered(progresses);
  return {
    ...summarize({
      // What is summed here is each feature's contract items, so the total is
      // contract items and not features. Calling it "feature" made a module
      // with four features report "4 of 16 features complete", which is a
      // number nobody can reconcile with the four features listed beside it.
      unit: "feature contract item across this module",
      components,
      revision,
      measurable: progresses.some((p) => p.measurable),
      now,
      whatCountsExtra: [
        `${complete.done} of ${count(complete.total, "measurable feature")} in this module are complete.`,
      ],
      whatRemainsExtra: unmeasurableNote(progresses, "feature"),
      stale: progresses.some((p) => p.stale),
      reason:
        "This module has no feature with a declared completion contract, so its progress is not measurable.",
    }),
    subject: { type: "module", id: module.id, name: module.name, status: module.status },
    features: progresses.map(childSummary),
  };
}

/** Milestone progress derives from its delivered features and its exit conditions. */
export async function milestoneProgress(db, milestoneId) {
  const milestone = await db.get("SELECT * FROM milestones WHERE id = ?", milestoneId);
  if (!milestone) throw new DbError("E_NOT_FOUND", `Milestone ${milestoneId} does not exist.`);
  const revision = await revisionOf(db, milestone.project_id);
  const now = Date.now();
  const features = (await db.all("SELECT * FROM features WHERE milestone_id = ?", milestoneId))
    .filter((f) => !retired(f.status));
  const progresses = [];
  for (const feature of features) progresses.push(await computeFeature(db, feature, revision, now));
  return milestoneFrom(milestone, progresses, revision, now);
}

function milestoneFrom(milestone, progresses, revision, now) {
  const exit = conditionCounts(json(milestone.exit_conditions_json, []));
  const components = [
    comp("Features delivered", delivered(progresses)),
    comp("Exit conditions", exit),
  ];
  return {
    ...summarize({
      unit: "delivery item",
      components,
      revision,
      measurable: components.some((c) => c.applies),
      now,
      whatRemainsExtra: unmeasurableNote(progresses, "feature"),
      stale: progresses.some((p) => p.stale),
      reason:
        "This milestone has no exit conditions and no feature with a completion contract, so it cannot be measured.",
    }),
    subject: { type: "milestone", id: milestone.id, name: milestone.name, status: milestone.status },
    features: progresses.map(childSummary),
  };
}

/** Goal progress derives from supporting feature outcomes and success criteria. */
export async function goalProgress(db, goalId) {
  const goal = await db.get("SELECT * FROM goals WHERE id = ?", goalId);
  if (!goal) throw new DbError("E_NOT_FOUND", `Goal ${goalId} does not exist.`);
  const revision = await revisionOf(db, goal.project_id);
  const now = Date.now();
  const features = (
    await db.all(
      `SELECT f.* FROM features f
         JOIN feature_goals fg ON fg.feature_id = f.id
        WHERE fg.goal_id = ?`,
      goalId,
    )
  ).filter((f) => !retired(f.status));
  const criteria = await db.all(
    "SELECT * FROM goal_success_criteria WHERE goal_id = ? ORDER BY sequence",
    goalId,
  );
  const progresses = [];
  for (const feature of features) progresses.push(await computeFeature(db, feature, revision, now));
  return goalFrom(goal, progresses, criteria, revision, now);
}

function goalFrom(goal, progresses, criteria, revision, now) {
  const components = [
    comp("Supporting features delivered", delivered(progresses)),
    comp("Success criteria met", tally(criteria)),
  ];
  const unmeasured = criteria.filter((c) => c.status === "unmeasured").length;
  const whatRemainsExtra = unmeasurableNote(progresses, "supporting feature");
  if (unmeasured) {
    whatRemainsExtra.push(
      `${count(unmeasured, "success criterion", "success criteria")} ${agrees(unmeasured, "has", "have")} never been measured, so they count as unmet.`,
    );
  }
  return {
    ...summarize({
      unit: "goal outcome",
      components,
      revision,
      measurable: components.some((c) => c.applies),
      now,
      whatRemainsExtra,
      stale: progresses.some((p) => p.stale),
      reason:
        "This goal declares no success criteria and no supporting feature with a completion contract, so it cannot be measured.",
    }),
    subject: { type: "goal", id: goal.id, name: goal.name, status: goal.status },
    features: progresses.map(childSummary),
  };
}

const childSummary = (p) => ({
  id: p.subject.id,
  name: p.subject.name,
  percent: p.percent,
  completed: p.completed,
  total: p.total,
  measurable: p.measurable,
  stale: p.stale,
});

/**
 * Project progress covers the currently accepted scope, not every idea ever
 * discussed. Drafts are named in `whatCounts` so their exclusion is visible
 * rather than silent.
 */
export async function projectProgress(db, projectId) {
  const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) throw new DbError("E_NOT_FOUND", `Project ${projectId} does not exist.`);
  const revision = await revisionOf(db, projectId);
  const now = Date.now();

  const allFeatures = await db.all("SELECT * FROM features WHERE project_id = ?", projectId);
  const live = allFeatures.filter((f) => !retired(f.status));
  const byId = new Map();
  for (const feature of live) byId.set(feature.id, await computeFeature(db, feature, revision, now));

  const acceptedFeatures = live.filter((f) => Boolean(f.accepted_at) || settled(f.status));
  const acceptedProgress = acceptedFeatures.map((f) => byId.get(f.id));

  const milestones = (await db.all("SELECT * FROM milestones WHERE project_id = ?", projectId))
    .filter((m) => !retired(m.status));
  const milestoneProgresses = milestones.map((m) =>
    milestoneFrom(m, live.filter((f) => f.milestone_id === m.id).map((f) => byId.get(f.id)), revision, now),
  );

  const goals = (await db.all("SELECT * FROM goals WHERE project_id = ?", projectId))
    .filter((g) => !retired(g.status));
  const goalCriteria = goals.length
    ? await db.all(
        `SELECT * FROM goal_success_criteria WHERE goal_id IN (${marks(goals.length)})`,
        ...goals.map((g) => g.id),
      )
    : [];

  const components = [
    comp("Accepted features delivered", delivered(acceptedProgress)),
    comp("Milestones reached", delivered(milestoneProgresses)),
    comp("Goal success criteria met", tally(goalCriteria)),
  ];

  const drafts = live.length - acceptedFeatures.length;
  const whatCountsExtra = [
    `Only accepted scope counts: ${count(acceptedFeatures.length, "accepted feature")} of ${live.length} live.`,
  ];
  if (drafts) whatCountsExtra.push(`${count(drafts, "feature")} are not accepted yet and are excluded.`);
  const retiredFeatures = allFeatures.length - live.length;
  if (retiredFeatures) {
    whatCountsExtra.push(
      `${count(retiredFeatures, "cancelled or superseded feature")} ${agrees(retiredFeatures, "is", "are")} excluded from the totals and stay in history.`,
    );
  }

  return {
    ...summarize({
      unit: "scope item",
      components,
      revision,
      measurable: components.some((c) => c.applies),
      now,
      whatCountsExtra,
      whatRemainsExtra: unmeasurableNote(acceptedProgress, "accepted feature"),
      stale: [...byId.values()].some((p) => p.stale),
      reason:
        "Nothing is accepted yet: no accepted feature, milestone or goal success criterion to measure. Accept scope before asking how far along it is.",
    }),
    subject: { type: "project", id: project.id, name: project.name, status: project.status },
    milestones: milestoneProgresses.map(childSummary),
    features: acceptedProgress.map(childSummary),
  };
}

// --------------------------------------------------------------- readiness

/**
 * Production readiness: the capability checklist, the twenty-step module loop,
 * open questions and documentation sync. Brief sections 8.2, 9.3 and 15.2.
 * Deferred and awaiting-decision areas count as unresolved, because a silent
 * gap is the failure this checklist exists to prevent.
 */
export async function readiness(db, projectId) {
  const revision = await revisionOf(db, projectId);
  const now = Date.now();

  const areas = await db.all(
    `SELECT * FROM capability_areas
      WHERE project_id = ? AND catalog = 'readiness'
      ORDER BY sequence, area`,
    projectId,
  );
  const modules = (await db.all("SELECT * FROM modules WHERE project_id = ? ORDER BY sequence, name", projectId))
    .filter((m) => !retired(m.status));
  const steps = modules.length
    ? await db.all(
        `SELECT * FROM module_completeness WHERE module_id IN (${marks(modules.length)}) ORDER BY module_id, step`,
        ...modules.map((m) => m.id),
      )
    : [];
  const questions = await db.all("SELECT * FROM questions WHERE project_id = ?", projectId);
  const documents = await db.all("SELECT * FROM documents WHERE project_id = ?", projectId);

  // What an accepted feature actually describes, counted per feature.
  //
  // Readiness counted capability areas, module completeness steps, questions and
  // documents, and nothing else. So a project whose features were all accepted
  // could report ninety-nine percent while its surfaces, data model, API and
  // architecture were empty, and every one of those areas of the interface sat
  // blank with nothing in the number to suggest anything was missing. A figure
  // that cannot fall for a whole missing layer is not measuring the layer.
  //
  // Only accepted features are counted. A drafted one is not yet a promise, and
  // holding readiness down for work nobody has agreed to is how a number stops
  // being read.
  const acceptedFeatures = await db.all(
    "SELECT id, name, spec_depth FROM features WHERE project_id = ? AND status NOT IN ('draft','retired','superseded')",
    projectId,
  );
  const described = { surfaces: 0, dataOrApi: 0, workflow: 0 };
  for (const feature of acceptedFeatures) {
    const has = async (table) => Number(
      (await db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE feature_id = ?`, feature.id))?.n ?? 0) > 0;
    if (await has("surfaces")) described.surfaces += 1;
    // Either satisfies it, the same way the depth gate treats them: a feature can
    // be backed by stored data or by an operation, and demanding both would fail a
    // feature that legitimately has one.
    if (await has("data_entities") || await has("api_operations")) described.dataOrApi += 1;
    if (await has("workflows")) described.workflow += 1;
  }

  const areaCounts = { specified: 0, awaiting_decision: 0, deferred: 0, not_applicable: 0 };
  for (const area of areas) areaCounts[area.state] = (areaCounts[area.state] ?? 0) + 1;

  const applicableAreas = areas.filter((a) => a.state !== "not_applicable");
  const applicableSteps = steps.filter((s) => s.state !== "not_applicable");
  const liveQuestions = questions.filter((q) => q.status !== "withdrawn");

  const components = [
    comp("Capability areas specified", {
      done: applicableAreas.filter((a) => a.state === "specified").length,
      total: applicableAreas.length,
    }),
    comp("Module completeness steps", {
      done: applicableSteps.filter((s) => s.state === "filled").length,
      total: applicableSteps.length,
    }),
    comp("Questions answered", {
      done: liveQuestions.filter((q) => q.status === "answered").length,
      total: liveQuestions.length,
    }),
    // Retired documents leave the total rather than counting against it. The
    // record each described is gone and nothing generates them any more, so
    // counting them as out of sync asks for work nobody can do and holds
    // readiness below a hundred forever.
    comp("Documentation in sync", tally(
      documents.filter((d) => d.sync_status !== "retired"),
      (d) => d.sync_status === "generated" || d.sync_status === "accepted")),
    // Four components rather than one, because "the architecture is described" is
    // not a single fact: a product can have its screens worked out and no data
    // model, and averaging that into one figure hides which half is missing.
    // Absent when nothing is accepted yet, since there is nothing to describe.
    ...(acceptedFeatures.length
      ? [
          comp("Accepted features with a surface", { done: described.surfaces, total: acceptedFeatures.length }),
          comp("Accepted features with data or an API", { done: described.dataOrApi, total: acceptedFeatures.length }),
          comp("Accepted features with a workflow", { done: described.workflow, total: acceptedFeatures.length }),
        ]
      : []),
  ];

  const unresolvedAreas = areas.filter(
    (a) => a.state === "awaiting_decision" || a.state === "deferred",
  );
  const silentGaps = unresolvedAreas.filter((a) => !a.question_id && !a.owner);
  const whatRemainsExtra = [];
  if (silentGaps.length) {
    whatRemainsExtra.push(
      `${count(silentGaps.length, "unresolved capability area")} ${agrees(silentGaps.length, "has", "have")} no owner and no open question, which is a silent gap.`,
    );
  }
  const pendingProposals = documents.filter((d) => d.sync_status === "manual_edit_pending");
  if (pendingProposals.length) {
    whatRemainsExtra.push(
      `${count(pendingProposals.length, "document")} were edited by hand and are waiting on an accept or reject decision.`,
    );
  }

  return {
    ...summarize({
      unit: "readiness item",
      components,
      revision,
      measurable: components.some((c) => c.applies),
      now,
      whatCountsExtra: areaCounts.not_applicable
        ? [`${count(areaCounts.not_applicable, "capability area")} ${agrees(areaCounts.not_applicable, "is", "are")} recorded as not applicable, with a reason, and are excluded.`]
        : [],
      whatRemainsExtra,
      stale: pendingProposals.length > 0,
      reason:
        "No readiness checklist has been recorded for this project, so readiness cannot be measured. Run discovery to evaluate the capability areas.",
    }),
    subject: { type: "project", id: projectId },
    areaCounts,
    areas: areas.map((a) => ({
      id: a.id,
      area: a.area,
      state: a.state,
      choice: a.choice,
      reason: a.reason,
      owner: a.owner,
      revisitTrigger: a.revisit_trigger,
      consequence: a.consequence,
      questionId: a.question_id,
      decisionId: a.decision_id,
      silentGap: !a.question_id && !a.owner && (a.state === "awaiting_decision" || a.state === "deferred"),
    })),
    modules: modules.map((m) => {
      const mine = steps.filter((s) => s.module_id === m.id);
      const applicable = mine.filter((s) => s.state !== "not_applicable");
      return {
        id: m.id,
        name: m.name,
        filled: applicable.filter((s) => s.state === "filled").length,
        applicable: applicable.length,
        openSteps: applicable
          .filter((s) => s.state !== "filled")
          .map((s) => ({ step: s.step, name: s.step_name })),
      };
    }),
    questions: {
      open: liveQuestions.filter((q) => q.status === "open").map(questionSummary),
      deferred: liveQuestions.filter((q) => q.status === "deferred").map(questionSummary),
    },
    pendingDocumentProposals: pendingProposals.map((d) => ({ id: d.id, path: d.path, kind: d.kind })),
  };
}

const questionSummary = (q) => ({
  id: q.id,
  question: q.question,
  whyItMatters: q.why_it_matters,
  recommendation: q.recommendation,
  scopeType: q.scope_type,
  scopeId: q.scope_id,
  deferralReason: q.deferral_reason,
});

// --------------------------------------------------------------- freshness

/**
 * Is what we are looking at the present? Brief section 16.3. This asks a
 * different question from progress: a perfectly complete picture can still be
 * a fortnight out of date, and folding the two together is how "on track" gets
 * said about a snapshot that has since been overtaken.
 */
export async function freshness(db, projectId) {
  const now = Date.now();
  const last = await db.get(
    `SELECT sequence, created_at, event_type, summary FROM activity_events
      WHERE project_id = ? ORDER BY sequence DESC LIMIT 1`,
    projectId,
  );
  const documents = await db.all("SELECT * FROM documents WHERE project_id = ?", projectId);
  const sessions = await db.all(
    `SELECT * FROM work_sessions WHERE project_id = ? AND status = 'active'
      ORDER BY last_activity_at DESC`,
    projectId,
  );
  const branches = await db.all(
    "SELECT * FROM branches WHERE project_id = ? AND status = 'active' ORDER BY last_seen_at DESC",
    projectId,
  );
  const evidence = await db.all(
    "SELECT * FROM verification_evidence WHERE project_id = ? AND status <> 'superseded'",
    projectId,
  );
  const conflicts = await db.all(
    "SELECT count(*) AS n FROM sync_conflicts WHERE project_id = ? AND status = 'open'",
    projectId,
  );

  const revision = last?.sequence ?? 0;
  const generated = documents
    .map((d) => d.generated_at)
    .filter(Boolean)
    .sort();
  // A document is stale when the records it was rendered from have moved on,
  // not when it was merely written. `generate` stamps each row with the revision
  // it rendered at and only then records its own documentation_generated event,
  // so comparing against the raw maximum sequence would report every document as
  // stale the instant it was produced, and no run could ever clear it.
  // Documentation events are excluded because a render is not a content change,
  // and ambient events because a note that files moved or a session started
  // changes no record any document projects. Counting those made every commit
  // mark all of them stale, which the release gate then refused, and regenerating
  // only cleared it until the next commit.
  const IGNORED = [
    "documentation_generated", "documentation_proposal_raised",
    "documentation_proposal_resolved", "documentation_possibly_stale",
    ...AMBIENT_EVENTS,
  ];
  const contentRevision = (await db.get(
    `SELECT max(sequence) AS s FROM activity_events
      WHERE project_id = ? AND event_type NOT IN (${IGNORED.map(() => "?").join(", ")})`,
    projectId, ...IGNORED,
  ))?.s ?? 0;
  const live = documents.filter((d) => d.sync_status !== "retired");
  const behind = live.filter((d) => (d.database_revision ?? 0) < contentRevision);
  const pendingProposals = documents.filter((d) => d.sync_status === "manual_edit_pending");
  const missingDocuments = documents.filter((d) => d.sync_status === "missing");
  const staleEvidence = evidence.filter((e) => !evidenceIsCurrent(e, now));

  const liveSessions = sessions.map((s) => {
    const at = Date.parse(s.last_activity_at ?? s.started_at ?? "");
    return {
      id: s.id,
      developerId: s.developer_id,
      agentId: s.agent_id,
      branchId: s.branch_id,
      activeTaskId: s.active_task_id,
      objective: s.objective,
      lastActivityAt: s.last_activity_at ?? s.started_at ?? null,
      stale: !Number.isFinite(at) || now - at > SESSION_STALE_MS,
    };
  });

  const reasons = [];
  if (behind.length) {
    reasons.push(
      `${count(behind.length, "generated document")} ${behind.length === 1 ? "was" : "were"} built from an older database revision than ${contentRevision}.`,
    );
  }
  if (missingDocuments.length) {
    reasons.push(`${count(missingDocuments.length, "expected document")} ${agrees(missingDocuments.length, "is", "are")} missing from disk.`);
  }
  if (pendingProposals.length) {
    reasons.push(`${count(pendingProposals.length, "document")} have an unresolved manual edit.`);
  }
  if (staleEvidence.length) {
    reasons.push(
      `${count(staleEvidence.length, "verification record")} ${agrees(staleEvidence.length, "is", "are")} older than ${EVIDENCE_STALE_DAYS} days.`,
    );
  }
  const abandoned = liveSessions.filter((s) => s.stale);
  if (abandoned.length) {
    // "1 session are still marked active" reads as a bug in the product, which
    // is a poor way to report somebody else's housekeeping. count() gets the
    // noun right and the verb has to agree with it.
    reasons.push(`${count(abandoned.length, "session")} ${
      abandoned.length === 1 ? "is" : "are"
    } still marked active but ${
      abandoned.length === 1 ? "has" : "have"
    } gone quiet.`);
  }
  const openConflicts = conflicts[0]?.n ?? 0;
  if (openConflicts) reasons.push(`${count(openConflicts, "unresolved sync conflict")}.`);

  return {
    revision,
    lastEventSequence: revision,
    lastEventAt: last?.created_at ?? null,
    lastEventSummary: last?.summary ?? null,
    lastDocumentationGeneratedAt: generated.at(-1) ?? null,
    documentsBehindRevision: behind.length,
    pendingDocumentProposals: pendingProposals.map((d) => ({ id: d.id, path: d.path })),
    missingDocuments: missingDocuments.map((d) => ({ id: d.id, path: d.path })),
    staleEvidence: staleEvidence.map((e) => ({
      id: e.id,
      featureId: e.feature_id,
      taskId: e.task_id,
      summary: e.summary,
      recordedAt: e.recorded_at,
      result: e.result,
    })),
    sessions: liveSessions,
    lastSessionHeartbeatAt: liveSessions[0]?.lastActivityAt ?? null,
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      headRevision: b.head_revision,
      dirty: Boolean(b.dirty),
      lastSeenAt: b.last_seen_at,
    })),
    openSyncConflicts: openConflicts,
    stale: reasons.length > 0,
    reasons,
    generatedAt: iso(now),
  };
}

// -------------------------------------------------------------- next action

const PRIORITY_RANK = { critical: 0, urgent: 1, high: 2, normal: 3, medium: 3, low: 4 };
const rank = (task) => PRIORITY_RANK[String(task.priority ?? "normal").toLowerCase()] ?? 3;
const byPriority = (a, b) =>
  rank(a) - rank(b) || (a.sequence ?? 0) - (b.sequence ?? 0) || String(a.id).localeCompare(String(b.id));

const IN_FLIGHT = new Set(["in_progress", "in_review", "verifying"]);

/**
 * One answer to "what should happen next", as a strict cascade: a blocking
 * problem beats work in progress, which beats ready work, which beats
 * unspecified scope, which beats verification. The cascade is fixed so the CLI
 * and the control center never disagree about the top of the list.
 */
export async function nextAction(db, projectId) {
  const now = Date.now();
  const revision = await revisionOf(db, projectId);
  const context = { revision, generatedAt: iso(now) };



  const tasks = await db.all("SELECT * FROM tasks WHERE project_id = ?", projectId);
  const open = tasks.filter((t) => !retired(t.status));
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // 1. Blocking problems.
  const blocked = open.filter((t) => t.status === "blocked").sort(byPriority);
  if (blocked.length) {
    const task = blocked[0];
    return answer(context, {
      kind: "blocking_problem",
      recordType: "task",
      record: task,
      title: `Unblock ${task.id}: ${task.name}`,
      detail: task.block_reason
        ? `It is blocked because: ${task.block_reason}`
        : "It is blocked and no reason was recorded, so the reason has to be established first.",
      remedy: "Resolve the blocker or record why the work should be cancelled instead.",
      others: blocked.slice(1),
    });
  }

  const failing = await db.all(
    `SELECT * FROM verification_evidence
      WHERE project_id = ? AND result = 'fail' AND status = 'current'
      ORDER BY recorded_at DESC`,
    projectId,
  );
  if (failing.length) {
    const row = failing[0];
    return answer(context, {
      kind: "blocking_problem",
      recordType: "verification_evidence",
      record: row,
      title: `Fix the failing check on ${row.feature_id ?? row.task_id ?? row.id}`,
      detail: `Verification recorded a failure: ${row.summary}`,
      remedy: "Repair the behaviour, then record fresh evidence.",
      others: failing.slice(1),
    });
  }

  const conflicts = await db.all(
    "SELECT * FROM sync_conflicts WHERE project_id = ? AND status = 'open' ORDER BY detected_at",
    projectId,
  );
  if (conflicts.length) {
    const row = conflicts[0];
    return answer(context, {
      kind: "blocking_problem",
      recordType: "sync_conflict",
      record: row,
      title: `Resolve the conflict on ${row.record_type} ${row.record_id}`,
      detail: "Two versions of this record disagree and nothing downstream can be trusted until it is settled.",
      remedy: "Choose the local or remote value, or merge them, and record the resolution.",
      others: conflicts.slice(1),
    });
  }

  // 2. Work already in progress. Finishing beats starting.
  const active = open.filter((t) => IN_FLIGHT.has(t.status)).sort(byPriority);
  if (active.length) {
    const task = active[0];
    return answer(context, {
      kind: "work_in_progress",
      recordType: "task",
      record: task,
      title: `Finish ${task.id}: ${task.name}`,
      detail: `It is already ${task.status.replace(/_/g, " ")}. Finishing open work beats starting more.`,
      remedy: task.expected_outcome
        ? `Expected outcome: ${task.expected_outcome}`
        : "Complete it and attach the verification it declares.",
      others: active.slice(1),
    });
  }

  // 3. Ready work whose dependencies are all satisfied.
  const dependencies = await db.all(
    `SELECT d.* FROM task_dependencies d
       JOIN tasks t ON t.id = d.task_id
      WHERE t.project_id = ? AND d.dependency_type = 'blocks'`,
    projectId,
  );
  const waitingOn = new Map();
  for (const dep of dependencies) {
    const upstream = byId.get(dep.depends_on_task_id);
    if (!upstream) continue;
    if (upstream.status === "complete" || retired(upstream.status)) continue;
    waitingOn.set(dep.task_id, [...(waitingOn.get(dep.task_id) ?? []), upstream.id]);
  }
  const ready = open
    .filter((t) => (t.status === "ready" || t.status === "paused") && !waitingOn.has(t.id))
    .sort(byPriority);
  if (ready.length) {
    const task = ready[0];
    return answer(context, {
      kind: "ready_work",
      recordType: "task",
      record: task,
      title: `${task.status === "paused" ? "Resume" : "Start"} ${task.id}: ${task.name}`,
      detail: task.status === "paused"
        ? "It was paused and nothing is blocking it now."
        : "It is ready and nothing is blocking it.",
      remedy: task.expected_outcome ? `Expected outcome: ${task.expected_outcome}` : "Claim it and begin.",
      others: ready.slice(1),
    });
  }

  // 4. Scope that cannot be worked because it was never specified.
  const features = (await db.all("SELECT * FROM features WHERE project_id = ?", projectId))
    .filter((f) => !retired(f.status));
  const criteriaCount = await countBy(db, "feature_acceptance_criteria", "feature_id");
  const taskCount = new Map();
  for (const task of open) taskCount.set(task.feature_id, (taskCount.get(task.feature_id) ?? 0) + 1);
  const unspecified = features.filter(
    (f) => !(criteriaCount.get(f.id) > 0) && !(taskCount.get(f.id) > 0),
  );
  if (unspecified.length) {
    const feature = unspecified[0];
    return answer(context, {
      kind: "unspecified_feature",
      recordType: "feature",
      record: feature,
      title: `Specify ${feature.id}: ${feature.name}`,
      detail: "It has no acceptance criteria and no tasks, so its progress cannot be measured at all.",
      remedy: "Write the acceptance criteria, then derive tasks from them.",
      others: unspecified.slice(1),
    });
  }

  const questions = await db.all(
    "SELECT * FROM questions WHERE project_id = ? AND status = 'open' ORDER BY created_at",
    projectId,
  );
  if (questions.length) {
    const question = questions[0];
    return answer(context, {
      kind: "unspecified_feature",
      recordType: "question",
      record: question,
      title: `Answer ${question.id}: ${question.question}`,
      detail: `It matters because: ${question.why_it_matters}`,
      remedy: question.recommendation
        ? `Recommendation on file: ${question.recommendation}`
        : "Decide, or defer it with an owner and a revisit trigger.",
      others: questions.slice(1),
    });
  }

  // 5. Work that is done but unproven.
  const evidence = await db.all(
    "SELECT * FROM verification_evidence WHERE project_id = ?",
    projectId,
  );
  const proven = new Set(
    evidence
      .filter((e) => e.acceptance_criterion_id && e.result === "pass" && evidenceIsCurrent(e, now))
      .map((e) => e.acceptance_criterion_id),
  );
  const criteria = features.length
    ? await db.all(
        `SELECT * FROM feature_acceptance_criteria WHERE feature_id IN (${marks(features.length)})`,
        ...features.map((f) => f.id),
      )
    : [];
  const unproven = criteria.filter((c) => c.status === "met" && !proven.has(c.id));
  if (unproven.length) {
    const criterion = unproven[0];
    return answer(context, {
      kind: "verification",
      recordType: "feature_acceptance_criterion",
      record: criterion,
      title: `Prove ${criterion.id} on ${criterion.feature_id}`,
      detail: `It is marked met with no current evidence: ${criterion.criterion}`,
      remedy: criterion.verification_method
        ? `Run the declared check and record the result: ${criterion.verification_method}`
        : "Record how it was verified, or move it back to unmet.",
      others: unproven.slice(1),
    });
  }

  const stale = evidence.filter((e) => e.status !== "superseded" && !evidenceIsCurrent(e, now));
  if (stale.length) {
    const row = stale[0];
    return answer(context, {
      kind: "verification",
      recordType: "verification_evidence",
      record: row,
      title: `Re-verify ${row.feature_id ?? row.task_id ?? row.id}`,
      detail: `Its proof is older than ${EVIDENCE_STALE_DAYS} days, so it no longer counts: ${row.summary}`,
      remedy: "Run the check again and record fresh evidence.",
      others: stale.slice(1),
    });
  }

  const drafts = open.filter((t) => t.status === "draft").sort(byPriority);
  if (drafts.length) {
    const task = drafts[0];
    return answer(context, {
      kind: "ready_work",
      recordType: "task",
      record: task,
      title: `Complete the definition of ${task.id}: ${task.name}`,
      detail: "It is still a draft, so it cannot be claimed. A task leaves draft only with a contract link or a named feature it unblocks.",
      remedy: "Link it to what it implements, then move it to ready.",
      others: drafts.slice(1),
    });
  }

  return {
    kind: "nothing_pending",
    title: "Nothing is pending",
    detail: "No blocked work, no work in progress, no ready work, no unspecified feature and no unproven criterion.",
    remedy: "Accept more scope, or ship.",
    recordType: null,
    recordId: null,
    record: null,
    alternatives: [],
    sourceRevision: revision,
    generatedAt: context.generatedAt,
  };
}

function answer(context, { kind, recordType, record, title, detail, remedy, others = [] }) {
  return {
    kind,
    title,
    detail,
    remedy,
    recordType,
    recordId: record.id,
    record,
    alternatives: others.slice(0, 4).map((o) => ({
      id: o.id,
      label: o.name ?? o.question ?? o.summary ?? o.criterion ?? o.record_id ?? o.id,
    })),
    alsoWaiting: others.length,
    sourceRevision: context.revision,
    generatedAt: context.generatedAt,
  };
}

async function countBy(db, table, column) {
  const rows = await db.all(`SELECT ${column} AS key, count(*) AS n FROM ${table} GROUP BY ${column}`);
  return new Map(rows.map((r) => [r.key, r.n]));
}

// --------------------------------------------------------------- alignment

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * Coherence of the map, which is a separate question from progress and from
 * freshness. Every warning names one record and one thing to do about it: a
 * warning nobody can act on is noise, and noise is how people learn to ignore
 * the whole list.
 */
export async function alignmentWarnings(db, projectId) {
  const now = Date.now();
  const out = [];
  const warn = (severity, code, recordType, recordId, title, detail, remedy) =>
    out.push({ severity, code, recordType, recordId, title, detail, remedy });

  const features = (await db.all("SELECT * FROM features WHERE project_id = ?", projectId))
    .filter((f) => !retired(f.status));
  const criteria = features.length
    ? await db.all(
        `SELECT * FROM feature_acceptance_criteria WHERE feature_id IN (${marks(features.length)})`,
        ...features.map((f) => f.id),
      )
    : [];
  // A feature that says it is specified to full depth while carrying microspec
  // content is a promise the record does not keep, and the depth is exactly what
  // a reader trusts when deciding whether to ask more questions.
  const { depthReadiness } = await import("../features/acceptance.mjs");
  for (const feature of features) {
    if (feature.status !== "accepted") continue;
    try {
      const depth = await depthReadiness(db, feature.id);
      if (depth.acceptable) continue;
      warn(
        "high",
        "feature_thinner_than_its_depth",
        "feature",
        feature.id,
        `${feature.name} claims ${depth.depth} depth but does not carry it`,
        `${depth.met} of the ${depth.required} things ${depth.depth} depth promises are recorded. Missing: ${depth.missing.map((m) => m.says).join("; ")}.`,
        "Record what is missing, or lower the feature's depth so the record matches the feature.",
      );
    } catch {
      // An unreadable depth is not a reason to lose every other warning.
    }
  }
  const tasks = await db.all("SELECT * FROM tasks WHERE project_id = ?", projectId);
  const links = await db.all("SELECT * FROM feature_goals");
  const evidence = await db.all("SELECT * FROM verification_evidence WHERE project_id = ?", projectId);

  const criteriaByFeature = new Map();
  for (const c of criteria) {
    if (retired(c.status)) continue;
    criteriaByFeature.set(c.feature_id, [...(criteriaByFeature.get(c.feature_id) ?? []), c]);
  }
  const tasksByFeature = new Map();
  for (const t of tasks) {
    if (retired(t.status)) continue;
    tasksByFeature.set(t.feature_id, [...(tasksByFeature.get(t.feature_id) ?? []), t]);
  }
  const goalsByFeature = new Set(links.map((l) => l.feature_id));
  const proven = new Set(
    evidence
      .filter((e) => e.acceptance_criterion_id && e.result === "pass" && evidenceIsCurrent(e, now))
      .map((e) => e.acceptance_criterion_id),
  );

  for (const feature of features) {
    const mine = criteriaByFeature.get(feature.id) ?? [];
    const myTasks = tasksByFeature.get(feature.id) ?? [];
    if (!mine.length) {
      warn("medium", "feature_without_acceptance_criteria", "feature", feature.id,
        `${feature.id} has no acceptance criteria`,
        "Nothing states when this feature is done, so its progress cannot be measured and no task can be verified against it.",
        "Write one with superdev feature specify <id> --criterion, giving what must be true and how it is checked.");
    }
    if (!goalsByFeature.has(feature.id)) {
      warn("medium", "feature_without_goal", "feature", feature.id,
        `${feature.id} serves no goal`,
        "It is not linked to any goal, so it cannot be traded off against anything or justified when scope is cut.",
        "Link it to the goal it advances, or move it out of scope.");
    }
    const accepted = Boolean(feature.accepted_at) || settled(feature.status);
    if (accepted && !myTasks.length && mine.some((c) => c.status !== "met")) {
      warn("medium", "accepted_feature_without_tasks", "feature", feature.id,
        `${feature.id} is accepted with unmet criteria and no open tasks`,
        "Accepted scope with nothing planned against it quietly stalls.",
        "Run superdev derive <id> --apply, which turns its acceptance criteria into tasks.");
    }
    if (finished(feature.status) && mine.some((c) => c.status === "unmet")) {
      const n = mine.filter((c) => c.status === "unmet").length;
      warn("high", "feature_complete_with_unmet_criteria", "feature", feature.id,
        `${feature.id} claims ${feature.status} with ${count(n, "unmet criterion", "unmet criteria")}`,
        "The status says finished and the contract says otherwise. One of the two is wrong.",
        "Record evidence with superdev task evidence, waive a criterion with superdev feature waive, or move the feature back.");
    }
    if (finished(feature.status)) {
      const openTasks = myTasks.filter((t) => t.status !== "complete");
      if (openTasks.length) {
        warn("high", "feature_complete_with_open_tasks", "feature", feature.id,
          `${feature.id} claims ${feature.status} with ${count(openTasks.length, "open task")}`,
          "A feature cannot be finished while the work it declared is not.",
          "Close or cancel the remaining tasks, or reopen the feature.");
      }
    }
  }

  for (const c of criteria) {
    if (c.status === "met" && !proven.has(c.id)) {
      warn("medium", "criterion_met_without_evidence", "feature_acceptance_criterion", c.id,
        `${c.id} is met with no current evidence`,
        `It was marked met but nothing current proves it: ${c.criterion}`,
        "Attach passing evidence with superdev task evidence --criterion <id>, or retire the proof it rests on with superdev evidence supersede.");
    }
  }

  for (const e of evidence) {
    if (e.status !== "superseded" && !evidenceIsCurrent(e, now)) {
      warn("medium", "stale_evidence", "verification_evidence", e.id,
        `${e.id} is no longer current proof`,
        `Recorded ${e.recorded_at} and older than ${EVIDENCE_STALE_DAYS} days: ${e.summary}`,
        "Run the check again and record fresh evidence.");
    }
  }

  const goals = (await db.all("SELECT * FROM goals WHERE project_id = ?", projectId))
    .filter((g) => !retired(g.status));
  const goalCriteria = goals.length
    ? await db.all(
        `SELECT * FROM goal_success_criteria WHERE goal_id IN (${marks(goals.length)})`,
        ...goals.map((g) => g.id),
      )
    : [];
  const supported = new Set(links.map((l) => l.goal_id));
  for (const goal of goals) {
    if (!goalCriteria.some((c) => c.goal_id === goal.id)) {
      warn("medium", "goal_without_success_criteria", "goal", goal.id,
        `${goal.id} has no success criteria`,
        "Without a measurable criterion this goal can never be shown to have been reached.",
        "Add at least one criterion with a measurement method and a target.");
    }
    if (!supported.has(goal.id)) {
      warn("medium", "goal_without_features", "goal", goal.id,
        `${goal.id} has no supporting features`,
        "Nothing being built advances this goal.",
        "Link the features that serve it, or retire the goal.");
    }
  }

  const milestones = (await db.all("SELECT * FROM milestones WHERE project_id = ?", projectId))
    .filter((m) => !retired(m.status));
  for (const milestone of milestones) {
    if (!conditionCounts(json(milestone.exit_conditions_json, [])).total) {
      warn("medium", "milestone_without_exit_conditions", "milestone", milestone.id,
        `${milestone.id} has no exit conditions`,
        "There is no stated test for whether this milestone has been reached.",
        "Record the conditions that must hold before it can be called done.");
    }
    // A milestone with no features and no exit conditions is empty and worth
    // reporting. One with exit conditions and no features is a gate rather than
    // a delivery phase: a release checkpoint whose test is a set of conditions
    // over the whole product, not a bag of scheduled work. Flagging that told
    // the reader to assign scope to something that deliberately has none, and
    // following the advice would have double counted every feature.
    const hasFeatures = features.some((f) => f.milestone_id === milestone.id);
    const hasExitConditions = conditionCounts(json(milestone.exit_conditions_json, [])).total > 0;
    if (!hasFeatures && !hasExitConditions) {
      warn("low", "milestone_without_features", "milestone", milestone.id,
        `${milestone.id} has neither features nor exit conditions`,
        "No scope is assigned to it and nothing says when it is reached, so it cannot be delivered or measured.",
        "Assign the features it delivers, record the conditions that must hold, or remove it.");
    }
  }

  const modules = (await db.all("SELECT * FROM modules WHERE project_id = ?", projectId))
    .filter((m) => !retired(m.status));
  for (const module of modules) {
    if (!features.some((f) => f.module_id === module.id)) {
      warn("low", "module_without_features", "module", module.id,
        `${module.id} has no features`,
        "The module is declared but owns nothing.",
        "Add the features it owns, or deprecate it.");
    }
  }

  const contractLinks = await db.all("SELECT DISTINCT task_id FROM task_contract_links");
  const mapped = new Set(contractLinks.map((r) => r.task_id));
  for (const task of tasks) {
    if (retired(task.status) || task.status === "draft") continue;
    if (task.enabling) {
      if (!task.enabled_feature_id || !task.enabling_rationale) {
        warn("high", "enabling_task_without_target", "task", task.id,
          `${task.id} is enabling work with no named target`,
          "Enabling work that names no feature it unblocks is indistinguishable from unmapped work.",
          "Name the feature it unblocks and record why.");
      }
      continue;
    }
    if (!mapped.has(task.id)) {
      warn("high", "task_without_contract", "task", task.id,
        `${task.id} implements nothing declared`,
        "It left draft without a contract link, so no specification moves when it completes.",
        "Link it to the criterion, workflow step, API, entity or surface it implements.");
    }
  }

  const areas = await db.all(
    "SELECT * FROM capability_areas WHERE project_id = ? AND catalog = 'readiness'",
    projectId,
  );
  for (const area of areas) {
    if (area.state === "awaiting_decision" && !area.question_id) {
      warn("high", "capability_gap_without_question", "capability_area", area.id,
        `${area.area} is awaiting a decision with no question raised`,
        "An unanswered area with nobody asked is a silent gap, which this checklist exists to make impossible.",
        "Raise the question, or record the area as not applicable with a reason.");
    }
    if (area.state === "deferred" && (!area.owner || !area.revisit_trigger)) {
      warn("medium", "deferred_without_owner", "capability_area", area.id,
        `${area.area} is deferred without an owner or a revisit trigger`,
        "A deferral with nobody to revisit it is a decision never to do it.",
        "Record the owner, the revisit trigger and the consequence of leaving it.");
    }
  }

  const decisions = await db.all(
    "SELECT * FROM decisions WHERE project_id = ? AND status IN ('accepted','time_boxed','revisit_required')",
    projectId,
  );
  for (const decision of decisions) {
    const expiry = Date.parse(decision.expires_at ?? "");
    if (Number.isFinite(expiry) && expiry <= now) {
      warn("high", "decision_expired", "decision", decision.id,
        `${decision.id} has passed its expiry`,
        `A time-boxed decision stopped governing on ${decision.expires_at} and is still marked ${decision.status}.`,
        "Re-accept it, supersede it, or record what replaced it.");
    }
    if (decision.status === "revisit_required") {
      warn("medium", "decision_needs_revisit", "decision", decision.id,
        `${decision.id} is flagged for revisit`,
        "A revisit trigger fired and the decision has not been looked at since.",
        "Confirm it with superdev memory verify <id>, or replace it with superdev memory supersede <id>.");
    }
  }

  const documents = await db.all(
    "SELECT * FROM documents WHERE project_id = ? AND sync_status IN ('manual_edit_pending','missing')",
    projectId,
  );
  for (const doc of documents) {
    warn("medium", `document_${doc.sync_status}`, "document", doc.id,
      doc.sync_status === "missing"
        ? `${doc.path} is missing from disk`
        : `${doc.path} was edited by hand`,
      doc.sync_status === "missing"
        ? "A generated document that should exist is not there, so what people read and what the database holds have parted company."
        : "The file no longer matches what was generated, so regeneration is held back until someone decides.",
      doc.sync_status === "missing"
        ? "Regenerate it."
        : "Take it in with superdev docs accept <path> --apply, or put the generated version back with superdev docs reject <path> --apply.");
  }

  // The product changing while nothing tracked it is the record falling behind,
  // which is what this whole report is for. The hook has recorded that marker
  // since it was written and nothing read it, so the one place a reader looks
  // for "is the record still true?" never mentioned the clearest sign that it
  // is not. Only markers since the last task was claimed count: an older one
  // describes work somebody has since accounted for.
  const untracked = await db.get(
    `SELECT COUNT(*) AS n, MAX(created_at) AS latest FROM activity_events
      WHERE project_id = ? AND event_type = 'untracked_work'
        AND created_at > coalesce(
          (SELECT MAX(created_at) FROM activity_events
            WHERE project_id = ? AND event_type IN ('task_claimed', 'task_created')), '')`,
    projectId, projectId,
  );
  if (Number(untracked?.n ?? 0) > 0) {
    warn("high", "work_without_a_task", "project", projectId,
      `${untracked.n} ${Number(untracked.n) === 1 ? "change was" : "changes were"} made while no task was claimed`,
      "The product changed and nothing in the record says why, which feature it serves, or what would prove it. Progress is derived from tracked work, so this work is invisible to every number on this page.",
      "Create or claim a task covering it, then link it to the contract it implements.");
  }

  return out.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      String(a.recordId).localeCompare(String(b.recordId)),
  );
}
