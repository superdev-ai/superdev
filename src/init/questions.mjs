// The questions worth a person's attention, and the rows that make a gap
// queryable instead of forgettable.
//
// Two rules shape this file. First, a question is only material when the answer
// changes what gets built; everything else gets a recommended default recorded
// as a deferral with an owner and a revisit trigger, which is the brief's fourth
// capability state and the reason a silent gap cannot happen here. Second,
// "I do not know" is a legitimate answer: it becomes a reversible assumption and
// the question stays open, because a forced guess recorded as a decision is
// worse than an honest blank.

import { create, mutate, patch, recordActivity, setStatus, DbError } from "../db/store.mjs";
import { sanitizeExternal } from "../model/screening.mjs";
import { CAPABILITY_AREAS, MODULE_STEPS, SYSTEM_TASK_CATEGORIES, TASK_CATEGORY_MEANINGS, count } from "../model/vocabulary.mjs";
import { slugify } from "../model/ids.mjs";
import { AREA } from "./discovery.mjs";

const nowIso = () => new Date().toISOString();

const clean = (text) => {
  if (text === null || text === undefined) return null;
  const out = sanitizeExternal(String(text)).trim();
  return out || null;
};

// ---------------------------------------------------------------- materiality

/**
 * The areas where the answer changes the product rather than the process. These
 * are the only ones allowed to become a question, which is what keeps the set
 * small enough that somebody actually reads it.
 */
