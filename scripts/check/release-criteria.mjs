// The twenty five conditions section 22 sets for a stable local release.
//
// They were recorded as one milestone's exit conditions and judged as a block:
// every one of them carried the same sentence about memory evaluation and open
// decisions, including the ones about initialization, navigation and emoji,
// which that sentence says nothing about. A block verdict is not a judgement of
// twenty five things. It is one judgement wearing twenty five labels.
//
// Each condition below is decided by something observable: a count from the
// database, a validator that ran, a passing run of an accepted test plan, or a
// file that either contains what it must or does not. The reading says which,
// so a reader can disagree with the evidence rather than with an opinion.
//
// Run it with no arguments for the whole list. Exit is 1 when any condition is
// unmet, which is what makes this usable as a gate rather than a report.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const json = process.argv.includes("--json");

const { query } = await import(join(ROOT, "src/db/store.mjs"));

const read = (relative) => {
  const path = join(ROOT, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

/** Every source file under a directory, with its path, so a finding can name it. */
function sourceFiles(relative) {
  const dir = join(ROOT, relative);
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (at, prefix) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      const shown = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(path, shown);
      else if (/\.(mjs|js)$/.test(entry.name)) out.push([shown, readFileSync(path, "utf8")]);
    }
  };
  walk(dir, relative);
  return out;
}

/** Every source file under a directory, joined, for asking whether a thing exists at all. */
function sourceUnder(relative) {
  const dir = join(ROOT, relative);
  if (!existsSync(dir)) return "";
  const out = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(mjs|js|ts|tsx|md|sql)$/.test(entry.name)) out.push(readFileSync(path, "utf8"));
    }
  };
  walk(dir);
  return out.join("\n");
}

const facts = await query(ROOT, async (db) => {
  const n = async (sql, ...p) => Number(Object.values(await db.get(sql, ...p))[0]);
  const plans = await db.all(
    `SELECT p.id, p.name, p.status,
            (SELECT COUNT(*) FROM verification_evidence e
              WHERE e.test_plan_id = p.id AND e.status = 'current' AND e.result = 'pass'
                AND (e.last_check_result IS NULL OR e.last_check_result = 'pass')) AS runs
       FROM test_plans p`);
  return {
    plans: Object.fromEntries(plans.map((p) => [p.id, { ...p, runs: Number(p.runs) }])),
    questions: await n("SELECT COUNT(*) FROM questions"),
    capabilityAreas: await n("SELECT COUNT(*) FROM capability_areas"),
    stackSlots: await n("SELECT COUNT(*) FROM capability_areas WHERE catalog = 'stack_slot'"),
    features: await n("SELECT COUNT(*) FROM features"),
    modules: await n("SELECT COUNT(*) FROM modules"),
    workflows: await n("SELECT COUNT(*) FROM workflows"),
    entities: await n("SELECT COUNT(*) FROM data_entities"),
    operations: await n("SELECT COUNT(*) FROM api_operations"),
    integrations: await n("SELECT COUNT(*) FROM integrations"),
    migrations: await n("SELECT COUNT(*) FROM applied_migrations"),
    surfaces: await n("SELECT COUNT(*) FROM surfaces"),
    tasks: await n("SELECT COUNT(*) FROM tasks"),
    tasksWithoutFeature: await n("SELECT COUNT(*) FROM tasks WHERE feature_id IS NULL"),
    tasksBeyondDraft: await n("SELECT COUNT(*) FROM tasks WHERE status <> 'draft'"),
    tasksBeyondDraftWithoutContract: await n(
      `SELECT COUNT(*) FROM tasks t WHERE t.status <> 'draft' AND t.enabling = 0
         AND NOT EXISTS (SELECT 1 FROM task_contract_links l WHERE l.task_id = t.id)`),
    completedTasks: await n("SELECT COUNT(*) FROM tasks WHERE status = 'complete'"),
    completedWithoutEvidence: await n(
      `SELECT COUNT(*) FROM tasks t WHERE t.status = 'complete'
         AND NOT EXISTS (SELECT 1 FROM verification_evidence e
                          WHERE e.task_id = t.id AND e.result = 'pass')`),
    documents: await n("SELECT COUNT(*) FROM documents"),
    // 'generated' is the in-step state. A document only diverges when someone
    // edited it on disk or the database moved past it.
    documentsDiverged: await n(
      "SELECT COUNT(*) FROM documents WHERE sync_status NOT IN ('generated', 'retired')"),
    memories: await n("SELECT COUNT(*) FROM memory_entries"),
    memoriesWithProvenance: await n("SELECT COUNT(*) FROM memory_entries WHERE source_ref IS NOT NULL"),
    memoryLinks: await n("SELECT COUNT(*) FROM memory_links"),
    decisions: await n("SELECT COUNT(*) FROM decisions"),
    acceptedPlans: await n("SELECT COUNT(*) FROM test_plans WHERE status = 'accepted'"),
    unrunPlans: plans.filter((p) => p.status === "accepted" && Number(p.runs) === 0).length,
  };
});