const MATERIAL = [
  {
    area: AREA.purpose,
    scopeId: "statement",
    question: "In one sentence, what is this product for, and what would prove it worked?",
    whyItMatters:
      "Every goal, milestone and acceptance criterion is measured against this. Without it Superdev can record that work happened but never that it mattered.",
    recommendation: "State the outcome in one sentence and name one thing you could observe that would prove it.",
    alternatives: [
      "Give the outcome now and the measure once the first feature is real",
      "Declare the project exploratory, with no success measure yet",
    ],
    selectMode: "one",
    recommended: ["Give the outcome now and the measure once the first feature is real"],
    recommendedWhy: "An outcome with no measure is still worth recording, and the measure is easier to name once one real feature exists. Declaring the project exploratory is honest but leaves readiness unable to report better than unknown.",
    ifDeferred: "Goals and milestones stay unmeasurable and readiness can never report better than unknown.",
  },
  {
    area: AREA.users,
    question: "Who uses this, and does any of them see something the others must not?",
    whyItMatters:
      "Roles decide permissions, permissions decide enforcement points, and a role discovered late usually means reworking every surface and every query at once.",
    recommendation: "Name one role now. Say plainly whether the data is shared by everybody or separated per account.",
    alternatives: [
      "One role, all data shared",
      "Several roles, data shared",
      "Several roles with per-account separation (multi-tenant)",
    ],
    selectMode: "one",
    recommended: ["One role, all data shared"],
    recommendedWhy: "It is the only one of the three that can be widened later without reworking every query. Separation added early costs a column; separation added late costs every surface at once, so this is the cheap direction to be wrong in.",
    ifDeferred: "Authorization is designed after the data model, which is the most expensive order to do it in.",
  },
  {
    area: AREA.frontend,
    question: "What does a user actually touch: a web application, a command line, an API, or nothing yet?",
    whyItMatters:
      "The delivery shape decides whether surfaces, UI actions and accessibility are part of the specification at all, or deliberately not applicable.",
    recommendation: "Name the one surface the first user will touch. A second one can be added when it exists.",
    alternatives: ["A web application", "A command line tool", "An API or library only", "An existing host application"],
    // No recommendation. Nothing about a product in general makes one of these
    // likelier, and a tag with no reason behind it is an instruction wearing a
    // recommendation's clothes.
    selectMode: "one",
    ifDeferred: "Surface and UI-action specifications cannot be started, so a whole layer of the product has no home.",
  },
  {
    area: AREA.backend,
    question: "Is there a server, and does it own data other people can see?",
    whyItMatters:
      "A shared server turns authentication, authorization and data ownership from optional into mandatory, and turns a local tool into an operated service.",
    recommendation: "Say whether anything runs outside the user's own machine. If nothing does, several capability areas become genuinely not applicable.",
    alternatives: ["Local only", "A single service", "Several services with separate ownership"],
    selectMode: "one",
    ifDeferred: "Backend boundaries, authentication and operational response are all left undecided together.",
  },
  {
    area: AREA.api,
    question: "Does anything outside your control call this product?",
    whyItMatters:
      "A contract with an outside caller cannot be changed quietly. That single fact decides versioning, error contracts and how much of the specification is public.",
    recommendation: "Assume no external caller until one exists. Declare it the moment one does.",
    alternatives: ["No external caller", "An internal client only", "A published, versioned public API"],
    selectMode: "one",
    recommended: ["No external caller"],
    recommendedWhy: "A contract with an outside caller cannot be withdrawn quietly, so it is worth declaring only when one actually exists. Nothing is lost by declaring it the day it does.",
    ifDeferred: "An internal shape becomes a public contract by accident, which is the most expensive kind of accident.",
  },
  {
    area: AREA.auth,
    question: "Does a user sign in, and who issues the identity?",
    whyItMatters:
      "Sessions, tokens and the enforcement point for every permission hang off this answer, and retrofitting identity touches every route.",
    recommendation: "If anything is per-user or private, decide identity now rather than after the first data model.",
    alternatives: ["No sign in", "Identity from an existing provider", "Identity issued by this product"],
    selectMode: "one",
    ifDeferred: "Every permission question gets deferred with it, and the data model is designed without an owner column.",
  },
  {
    area: AREA.database,
    question: "What data does this own, and what would it cost to lose it?",
    whyItMatters:
      "Data ownership decides the store, the retention rules, the backup posture and whether deletion is a real feature or a database statement.",
    recommendation: "Name the one or two things the product is the authority on. Say whether losing them is an inconvenience or a catastrophe.",
    alternatives: ["Nothing durable yet", "Local data only", "Shared durable data with a recovery expectation"],
    selectMode: "one",
    ifDeferred: "Entities are invented per feature and the same fact ends up stored in two places.",
  },
  {
    area: AREA.integrations,
    question: "Which outside services must this work with?",
    whyItMatters:
      "Every integration adds an authentication approach, a failure behavior and an environment to configure. Discovering one late reopens the architecture.",
    recommendation: "List the services you already know about, even the obvious ones. An empty list is a fine answer and is recorded as one.",
    alternatives: ["None", "Payment or billing", "An email or messaging provider", "A model or inference provider"],
    // Several of these are true at once on most products, and a question that
    // forces one answer gets a wrong one rather than an incomplete one.
    selectMode: "many",
    ifDeferred: "Integration failure behavior is invented at the moment of the first outage.",
  },
  {
    area: AREA.compliance,
    question: "Does any regulated regime apply to the data this handles?",
    whyItMatters:
      "Compliance is only specified when it is declared. Declaring it late means auditing work that is already shipped, which is the expensive direction.",
    recommendation: "Answer no unless you can name the regime. A named regime turns retention, deletion and audit into required specification.",
    alternatives: ["No regulated data", "Personal data under a privacy regime", "Payment or health data"],
    selectMode: "many",
    recommended: ["No regulated data"],
    recommendedWhy: "Compliance is specified only when it is declared, and a regime nobody can name is not one. Naming one turns retention, deletion and audit into required specification, so this is worth answering yes to only deliberately.",
    ifDeferred: "Retention and deletion are designed as convenience features and have to be rebuilt as obligations.",
  },
  {
    area: AREA.environments,
    question: "Where does this run, and how are its secrets handled?",
    whyItMatters:
      "Superdev refuses to store a credential anywhere, so it needs to know where secrets do live before it can specify configuration honestly.",
    recommendation: "Name the environments you will really have. Two is usually right; one is a valid answer for a local tool.",
    alternatives: ["Local only", "Local and production", "Local, staging and production"],
    selectMode: "one",
    recommended: ["Local and production"],
    recommendedWhy: "Two environments is what most products actually have, and configuration specified against environments that do not exist diverges from the real ones. One is a valid answer for a local tool.",
    ifDeferred: "Configuration is specified per feature and diverges between environments before anybody notices.",
  },
];

export const MATERIAL_AREAS = MATERIAL.map((m) => m.area);

/**
 * When each deferred area has to be looked at again. A deferral without a
 * trigger is just a gap with better manners, so every area has one.
 */
const REVISIT = {
  [AREA.purpose]: "the first milestone is defined",
  [AREA.users]: "a second kind of user appears",
  [AREA.frontend]: "the first user-facing surface is specified",
  [AREA.navigation]: "a second surface is added",
  [AREA.design]: "the first surface is built",
  [AREA.backend]: "anything runs outside the user's own machine",
  [AREA.api]: "a caller outside this repository appears",
  [AREA.auth]: "anything becomes private to one user",
  [AREA.authz]: "a second role appears",
  [AREA.database]: "the first durable record is stored",
  [AREA.migrations]: "a stored shape changes after release",
  [AREA.storage]: "a user uploads a file",
  [AREA.search]: "a list grows past what a person will scroll",
  [AREA.realtime]: "two people need to see the same change at once",
  [AREA.offline]: "the product is used where the network is not guaranteed",
  [AREA.jobs]: "work has to happen without somebody waiting for it",
  [AREA.events]: "another system needs to react to a change here",
  [AREA.integrations]: "the first outside service is added",
  [AREA.notifications]: "a user has to be told something while away",
  [AREA.rateLimit]: "an endpoint becomes reachable by the public",
  [AREA.security]: "the first personal or private field is stored",
  [AREA.compliance]: "a regulated regime is declared",
  [AREA.observability]: "the product runs somewhere you cannot watch",
  [AREA.performance]: "a user complains about waiting, or a target is agreed",
  [AREA.environments]: "a second environment exists",
  [AREA.ci]: "a second person or agent commits to this repository",
  [AREA.infrastructure]: "the product is deployed anywhere",
  [AREA.backups]: "losing the data would matter",
  [AREA.analytics]: "a product decision needs usage evidence and consent is settled",
  [AREA.testing]: "a regression costs more than the test would have",
  [AREA.release]: "a release reaches somebody other than its author",
};

/** Technology slots for foundations/stack.md, and the area whose evidence fills them. */
export const STACK_SLOTS = [
  ["Language and runtime", null],
  ["Frontend framework", AREA.frontend],
  ["Navigation and routing", AREA.navigation],
  ["Styling and design system", AREA.design],
  ["Backend framework", AREA.backend],
  ["API style", AREA.api],
  ["Authentication", AREA.auth],
  ["Database", AREA.database],
  ["Migrations", AREA.migrations],
  ["File and object storage", AREA.storage],
  ["Search", AREA.search],
  ["Realtime transport", AREA.realtime],
  ["Background jobs", AREA.jobs],
  ["Notifications and delivery", AREA.notifications],
  ["Observability", AREA.observability],
  ["Testing", AREA.testing],
  ["Hosting and deployment", AREA.infrastructure],
  ["Continuous integration", AREA.ci],
  ["Secret management", AREA.environments],
  ["Product analytics", AREA.analytics],
];

const NOT_EVALUATED = "Not evaluated yet. Discovery has not reached this area.";

const consequenceFor = (area) =>
  `Nothing in the specification covers ${lower(area)} until then, so the first feature that needs it stops at the gap.`;

const lower = (area) => `${area.charAt(0).toLowerCase()}${area.slice(1)}`;

// ------------------------------------------------------------------- seeding

/**
 * One row per capability area, plus the stack slots foundations renders from.
 *
 * Seeding all of them is the point: an area nobody thought about is a row in
 * `awaiting_decision` or `deferred` that any query can find, rather than a
 * judgement call nobody made. Pass `evidence` from `inspectEvidence` and the
 * areas the repository already answers are seeded as specified, with the path
 * that answered them.
 */