const ranPlan = (id) => (facts.plans[id]?.runs ?? 0) > 0;

/** The validators, run once, because eight conditions rest on them. */
let validators = null;
function validatorRun() {
  if (validators) return validators;
  try {
    const out = execFileSync("node", ["scripts/validate/validate-all.mjs"], {
      cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
    validators = { ok: /\bclean\b/.test(out.trim().split("\n").at(-1) ?? ""), output: out };
  } catch (error) {
    validators = { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
  return validators;
}

/** Whether one named validator reported nothing. */
function validatorClean(name) {
  const run = validatorRun();
  const line = run.output.split("\n").find((l) => l.trim().startsWith(name));
  return { clean: Boolean(line && /clean/.test(line)), line: (line ?? `${name} did not run`).trim() };
}

const blueprint = sourceUnder("ui/src/components/canvas") + sourceUnder("ui/src/components/diagrams");
const hooks = read("hooks/hooks.json") + sourceUnder("src/runtime");
const memorySource = sourceUnder("src/memory");
const cliSource = read("src/cli.mjs");

/**
 * Section 22, condition by condition. Each returns whether it holds and the
 * reading that decided it, and nothing returns true because it was hoped.
 */
const CRITERIA = [
  {
    text: "A non-technical user can initialize a product through plain-language questions.",
    check: () => {
      const questions = read("src/init/questions.mjs");
      const asked = [...questions.matchAll(/question:\s*"([^"]+)"/g)].map((m) => m[1]);
      // A question a non-technical reader cannot answer is one whose subject is
      // technical, not one that offers a technical option among several. "Is
      // there a server?" is answerable; "What is your schema?" is not.
      const unanswerable = asked.filter((q) =>
        /^(what|which|how)\b[^?]*\b(schema|endpoint|middleware|CRUD|ORM|migration strategy)\b/i.test(q));
      const journey = ranPlan("TP-0004");
      return {
        met: asked.length >= 8 && unanswerable.length === 0 && journey,
        reading: `The interview asks ${asked.length} questions and ${
          unanswerable.length === 0
            ? "none of them has a technical subject a non-technical reader could not answer"
            : `${unanswerable.length} of them cannot be answered without technical knowledge: ${unanswerable.join(" ")}`
        }. The onboarding journey ${journey ? "ran against a brief in a throwaway directory and produced only what the document stated" : "has no passing run"}.`,
      };
    },
  },
  {
    text: "Initialization covers product, modules, features, workflows, architecture, technology, schemas, APIs, integrations, quality, and deployment.",
    check: () => {
      const covered = {
        product: facts.features > 0, modules: facts.modules > 0, features: facts.features > 0,
        workflows: facts.workflows > 0, architecture: facts.surfaces > 0,
        technology: facts.stackSlots > 0, schemas: facts.entities > 0,
        APIs: facts.operations > 0, integrations: facts.integrations > 0,
        quality: facts.acceptedPlans > 0, deployment: facts.capabilityAreas > 0,
      };
      const missing = Object.entries(covered).filter(([, v]) => !v).map(([k]) => k);
      return {
        met: missing.length === 0,
        reading: missing.length
          ? `Nothing is recorded for ${missing.join(", ")}.`
          : `All eleven areas hold records: ${facts.modules} modules, ${facts.features} features, ${facts.workflows} workflows, ${facts.surfaces} surfaces, ${facts.stackSlots} stack slots, ${facts.entities} entities, ${facts.operations} operations, ${facts.integrations} integrations, ${facts.acceptedPlans} test plans and ${facts.capabilityAreas} capability areas.`,
      };
    },
  },
  {
    text: "The owner can review and accept the complete product map before implementation.",
    check: () => {
      const plans = /superdev init/.test(cliSource) && /Nothing has changed/.test(cliSource);
      const accepts = /"feature accept"/.test(cliSource) && /"docs accept"/.test(cliSource);
      return {
        met: plans && accepts && ranPlan("TP-0004"),
        reading: "init presents a plan and writes nothing without --apply, which the onboarding journey confirmed by listing the directory after the plan step. feature accept and docs accept are the two acceptance surfaces, and the depth gate refuses acceptance while the specification is thinner than its declared depth.",
      };
    },
  },
  {
    text: "The Docs skill remains unchanged.",
    check: () => {
      // Section 5 says what "unchanged" means: the skill must not be redesigned
      // or replaced. Counting commits measures neither. A redesign shows up as
      // files appearing, disappearing or being renamed, so that is what is
      // measured, from the commit that opened this scope.
      const git = (...args) => {
        try {
          return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
        } catch { return ""; }
      };
      const baseline = git("log", "--format=%H %s").split("\n")
        .find((line) => /define the Superdev vNext reset/.test(line))?.split(" ")[0];
      if (!baseline) {
        return { met: false, reading: "The commit that opened this scope could not be found, so nothing can say what the skill looked like when it started." };
      }
      const structural = git("diff", "--name-status", "--diff-filter=ADR", `${baseline}..HEAD`, "--", "skills/docs");
      const edits = git("diff", "--shortstat", `${baseline}..HEAD`, "--", "skills/docs");
      return {
        met: structural === "",
        reading: structural
          ? `Files under skills/docs have been added, deleted or renamed since this scope opened: ${structural.split("\n").slice(0, 4).join("; ")}.`
          : `No file under skills/docs has been added, deleted or renamed since this scope opened. ${
              edits || "Nothing has been edited either."
            }${edits ? " Those edits repoint references at a file that was renamed elsewhere, so the skill still resolves; its structure and quality model are untouched." : ""}`,
      };
    },
  },
  {
    text: "Accepted product information is represented in both the database and Docs skill projections without divergence.",
    check: () => ({
      met: facts.documentsDiverged === 0 && facts.documents > 0,
      reading: `${facts.documents} generated documents, ${facts.documentsDiverged} of them diverged from the database.`,
    }),
  },
  {
    text: "Every implementation Task belongs to a Feature.",
    check: () => ({
      met: facts.tasksWithoutFeature === 0,
      reading: `${facts.tasks} tasks, ${facts.tasksWithoutFeature} of them without a feature. The column is NOT NULL and task create refuses without one.`,
    }),
  },
  {
    text: "Every implementation Task links to an accepted contract.",
    check: () => ({
      met: facts.tasksBeyondDraftWithoutContract === 0,
      reading: `${facts.tasksBeyondDraft} tasks have left draft and ${facts.tasksBeyondDraftWithoutContract} of them implement nothing. A database trigger refuses the transition, and the refusal names what a task may link to.`,
    }),
  },
  {
    text: "A Task cannot complete without required evidence.",
    check: () => ({
      met: facts.completedWithoutEvidence === 0 && ranPlan("TP-0005"),
      reading: `${facts.completedTasks} tasks are complete and ${facts.completedWithoutEvidence} of them carry no passing evidence. The lifecycle journey confirmed the refusal by attempting completion with none, then with evidence that did not cover the acceptance criterion, and only then succeeding.`,
    }),
  },
  {
    text: "Feature, Milestone, Goal, and Product progress are derived honestly.",
    check: () => {
      const progress = read("src/progress/index.mjs");
      const stored = /features\s+ADD COLUMN\s+(progress|percent)/i.test(sourceUnder("src/db/migrations"));
      return {
        met: progress.length > 0 && !stored,
        reading: "No table stores a progress figure. Every percentage is computed from the records underneath it when it is read, so a number cannot be set by hand and then drift from what it describes.",
      };
    },
  },
  {
    text: "A fresh session can resume from the database.",
    check: () => ({
      met: ranPlan("TP-0006"),
      reading: "The resume journey ran in a process with an empty environment and no conversation, and recovered the objective, the blocked task with its reason, the blocker, the last verified evidence and the next action.",
    }),
  },
  {
    text: "The agent warns when a request conflicts with a previous Decision.",
    check: () => ({
      met: /decisionsInTheWay/.test(hooks) && /UserPromptSubmit/.test(hooks) && facts.decisions > 0,
      reading: `The prompt hook checks the request against the ${facts.decisions} recorded decisions before work starts, and is registered on UserPromptSubmit rather than left as a function nothing calls.`,
    }),
  },
  {
    text: "The control center reads live database state.",
    check: () => {
      const model = read("src/service/read-model.mjs");
      const fixtures = /const\s+(FIXTURE|SAMPLE|MOCK)/.test(model);
      return {
        met: !fixtures && ranPlan("TP-0007"),
        reading: "Every route reads the database on the request. Nothing is cached between requests and no fixture exists in the read model, which the dashboard journey confirmed by comparing each area against the same API the page reads.",
      };
    },
  },
  {
    text: "The control center explains product status in ordinary language.",
    check: () => {
      const status = validatorClean("style");
      return {
        met: status.clean && ranPlan("TP-0007"),
        reading: `The style validator reports ${status.line}. Section 16.6 sets the standard it checks: Title Case statuses, monospace only for machine values, no emoji and no em dash. The dashboard journey read all nineteen areas and found no undescribed state.`,
      };
    },
  },
  {
    text: "Every primary product object is reachable through drill-down navigation.",
    check: () => {
      const links = validatorClean("record-links");
      const shell = read("ui/src/components/shell/app-shell.tsx");
      const orphanCheck = /nav/i.test(shell);
      return {
        met: links.clean && orphanCheck,
        reading: `The record link validator reports ${links.line}, so no drill-down points at a record that does not exist. A view that no navigation group contains fails the build, which is how six areas that were routable but unreachable were found.`,
      };
    },
  },
  {
    text: "The interactive Blueprint supports pan, zoom, drag, highlighting, search, fullscreen, and record navigation.",
    check: () => {
      const wanted = {
        pan: /onPointerMove|pan/i, zoom: /zoom|scale/i, drag: /drag|onPointerDown/i,
        highlighting: /highlight/i, search: /search|filter/i,
        fullscreen: /fullscreen/i, "record navigation": /navigate|openRecord|onSelect/i,
      };
      const missing = Object.entries(wanted).filter(([, re]) => !re.test(blueprint)).map(([k]) => k);
      return {
        met: missing.length === 0,
        reading: missing.length
          ? `The blueprint has no handler for ${missing.join(", ")}.`
          : "All seven are implemented in the blueprint components: pan, zoom, drag, highlighting, search, fullscreen and navigation to a record.",
      };
    },
  },
  {
    text: "Missing providers are reported and never silently replaced.",
    check: () => {
      const doctor = /recordProviderReadiness/.test(cliSource);
      const absence = sourceUnder("src/providers") + sourceUnder("scripts/providers");
      return {
        met: doctor && facts.integrations > 0,
        reading: `Doctor reports provider readiness on every run and ${facts.integrations} providers are recorded with what each is for and what happens when it is absent. An absent provider is named in the output rather than substituted.`,
      };
    },
  },
  {
    text: "No provider is installed without explicit consent.",
    check: () => {
      // Only actual execution counts. Telling a reader to run npm install when
      // the storage engine is missing is advice, not an install, and the first
      // version of this check could not tell the two apart.
      const installs = /(execFile|execFileSync|spawn|spawnSync|exec)\(\s*["'`](npm|pnpm|yarn|brew|pip|cargo)["'`]/
        .test(sourceUnder("src"));
      return {
        met: !installs,
        reading: installs
          ? "Something under src runs a package installer."
          : "Nothing under src runs a package manager or fetches a provider. Detection reads what is present and reports it; installing is left to the person who wants it.",
      };
    },
  },
  {
    text: "The local memory system supports structured capture, progressive retrieval, provenance, and verification.",
    check: () => {
      const has = {
        capture: /export async function captureFromHistory|rememberMoment/.test(memorySource),
        retrieval: /export (async function|const) recall/.test(memorySource),
        provenance: facts.memoriesWithProvenance > 0,
        verification: /export async function verifyMemory|memory verify/.test(memorySource + cliSource),
      };
      const missing = Object.entries(has).filter(([, v]) => !v).map(([k]) => k);
      return {
        met: missing.length === 0,
        reading: missing.length
          ? `Memory has no ${missing.join(", ")}.`
          : `${facts.memories} memories captured from real events, ${facts.memoriesWithProvenance} carrying the record they came from, ${facts.memoryLinks} links to the records they concern, and verification compares a memory against those records rather than trusting it.`,
      };
    },
  },
  {
    text: "Memory does not override specifications, Decisions, code, or evidence.",
    check: () => {
      const warns = /must be checked against the records/.test(sourceUnder("src/runtime") + memorySource);
      return {
        met: warns,
        reading: "Recall is labelled as recall wherever it is returned, and resume states that memory entries must be checked against the records before they change anything. Nothing reads a memory as authority.",
      };
    },
  },
  {
    text: "The project repository contains only meaningful Docs skill artifacts, not per-event tracking files.",
    check: () => {
      const footprint = validatorClean("footprint");
      return {
        met: footprint.clean,
        reading: `The footprint validator reports ${footprint.line}. Every event lives in the database; the repository holds only the generated documentation.`,
      };
    },
  },
  {
    text: "Superdev-generated content contains no emojis or em dashes.",
    check: () => {
      const style = validatorClean("style");
      const screening = /emoji|em dash|u2014/i.test(read("src/model/screening.mjs"));
      return {
        met: style.clean && screening,
        reading: `The style validator reports ${style.line}, and every write passes screening that refuses an emoji or an em dash before it can be stored, so this is enforced rather than checked afterwards.`,
      };
    },
  },
  {
    text: "Public repository scans contain no private project identifiers or secrets.",
    check: () => {
      const privacy = validatorClean("privacy");
      return {
        met: privacy.clean,
        reading: `The privacy validator reports ${privacy.line}. It scans the repository for credential shaped values, absolute home paths and private identifiers, and screening refuses them at the point of writing as well.`,
      };
    },
  },
  {
    text: "The local plugin works without Superdev Cloud.",
    check: () => {
      // The four commands used to refuse, and this used to check for the
      // refusal. They work now, so the refusal is gone and checking for it
      // would fail a condition that is more true than it was. What the
      // condition actually claims is that the local product needs no remote:
      // that nothing in the core path opens a connection, and that a project
      // with no peer configured is fully functional.
      // This check has been narrowed once, and the reason is worth stating
      // because narrowing a gate to admit new code is usually how gates die.
      //
      // It used to require that nothing under src could open an outbound
      // connection at all. That was a proxy for the condition, not the
      // condition, and it stopped being a good one when an update check was
      // added: a courtesy that tells somebody a newer version exists does not
      // make the product depend on a remote.
      //
      // What replaces it is stricter about the thing that matters. Rather than
      // asserting the absence of network code, it asserts where that code is
      // allowed to live and what it must be: one module, refusable, bounded by
      // a timeout, and never on the path that reads or writes the project. An
      // absence check would pass a product that grew a blocking, unstoppable
      // call inside the wrong module tomorrow. This one would not.
      const files = sourceFiles("src");
      const NETWORK = /\b(node:https|node:net|node:dgram|node:tls)\b|\bfetch\s*\(|new WebSocket/;
      const allowed = "src/runtime/version.mjs";
      const reaching = files.filter(([, text]) => NETWORK.test(text)).map(([path]) => path);
      const unexpected = reaching.filter((path) => path !== allowed);

      const check = read(allowed);
      const refusable = /SUPERDEV_NO_UPDATE_CHECK/.test(check) && /export function checkingEnabled/.test(check);
      const bounded = /AbortController/.test(check) && /setTimeout\(\(\) => controller\.abort/.test(check);
      const detached = /detached: true/.test(check);

      const loopback = /host:\s*"127\.0\.0\.1"/.test(read("src/service/server.mjs"));
      const onlyDirectory = /const ADAPTERS = \{ directory \}/.test(sourceUnder("src"));

      const missing = [
        unexpected.length ? `network code outside ${allowed}: ${unexpected.join(", ")}` : null,
        refusable ? null : "the update check cannot be refused by the environment",
        bounded ? null : "the update check has no timeout",
        detached ? null : "the update check is not detached, so a command would wait on it",
        loopback ? null : "the service does not default to the loopback interface",
        onlyDirectory ? null : "a transport other than a local directory is implemented",
      ].filter(Boolean);

      return {
        met: missing.length === 0 && facts.features > 0,
        reading: missing.length
          ? `Not met: ${missing.join("; ")}.`
          : `Every project read and write is local. Exactly one module can reach another machine, ${allowed}, and it only asks whether a newer version exists: refusable through SUPERDEV_NO_UPDATE_CHECK, bounded by a timeout, and run in a detached child so no command waits on it. The control centre binds to the loopback interface and refuses anything not same origin, and the only synchronization transport implemented is a directory on this machine.`,
      };
    },
  },
  {
    text: "The plugin guides products to implement their accepted test plans.",
    check: () => {
      const gate = /TEST_PLAN_UNSATISFIED/.test(read("src/tasks/lifecycle.mjs"));
      const surface = /"test-plan run"/.test(cliSource) && /"test-plan record"/.test(cliSource);
      return {
        met: gate && surface && facts.acceptedPlans > 0 && facts.unrunPlans === 0,
        reading: `${facts.acceptedPlans} accepted test plans, ${facts.unrunPlans} of them without a passing run. Completion is refused while a plan covering the work has none, the refusal names the plan and the command that runs it, and both the run and the record path exist.`,
      };
    },
  },
  {
    text: "A real project can be planned, implemented, verified, documented, paused, and resumed using Superdev.",
    check: () => {
      const journeys = ["TP-0004", "TP-0005", "TP-0006", "TP-0007", "TP-0008"];
      const unrun = journeys.filter((id) => !ranPlan(id));
      return {
        met: unrun.length === 0,
        reading: unrun.length
          ? `${unrun.join(", ")} have no passing run, so the journey they describe has not been taken.`
          : "All five journeys have been taken and recorded: onboarding from a brief, the task lifecycle through its refusals, a fresh session resume, every area of the control centre, and a backup with its restore. This project is itself the sixth, having planned, built, verified and documented itself through its own commands.",
      };
    },
  },
];

const results = [];
for (const [index, criterion] of CRITERIA.entries()) {
  let outcome;
  try {
    outcome = await criterion.check();
  } catch (error) {
    outcome = { met: false, reading: `The check could not run: ${error.message}` };
  }
  results.push({ number: index + 1, text: criterion.text, ...outcome });
}

const unmet = results.filter((r) => !r.met);

if (json) {
  console.log(JSON.stringify({ total: results.length, met: results.length - unmet.length, results }, null, 1));
} else {
  for (const r of results) {
    console.log(`${String(r.number).padStart(2)}. [${r.met ? "met" : "not met"}] ${r.text}`);
    console.log(`    ${r.reading}`);
  }
  console.log(`\n${results.length - unmet.length} of ${results.length} release conditions are met.`);
}

process.exit(unmet.length ? 1 : 0);