export async function seedCapabilityAreas(db, projectId, opts = {}) {
  const at = opts.at ?? nowIso();
  const answers = opts.evidence?.answers ?? {};
  const owner = clean(opts.owner) ?? "project owner";
  const created = [];
  const skipped = [];

  for (const [index, area] of CAPABILITY_AREAS.entries()) {
    const existing = await findArea(db, projectId, "readiness", area);
    if (existing) {
      skipped.push(existing);
      continue;
    }
    const answer = answers[area];
    const values = answer
      ? { state: "specified", choice: clean(answer.what), evidence_ref: clean(answer.evidence), reason: null, owner: null, revisit_trigger: null, consequence: null }
      : MATERIAL_AREAS.includes(area)
        ? {
            state: "awaiting_decision",
            reason: "Material to what gets built, and nothing in the repository answers it.",
            owner,
            revisit_trigger: REVISIT[area] ?? "the next specification touches it",
            consequence: consequenceFor(area),
          }
        : {
            state: "deferred",
            reason: "Not needed by the first working slice, and nothing in the repository answers it.",
            owner,
            revisit_trigger: REVISIT[area] ?? "the next specification touches it",
            consequence: consequenceFor(area),
          };

    created.push(await create(db, "capability_area", {
      project_id: projectId,
      catalog: "readiness",
      scope_type: "project",
      scope_id: null,
      area,
      sequence: index,
      updated_at: at,
      ...values,
    }, { projectId, activity: false }));
  }

  const stackCreated = [];
  for (const [index, [slot, area]] of STACK_SLOTS.entries()) {
    const existing = await findArea(db, projectId, "stack_slot", slot);
    if (existing) {
      skipped.push(existing);
      continue;
    }
    const answer = area ? answers[area] : stackChoice(opts.evidence);
    stackCreated.push(await create(db, "capability_area", {
      project_id: projectId,
      catalog: "stack_slot",
      scope_type: "project",
      scope_id: null,
      area: slot,
      state: answer ? "specified" : "awaiting_decision",
      choice: answer ? clean(answer.what) : null,
      evidence_ref: answer ? clean(answer.evidence) : null,
      reason: answer ? null : "No choice is recorded and none is implied by the repository.",
      owner: answer ? null : owner,
      revisit_trigger: answer ? null : "this slot is needed by a feature",
      consequence: answer ? null : `An unfilled ${lower(slot)} slot becomes an accidental choice made by whoever writes the first line of code.`,
      sequence: index,
      updated_at: at,
    }, { projectId, activity: false }));
  }

  // One event for the whole seed. Thirty-one rows are one act of setup, not
  // thirty-one things a person wants to read in an activity feed.
  if (created.length || stackCreated.length) {
    await recordActivity(db, projectId, {
      type: "project_initialized",
      summary: `Seeded ${count(created.length, "capability area")} and ${count(stackCreated.length, "stack slot")}`,
      actor: opts.actor ?? "superdev",
      metadata: { areas: created.length, stackSlots: stackCreated.length, specified: created.filter((r) => r.state === "specified").length },
    });
  }
  return { areas: created, stackSlots: stackCreated, alreadyPresent: skipped.length };
}

const findArea = (db, projectId, catalog, area) =>
  // scope_id is null here and SQLite treats nulls as distinct in a unique
  // index, so the uniqueness rule has to be checked rather than relied on.
  db.get(
    "SELECT * FROM capability_areas WHERE project_id = ? AND catalog = ? AND area = ? AND scope_id IS NULL",
    projectId, catalog, area,
  );

const stackChoice = (evidence) =>
  evidence?.stacks?.length
    ? { what: evidence.stacks.join(", "), evidence: evidence.findings?.find((f) => f.epistemic === "confirmed")?.evidence ?? null }
    : null;

/** The system task categories, seeded so a project can add its own alongside. */
export async function seedTaskCategories(db, projectId, opts = {}) {
  const created = [];
  let alreadyPresent = 0;
  for (const [index, name] of SYSTEM_TASK_CATEGORIES.entries()) {
    const existing = await db.get("SELECT * FROM task_categories WHERE project_id = ? AND name = ?", projectId, name);
    if (existing) {
      alreadyPresent += 1;
      continue;
    }
    created.push(await create(db, "task_category", {
      project_id: projectId,
      name,
      color_token: `category-${slugify(name)}`,
      // A category that cannot say what it means gets read differently by
      // everyone who picks it.
      description: TASK_CATEGORY_MEANINGS[name] ?? null,
      system: 1,
      active: 1,
      sequence: index,
    }, { projectId, activity: false }));
  }
  if (created.length) {
    await recordActivity(db, projectId, {
      type: "project_initialized",
      summary: `Seeded ${created.length} task categories`,
      actor: opts.actor ?? "superdev",
      metadata: { categories: created.map((c) => c.name) },
    });
  }
  return { created, alreadyPresent };
}

/**
 * The twenty-step module loop, as twenty rows that start open.
 *
 * A step is closed by filling it or by marking it not applicable with a reason;
 * the schema refuses the second without the reason, which is what stops "not
 * applicable" from becoming a way to make a step disappear.
 */
export async function seedModuleCompleteness(db, moduleId, opts = {}) {
  const at = opts.at ?? nowIso();
  const created = [];
  let alreadyPresent = 0;
  for (const [index, name] of MODULE_STEPS.entries()) {
    const step = index + 1;
    const existing = await db.get("SELECT * FROM module_completeness WHERE module_id = ? AND step = ?", moduleId, step);
    if (existing) {
      alreadyPresent += 1;
      continue;
    }
    created.push(await create(db, "module_completeness", {
      module_id: moduleId,
      step,
      step_name: name,
      state: "open",
      updated_at: at,
    }, { activity: false }));
  }
  return { created, alreadyPresent };
}

// ---------------------------------------------------------- materialQuestions

/**
 * The smallest set of questions whose answers actually change the product.
 *
 * An area the repository already answered is not asked about. An area already
 * asked about is not asked again. What is left is the honest remainder, and it
 * is usually under ten questions.
 */
export async function materialQuestions(db, projectId) {
  const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) throw new DbError("E_NOT_FOUND", `Project ${projectId} does not exist.`);

  const areas = await db.all(
    "SELECT * FROM capability_areas WHERE project_id = ? AND catalog = 'readiness'",
    projectId,
  );
  const byArea = new Map(areas.map((a) => [a.area, a]));
  const asked = new Set(
    (await db.all("SELECT question FROM questions WHERE project_id = ?", projectId)).map((q) => q.question),
  );

  const open = MATERIAL.filter((entry) => {
    const area = byArea.get(entry.area);
    // No seeded row yet means discovery has not run; the question still applies.
    if (area && area.state !== "awaiting_decision") return false;
    if (ALREADY_ANSWERED[entry.area]?.(project)) return false;
    return true;
  });

  return questionCatalog(open.map((entry) => entry.area), { project })
    .filter((descriptor) => !asked.has(descriptor.question))
    .map((descriptor) => ({ ...descriptor, areaId: byArea.get(descriptor.area)?.id ?? null }));
}

/**
 * The question descriptors for a set of areas, with no database involved.
 *
 * `planInit` prints the exact questions before a project row exists, so the
 * wording has to be derivable from the area name alone.
 */
/**
 * Material areas the project already answers, and what answers them.
 *
 * This used to be one inline condition inside the question filter, and the same
 * fact was not consulted when the area was seeded. So supplying a purpose
 * statement suppressed the purpose question while leaving the area awaiting a
 * decision, and readiness then reported, at high severity, that the product's
 * purpose was awaiting a decision with nobody asked about it. To somebody who had
 * just stated it. Neither remedy the warning named was a command that existed.
 *
 * Holding the rule in one place is what lets `settleAnsweredAreas` agree with the
 * filter by construction rather than by both being edited together.
 */
const ALREADY_ANSWERED = {
  [AREA.purpose]: (project) => Boolean(clean(project?.statement)),
};

/** What the project's own record says, for an area that needs no question. */
const ANSWERED_BY = {
  [AREA.purpose]: (project) => ({
    choice: clean(project.statement),
    evidence: "stated at initialization",
  }),
};

/**
 * Settle every material area that needs no question because the project already
 * answers it.
 *
 * Run after questions are raised, so "awaiting a decision with no question
 * raised" is unreachable for these areas rather than merely unlikely. An area
 * this cannot settle keeps its state and keeps its warning: the point is to close
 * a hole, not to quieten the checklist.
 */
export async function settleAnsweredAreas(db, projectId, { at = nowIso(), actor = "superdev" } = {}) {
  const project = await db.get("SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) return [];
  const areas = await db.all(
    `SELECT * FROM capability_areas
      WHERE project_id = ? AND catalog = 'readiness'
        AND state = 'awaiting_decision' AND question_id IS NULL`,
    projectId,
  );
  const settled = [];
  for (const area of areas) {
    if (!ALREADY_ANSWERED[area.area]?.(project)) continue;
    const answer = ANSWERED_BY[area.area]?.(project);
    if (!answer?.choice) continue;
    await patch(db, "capability_area", area.id, area.version, {
      state: "specified",
      choice: answer.choice,
      evidence_ref: answer.evidence,
      reason: null,
      owner: null,
      revisit_trigger: null,
      consequence: null,
    }, { projectId, activity: false, at });
    settled.push({ id: area.id, area: area.area, evidence: answer.evidence });
  }
  if (settled.length) {
    await recordActivity(db, projectId, {
      type: "specification_changed",
      actor,
      summary: `${settled.length === 1 ? "1 capability area" : `${settled.length} capability areas`} settled from what the project already records`,
      metadata: { areas: settled.map((a) => a.id) },
    });
  }
  return settled;
}

export function questionCatalog(areas, { project = null } = {}) {
  const wanted = new Set(areas);
  return MATERIAL.filter((entry) => wanted.has(entry.area)).map((entry) => ({
    area: entry.area,
    scopeType: "project",
    scopeId: entry.scopeId ?? null,
    question: entry.question,
    // The deferral consequence rides along in why_it_matters because a question
    // read on its own, without joining its capability area, still has to say
    // what happens if it is skipped.
    whyItMatters: `${entry.whyItMatters} If this is deferred: ${entry.ifDeferred}`,
    recommendation: entry.recommendation,
    alternatives: entry.alternatives,
    // How many of the options can be true at once, which options are recommended,
    // and why. A question whose options nobody can select is a paragraph.
    selectMode: entry.selectMode ?? "one",
    recommended: entry.recommended ?? [],
    recommendedWhy: entry.recommendedWhy ?? null,
    ifDeferred: entry.ifDeferred,
    revisitTrigger: REVISIT[entry.area] ?? "the next specification touches it",
    projectId: project?.id ?? null,
  }));
}

// ------------------------------------------------------------- answerQuestion

const DONT_KNOW =
  /^(i\s+(do\s+not|don'?t)\s+know|idk|dunno|not\s+sure|unsure|no\s+idea|unknown|no\s+opinion|don'?t\s+care)\b/i;

/**
 * Record an answer, or record the honest absence of one.
 *
 * "I do not know" is not refused and is not turned into a decision. It becomes
 * a reversible assumption carrying the recommended default, the question stays
 * open, and the capability area moves to deferred with an owner and a revisit
 * trigger. That way the project keeps moving without anybody later mistaking a
 * guess for something that was actually decided.
 */
export async function answerQuestion(root, questionId, opts = {}) {
  const at = opts.at ?? nowIso();
  const actor = clean(opts.actor) ?? "superdev";
  const answeredBy = clean(opts.answeredBy) ?? actor;
  const answer = clean(opts.answer);
  const unknown = opts.unknown === true || !answer || DONT_KNOW.test(answer);

  return mutate(root, async (db) => {
    const question = await db.get("SELECT * FROM questions WHERE id = ?", questionId);
    if (!question) throw new DbError("E_NOT_FOUND", `Question ${questionId} does not exist.`);
    if (question.status === "answered" && !opts.reopen) {
      return { question, changed: false, reason: "This question is already answered. Pass reopen to replace the answer." };
    }
    const area = await db.get(
      "SELECT * FROM capability_areas WHERE project_id = ? AND question_id = ?",
      question.project_id, questionId,
    );

      if (unknown) return recordAssumption(db, { question, area, opts, at, actor, answeredBy });
    return recordAnswer(db, { question, area, answer, inOwnWords: clean(opts.inOwnWords), at, actor, answeredBy });
  });
}

async function recordAnswer(db, { question, area, answer, inOwnWords = null, at, actor, answeredBy }) {
  const updated = await patch(db, "question", question.id, question.version, {
    answer,
    answered_by: answeredBy,
    answered_at: at,
    deferral_reason: null,
  }, { projectId: question.project_id, activity: false, at });

  const answered = await setStatus(db, "question", question.id, "answered", {
    projectId: question.project_id,
    expectedVersion: updated.version,
    actor,
    note: answer,
    at,
    activityType: "specification_changed",
    activitySummary: `Question ${question.id} answered: ${truncate(answer)}`,
  });

  if (area) {
    await patch(db, "capability_area", area.id, area.version, {
      state: "specified",
      choice: answer,
      reason: null,
      evidence_ref: `answered in ${question.id}`,
    }, { projectId: question.project_id, activity: false, at });
  }

  // The two project-level questions write straight through to the field they
  // exist to fill, so an answer does not have to be copied by hand afterwards.
  //
  // What gets written through is the reader's own words when there are any. The
  // purpose question's options are strategies for answering it ("give the outcome
  // now and the measure once the first feature is real"), not the answer, so
  // selecting one and writing the whole composed answer into projects.statement
  // put advice where the product statement belongs. The question keeps the full
  // answer, because what was chosen is part of the record; the field gets the
  // sentence that was meant for it.
  let project = null;
  if (question.scope_type === "project" && ["statement", "problem"].includes(question.scope_id)) {
    const current = await db.get("SELECT * FROM projects WHERE id = ?", question.project_id);
    project = await patch(db, "project", current.id, current.version, {
      [question.scope_id]: inOwnWords ?? answer,
    }, {
      projectId: current.id, activity: false, at,
    });
  }

  return { question: answered, area: area ? await reload(db, "capability_areas", area.id) : null, project, assumption: null, changed: true, deferred: false };
}

async function recordAssumption(db, { question, area, opts, at, actor, answeredBy }) {
  const revisit = clean(opts.revisitTrigger) ?? area?.revisit_trigger ?? "the next specification touches this";
  const owner = clean(opts.owner) ?? area?.owner ?? answeredBy;
  const statement = clean(question.recommendation)
    ?? `Proceeding without an answer to: ${question.question}`;

  const assumption = await create(db, "discovery_item", {
    project_id: question.project_id,
    kind: "assumption",
    statement,
    epistemic_status: "assumed",
    provenance: `recorded instead of an answer to ${question.id}; reversible, revisit when ${revisit}`,
    status: "proposed",
    created_at: at,
  }, { projectId: question.project_id, activity: false });

  // The question stays open. It has not been answered; it has been survived.
  const updated = await patch(db, "question", question.id, question.version, {
    deferral_reason: `No answer yet. Assumption ${assumption.id} applies in its place. Revisit when ${revisit}.`,
  }, { projectId: question.project_id, activity: false, at });

  if (area) {
    await patch(db, "capability_area", area.id, area.version, {
      state: "deferred",
      reason: `No answer yet; assumption ${assumption.id} applies in its place.`,
      owner,
      revisit_trigger: revisit,
      consequence: area.consequence ?? consequenceFor(area.area),
    }, { projectId: question.project_id, activity: false, at });
  }

  await recordActivity(db, question.project_id, {
    type: "specification_changed",
    summary: `Question ${question.id} left open with reversible assumption ${assumption.id}`,
    actor,
    metadata: { questionId: question.id, assumptionId: assumption.id, revisitTrigger: revisit, owner },
  });

  return {
    question: updated,
    area: area ? await reload(db, "capability_areas", area.id) : null,
    project: null,
    assumption,
    changed: true,
    deferred: true,
  };
}

const reload = (db, table, id) => db.get(`SELECT * FROM ${table} WHERE id = ?`, id);

const truncate = (text, max = 120) =>
  String(text ?? "").length > max ? `${String(text).slice(0, max - 3)}...` : String(text ?? "");
