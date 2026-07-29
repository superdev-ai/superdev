#!/usr/bin/env node
// The command surface. Brief section 14.1.
//
// Two decisions shape the whole file. Modules are imported where they are used
// rather than at the top, so that `--help` and a usage error never pay to open a
// database driver, and one broken module cannot take every other command down
// with it. And every handler returns data and text rather than printing, so
// --json is one branch in one place instead of thirty scattered ones.
//
// Exit codes are part of the contract: 0 success, 1 a finding or a refusal,
// 2 a usage error. A finding is a real answer, so `doctor` and `docs diff`
// return 1 when they find something rather than pretending nothing is wrong.

import { mkdirSync, readFileSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as R from "./cli/render.mjs";

const nowIso = () => new Date().toISOString();

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
    this.code = "E_USAGE";
  }
}

class Refusal extends Error {
  constructor(message, code = "E_REFUSED") {
    super(message);
    this.name = "Refusal";
    this.code = code;
  }
}

// ---------------------------------------------------------------- argument parsing

// Flags that carry no value. Everything else must be given one, so that
// `--reason --apply` fails loudly instead of silently recording "true" as the
// reason a task is blocked.
const BOOLEAN = new Set(["apply", "json", "help", "all", "enabling", "end", "reports", "partial", "adopt", "dryRun", "resolve", "version", "noUpdateCheck", "updateCheck", "entry", "remove", "open"]);

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

function parseArgs(argv) {
  const words = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      words.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "-h") {
      flags.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      words.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const raw = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const name = camel(raw);
    let value = eq === -1 ? null : arg.slice(eq + 1);
    if (value === null) {
      if (BOOLEAN.has(name)) value = true;
      else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
          throw new UsageError(`--${raw} needs a value. Write --${raw} <value>.`);
        }
        value = next;
        i += 1;
      }
    }
    flags[name] = name in flags ? [].concat(flags[name], value) : value;
  }
  return { words, flags };
}

const asList = (value) => (value === undefined ? [] : [].concat(value).map(String));

/** A JSON column's value, or the fallback when it is absent or malformed. */
const json = (value, fallback) => {
  try {
    const parsed = JSON.parse(value ?? "null");
    return parsed ?? fallback;
  } catch { return fallback; }
};

/** A path with its symlinks resolved, or the path itself when it cannot be. */
const realpathOf = (path) => {
  try { return realpathSync(path); } catch { return path; }
};

function requireFlag(flags, name, what) {
  const value = flags[camel(name)];
  if (value === undefined || value === true) throw new UsageError(`${what} Pass --${name} <value>.`);
  return String(value);
}

function requireWord(words, index, what) {
  const value = words[index];
  if (!value) throw new UsageError(what);
  return value;
}

// ------------------------------------------------------------------------ help

const HELP = `superdev, a local-first control system for building products.

Usage
  superdev <command> [options]

Getting started
  init                 Plan a new project from an idea, a brief or a folder
  adopt                Take on a codebase that already exists
  plan                 The shape of the work, read only
  status               Where the project is, how fresh that is, what is next
  readiness            The production-readiness checklist, gap by gap
  resume               Everything the next session needs to carry on
  doctor               Health of the database, the docs and the record map

Working
  task list            Open tasks, oldest first
  task show <id>       One task in full
  task create          Create a task against a feature
  task update <id>     Edit a task, or point it at what it implements
  task claim <id>      Take a task for this developer, agent and branch
  task start <id>      Move a task to In Progress
  task release <id>    Hand a task back
  task evidence <id>   Record what verifying it actually showed
  test-plan list       How each feature and the product itself is verified
  test-plan show <id>  One test plan, how to run it and what has run
  test-plan run <id>   Run the plan and record what it produced
  test-plan record <id>  Record a plan carried out by hand
  verify               Re-run the checks the recorded evidence stands on
  evidence supersede <id>  Retire a record that no longer applies, with the reason
  task cancel <id>     Stop work that should not continue, with a reason
  task complete <id>   Finish a task once its verification passes
  task block <id>      Record why a task cannot move
  task unblock <id>    Put a blocked task back where it was
  task reopen <id>     Reopen finished work, with a reason
  task merge <id>      Fold a duplicate into the task that keeps the work
  derive [feature]     Turn accepted specifications into tasks

Knowledge
  docs generate        Write the Markdown projection of the database
                       Add --reports for the summary, status and drift reports
  docs diff [path]     What a hand edit changed
  docs accept <path>   Take a hand edit into the database
  docs reject <path>   Put the generated version back
  memory search <text> Recall what earlier sessions recorded
  memory show <id>     One memory with its provenance and verification
  memory verify <id>   Check a memory against the current record
  memory consolidate   Merge duplicates, mark contradictions, rebuild the index
  memory supersede <id> Replace a memory that no longer holds
  memory status        What memory holds, and what retrieval can and cannot do
  memory benchmark     Measure retrieval against what section 15.12 requires
  question list        Open questions, oldest first
  change record        Record what moved in accepted scope, and why
  change list          What has changed, newest first
  change show <id>     One change and the records it moved
  assumption record    Record a reversible answer and its review trigger
  assumption list      Assumptions, the ones still holding first
  assumption resolve <id> Say what an assumption turned out to be
  question answer <id> Answer an open question
Product map
  module list          Modules and how many features each owns
  module show <id>     One module, its features and the contracts it owns
  goal list            Goals and whether their success criteria are met
  goal show <id>       One goal, how it is measured, what serves it
  milestone list       Delivery checkpoints and what is scheduled into them
  milestone show <id>  One milestone, its exit conditions and its features
  feature list         Every feature, its depth and its criteria
  feature show <id>    One feature and the whole contract under it
  workflow list        Workflows and how many steps each has
  workflow show <id>   One workflow, step by step
  architecture show    Runtime pieces, how they connect, integrations
  schema show [entity] The data model, or one entity's fields
  api show             Operations and the services that group them
  integration list     Integrations and what happens when one is absent

Knowledge
  decision record      Record a decision, with what it governs
  decision supersede   Replace a decision that no longer holds
  decision list        Decisions and what they still govern
  feature create       Add a feature to a module
  feature move <id>    Reassign a feature's module or milestone
  feature goal <id>    Say which goal a feature advances
  feature specify <id> Write the specification its depth requires
  goal record          Record a lasting outcome
  goal criterion <id>  Add a success criterion, with how it is measured
  milestone record     Record a delivery stage
  milestone condition <id>  Add an exit condition, or --entry for an entry one
  milestone update <id>     Rename it, restate it, or move its target date
  milestone met <id>        Mark a condition met, with the reading that decided it
  module record        Record a slice of the product
  module rename <id>   Rename a module, or restate what it owns
  capability list      Readiness areas and stack slots, and what settled each
  capability specify <id>   Record what was chosen for an area
  capability not-applicable <id>  Record that an area does not apply, with why
  surface record       Record a screen, panel or modal, and its actions
  entity record        Record something the product stores
  operation record     Record an operation something outside can call
  workflow record      Record a workflow and its ordered steps
  workflow step <id>   Add a step to a workflow
  requirement record   Record a security, privacy, performance or observability
                       requirement. This is where a security review is recorded
  integration record   Record an outside service, and what happens when it is gone
  test-plan record-new Record how something is tested, and how to run it
  migration record     Record a schema change and how it is rolled back
  states record        Record the states something moves through
  term record          Record what a word means in this project
  field add <id>       Add a field to a data entity
  relationship add     Record how two entities relate
  service record       Group operations under a service
  transition add <id>  Record a transition between two states
  surface state <id>   Describe an empty, loading or error state
  workflow actor <id>  Record who carries out part of a workflow
  workflow branch <id> Record where a workflow forks, and on what
  job record           Record something that runs in the background
  webhook record       Record an event this sends or receives
  runtime record       Record a piece of the running system
  discovery convert <id>  Turn a concept from the brief into a goal, module or feature
  scope record         Record what the product will not do, and why
  scope list           What is in scope, out of scope, and a non-goal
  scope remove <id>    Take a scope line back out
  retire <id>          Take a goal or milestone out of scope, with the reason
  feature waive <id>   Set an acceptance criterion aside, with the reason
  feature depth        Read what a depth requires, or set one
  feature accept       Accept a feature, refused while its depth is unmet
  category list        Task categories, what they mean, and how many use them
  category add         Add a category of your own
  category rename      Rename one
  category describe    Say what a category means in this project
  category retire      Take a category off the pickable list, keeping history
  category restore     Put a retired category back

Service and data
  ui                   Open the control center
  start / stop         Run or halt the local service
  restart / services   Restart it, or list what is running
  export / import      Move a project between machines
  settings             What Superdev checks on its own, and how to stop it
  db status            Schema version, integrity and row counts
  db migrate           Apply pending schema migrations
  db backup            Snapshot the database
  db restore <file>    Replace the database with a snapshot

Options
  --root <path>        Project directory. Defaults to the working directory
  --apply              Actually do it. Without this every command that would
                       change something prints the plan and changes nothing
  --json               Machine-readable output, and nothing else on stdout
  --out <path>         Write this command's output to a file
  --actor <name>       Who to record as responsible. Defaults to superdev
  --help               This text

Flags worth knowing
  init --brief <file>  Read the project from a document. See requirement.md in
                       the Superdev repository for the format it reads best
  init --adopt         The documents already here are input to this project, not
                       a record of it. Say this when init routes to adopt but the
                       files it found are a brief rather than a projection
  feature specify --not <text>
                       What the feature deliberately does not do. Repeatable.
                       Its counterpart is --in, and --out stays global
  ui | start --port <number>
                       Serve on this port instead of 4317. Every project defaults
                       to the same port, so the second one to start is refused
                       and needs this

Exit codes
  0 it worked, 1 something was found or refused, 2 the command was misused`;

// ------------------------------------------------------------------- utilities

const store = () => import("./db/store.mjs");

/**
 * Turn "the database file is not there" into the one sentence that says what to
 * do about it. Commands reach the database by many routes: some open it here,
 * some through a module that opens it for them. Rather than guard each route,
 * the translation happens once, around the handler, so a command added later
 * cannot reintroduce a driver message about WAL coordination paths.
 */
async function withFriendlyMissingProject(ctx, fn) {
  const { paths } = await store();
  const missing = !existsSync(paths(ctx.root).db);
  try {
    return await fn();
  } catch (err) {
    if (missing && /failed to open database|entity not found/i.test(String(err?.message ?? ""))) {
      throw new Refusal(
        "This directory has no Superdev project yet. Run init to plan one, or adopt to take on a codebase that already exists.",
        "E_NO_PROJECT",
      );
    }
    throw err;
  }
}

/** Read helper that refuses politely when the project was never initialized. */
async function withProject(root, fn) {
  const { query, currentProject, paths } = await store();
  // The file check comes first. Opening a database that was never created fails
  // inside the engine with a driver message about WAL coordination paths, which
  // is not an answer anyone can act on.
  if (!existsSync(paths(root).db)) {
    throw new Refusal(
      "This directory has no Superdev project yet. Run init to plan one, or adopt to take on a codebase that already exists.",
      "E_NO_PROJECT",
    );
  }
  return query(root, async (db) => {
    const project = await currentProject(db);
    if (!project) {
      throw new Refusal(
        "This directory has no Superdev project yet. Run init to plan one, or adopt to take on a codebase that already exists.",
        "E_NO_PROJECT",
      );
    }
    return fn(db, project);
  });
}

/** The standard shape of a command that did nothing because --apply was absent. */
const planned = (plan, what, text) => ({
  data: { applied: false, plan },
  text: `${text}${R.dryRunNote(what)}`,
});

const countWord = R.plural;

/**
 * A path the reader can act on. Inside the project it is relative, because an
 * absolute machine path is wider than the terminal and says nothing extra.
 */
function here(root, path) {
  if (!path) return path;
  const rel = relative(root, String(path));
  return rel && !rel.startsWith("..") ? rel : String(path);
}

/**
 * Shorten every project path inside a report whose shape this file does not
 * know. Reports from init, adopt, resume and the service carry absolute paths
 * that are wider than the terminal and tell the reader nothing.
 */
function localize(value, root, depth = 0) {
  if (value === root) return "this directory";
  if (typeof value === "string") return value.startsWith(`${root}/`) ? here(root, value) : value;
  if (!value || typeof value !== "object" || depth > 6) return value;
  if (Array.isArray(value)) return value.map((entry) => localize(entry, root, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, root, depth + 1)]));
}

// Values nobody needs to read and everybody would paste into a transcript. The
// machine-readable output still carries them, because the control center needs
// the instance token to talk to the service at all.
const SECRET_KEY = /token|secret|password|key$/i;

const maskSecrets = (value, depth = 0) => {
  if (!value || typeof value !== "object" || depth > 6) return value;
  if (Array.isArray(value)) return value.map((entry) => maskSecrets(entry, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) && typeof v === "string" ? "held locally, not shown" : maskSecrets(v, depth + 1),
    ]),
  );
};

/** A report whose shape belongs to another module, rendered as an outline. */
const report = (ctx, title, value) => R.renderReport(title, maskSecrets(localize(value, ctx.root)));

// ------------------------------------------------------------------ init, adopt

async function cmdInit(ctx) {
  const { planInit, applyInit } = await import("./init/index.mjs");
  // --brief and --notes used to be passed through under their own names, which
  // nothing downstream reads, so a brief file was silently discarded and init
  // still exited 0 reporting success. They map onto the two inputs that do
  // exist: a source file is ingested as evidence, and notes become the project
  // statement.
  const brief = ctx.flags.brief ? String(ctx.flags.brief) : null;
  if (brief && !existsSync(resolve(ctx.root, brief)) && !existsSync(brief)) {
    throw new UsageError(`There is no file at ${brief}. --brief names a file to read the project from.`);
  }
  const options = {
    idea: ctx.flags.idea ?? null,
    sources: brief ? [brief] : [],
    statement: ctx.flags.notes ?? null,
    name: ctx.flags.name ?? null,
    actor: ctx.actor,
    // Existing documents normally mean adopt, because initializing over them
    // would create a second source of truth. This says they are input rather
    // than a projection, which is the case when initializing from a
    // requirements document. Without it there was no way to say so, and the
    // refusal named an internal function nobody could run.
    adopt: Boolean(ctx.flags.adopt),
  };
  if (!ctx.apply) {
    const plan = await planInit(ctx.root, options);
    return planned(plan, "create the project", report(ctx, "Initialization plan", plan));
  }
  const result = await applyInit(ctx.root, options);
  return { data: { applied: true, result }, text: report(ctx, "Project initialized", result) };
}

async function cmdAdopt(ctx) {
  const { adoptProject } = await import("./init/index.mjs");
  const result = await adoptProject(ctx.root, { apply: ctx.apply, actor: ctx.actor });
  if (!ctx.apply) {
    return planned(result, "adopt this codebase", report(ctx, "Adoption plan", result));
  }
  return { data: { applied: true, result }, text: report(ctx, "Codebase adopted", result) };
}

// ------------------------------------------------------------------------ plan

/**
 * Read only on purpose. It says what the work looks like and what deriving
 * would create; `derive --apply` is the command that creates it. Two commands
 * that both write the same tasks would be one command too many.
 */
async function cmdPlan(ctx) {
  const { projectProgress, nextAction } = await import("./progress/index.mjs");
  const { derivationDelta } = await import("./tasks/derive.mjs");

  const view = await withProject(ctx.root, async (db, project) => {
    const progress = await projectProgress(db, project.id);
    const next = await nextAction(db, project.id);
    const milestones = await db.all(
      "SELECT id, name, status, target_date FROM milestones WHERE project_id = ? ORDER BY sequence, id",
      project.id,
    );
    const modules = await db.all(
      "SELECT id, name, status FROM modules WHERE project_id = ? ORDER BY sequence, id",
      project.id,
    );
    const features = await db.all(
      "SELECT id, name, status, module_id FROM features WHERE project_id = ? ORDER BY module_id, id",
      project.id,
    );
    return { project, progress, next, milestones, modules, features };
  });

  const delta = await derivationDelta(ctx.root, ctx.words[1] ?? null);
  const wouldCreate = delta.created?.length ?? delta.created ?? 0;

  const text = R.stitch([
    `${view.project.name} (${view.project.id})`,
    "",
    R.block("Progress", `Overall: ${R.completion(view.progress)}`),
    "",
    R.block("Milestones", view.milestones.length
      ? R.table(["Id", "Status", "Target", "Name"],
          view.milestones.map((m) => [m.id, R.status(m.status), m.target_date ?? "", m.name]))
      : "  None recorded."),
    "",
    R.block("Modules and features", view.modules.length
      ? view.modules.map((m) => R.stitch([
          `${m.id}  ${m.name} (${R.status(m.status)})`,
          R.bullets(view.features.filter((f) => f.module_id === m.id)
            .map((f) => `${f.id} ${f.name} (${R.status(f.status)})`), "    "),
        ])).join("\n")
      : "  None recorded."),
    "",
    R.block("Deriving would", typeof wouldCreate === "number"
      ? `  create ${countWord(wouldCreate, "task")} from accepted specifications. Run derive --apply to do it.`
      : "  make no change."),
    "",
    R.block("Next", view.next ? `${view.next.title}\n${R.wrap(view.next.remedy ?? "", R.WIDTH, "  ")}` : ""),
  ]);

  return { data: { ...view, derivation: delta }, text };
}

// ---------------------------------------------------------------------- status

async function cmdStatus(ctx) {
  const { projectProgress, freshness, nextAction, alignmentWarnings } =
    await import("./progress/index.mjs");

  const view = await withProject(ctx.root, async (db, project) => ({
    project,
    progress: await projectProgress(db, project.id),
    freshness: await freshness(db, project.id),
    next: await nextAction(db, project.id),
    warnings: await alignmentWarnings(db, project.id),
  }));

  return { data: view, text: R.renderStatus(view) };
}

async function cmdReadiness(ctx) {
  const { readiness } = await import("./progress/index.mjs");
  const report = await withProject(ctx.root, (db, project) => readiness(db, project.id));
  return { data: report, text: R.renderReadiness(report) };
}

// ---------------------------------------------------------------------- resume

async function cmdResume(ctx) {
  if (ctx.flags.end) {
    const { endSession, activeSession } = await import("./runtime/session.mjs");
    if (!ctx.apply) {
      const sessionId = ctx.flags.session ?? null;
      return planned({ sessionId }, "end the session",
        R.wrap(`Would end ${sessionId ? `session ${sessionId}` : "the active session"} and write its outcome.`));
    }
    // endSession takes the id positionally. Passing the options object in that
    // slot meant every --end ever run reported "Session [object Object] does not
    // exist", so this path has never worked. And --session is optional, so the
    // null case has to resolve the live session rather than hand down a null.
    const sessionId = ctx.flags.session ? String(ctx.flags.session) : (await activeSession(ctx.root))?.id ?? null;
    if (!sessionId) {
      throw new Refusal(
        "There is no active session to end. Pass --session <SES-id> to name one.",
        "E_NO_ACTIVE_SESSION",
      );
    }
    const result = await endSession(ctx.root, sessionId, { actor: ctx.actor, note: ctx.flags.note ?? null });
    return { data: { applied: true, result }, text: report(ctx, "Session ended", result) };
  }

  let started = null;
  if (ctx.apply) {
    const { startSession } = await import("./runtime/session.mjs");
    started = await startSession(ctx.root, {
      actor: ctx.actor,
      objective: ctx.flags.objective ?? null,
    });
  }

  const { resumeContext } = await import("./runtime/resume.mjs");
  const context = await resumeContext(ctx.root, {
    sessionId: ctx.flags.session ?? started?.id ?? started?.session?.id ?? null,
  });

  const text = R.stitch([
    started ? "A work session was started for this run." : null,
    report(ctx, "Where to carry on", context),
    ctx.apply ? null : "\nNo session was started. Re-run with --apply to open one.",
  ]);
  return { data: { applied: Boolean(started), session: started, context }, text };
}

// ---------------------------------------------------------------------- doctor

/**
 * One place that answers "is anything wrong". Every check is a sentence with a
 * verdict, and a failing check makes the command exit 1 so a hook can act on it.
 */
async function cmdDoctor(ctx) {
  const { paths } = await store();
  const { inspect } = await import("./db/migrate.mjs");
  const { integrityCheck } = await import("./db/maintenance.mjs");
  const { alignmentWarnings, freshness } = await import("./progress/index.mjs");
  const { detectProposals } = await import("./docs/proposals.mjs");

  const dbFile = paths(ctx.root).db;
  const checks = [];

  // First, because nothing below it can run without this. A Claude Code
  // marketplace install copies the plugin into its own cache, and node_modules
  // is git-ignored, so the copy arrives with no engine and every other command
  // fails at the import with a stack trace instead of a sentence. Doctor exists
  // to turn exactly that into an instruction.
  // Reaching this line proves it: the engine is a static import inside
  // src/db/connect.mjs, which store() above already pulled in, so a missing
  // engine never gets here. It is reported anyway because "the engine is fine"
  // is one of the things a person runs doctor to be told. The failing case is
  // handled once, in run(), for every command rather than only this one.
  checks.push({
    name: "Storage engine",
    ok: true,
    detail: "Installed and loaded",
  });

  const migrations = await inspect(dbFile);

  checks.push({
    name: "Database",
    ok: migrations.databaseExists,
    detail: migrations.databaseExists
      ? `Schema version ${migrations.version} of ${migrations.latest}, ${countWord(migrations.pending.length, "migration")} pending`
      : "No database in this directory yet. Run init.",
  });

  if (!migrations.databaseExists) {
    return { data: { ok: false, checks, migrations, findings: [] }, text: R.renderDoctor({ checks }), exit: 1 };
  }

  if (migrations.drift.length) {
    checks.push({
      name: "Migration history",
      ok: false,
      detail: migrations.drift.map((d) => `${d.version}: ${d.problem}`).join("; "),
    });
  }

  const integrity = await integrityCheck(ctx.root);
  checks.push({
    name: "Integrity",
    ok: integrity.ok,
    detail: integrity.ok
      ? "No page damage and no dangling references"
      : `${integrity.integrity.filter((line) => line !== "ok").join("; ") || ""} ${countWord(integrity.foreignKeys.length, "dangling reference")}`.trim(),
  });

  const proposals = await detectProposals(ctx.root, { apply: false });
  checks.push({
    name: "Documentation",
    ok: proposals.proposals.length === 0,
    detail: proposals.proposals.length
      ? `${countWord(proposals.proposals.length, "file")} waiting on a decision`
      : proposals.scanned
        ? `${countWord(proposals.scanned, "generated file")} match the database`
        : "Nothing has been generated yet",
  });

  // Markdown in the docs root that no record claims.
  //
  // Two Superdev architectures existed under the same version number, and both
  // wrote to talks/. A copy of the older one, driving its own engine, would fill
  // that directory with files this database has never heard of, and every check
  // here would stay green because each one asks about records rather than about
  // the directory. An unclaimed file is also what a hand-created document looks
  // like, which is worth naming for its own sake.
  const foreign = await unclaimedDocuments(ctx.root);
  if (foreign.length) {
    checks.push({
      name: "Docs directory",
      ok: false,
      detail: `${countWord(foreign.length, "file")} under the docs root ${foreign.length === 1 ? "belongs" : "belong"} to no record: ${foreign.slice(0, 3).join(", ")}${foreign.length > 3 ? ", and more" : ""}. Superdev did not write ${foreign.length === 1 ? "it" : "them"}, so nothing here keeps ${foreign.length === 1 ? "it" : "them"} true.`,
    });
  }

  const view = await withProject(ctx.root, async (db, project) => ({
    warnings: await alignmentWarnings(db, project.id),
    freshness: await freshness(db, project.id),
  }));

  // Low-severity findings are reported without failing the check.
  //
  // Any warning at all used to fail it, which made recording an assumption block
  // every release: "an assumption is still holding" is a note that somebody did the
  // right thing, and the product asks them to do it. A gate that fires on correct
  // behaviour teaches people to avoid the behaviour, which is how a checklist stops
  // being read. High and medium say the record is wrong and still fail; low says
  // there is something to know, and it is printed either way.
  const high = view.warnings.filter((w) => w.severity === "high").length;
  const failing = view.warnings.filter((w) => w.severity !== "low").length;
  const low = view.warnings.length - failing;
  checks.push({
    name: "Alignment",
    ok: failing === 0,
    detail: failing
      ? `${countWord(failing, "warning")}, ${high} of them high${low ? `, and ${low} worth knowing` : ""}`
      : low
        ? `Every record maps to something that declares it. ${countWord(low, "note")} below worth reading.`
        : "Every record maps to something that declares it",
  });
  checks.push({
    name: "Freshness",
    ok: !view.freshness.stale,
    detail: view.freshness.stale ? view.freshness.reasons[0] : "Nothing is out of date",
  });

  // Provider readiness, checked and written down.
  //
  // providerReadiness() in the runtime hooks reads .superdev/runtime/providers.json
  // and its own comment says doctor writes it. Nothing ever did, the file never
  // existed, and so the readiness line could not fire and doctor reported nothing
  // about providers at all, while the debug skill told agents to check readiness
  // here. Detection ran once during init and was never kept.
  //
  // Nothing is installed. An absent provider stays absent until the owner asks
  // for it; this only records what is present.
  const providers = await recordProviderReadiness(ctx.root, paths);
  if (providers) checks.push(providers);

  // Evidence that nothing can re-run, reported without re-running anything:
  // doctor stays a fast read, and superdev verify is where checks actually run.
  const evidence = await withProject(ctx.root, (db) => db.get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN check_command IS NULL OR TRIM(check_command) = '' THEN 1 ELSE 0 END) AS manual,
            SUM(CASE WHEN last_check_result = 'fail' THEN 1 ELSE 0 END) AS failing
       FROM verification_evidence WHERE status = 'current'`));
  checks.push({
    name: "Evidence",
    ok: evidence?.total ? (evidence.failing ?? 0) === 0 : null,
    detail: evidence?.total
      ? `${evidence.total - evidence.manual} of ${evidence.total} can be re-run${evidence.failing ? `, ${evidence.failing} last failed` : ""}. Run superdev verify.`
      : "No evidence recorded yet",
  });

  const ok = checks.every((c) => c.ok !== false);
  return {
    data: { ok, checks, migrations, integrity: { ok: integrity.ok, counts: integrity.counts }, findings: view.warnings },
    text: R.renderDoctor({ checks, findings: view.warnings }),
    exit: ok ? 0 : 1,
  };
}

/**
 * Markdown under the project's docs root that no document record claims.
 *
 * Read only, and bounded: this is a health check, not a crawl. The docs root is
 * read from the project rather than assumed, because adoption points it at
 * whatever the repository already used.
 */
async function unclaimedDocuments(root) {
  const found = [];
  try {
    const { readdirSync } = await import("node:fs");
    const project = await withProject(root, async (db) => ({
      docsRoot: (await db.get("SELECT docs_profile FROM projects LIMIT 1"))?.docs_profile === "talks-v1" ? "talks" : null,
      known: new Set((await db.all("SELECT path FROM documents")).map((d) => d.path)),
    }));
    if (!project.docsRoot) return [];
    const base = resolve(root, project.docsRoot);
    const walk = (dir, depth) => {
      if (depth > 4 || found.length > 50) return;
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else if (entry.name.endsWith(".md")) {
          const rel = relative(resolve(root), full).split("\\").join("/");
          if (!project.known.has(rel)) found.push(rel);
        }
      }
    };
    walk(base, 0);
  } catch {
    // A health check that throws is worse than one that says nothing here.
    return [];
  }
  return found;
}

/**
 * Detect the installed providers and write the report the session hook reads.
 *
 * Ids and states only. A provider's path or version detail names one machine,
 * and this file is read at session start where that would leak into a prompt.
 */
async function recordProviderReadiness(root, paths) {
  try {
    const { detectAll } = await import("../scripts/providers/detect.mjs");
    const report = detectAll({ rootReal: resolve(root) });
    const rows = (report?.providers ?? []).map((p) => ({ id: p.id, state: p.state }));
    const ready = rows.filter((p) => p.state === "available-and-ready");
    const notReady = rows.filter((p) => p.state !== "available-and-ready" && p.state !== "not-applicable");

    const dir = paths(root).runtime;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "providers.json"),
      JSON.stringify({ checkedAt: new Date().toISOString(), providers: rows }, null, 2) + "\n",
    );

    return {
      name: "Providers",
      // Not being installed is not a fault. The check exists to say which
      // specialist passes will not run, not to demand that they can.
      ok: true,
      detail: rows.length
        ? `${ready.length} of ${rows.length} ready${notReady.length ? `, not ready: ${notReady.map((p) => p.id).join(", ")}` : ""}`
        : "No provider was detected",
    };
  } catch (error) {
    // ok: null, not ok: true. This returned Pass beside the words "could not be
    // determined", which is a contradiction printed in green, and the detail
    // column truncates at 80 characters so on a narrow terminal only the green
    // was visible. Doctor exists so nothing is silently skipped; its own checks
    // are held to that.
    return {
      name: "Providers",
      ok: null,
      detail: `Readiness could not be determined: ${String(error.message).slice(0, 120)}`,
    };
  }
}

// --------------------------------------------------------------------- service

const service = () => import("./service/manage.mjs");

// The service reports a state, not a boolean. Both spellings are accepted so a
// later rename of one field cannot silently make `ui` claim nothing is running.
const isRunning = (report) => report?.state === "running" || report?.running === true;

/**
 * The port to serve on, when the default one is taken.
 *
 * The refusal for a held port told the reader to start on another port and no
 * command could. This is that flag, validated here rather than in two places:
 * `ui` and `start` are the same decision made twice, and a port that is not a
 * usable number has to be refused before a process is spawned against it.
 */
function portFrom(ctx) {
  if (ctx.flags.port === undefined) return null;
  const value = Number(ctx.flags.port);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new UsageError(`--port takes a whole number between 1024 and 65535. ${JSON.stringify(String(ctx.flags.port))} is not one.`);
  }
  return value;
}

async function cmdUi(ctx) {
  const { serviceStatus, startService } = await service();
  const current = await serviceStatus(ctx.root);
  if (isRunning(current)) {
    return {
      data: { applied: false, service: current },
      text: R.stitch([
        "The control center is already running.",
        R.pairs([["Address", current.url ?? `http://127.0.0.1:${current.port ?? ""}`], ["Process", current.pid]], ""),
      ]),
    };
  }
  const port = portFrom(ctx);
  if (!ctx.apply) {
    return planned(current, "start the control center",
      R.wrap(`The control center is not running. Starting it opens one local process for this project and listens on the loopback address only${port ? `, on port ${port}` : ""}.`));
  }
  const started = await startService(ctx.root, { actor: ctx.actor, ...(port ? { port } : {}) });
  return { data: { applied: true, service: started }, text: report(ctx, "Control center started", started) };
}

async function cmdStart(ctx) {
  const { startService, serviceStatus } = await service();
  const port = portFrom(ctx);
  if (!ctx.apply) {
    return planned(await serviceStatus(ctx.root), "start the local service",
      port
        ? `Starting the service opens one local process for this project, on port ${port}.`
        : "Starting the service opens one local process for this project.");
  }
  const started = await startService(ctx.root, { actor: ctx.actor, ...(port ? { port } : {}) });
  return { data: { applied: true, service: started }, text: report(ctx, "Service started", started) };
}

async function cmdStop(ctx) {
  const { stopService, serviceStatus } = await service();
  if (!ctx.apply) {
    return planned(await serviceStatus(ctx.root), "stop the local service",
      "Stopping the service ends the local process. Nothing recorded is lost.");
  }
  const stopped = await stopService(ctx.root, { actor: ctx.actor });
  return { data: { applied: true, service: stopped }, text: report(ctx, "Service stopped", stopped) };
}

async function cmdRestart(ctx) {
  const { restartService, serviceStatus } = await service();
  if (!ctx.apply) {
    return planned(await serviceStatus(ctx.root), "restart the local service",
      "Restarting stops the local process and starts a fresh one.");
  }
  const result = await restartService(ctx.root, { actor: ctx.actor });
  return { data: { applied: true, service: result }, text: report(ctx, "Service restarted", result) };
}

async function cmdServices(ctx) {
  const { serviceStatus } = await service();
  const state = await serviceStatus(ctx.root);
  return { data: state, text: report(ctx, "Local service", state) };
}

// ------------------------------------------------------------- export, import

async function cmdExport(ctx) {
  const { exportProject } = await import("./db/maintenance.mjs");
  const out = ctx.flags.out ? resolve(String(ctx.flags.out)) : null;
  if (!ctx.apply) {
    return planned({ out }, "write the export",
      R.wrap(`Would write a portable snapshot of every record${out ? ` to ${here(ctx.root, out)}` : " into .superdev/exports"}.`));
  }
  const result = await exportProject(ctx.root, { out });
  return {
    data: { applied: true, ...result },
    text: R.stitch([
      R.wrap(`Wrote ${countWord(result.rows, "row")} to ${here(ctx.root, result.path)}.`),
      R.table(["Table", "Rows"], result.tables.filter((t) => t.rows).map((t) => [t.table, String(t.rows)]), { flex: 0 }),
    ]),
    // The export file is the output, so --out must not be reused as a text sink.
    consumedOut: true,
  };
}

async function cmdImport(ctx) {
  const { importProject } = await import("./db/maintenance.mjs");
  const file = requireWord(ctx.words, 1, "Say which export file to read: superdev import <file>.");
  const result = await importProject(ctx.root, resolve(file), { apply: ctx.apply });
  if (!result.applied) {
    return planned(result.plan, "load these records",
      report(ctx, `Import plan for ${result.plan.project?.id ?? "this export"}`, result.plan));
  }
  return {
    data: result,
    text: R.wrap(`Loaded ${countWord(result.inserted, "new row")} of ${result.rows} in the export. Rows already present were left alone.`),
  };
}

// ------------------------------------------------------------------- database

async function cmdDbStatus(ctx) {
  const { paths } = await store();
  const { inspect } = await import("./db/migrate.mjs");
  const { integrityCheck } = await import("./db/maintenance.mjs");
  const dbFile = paths(ctx.root).db;
  const migrations = await inspect(dbFile);
  if (!migrations.databaseExists) {
    return {
      data: { migrations, integrity: null },
      text: "This directory has no Superdev database yet. Run init to create one.",
      exit: 1,
    };
  }
  const integrity = await integrityCheck(ctx.root);
  const counted = Object.entries(integrity.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return {
    data: { migrations, integrity },
    text: R.stitch([
      R.heading("Database"),
      R.pairs([
        // Relative on purpose: an absolute machine path is longer than the
        // terminal and tells the reader nothing they did not already know.
        ["Location", here(ctx.root, dbFile)],
        ["Schema version", `${migrations.version} of ${migrations.latest}`],
        ["Pending migrations", migrations.pending.length],
        ["Integrity", integrity.ok ? "Sound" : "Damaged, run doctor"],
        ["Drift", migrations.drift.length ? migrations.drift.map((d) => d.problem).join("; ") : "None"],
      ]),
      "",
      R.block("Rows", R.table(["Table", "Rows"], counted.map(([t, n]) => [t, String(n)]), { flex: 0 })),
    ]),
    exit: integrity.ok && !migrations.drift.length ? 0 : 1,
  };
}

async function cmdDbMigrate(ctx) {
  const { paths } = await store();
  const { migrate } = await import("./db/migrate.mjs");
  // A running control centre holds read connections opened against the current
  // schema, and they are pinned to the snapshot they opened on. Changing the
  // schema underneath them is how a live interface starts answering with
  // columns that no longer mean what it thinks. Same refusal as db restore.
  if (ctx.apply) {
    const { assertNoLiveService } = await import("./service/manage.mjs");
    await assertNoLiveService(ctx.root);
  }
  const result = await migrate(paths(ctx.root).db, { apply: ctx.apply });
  if (!ctx.apply) {
    if (!result.pending.length) return { data: result, text: "The database schema is already up to date." };
    return planned(result, "apply them", R.stitch([
      `${countWord(result.pending.length, "migration")} would run, taking the schema from ${result.from} to ${result.to}.`,
      R.table(["Version", "File", "Statements"],
        result.pending.map((m) => [String(m.version), m.name, String(m.statements)]), { flex: 1 }),
      "\nThe database is copied aside before anything runs.",
    ]));
  }
  if (!result.applied.length) return { data: result, text: "The database schema was already up to date." };
  return {
    data: result,
    text: R.stitch([
      `Applied ${countWord(result.applied.length, "migration")}. The schema is now at version ${result.to}.`,
      result.backup ? R.wrap(`The previous database was copied to ${here(ctx.root, result.backup)}.`) : null,
    ]),
  };
}

async function cmdDbBackup(ctx) {
  const { backup, listBackups, KEEP_BACKUPS } = await import("./db/maintenance.mjs");
  const label = ctx.flags.label ? String(ctx.flags.label) : "manual";
  if (!ctx.apply) {
    const existing = await listBackups(ctx.root);
    return planned({ label, existing: existing.length }, "take the snapshot", R.stitch([
      `Would write a complete snapshot labelled ${label} into .superdev/backups.`,
      `${countWord(existing.length, "backup")} already there. The newest ${KEEP_BACKUPS} are kept.`,
    ]));
  }
  const result = await backup(ctx.root, label);
  const kept = await listBackups(ctx.root);
  return {
    data: { applied: true, ...result, backups: kept.length },
    text: R.stitch([
      R.wrap(`Wrote ${here(ctx.root, result.path)} (${result.bytes} bytes).`),
      R.table(["When", "Size", "Name"], kept.map((b) => [R.shortDate(b.at), String(b.bytes), b.name])),
    ]),
  };
}

async function cmdDbRestore(ctx) {
  const { restore, listBackups } = await import("./db/maintenance.mjs");
  let file = ctx.words[2];
  if (!file) {
    const kept = await listBackups(ctx.root);
    if (!kept.length) throw new Refusal("There is no backup to restore from.", "E_NO_BACKUP");
    throw new UsageError(
      `Say which backup to restore: superdev db restore <file>. The newest is ${here(ctx.root, kept[0].path)}.`,
    );
  }
  // Passed through as written. A bare name is the name every command prints,
  // and restore resolves it against the backups directory; resolving it here
  // against the working directory turned the printed name into a file that
  // does not exist.
  const result = await restore(ctx.root, String(file), { apply: ctx.apply });
  if (!result.applied) {
    return planned(result.plan, "replace the database", R.stitch([
      R.wrap(`Would replace the project database with ${here(ctx.root, result.plan.from)} (${result.plan.bytes} bytes).`),
      R.wrap(result.plan.backsUpCurrent
        ? "The current database is snapshotted first, so restoring the wrong file is itself recoverable."
        : "There is no database here yet, so nothing is being replaced."),
    ]));
  }
  return {
    data: result,
    text: R.stitch([
      R.wrap(`Restored the database from ${here(ctx.root, result.plan.from)}.`),
      result.safetyBackup
        ? R.wrap(`The database that was there is kept at ${here(ctx.root, result.safetyBackup.path)}.`)
        : null,
    ]),
  };
}

// ----------------------------------------------------------------------- tasks

const lifecycle = () => import("./tasks/lifecycle.mjs");

const OPEN_ONLY = ["draft", "ready", "in_progress", "in_review", "verifying", "blocked", "paused"];

async function cmdTaskList(ctx) {
  const { query } = await store();
  const statuses = ctx.flags.status ? asList(ctx.flags.status).flatMap((s) => s.split(",")) : null;
  const feature = ctx.flags.feature ? String(ctx.flags.feature) : null;
  const limit = Number(ctx.flags.limit ?? 200);

  const tasks = await query(ctx.root, async (db) => {
    const where = [];
    const params = [];
    if (feature) {
      where.push("feature_id = ?");
      params.push(feature);
    }
    const wanted = statuses ?? (ctx.flags.all ? null : OPEN_ONLY);
    if (wanted) {
      where.push(`status IN (${wanted.map(() => "?").join(",")})`);
      params.push(...wanted);
    }
    return db.all(
      `SELECT * FROM tasks ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY sequence, id LIMIT ${Math.max(1, Math.min(limit, 1000))}`,
      ...params,
    );
  });

  const title = ctx.flags.all ? "Every task" : "Open tasks";
  return { data: { tasks }, text: R.renderTaskList(tasks, { title }) };
}

async function cmdTaskShow(ctx) {
  const { query, json } = await store();
  const id = requireWord(ctx.words, 2, "Say which task to show: superdev task show <id>.");

  const detail = await query(ctx.root, async (db) => {
    const task = await db.get("SELECT * FROM tasks WHERE id = ?", id);
    if (!task) throw new Refusal(`There is no task ${id}. Run task list to see what exists.`, "E_NOT_FOUND");
    const assignment = await db.get(
      "SELECT * FROM task_assignments WHERE task_id = ? AND active = 1", id,
    );
    let holder = null;
    if (assignment?.developer_id) {
      holder = (await db.get("SELECT display_name FROM developers WHERE id = ?", assignment.developer_id))?.display_name ?? null;
    }
    return {
      task,
      feature: await db.get("SELECT id, name FROM features WHERE id = ?", task.feature_id),
      links: await db.all("SELECT * FROM task_contract_links WHERE task_id = ? ORDER BY target_type, target_id", id),
      dependencies: await db.all(
        `SELECT t.id, t.name, t.status FROM task_dependencies d
           JOIN tasks t ON t.id = d.depends_on_task_id
          WHERE d.task_id = ? ORDER BY t.id`, id,
      ),
      subtasks: await db.all("SELECT id, name, status FROM tasks WHERE parent_task_id = ? ORDER BY sequence, id", id),
      assignment: assignment ? { ...assignment, holder } : null,
      evidence: await db.all(
        "SELECT * FROM verification_evidence WHERE task_id = ? ORDER BY recorded_at DESC LIMIT 10", id,
      ),
      history: await db.all(
        `SELECT * FROM status_history WHERE record_type = 'task' AND record_id = ?
          ORDER BY sequence DESC LIMIT 10`, id,
      ),
      completionCriteria: json(task.completion_criteria_json, []),
      verificationRequirements: json(task.verification_requirements_json, []),
    };
  });

  return { data: detail, text: R.renderTaskDetail(detail) };
}

const parseLink = (value) => {
  const [targetType, targetId] = String(value).split(":");
  if (!targetType || !targetId) {
    throw new UsageError(`--link takes type:id, for example --link acceptance_criterion:AC-0003. Got ${value}.`);
  }
  return { targetType, targetId };
};

async function cmdTaskCreate(ctx) {
  const input = {
    featureId: requireFlag(ctx.flags, "feature", "A task belongs to exactly one feature."),
    name: requireFlag(ctx.flags, "name", "A task needs a name that states the outcome."),
    description: ctx.flags.description ?? null,
    expectedOutcome: ctx.flags.outcome ?? null,
    whyNeeded: ctx.flags.why ?? null,
    completionCriteria: asList(ctx.flags.criterion),
    verificationRequirements: asList(ctx.flags.verify),
    affectedBoundaries: asList(ctx.flags.boundary),
    priority: ctx.flags.priority ? String(ctx.flags.priority) : "normal",
    risk: ctx.flags.risk ?? null,
    category: ctx.flags.category ?? null,
    estimate: ctx.flags.estimate ?? null,
    dueAt: ctx.flags.due ?? null,
    parentTaskId: ctx.flags.parent ?? null,
    enabling: Boolean(ctx.flags.enabling),
    enabledFeatureId: ctx.flags.enabledFeature ?? null,
    enablingRationale: ctx.flags.rationale ?? null,
    links: asList(ctx.flags.link).map(parseLink),
    dependsOn: asList(ctx.flags.dependsOn),
    status: ctx.flags.status ? String(ctx.flags.status) : "draft",
    actor: ctx.actor,
  };

  if (!ctx.apply) {
    return planned(input, "create it", R.stitch([
      `Would create a task against ${input.featureId}.`,
      R.pairs([
        ["Name", input.name],
        ["Status", R.status(input.status)],
        ["Priority", R.status(input.priority)],
        ["Expected outcome", input.expectedOutcome],
        ["Implements", input.links.map((l) => `${l.targetType} ${l.targetId}`).join(", ") || "nothing yet"],
      ]),
    ]));
  }

  const { createTask } = await lifecycle();
  const task = await createTask(ctx.root, input);
  return {
    data: { applied: true, task },
    text: R.wrap(`Created ${task.id} against ${task.feature_id}. It is ${R.status(task.status)}.`),
  };
}

const TASK_FIELDS = [
  ["name", "name"], ["description", "description"], ["outcome", "expectedOutcome"],
  ["why", "whyNeeded"], ["priority", "priority"], ["risk", "risk"],
  ["estimate", "estimate"], ["due", "dueAt"], ["parent", "parentTaskId"],
  ["rationale", "enablingRationale"], ["enabledFeature", "enabledFeatureId"],
];

async function cmdTaskUpdate(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to update: superdev task update <id>.");
  const values = {};
  for (const [flag, field] of TASK_FIELDS) {
    if (ctx.flags[flag] !== undefined) values[field] = String(ctx.flags[flag]);
  }
  if (ctx.flags.criterion !== undefined) values.completionCriteria = asList(ctx.flags.criterion);
  if (ctx.flags.verify !== undefined) values.verificationRequirements = asList(ctx.flags.verify);
  if (ctx.flags.boundary !== undefined) values.affectedBoundaries = asList(ctx.flags.boundary);
  if (ctx.flags.status !== undefined) {
    throw new UsageError(
      "Status moves through its own commands so the change always leaves history. Use task claim, task block, task complete or task reopen.",
    );
  }
  // A task that implements nothing cannot leave draft, and until now the only
  // moment it could be given a contract was the moment it was created. A task
  // created without one was therefore stuck forever, with the refusal naming a
  // link no command could add. The engine always had linkContract; nothing
  // reached it.
  const links = asList(ctx.flags.link).map(parseLink);

  if (!Object.keys(values).length && !links.length) {
    throw new UsageError("Nothing to update. Pass at least one of --name, --description, --outcome, --why, --priority, --risk, --estimate, --due, --criterion, --verify or --link.");
  }

  if (!ctx.apply) {
    return planned({ id, values, links }, "save it", R.stitch([
      `Would update ${id}.`,
      Object.keys(values).length
        ? R.pairs(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.join("; ") : v]))
        : null,
      links.length ? R.wrap(`It would implement ${links.map((l) => `${l.targetType} ${l.targetId}`).join(", ")}.`) : null,
    ]));
  }
  const { updateTask, linkContract } = await lifecycle();
  let task = null;
  if (Object.keys(values).length) task = await updateTask(ctx.root, id, values, { actor: ctx.actor });
  for (const link of links) task = await linkContract(ctx.root, id, link, { actor: ctx.actor });
  return {
    data: { applied: true, task, links },
    text: links.length
      ? `Updated ${id}. It now implements ${links.map((l) => `${l.targetType} ${l.targetId}`).join(", ")}.`
      : `Updated ${task.id}.`,
  };
}

async function cmdTaskClaim(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to claim: superdev task claim <id>.");
  const who = {
    developerId: ctx.flags.developer ?? null,
    agentId: ctx.flags.agent ?? null,
    branchId: ctx.flags.branch ?? null,
    sessionId: ctx.flags.session ?? null,
    actor: ctx.actor,
  };
  if (!ctx.apply) {
    return planned({ id, ...who }, "claim it",
      R.wrap(`Would claim ${id} for ${ctx.actor}. A task can be held by one session at a time.`));
  }
  const { claimTask } = await lifecycle();
  const task = await claimTask(ctx.root, id, who);
  return { data: { applied: true, task }, text: `${task.id} is now claimed. It is ${R.status(task.status)}.` };
}

async function cmdTaskRelease(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to release: superdev task release <id>.");
  const reason = ctx.flags.reason ? String(ctx.flags.reason) : null;
  if (!ctx.apply) {
    return planned({ id, reason }, "release it",
      R.wrap(`Would hand ${id} back. Its status does not change, only the claim ends.`));
  }
  const { releaseTask } = await lifecycle();
  const task = await releaseTask(ctx.root, id, { actor: ctx.actor, reason });
  return {
    data: { applied: true, task },
    text: R.wrap(`${task.id} is free to be claimed again. It is still ${R.status(task.status)}.`),
  };
}

/**
 * Not in the brief's list, but a task that can be blocked and never started or
 * unblocked is a dead end: `reopen` refuses work that is still open, so without
 * these two the listed commands cannot get a task back out of blocked.
 */
async function cmdTaskStart(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to start: superdev task start <id>.");
  if (!ctx.apply) {
    return planned({ id }, "start it",
      R.wrap(`Would move ${id} to In Progress. Anything still blocking it is recorded rather than refused.`));
  }
  const { startTask } = await lifecycle();
  const task = await startTask(ctx.root, id, {
    actor: ctx.actor, sessionId: ctx.flags.session ?? null, note: ctx.flags.note ?? null,
  });
  return { data: { applied: true, task }, text: `${task.id} is In Progress.` };
}

async function cmdTaskUnblock(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to unblock: superdev task unblock <id>.");
  const to = ctx.flags.to ? String(ctx.flags.to) : null;
  if (!ctx.apply) {
    return planned({ id, to }, "unblock it",
      R.wrap(`Would move ${id} back to ${to ? R.status(to) : "whatever it was doing before it blocked"}.`));
  }
  const { unblockTask } = await lifecycle();
  const task = await unblockTask(ctx.root, id, { actor: ctx.actor, to, note: ctx.flags.note ?? null });
  return {
    data: { applied: true, task },
    text: R.stitch([
      `${task.id} is ${R.status(task.status)} again.`,
      task.unclaimed ? R.wrap(task.unclaimed) : null,
    ]),
  };
}

/**
 * Record what verifying the task actually showed.
 *
 * Completion is refused without this, so before it existed no task could be
 * finished through the product's own interface: the engine could record
 * evidence but nothing reachable called it.
 *
 * A result is never assumed. --result defaults to pass because that is the
 * common case, but a failing or inconclusive run is recorded just as readily,
 * and a failure retracts any acceptance criterion it had been the proof for.
 */
/**
 * Record a decision.
 *
 * Nothing could write one before this: the table, its transitions, its
 * supersession chain and every report built on them existed, and the only way a
 * row ever appeared was a script reading the ADR files.
 */
// ------------------------------------------------------------- product map
//
// Section 12.4 names fifteen read commands and none existed, so a terminal
// session could write the product model and never read it back.

const productMap = () => import("./cli/product-map.mjs");
const said = (result) => ({ data: result.data, text: result.text });

async function cmdModuleList(ctx) { return said(await (await productMap()).moduleList(ctx.root)); }
async function cmdModuleShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which module: superdev module show <MOD-id>.");
  return said(await (await productMap()).moduleShow(ctx.root, id));
}
async function cmdGoalList(ctx) { return said(await (await productMap()).goalList(ctx.root)); }
async function cmdGoalShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which goal: superdev goal show <GOAL-id>.");
  return said(await (await productMap()).goalShow(ctx.root, id));
}
async function cmdMilestoneList(ctx) { return said(await (await productMap()).milestoneList(ctx.root)); }
async function cmdMilestoneShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which milestone: superdev milestone show <MS-id>.");
  return said(await (await productMap()).milestoneShow(ctx.root, id));
}
async function cmdFeatureList(ctx) {
  return said(await (await productMap()).featureList(ctx.root, {
    module: ctx.flags.module ? String(ctx.flags.module) : null,
    status: ctx.flags.status ? String(ctx.flags.status) : null,
  }));
}
async function cmdFeatureShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which feature: superdev feature show <FEAT-id>.");
  return said(await (await productMap()).featureShow(ctx.root, id));
}
async function cmdWorkflowList(ctx) { return said(await (await productMap()).workflowList(ctx.root)); }
async function cmdWorkflowShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which workflow: superdev workflow show <WF-id>.");
  return said(await (await productMap()).workflowShow(ctx.root, id));
}
async function cmdArchitectureShow(ctx) { return said(await (await productMap()).architectureShow(ctx.root)); }
async function cmdSchemaShow(ctx) {
  return said(await (await productMap()).schemaShow(ctx.root, { entity: ctx.words[2] ?? null }));
}
async function cmdApiShow(ctx) { return said(await (await productMap()).apiShow(ctx.root)); }
async function cmdIntegrationList(ctx) { return said(await (await productMap()).integrationList(ctx.root)); }

// ------------------------------------------------------------------- memory

async function cmdMemoryShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which memory: superdev memory show <MEM-id>.");
  const { query } = await store();
  const found = await query(ctx.root, async (db) => {
    const entry = await db.get("SELECT * FROM memory_entries WHERE id = ?", id);
    if (!entry) return null;
    return {
      entry,
      links: await db.all("SELECT target_type, target_id, relationship FROM memory_links WHERE memory_id = ?", id),
    };
  });
  if (!found) throw new UsageError(`There is no memory ${id}.`);
  const { entry, links } = found;
  return {
    data: found,
    text: R.stitch([
      R.heading(`${entry.title ?? entry.id}  ${entry.id}`),
      R.pairs([
        ["Kind", R.status(entry.kind)],
        ["How well known", R.status(entry.epistemic_status)],
        ["Recorded", entry.created_at],
        ["Source", entry.source_ref ?? "Not recorded"],
        ["Superseded by", entry.superseded_by ?? "Still current"],
      ]),
      "",
      R.wrap(entry.content ?? ""),
      links.length ? R.block("It concerns", R.bullets(links.map((l) => `${l.target_type} ${l.target_id} (${l.relationship})`))) : null,
      "",
      R.wrap("Memory is recall, not authority. Check it against the current specification, decisions and evidence before acting on it."),
    ]),
  };
}

async function cmdMemoryVerify(ctx) {
  const id = requireWord(ctx.words, 2, "Say which memory: superdev memory verify <MEM-id>.");
  const { verifyRecall } = await import("./memory/index.mjs");
  const report = await verifyRecall(ctx.root, id);
  return { data: report, text: R.renderReport(`Verification of ${id}`, report) };
}

async function cmdMemoryConsolidate(ctx) {
  const { consolidate } = await import("./memory/consolidate.mjs");
  const report = await consolidate(ctx.root, { apply: ctx.apply });
  const lines = [
    R.heading("Memory consolidation"),
    R.pairs([
      ["Live memories", String(report.live)],
      ["Duplicates merged", String(report.duplicatesMerged)],
      ["Contradictions found", String(report.contradictionsFound)],
      ["Noise discarded", String(report.noiseDiscarded)],
      ["Search terms rebuilt", String(report.retrievalTermsRebuilt)],
      ["Dangling links removed", String(report.danglingLinksRemoved)],
    ]),
  ];
  if (report.contradictions.length) {
    lines.push("", R.block("Statements that contradict each other", R.bullets(
      report.contradictions.map((c) => `${c.earlier} against ${c.later}, both about ${c.about}`))));
    lines.push(R.wrap("Both are kept. The earlier one is marked contradicted so recall warns rather than picking a side."));
  }
  lines.push("", R.wrap(ctx.apply ? "Applied." : "Nothing has changed. Re-run with --apply to consolidate."));
  return { data: report, text: R.stitch(lines) };
}

async function cmdMemorySupersede(ctx) {
  const id = requireWord(ctx.words, 2, "Say which memory is replaced: superdev memory supersede <MEM-id>.");
  const by = requireFlag(ctx.flags, "by", "Say which memory replaces it: --by <MEM-id>.");
  if (!ctx.apply) {
    return planned({ id, by }, "record it", R.wrap(`Would mark ${id} superseded by ${by}. Both are kept: a memory that was believed and turned out wrong is worth knowing.`));
  }
  const { supersede } = await import("./memory/index.mjs");
  const result = await supersede(ctx.root, id, String(by), { actor: ctx.actor });
  return { data: { applied: true, result }, text: `${id} is superseded by ${by}.` };
}

/**
 * Measure retrieval quality.
 *
 * Section 15.12 lists eleven measurements required before Claude Mem can be
 * dropped, and none had ever been taken, so DEC-TBD-002 could not be answered
 * even in principle. This measures and does not decide: what counts as good
 * enough is the owner's call.
 */
async function cmdMemoryBenchmark(ctx) {
  const { benchmark } = await import("./memory/benchmark.mjs");
  const r = await benchmark(ctx.root, { limit: ctx.flags.limit ? Number(ctx.flags.limit) : 40 });
  if (!r.measurable) {
    return { data: r, text: R.stitch([R.heading("Retrieval benchmark"), R.wrap(r.why)]) };
  }
  return {
    data: r,
    text: R.stitch([
      R.heading("Retrieval benchmark"),
      R.wrap(`${r.corpus.queries} questions drawn from ${r.corpus.entries} memories. Each question is the most distinctive word in one memory's title, and that memory is the answer it should find.`),
      "",
      R.pairs([
        ["Recall", `${r.recall.value} (${r.recall.says})`],
        ["Precision", String(r.precision.value)],
        ["Noise", String(r.noise.value)],
        ["Ranking", `${r.ranking.value} mean reciprocal rank`],
        ["Token reduction", String(r.tokenReduction.value)],
        ["Latency", `${r.latencyMs.median} ms median, ${r.latencyMs.worst} ms worst`],
        ["Index size", `${r.storageGrowth.searchTerms} terms over ${r.storageGrowth.entries} memories`],
        ["Superseded", String(r.staleDetection.superseded)],
        ["Contradictions marked", String(r.contradictionDetection.marked)],
      ]),
      "",
      R.block("Not measurable by a query", R.bullets([
        r.resumeAccuracy.says,
        r.handoffAccuracy.says,
      ])),
      R.wrap("These are the measurements section 15.12 asks for. What threshold is good enough is DEC-TBD-002 and stays open."),
    ]),
  };
}

async function cmdMemoryStatus(ctx) {
  const { memoryStatus } = await import("./memory/consolidate.mjs");
  const s = await memoryStatus(ctx.root);
  return {
    data: s,
    text: R.stitch([
      R.heading("Memory"),
      R.pairs([
        ["Held", String(s.total)],
        ["Current", String(s.live)],
        ["Superseded", String(s.superseded)],
        ["Findable by search", `${s.indexed} of ${s.live}`],
        ["Links to records", String(s.links)],
      ]),
      s.byKind.length ? R.block("By kind", R.bullets(s.byKind.map((k) => `${k.n} ${k.kind}`))) : null,
      s.byStatus.length ? R.block("By how well known", R.bullets(s.byStatus.map((k) => `${k.n} ${k.epistemic_status}`))) : null,
      "",
      R.block("How retrieval works", R.bullets(s.retrieval.stages)),
      R.wrap(`Semantic retrieval: ${s.retrieval.semantic}`),
      s.notIndexedForSearch > 0
        ? R.wrap(`${s.notIndexedForSearch} memories carry no search terms and cannot be found lexically. Run superdev memory consolidate --apply to index them.`)
        : null,
    ]),
  };
}

// --------------------------------------------------------- questions, changes

async function cmdQuestionList(ctx) {
  const { query, json } = await store();
  const rows = await query(ctx.root, (db) => db.all(
    `SELECT * FROM questions ${ctx.flags.all ? "" : "WHERE status = 'open'"} ORDER BY created_at`));
  if (!rows.length) {
    return { data: { questions: [] }, text: R.wrap(ctx.flags.all ? "No question has been recorded." : "No question is open.") };
  }
  return {
    data: { questions: rows },
    text: R.stitch([
      R.heading(`Questions (${rows.length})`),
      // Section 8.4 says a material question carries a recommendation and the
      // tradeoffs. Storing them and not showing them leaves the reader doing
      // the research the question was supposed to have done for them.
      rows.map((q) => {
        const alternatives = json(q.alternatives_json, []);
        return R.stitch([
          `${q.id}  [${R.status(q.status)}]`,
          R.wrap(q.question, R.WIDTH, "  "),
          R.wrap(`Why it matters: ${q.why_it_matters}`, R.WIDTH, "  "),
          q.recommendation ? R.wrap(`Recommended: ${q.recommendation}`, R.WIDTH, "  ") : null,
          alternatives.length
            ? R.stitch(["  Options:", R.bullets(alternatives.map((a) => String(a)), "    ")])
            : null,
          q.answer ? R.wrap(`Answered: ${q.answer}`, R.WIDTH, "  ") : null,
        ]);
      }).join("\n\n"),
    ]),
  };
}

async function cmdChangeRecord(ctx) {
  const summary = requireFlag(ctx.flags, "summary", "Say what moved: --summary <what changed>.");
  const reason = requireFlag(ctx.flags, "reason", "Say why. Without it nobody can tell later whether the product was steered or drifted.");
  const targets = asList(ctx.flags.target);
  const input = {
    summary, reason, targets,
    changeType: ctx.flags.type ? String(ctx.flags.type) : "scope_changed",
    decisionId: ctx.flags.decision ?? null,
    taskId: ctx.flags.task ?? null,
    requestedBy: ctx.flags.requestedBy ?? null,
    actor: ctx.actor,
    sessionId: ctx.flags.session ?? null,
  };
  if (!ctx.apply) {
    return planned(input, "record it", R.stitch([
      `Would record: ${summary}`,
      R.pairs([["Because", reason], ["Moves", targets.join(", ") || "nothing named yet"]]),
    ]));
  }
  const { recordChange } = await import("./product/changes.mjs");
  const row = await recordChange(ctx.root, input);
  return { data: { applied: true, change: row }, text: `${row.id} recorded: ${summary}` };
}

async function cmdChangeList(ctx) {
  const { listChanges } = await import("./product/changes.mjs");
  const rows = await listChanges(ctx.root, { limit: ctx.flags.limit ? Number(ctx.flags.limit) : 50 });
  if (!rows.length) return { data: { changes: [] }, text: R.wrap("No change to accepted scope has been recorded.") };
  return {
    data: { changes: rows },
    text: R.stitch([
      R.heading(`Changes (${rows.length})`),
      rows.map((c) => R.stitch([
        `${c.id}  ${R.shortDate(c.created_at)}  ${R.status(c.change_type)}`,
        R.wrap(c.summary, R.WIDTH, "  "),
        R.wrap(`Because: ${c.reason}`, R.WIDTH, "  "),
        R.wrap(`Moved: ${c.targets.map((t) => `${t.target_type} ${t.target_id}`).join(", ")}`, R.WIDTH, "  "),
      ])).join("\n\n"),
    ]),
  };
}

async function cmdChangeShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which change: superdev change show <CHG-id>.");
  const { showChange } = await import("./product/changes.mjs");
  const c = await showChange(ctx.root, id);
  return {
    data: c,
    text: R.stitch([
      R.heading(`${c.summary}  ${c.id}`),
      R.pairs([
        ["Kind", R.status(c.change_type)],
        ["Recorded", c.created_at],
        ["Because", c.reason],
        ["Decided by", c.decided_by ?? "Not recorded"],
        ["Under decision", c.decision ? `${c.decision.id} ${c.decision.title}` : "None"],
      ]),
      "",
      R.block("Records it moved", R.bullets(c.targets.map((t) =>
        `${t.target_type} ${t.target_id}${t.what_changed ? `: ${t.what_changed}` : ""}`))),
    ]),
  };
}

// -------------------------------------------------------------- assumptions

async function cmdAssumptionRecord(ctx) {
  const statement = requireFlag(ctx.flags, "statement", "Say what is being assumed: --statement <what>.");
  const why = requireFlag(ctx.flags, "why", "Say why this is assumed rather than decided: --why <reason>.");
  const trigger = requireFlag(ctx.flags, "trigger", "Say what would make this worth revisiting: --trigger <what>. Without one it is never reviewed.");
  const input = {
    statement, whyAssumed: why, reviewTrigger: trigger,
    consequenceIfWrong: ctx.flags.consequence ?? null,
    scopeType: ctx.flags.scopeType ?? null,
    scopeId: ctx.flags.scopeId ?? null,
    questionId: ctx.flags.question ?? null,
    actor: ctx.actor,
  };
  if (!ctx.apply) {
    return planned(input, "record it", R.stitch([
      `Would assume: ${statement}`,
      R.pairs([["Because", why], ["Revisit when", trigger]]),
    ]));
  }
  const { recordAssumption } = await import("./product/assumptions.mjs");
  const row = await recordAssumption(ctx.root, input);
  return { data: { applied: true, assumption: row }, text: `${row.id} recorded: ${statement}` };
}

async function cmdAssumptionList(ctx) {
  const { listAssumptions } = await import("./product/assumptions.mjs");
  const rows = await listAssumptions(ctx.root, { status: ctx.flags.status ? String(ctx.flags.status) : null });
  if (!rows.length) return { data: { assumptions: [] }, text: R.wrap("No assumption has been recorded.") };
  return {
    data: { assumptions: rows },
    text: R.stitch([
      R.heading(`Assumptions (${rows.length})`),
      rows.map((a) => R.stitch([
        `${a.id}  [${R.status(a.status)}]`,
        R.wrap(a.statement, R.WIDTH, "  "),
        R.wrap(`Assumed because: ${a.why_assumed}`, R.WIDTH, "  "),
        R.wrap(`Revisit when: ${a.review_trigger}`, R.WIDTH, "  "),
        a.resolution ? R.wrap(`Turned out: ${a.resolution}`, R.WIDTH, "  ") : null,
      ])).join("\n\n"),
    ]),
  };
}

async function cmdAssumptionResolve(ctx) {
  const id = requireWord(ctx.words, 2, "Say which assumption: superdev assumption resolve <ASM-id>.");
  const to = requireFlag(ctx.flags, "to", "Say what it turned out to be: --to confirmed, overturned or expired.");
  const resolution = requireFlag(ctx.flags, "resolution", "Say what the answer actually is.");
  if (!ctx.apply) {
    return planned({ id, to, resolution }, "record it", R.wrap(`Would mark ${id} ${to}: ${resolution}`));
  }
  const { resolveAssumption } = await import("./product/assumptions.mjs");
  const row = await resolveAssumption(ctx.root, id, { to: String(to), resolution: String(resolution), actor: ctx.actor });
  return { data: { applied: true, assumption: row }, text: `${id} is ${to}.` };
}

// -------------------------------------------------------------------- cloud
//
// Section 12.9 lists these four commands and says cloud synchronization is not
// required for the local plugin to function. They refused for as long as
// DEC-TBD-006, 007 and 008 were open, which was right: a merge policy invented
// by whoever wrote the code is a policy nobody agreed to.
//
// Those decisions are recorded now, so these do what the decisions say and
// nothing beyond them. Local stays authoritative, nothing leaves unencrypted,
// nothing leaves that DEC-TBD-007 keeps local, and the only transport is a
// directory on this machine. Nothing here reaches the network.

/**
 * Say if a newer version exists, then look again if it is time to.
 *
 * The notice comes from what the previous check wrote, so this never delays a
 * command. The refresh runs in a detached child that this process does not
 * wait for, because an unawaited fetch still holds the event loop open and made
 * the first command of the day pay for the round trip. Whatever the child
 * learns is read by the next run.
 */
async function announceUpdates(ctx) {
  if (ctx.json || ctx.flags.out) return;
  try {
    const { pendingNotice, startRefresh, checkingEnabled } = await import("./runtime/version.mjs");
    if (!checkingEnabled(ctx.root)) return;
    const notice = pendingNotice(ctx.root);
    if (notice) process.stderr.write(`\n${notice}\n`);
    // A detached child, so this process exits without waiting for a round trip.
    startRefresh(ctx.root, { pluginVersion: pluginVersionOf() });
  } catch {
    // An update courtesy must never be the reason a command looks broken.
  }
}

/** The installed plugin's own version, when this is running as one. */
function pluginVersionOf() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) return null;
  try {
    return JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8")).version ?? null;
  } catch {
    return null;
  }
}

/**
 * Report and change what Superdev checks on its own.
 *
 * There is exactly one such thing, and it is the only outbound request this
 * product makes, so it gets a command rather than a buried configuration file.
 * Somebody who wants it off should be able to find how in one place.
 */
/**
 * Run a lifecycle hook. Called by the plugin's hooks.json, not by people.
 *
 * This exists so the plugin needs no executable code of its own. Before it, the
 * hooks ran `node "${CLAUDE_PLUGIN_ROOT}/src/runtime/hooks.mjs"`, which meant
 * the plugin had to ship the whole runtime and its native storage engine, and a
 * plugin distributed by git arrived without the engine and could not run at all.
 *
 * Now the plugin ships skills, a hooks manifest and metadata, all of it text.
 * The executable half comes from the CLI, which npm installs properly.
 *
 * It delegates to the hook runner's own entry point rather than reimplementing
 * it, because that entry point carries things worth keeping: the payload is read
 * from stdin the way the harness sends it, the work is raced against a time
 * budget so a slow database cannot hold the harness open, the response is
 * written in the protocol's shape rather than Superdev's, and the process exits
 * hard so an interrupted write rolls back instead of half committing.
 */
async function cmdHook(ctx) {
  const event = requireWord(ctx.words, 1, "Say which lifecycle event: superdev hook <event>.");
  const { main } = await import("./runtime/hooks.mjs");
  // main reads argv[2] as the event, reads stdin itself, emits, and exits.
  await main([process.execPath, "hook", event]);
  return { data: {}, text: "", consumedOut: true, exit: 0 };
}

async function cmdSettings(ctx) {
  const { checkingEnabled, setChecking, self, pendingNotice } = await import("./runtime/version.mjs");
  const me = self();

  const wanted = ctx.flags.noUpdateCheck ? false : ctx.flags.updateCheck ? true : null;
  if (wanted !== null) {
    if (!ctx.apply) {
      return planned({ updateCheck: wanted }, wanted ? "turn it on" : "turn it off",
        R.wrap(wanted
          ? "Would turn the update check back on. It asks the npm registry and the plugin manifest for their latest versions, at most once a day, and never blocks a command."
          : "Would turn the update check off. Nothing would leave this machine at all after that, and you would find out about new versions yourself."));
    }
    setChecking(ctx.root, wanted);
    return {
      data: { updateCheck: wanted },
      text: R.wrap(wanted
        ? "Update checking is on. At most one request a day, after a command has already answered, and it fails silently."
        : "Update checking is off. Superdev now makes no outbound request of any kind."),
    };
  }

  const on = checkingEnabled(ctx.root);
  // Which copy is answering, not just which version.
  //
  // Superdev ships as an npm package and as a plugin, and both carry the same
  // version number. A stale plugin copy of an older architecture sat in a cache
  // beside the current one under the same number, and no command could say which
  // of them a session was actually using. The running file settles it, so
  // "superdev 0.1.1" stops naming two different things.
  const running = realpathOf(fileURLToPath(import.meta.url));
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ? realpathOf(process.env.CLAUDE_PLUGIN_ROOT) : null;
  const throughPlugin = Boolean(pluginRoot && running.startsWith(pluginRoot));
  return {
    data: { version: me.version, package: me.name, updateCheck: on, running, pluginRoot, throughPlugin },
    text: R.stitch([
      R.heading("Settings"),
      R.pairs([
        ["Version", `${me.name} ${me.version}`],
        ["Running from", running],
        ["Reached as", throughPlugin ? "the plugin's own copy" : "an installed superdev-cli"],
        ["Update check", on ? "On" : "Off"],
      ]),
      R.wrap(on
        ? "The update check is the only outbound request Superdev makes. It asks the npm registry for the CLI's latest version and reads the plugin manifest from the repository, at most once a day, after a command has already produced its output. It fails silently and never blocks. Turn it off with superdev settings --no-update-check --apply, or set SUPERDEV_NO_UPDATE_CHECK in the environment."
        : "Nothing leaves this machine. Turn the check back on with superdev settings --update-check --apply."),
      pendingNotice(ctx.root) ?? null,
    ]),
  };
}

async function cmdCloudStatus(ctx) {
  const { status } = await import("./cloud/sync.mjs");
  const { count } = await import("./model/vocabulary.mjs");
  const state = await status(ctx.root);

  if (!state.connected && !state.location) {
    return {
      data: state,
      text: R.stitch([
        R.heading("No remote is configured"),
        R.wrap(state.why),
        R.wrap(`Connect one with superdev cloud connect <directory>. ${count(state.shared, "table")} would be shared and ${count(state.withheld, "table")} never leave this machine.`),
      ]),
      exit: 0,
    };
  }

  return {
    data: state,
    text: R.stitch([
      R.heading(`Remote ${state.alias}`),
      R.pairs([
        ["Transport", state.transport],
        ["Location", state.location],
        ["Reachable", state.reachable ? "Yes" : "No, so a sync would have nothing to talk to"],
        ["Key fingerprint", state.keyFingerprint],
        ["Last synced", state.lastSyncedAt ? R.shortDate(state.lastSyncedAt) : "Never"],
        ["Records tracked", String(state.trackedRecords)],
        ["Open conflicts", String(state.conflicts.length)],
      ]),
      state.conflicts.length
        ? R.block(`Conflicts waiting (${state.conflicts.length})`, R.bullets(state.conflicts.map(
            (c) => `${c.id}  ${c.recordType} ${c.recordId}, found ${R.shortDate(c.detectedAt)}`)))
        : null,
      state.leases.length
        ? R.block(`Leases (${state.leases.length})`, R.bullets(state.leases.map(
            (l) => `${l.task_id} held by ${l.lease_holder}${l.lease_expires_at ? ` until ${R.shortDate(l.lease_expires_at)}` : ""}`)))
        : null,
      R.wrap(`${count(state.shared, "table")} are shared. ${count(state.withheld, "table")} never leave this machine, including memory, the activity trail, sessions and every identity.`),
    ]),
    exit: 0,
  };
}

async function cmdCloudConnect(ctx) {
  const location = ctx.words[2] ?? ctx.flags.location;
  const { connect } = await import("./cloud/sync.mjs");
  const out = await connect(ctx.root, {
    location: location ? String(location) : null,
    alias: ctx.flags.alias ? String(ctx.flags.alias) : null,
    transport: ctx.flags.transport ? String(ctx.flags.transport) : "directory",
    apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out.plan, "connect", R.stitch([
      R.wrap(`Would connect this project to the ${out.plan.transport} at ${out.plan.location}.`),
      R.wrap(out.plan.createsKey
        ? "An encryption key would be created for this project and kept here. It is never transmitted, and a remote copy is unreadable without it."
        : "This project already has an encryption key, which would be reused."),
      R.wrap("Connecting sends nothing. The first sync is a separate command."),
    ]));
  }
  return {
    data: out,
    text: R.stitch([
      R.wrap(`Connected as ${out.alias} to the ${out.transport} at ${out.location}.`),
      R.wrap(`${out.createdKey ? "An encryption key was created" : "The existing encryption key is used"}, fingerprint ${out.keyFingerprint}. It stays on this machine and a remote copy cannot be read without it.`),
      R.wrap("Nothing has been sent. Run superdev sync --dry-run to see what would go, and superdev sync --apply to send it."),
    ]),
  };
}

/**
 * One synchronization, or a preview of it.
 *
 * The preview and the run share every line that decides anything, so what is
 * described is what would happen. --resolve settles conflicts instead.
 */
async function cmdSync(ctx) {
  const { synchronize, openConflicts, resolveConflict } = await import("./cloud/sync.mjs");
  const { count } = await import("./model/vocabulary.mjs");

  if (ctx.flags.resolve !== undefined) {
    const which = typeof ctx.flags.resolve === "string" && ctx.flags.resolve !== "true"
      ? String(ctx.flags.resolve)
      : ctx.words[1] && ctx.words[1].startsWith("CONF") ? ctx.words[1] : null;
    const waiting = await openConflicts(ctx.root);
    if (!waiting.length) {
      return { data: { conflicts: [] }, text: R.wrap("No conflict is waiting. Nothing to settle.") };
    }
    if (!which) {
      return {
        data: { conflicts: waiting },
        text: R.stitch([
          R.heading(`Conflicts waiting (${waiting.length})`),
          waiting.map((c) => R.stitch([
            `${c.id}  ${c.record_type} ${c.record_id}`,
            R.wrap(`Both copies changed it since they last agreed. Settle it with superdev sync --resolve ${c.id} --keep local, --keep remote, or --keep merged.`, R.WIDTH, "  "),
          ])).join("\n\n"),
        ]),
      };
    }
    const choice = ctx.flags.keep ? String(ctx.flags.keep) : "local";
    const out = await resolveConflict(ctx.root, which, { choice, apply: ctx.apply, actor: ctx.actor });
    if (!out.applied) {
      return planned(out.plan, "settle it", R.stitch([
        R.wrap(`Would settle ${which} on ${out.plan.recordType} ${out.plan.recordId} by keeping ${choice}.`),
        out.plan.fields.length ? R.wrap(`The copies disagree on: ${out.plan.fields.join(", ")}.`) : null,
      ]));
    }
    return {
      data: out,
      text: R.wrap(`${which} settled by keeping ${choice}. The settled value is now what both sides agree on, so the next sync will not raise it again.`),
    };
  }

  const out = await synchronize(ctx.root, { apply: ctx.apply });
  const body = R.stitch([
    R.pairs([
      ["Remote", `${out.peer} at ${out.location}`],
      ["Other copies found", String(out.peersFound)],
      ["Coming in", String(out.incoming)],
      ["Going out", String(out.outgoing)],
      ["Conflicts", String(out.conflicts)],
    ]),
    out.leases.length
      ? R.block(`Held elsewhere (${out.leases.length})`, R.bullets(out.leases.map(
          (l) => `${l.taskId} by ${l.holder}${l.expiresAt ? ` until ${R.shortDate(l.expiresAt)}` : ""}`)))
      : null,
    out.unreadable.length
      ? R.block("Could not be read", R.bullets(out.unreadable))
      : null,
    R.wrap(`${count(out.withheldTables, "table")} were withheld, including memory, the activity trail, sessions and every identity. Nothing left this machine unencrypted.`),
  ]);

  if (!out.applied) {
    return planned(out, "synchronize", R.stitch([
      R.heading("What a sync would do"),
      body,
      out.conflicts
        ? R.wrap(`${count(out.conflicts, "record")} changed in both copies since they last agreed. A sync records each as a conflict and leaves the local value alone; settle them with superdev sync --resolve.`)
        : null,
    ]));
  }
  return {
    data: out,
    text: R.stitch([
      R.heading("Synchronized"),
      body,
      R.wrap(`${count(out.taken ?? 0, "record")} taken in. ${
        out.conflicts
          ? `${count(out.conflicts, "conflict")} recorded and left for you: the local value stands until you settle it with superdev sync --resolve.`
          : "No conflict was found."
      }`),
    ]),
  };
}


async function cmdDecisionRecord(ctx) {
  const title = requireFlag(ctx.flags, "title", "A decision needs a title, in plain language, so it can be found again.");
  const decision = requireFlag(ctx.flags, "decision", "Say what was decided. A title alone records that a choice happened, not what it was.");
  const input = {
    title, decision,
    context: ctx.flags.context ?? null,
    rationale: ctx.flags.rationale ?? null,
    verification: ctx.flags.verification ?? null,
    scopeType: ctx.flags.scopeType ?? null,
    scopeId: ctx.flags.scopeId ?? null,
    status: ctx.flags.status ? String(ctx.flags.status) : "proposed",
    acceptedBy: ctx.flags.acceptedBy ?? null,
    expiresAt: ctx.flags.expires ?? null,
    governs: asList(ctx.flags.governs),
    evidence: asList(ctx.flags.evidence),
    criteria: asList(ctx.flags.criterion),
    options: asList(ctx.flags.option),
    risks: asList(ctx.flags.risk),
    enforcement: asList(ctx.flags.enforcement),
    revisitTriggers: asList(ctx.flags.revisit),
    actor: ctx.actor,
    sessionId: ctx.flags.session ?? null,
  };
  if (!ctx.apply) {
    return planned(input, "record it", R.stitch([
      `Would record "${title}" as ${R.status(input.status)}.`,
      R.pairs([["Decided", decision], ["Governs", input.governs.join(", ") || "nothing yet"]]),
    ]));
  }
  const { recordDecision } = await import("./decisions/record.mjs");
  const row = await recordDecision(ctx.root, input);
  return { data: { applied: true, decision: row }, text: `${row.id} recorded: ${title}` };
}

/** Replace a decision that no longer holds, in one transaction. */
async function cmdDecisionSupersede(ctx) {
  const id = requireWord(ctx.words, 2, "Say which decision is being replaced: superdev decision supersede <id>.");
  const title = requireFlag(ctx.flags, "title", "The replacement needs a title.");
  const decision = requireFlag(ctx.flags, "decision", "Say what is decided instead.");
  const partial = Boolean(ctx.flags.partial);
  const scopeDelta = ctx.flags.scopeDelta ? String(ctx.flags.scopeDelta) : "";
  if (partial && !scopeDelta) {
    throw new UsageError("A partial supersession has to say which part stops applying. Pass --scopeDelta <what no longer holds>.");
  }
  const input = {
    title, decision, partial, scopeDelta,
    context: ctx.flags.context ?? null,
    rationale: ctx.flags.rationale ?? null,
    governs: asList(ctx.flags.governs),
    actor: ctx.actor,
  };
  if (!ctx.apply) {
    return planned({ supersedes: id, ...input }, "record it", R.stitch([
      `Would record "${title}" and mark ${id} ${partial ? "partially superseded" : "superseded"}.`,
      partial ? R.wrap(`What stops applying: ${scopeDelta}`) : null,
    ]));
  }
  const { supersedeDecision } = await import("./decisions/record.mjs");
  const row = await supersedeDecision(ctx.root, id, input);
  return {
    data: { applied: true, decision: row },
    text: `${row.id} replaces ${id}, which is now ${partial ? "partially superseded" : "superseded"}.`,
  };
}

/**
 * Re-run the checks recorded evidence stands on.
 *
 * Without --apply nothing changes, which is the mode worth reaching for: it
 * answers whether what the project believes is still true, without altering the
 * answer.
 */
async function cmdVerify(ctx) {
  const { verifyEvidence } = await import("./verify/index.mjs");
  const report = await verifyEvidence(ctx.root, {
    apply: ctx.apply,
    taskId: ctx.flags.task ? String(ctx.flags.task) : null,
    limit: ctx.flags.limit ? Number(ctx.flags.limit) : null,
  });

  const lines = [
    R.heading("Verification"),
    R.pairs([
      ["Evidence in force", String(report.evidenceCurrent)],
      ["Carries a command", String(report.withCommand)],
      ["Checked by hand only", String(report.manualOnly)],
      ["Re-ran", String(report.checked)],
      ["Still passing", String(report.stillPassing)],
      ["No longer passing", String(report.noLongerPassing)],
      ["Could not run", String(report.couldNotRun)],
    ]),
  ];
  if (report.failing.length) {
    lines.push("", R.block("No longer passing", R.bullets(report.failing.map((f) =>
      `${f.task ?? f.evidence} (${R.status(f.taskStatus ?? "unknown")}): ${f.command}. ${f.detail}`))));
  }
  if (report.unrunnable.length) {
    lines.push("", R.block("Could not run", R.bullets(report.unrunnable.slice(0, 8).map((f) =>
      `${f.task ?? f.evidence}: ${f.why}`))));
  }
  lines.push("", R.wrap(ctx.apply
    ? `${report.noLongerPassing} piece(s) of evidence marked stale. The tasks that stood on them are named above and are not reopened automatically.`
    : "Nothing has changed. Re-run with --apply to mark failing evidence stale."));

  return { data: report, text: R.stitch(lines), exit: report.noLongerPassing > 0 ? 1 : 0 };
}

/**
 * Which kind of criterion `--criterion` names, decided from the identifier.
 *
 * One flag for two targets, because a reader asking what proves something does not
 * care which table it lives in. The kind is read from the identifier's own prefix,
 * and anything else is refused here rather than becoming a foreign key failure: the
 * plan used to resolve a GSC id, promise to mark it met, and then die on
 * `FOREIGN KEY constraint failed`, which named no record, no column and no remedy.
 */
function criterionTarget(flag) {
  if (flag === undefined || flag === null) {
    return { acceptanceCriterionId: null, goalCriterionId: null };
  }
  const id = String(flag).trim();
  if (/^AC-/i.test(id)) return { acceptanceCriterionId: id.toUpperCase(), goalCriterionId: null };
  if (/^GSC-/i.test(id)) return { acceptanceCriterionId: null, goalCriterionId: id.toUpperCase() };
  throw new UsageError(
    `--criterion takes an acceptance criterion (AC-nnnn) or a goal success criterion (GSC-nnnn), and ${JSON.stringify(id)} is neither. superdev feature show <FEAT-id> lists a feature's acceptance criteria, and superdev goal show <GOAL-id> lists a goal's success criteria.`,
  );
}

async function cmdTaskEvidence(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task was verified: superdev task evidence <id>.");
  const summary = requireFlag(ctx.flags, "summary",
    "Evidence needs a one-line summary of what was actually observed, not just a result.");
  const result = ctx.flags.result ? String(ctx.flags.result) : "pass";
  if (!["pass", "fail", "inconclusive"].includes(result)) {
    throw new UsageError(`A result is pass, fail or inconclusive, not ${result}.`);
  }
  const evidence = {
    summary,
    result,
    evidenceType: ctx.flags.type ? String(ctx.flags.type) : "manual_check",
    reference: ctx.flags.reference ? String(ctx.flags.reference) : null,
    ...criterionTarget(ctx.flags.criterion),
    checkCommand: ctx.flags.command ? String(ctx.flags.command) : null,
    testPlanId: ctx.flags.plan ? String(ctx.flags.plan) : null,
    actor: ctx.actor,
    sessionId: ctx.flags.session ?? null,
  };
  if (!ctx.apply) {
    return planned({ id, ...evidence }, "record it", R.stitch([
      `Would record ${result === "pass" ? "passing" : result === "fail" ? "failing" : "inconclusive"} evidence for ${id}: ${summary}`,
      evidence.goalCriterionId
        ? R.wrap(`It is attached to goal success criterion ${evidence.goalCriterionId}, which ${result === "pass" ? "this marks met" : "this leaves unmet"}.`)
        : null,
      evidence.acceptanceCriterionId
        ? R.wrap(`It is attached to acceptance criterion ${evidence.acceptanceCriterionId}, which ${result === "pass" ? "this marks met" : "this leaves unmet"}.`)
        : null,
      evidence.testPlanId
        ? R.wrap(`It is recorded as a run of test plan ${evidence.testPlanId}${result === "pass" ? ", which satisfies it for the work it covers." : ", which leaves it unsatisfied."}`)
        : null,
    ]));
  }
  const { attachEvidence } = await lifecycle();
  const task = await attachEvidence(ctx.root, id, evidence);
  const also = (task.alsoProving ?? []).filter((e) => e.id !== task.evidence.id);
  return {
    data: { applied: true, task },
    text: R.stitch([
      `${task.evidence.id} recorded against ${task.id}: ${summary}`,
      // Two current records for one criterion is legitimate, and it is also how a
      // correction looks. Saying so is what stops the older one being forgotten
      // until verify starts failing on a command that has moved.
      also.length
        ? R.wrap(`${countWord(also.length, "record")} already ${also.length === 1 ? "proves" : "prove"} ${evidence.acceptanceCriterionId}: ${also.map((e) => e.id).join(", ")}. If this replaces one rather than adding to it, retire it with superdev evidence supersede ${also[0].id} --reason "<why>" --apply.`)
        : null,
    ]),
  };
}

/**
 * How the product is verified, and whether that verification has been run.
 *
 * Section 9.3 makes the accepted test plan a completion condition, so the
 * question a reader has is never only what the plan says: it is whether anyone
 * has run it since. Both are answered here, because a plan without its last
 * result is a promise rather than a report.
 */
async function cmdTestPlanList(ctx) {
  const { listPlans } = await import("./product/test-plans.mjs");
  const { count } = await import("./model/vocabulary.mjs");
  const plans = await listPlans(ctx.root);
  if (!plans.length) {
    return { data: { plans: [] }, text: R.wrap("No test plan has been recorded. A feature without one cannot say what proving it means.") };
  }
  const unrun = plans.filter((p) => p.status === "accepted" && !p.satisfied);
  return {
    data: { plans },
    text: R.stitch([
      R.heading(`Test plans (${plans.length})`),
      plans.map((p) => R.stitch([
        `${p.id}  [${R.status(p.status)}]  ${p.name}`,
        R.wrap(`Covers: ${p.feature_id ?? p.workflow_id ?? p.module_id ?? "the whole product"}`, R.WIDTH, "  "),
        R.wrap(`Run: ${p.how_to_run}`, R.WIDTH, "  "),
        R.wrap(`Passes when: ${p.passing_condition}`, R.WIDTH, "  "),
        R.wrap(p.satisfied
          ? `${count(p.passing_runs, "passing run")} recorded.`
          : `No passing run recorded, so any task it covers cannot complete. ${
              p.runnable ? `Run it with superdev test-plan run ${p.id} --apply.` : `It cannot run unattended, so record what you saw with superdev test-plan record ${p.id}.`}`,
          R.WIDTH, "  "),
      ])).join("\n\n"),
      unrun.length
        ? R.wrap(`${count(unrun.length, "accepted plan")} without a passing run. Until each has one, no task it covers can complete.`)
        : R.wrap("Every accepted plan carries a passing run."),
    ]),
  };
}

async function cmdTestPlanShow(ctx) {
  const id = requireWord(ctx.words, 2, "Say which test plan: superdev test-plan show <TP-id>.");
  const { showPlan } = await import("./product/test-plans.mjs");
  const { plan: p, runs } = await showPlan(ctx.root, id);
  return {
    data: { plan: p, runs },
    text: R.stitch([
      R.heading(`${p.name}  ${p.id}`),
      R.pairs([
        ["Status", R.status(p.status)],
        ["Covers", p.feature_id ?? p.workflow_id ?? p.module_id ?? "The whole product"],
        ["Run", p.how_to_run],
        ["Passes when", p.passing_condition],
        ["Runs unattended", p.runnable ? "Yes" : `No. ${p.why_not_runnable}`],
      ]),
      R.heading("Strategy"),
      R.wrap(p.strategy),
      R.heading("Runs recorded"),
      runs.length
        ? R.bullets(runs.map((r) =>
            `${R.shortDate(r.recorded_at)}  ${R.status(r.last_check_result ?? r.result)}  ${r.summary}${r.task_id ? ` (${r.task_id})` : ""}`))
        : R.wrap("None. Until this plan is run, every task it covers is refused at completion."),
    ]),
  };
}

/** Run the plan's own command and record whatever it produced. */
async function cmdTestPlanRun(ctx) {
  const id = requireWord(ctx.words, 2, "Say which test plan to run: superdev test-plan run <TP-id>.");
  const { runPlan } = await import("./product/test-plans.mjs");
  const out = await runPlan(ctx.root, id, {
    actor: ctx.actor,
    sessionId: ctx.flags.session ?? null,
    taskId: ctx.flags.task ? String(ctx.flags.task) : null,
    apply: ctx.apply,
  });
  const headline = `${id} ${out.result === "pass" ? "passed" : out.result === "fail" ? "failed" : "was inconclusive"}: ${out.detail || "no output"}`;
  if (!out.applied) {
    return planned({ id, ...out, plan: undefined }, "record the result", R.stitch([
      R.wrap(headline),
      R.wrap("The command was run. Nothing has been recorded yet."),
    ]));
  }
  return {
    data: { applied: true, id, result: out.result, evidence: out.evidence?.id ?? null },
    text: R.stitch([
      R.wrap(headline),
      R.wrap(`Recorded as ${out.evidence?.id ?? "evidence"}.${out.result === "pass" ? "" : " A failing run does not satisfy the plan, so the tasks it covers stay blocked."}`),
    ]),
  };
}

/** Record a plan that was carried out rather than run. */
async function cmdTestPlanRecord(ctx) {
  const id = requireWord(ctx.words, 2, "Say which test plan was carried out: superdev test-plan record <TP-id>.");
  const summary = requireFlag(ctx.flags, "summary",
    "Say what was actually observed when the plan was carried out, not only whether it passed.");
  const { recordPlanRun } = await import("./product/test-plans.mjs");
  const out = await recordPlanRun(ctx.root, id, {
    summary,
    result: ctx.flags.result ? String(ctx.flags.result) : "pass",
    reference: ctx.flags.reference ? String(ctx.flags.reference) : null,
    taskId: ctx.flags.task ? String(ctx.flags.task) : null,
    actor: ctx.actor,
    sessionId: ctx.flags.session ?? null,
    apply: ctx.apply,
  });
  if (!out.applied) {
    return planned({ id, result: out.result, summary }, "record it",
      R.wrap(`Would record ${out.result === "pass" ? "a passing" : out.result === "fail" ? "a failing" : "an inconclusive"} run of ${id}: ${summary}`));
  }
  return {
    data: { applied: true, id, evidence: out.evidence?.id ?? null },
    text: R.wrap(`${out.evidence?.id ?? "The run"} recorded against ${id}: ${summary}`),
  };
}

/**
 * Stop work that should not continue.
 *
 * Cancelling is a status move like any other, so it leaves history and takes a
 * reason: a cancelled task with no reason is indistinguishable from one that
 * was quietly dropped.
 */
async function cmdTaskCancel(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to cancel: superdev task cancel <id>.");
  const reason = requireFlag(ctx.flags, "reason",
    "A cancelled task needs the reason, in plain language, so nobody re-derives it by accident.");
  if (!ctx.apply) {
    return planned({ id, reason }, "cancel it", R.wrap(`Would cancel ${id} because: ${reason}`));
  }
  const { cancelTask } = await lifecycle();
  const task = await cancelTask(ctx.root, id, { actor: ctx.actor, reason });
  return { data: { applied: true, task }, text: `${task.id} is cancelled.` };
}

async function cmdTaskComplete(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to complete: superdev task complete <id>.");
  if (!ctx.apply) {
    return planned({ id }, "complete it", R.stitch([
      `Would complete ${id}.`,
      R.wrap("It is refused unless its verification evidence passes, the acceptance criteria it verifies are met, and no subtask is still open."),
    ]));
  }
  const { completeTask } = await lifecycle();
  const task = await completeTask(ctx.root, id, { actor: ctx.actor, note: ctx.flags.note ?? null });
  return { data: { applied: true, task }, text: `${task.id} is complete and its claim was released.` };
}

async function cmdTaskBlock(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task is blocked: superdev task block <id>.");
  const reason = requireFlag(ctx.flags, "reason", "A blocked task needs the reason, in plain language, so the next person can unblock it.");
  if (!ctx.apply) {
    return planned({ id, reason }, "record it", R.wrap(`Would mark ${id} blocked because: ${reason}`));
  }
  const { blockTask } = await lifecycle();
  const task = await blockTask(ctx.root, id, { reason, actor: ctx.actor });
  return { data: { applied: true, task }, text: `${task.id} is Blocked. The reason is on the record.` };
}

/**
 * Fold a duplicate task into the one that keeps the work.
 *
 * There is no delete. A task carries why it existed and what proved it, and
 * history here is append only, so a deleted task would take its evidence with it
 * and leave a commit message pointing at an identifier nobody can look up. The
 * duplicate is superseded and says which task replaced it, which is the same
 * answer for the reader and a better one for the record.
 */
/**
 * Retire one evidence record that no longer applies.
 *
 * `evidence` rather than `task evidence supersede`, because the resolver reads two
 * words and the third would be taken as a task identifier. The record is the
 * subject here anyway, not the task.
 */
async function cmdEvidenceSupersede(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which record: superdev evidence supersede <EV-id> --reason "<why it no longer applies>".');
  const reason = String(requireFlag(ctx.flags, "reason", "Superseding evidence needs a reason, because the record already said this was observed."));
  if (!ctx.apply) {
    return planned({ id, reason }, "supersede it", R.stitch([
      R.wrap(`Would supersede ${id}: ${reason}`),
      R.wrap("The record and its reason stay in history. It leaves the verification tally, and any acceptance criterion resting on it falls back to whatever else is current, or to unmet."),
    ]));
  }
  const { supersedeEvidence } = await lifecycle();
  const out = await supersedeEvidence(ctx.root, id, { reason, actor: ctx.actor });
  return {
    data: out,
    text: R.stitch([
      `${id} is superseded and no longer counted.`,
      out.command ? R.wrap(`Its command was: ${out.command}`) : null,
      out.criterion
        ? R.wrap(out.criterion.restingOn
            ? `${out.criterion.id} is still met, now resting on ${out.criterion.restingOn}.`
            : `${out.criterion.id} is ${R.status(out.criterion.status)}, because nothing current proves it now.`)
        : null,
    ]),
  };
}

async function cmdTaskMerge(ctx) {
  const duplicate = requireWord(ctx.words, 2, "Say which task is the duplicate: superdev task merge <duplicate-id> --into <TASK-id>.");
  const survivor = String(requireFlag(ctx.flags, "into", "Say which task keeps the work: --into <TASK-id>."));
  const { planMerge, mergeTasks } = await import("./tasks/merge.mjs");

  if (!ctx.apply) {
    const plan = await planMerge(ctx.root, duplicate, survivor);
    const rows = Object.entries(plan.moving)
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => [MERGE_LABEL[kind] ?? kind, String(n)]);
    return planned(plan, "merge them", R.stitch([
      R.wrap(`Would fold ${plan.duplicate.id} ${plan.duplicate.name} into ${plan.survivor.id} ${plan.survivor.name}.`),
      rows.length ? R.block("What would move", R.table(["What", "How many"], rows)) : R.wrap("Nothing is recorded against it yet, so only its status would change."),
      plan.releasing ? R.wrap("Its claim would be released rather than moved, because an assignment names who took the work.") : null,
      plan.staying.history
        ? R.wrap(`${countWord(plan.staying.history, "activity event")} would stay on ${plan.duplicate.id}, because history records a moment and cannot be moved to another record without saying something untrue about the past.`)
        : null,
      R.wrap(`${plan.duplicate.id} would become Superseded and point at ${plan.survivor.id}. Nothing is deleted.`),
    ]));
  }

  const out = await mergeTasks(ctx.root, duplicate, survivor, {
    actor: ctx.actor, reason: ctx.flags.reason ? String(ctx.flags.reason) : null,
  });
  const rows = Object.entries(out.moved).filter(([, n]) => n > 0);
  return {
    data: out,
    text: R.stitch([
      `${out.duplicate.id} is merged into ${out.survivor.id}.`,
      rows.length
        ? R.block("Moved", R.table(["What", "How many"], rows.map(([k, n]) => [MERGE_LABEL[k] ?? k, String(n)])))
        : null,
      R.wrap(`${out.duplicate.id} is ${R.status(out.duplicate.status)} and points at ${out.survivor.id}, so anyone who finds the old identifier is told where the work went.`),
    ]),
  };
}

const MERGE_LABEL = {
  evidence: "Evidence",
  contractLinks: "Contract links (copied, not moved)",
  dependencies: "Dependencies",
  memories: "Memory entries",
  changes: "Recorded changes",
  children: "Child tasks",
};

async function cmdTaskReopen(ctx) {
  const id = requireWord(ctx.words, 2, "Say which task to reopen: superdev task reopen <id>.");
  const reason = requireFlag(ctx.flags, "reason", "Reopening finished work needs a reason, because the record already said it was done.");
  const to = ctx.flags.to ? String(ctx.flags.to) : null;
  if (!ctx.apply) {
    return planned({ id, reason, to }, "reopen it",
      R.wrap(`Would reopen ${id}${to ? ` as ${R.status(to)}` : ""} because: ${reason}`));
  }
  const { reopenTask } = await lifecycle();
  const task = await reopenTask(ctx.root, id, { reason, to, actor: ctx.actor });
  return {
    data: { applied: true, task },
    // A task nobody holds lands Ready, and the reason is said rather than left
    // for the reader to notice by comparing this against what they expected.
    text: R.stitch([
      `${task.id} is open again and is ${R.status(task.status)}.`,
      task.unclaimed ? R.wrap(task.unclaimed) : null,
    ]),
  };
}

// ---------------------------------------------------------------------- derive

async function cmdDerive(ctx) {
  const { deriveTasks, deriveAll } = await import("./tasks/derive.mjs");
  // The feature is positional. Written as --feature it swallows the identifier
  // as the flag's value, leaving no positional, and deriving one feature
  // silently becomes deriving every accepted feature: fifty-two tasks where one
  // was meant. Refusing is the only safe reading of that.
  if (ctx.flags.feature !== undefined) {
    throw new UsageError(
      `The feature is positional here: superdev derive ${ctx.flags.feature}. Written as --feature it is read as a value and every accepted feature is derived instead.`,
    );
  }
  const featureId = ctx.words[1] ?? null;
  const result = featureId
    ? await deriveTasks(ctx.root, featureId, { apply: ctx.apply, actor: ctx.actor })
    : await deriveAll(ctx.root, { apply: ctx.apply, actor: ctx.actor });

  const created = result.created?.length ?? result.created ?? 0;
  const updated = result.updated?.length ?? result.updated ?? 0;
  const superseded = result.superseded?.length ?? result.superseded ?? 0;
  const summary = `${countWord(created, "task")} to create, ${updated} to update, ${superseded} to supersede`;

  if (!ctx.apply) {
    return planned(result, "create them", R.stitch([
      featureId ? `Deriving ${featureId}: ${summary}.` : `Deriving every accepted feature: ${summary}.`,
      Array.isArray(result.created) && result.created.length
        ? R.bullets(result.created.map((c) => c.name ?? c.item?.name ?? c.id ?? "a task"))
        : null,
    ]));
  }
  return {
    data: result,
    text: `Derivation finished: ${created} created, ${updated} updated, ${superseded} superseded.`,
  };
}

// ------------------------------------------------------------------------ docs

async function cmdDocsGenerate(ctx) {
  const { generate } = await import("./docs/render.mjs");
  const only = ctx.flags.only ? String(ctx.flags.only) : null;
  const result = await generate(ctx.root, { apply: ctx.apply, only , includeReports: Boolean(ctx.flags.reports) });
  const summary = R.stitch([
    `${countWord(result.written.length, "file")} to write, ${result.unchanged.length} already correct, ${result.proposals.length} held back by a hand edit.`,
    result.written.length ? R.bullets(result.written) : null,
    result.proposals.length
      ? R.block("Held back", R.bullets(result.proposals.map((p) => `${p.path} was edited by hand`)))
      : null,
    result.skipped.length
      ? R.block("No longer applicable", R.bullets(result.skipped.map((s) => `${s.path} (${s.reason})`)))
      : null,
  ]);
  if (!ctx.apply) return planned(result, "write them", summary);
  return {
    data: result,
    text: R.stitch([
      `Wrote ${countWord(result.written.length, "file")}. ${countWord(result.unchanged.length, "file")} ${result.unchanged.length === 1 ? "was" : "were"} already correct.`,
      result.proposals.length
        ? R.wrap(`${countWord(result.proposals.length, "file")} ${result.proposals.length === 1 ? "was" : "were"} left alone because someone edited ${result.proposals.length === 1 ? "it" : "them"}. Run docs diff to see what changed.`)
        : null,
    ]),
    exit: result.proposals.length ? 1 : 0,
  };
}

async function cmdDocsDiff(ctx) {
  const { detectProposals, diffProposal } = await import("./docs/proposals.mjs");
  const path = ctx.words[2] ?? null;
  if (!path) {
    const report = await detectProposals(ctx.root, { apply: false });
    return {
      data: report,
      text: R.renderProposals(report),
      exit: report.proposals.length ? 1 : 0,
    };
  }
  const diff = await diffProposal(ctx.root, path);
  const differs = diff.added > 0 || diff.removed > 0;
  return { data: diff, text: R.renderDiff(diff), exit: differs ? 1 : 0 };
}

// An unmapped edit is {section, reason}. Both matter: the person needs to know
// which part of the file has nowhere to go and why.
const unmappedLine = (entry) =>
  typeof entry === "string" ? entry : `${entry.section ?? entry.heading ?? "the preamble"}: ${entry.reason ?? "nothing in the database holds this"}`;

async function cmdDocsAccept(ctx) {
  const { acceptProposal } = await import("./docs/proposals.mjs");
  const path = requireWord(ctx.words, 2, "Say which document to accept: superdev docs accept <path>.");
  const result = await acceptProposal(ctx.root, path, { apply: ctx.apply, actor: ctx.actor });
  if (!ctx.apply) {
    return planned(result, "write the edit into the database", R.stitch([
      R.wrap(`Accepting ${result.path} would take the hand-edited text into the records it came from.`),
      result.message ? R.wrap(result.message, R.WIDTH, "  ") : null,
      result.unmapped?.length
        ? R.block("Nothing to map these onto", R.bullets(result.unmapped.map(unmappedLine)))
        : null,
    ]));
  }
  return {
    data: result,
    text: R.stitch([
      R.wrap(result.resolved
        ? `Accepted the edits to ${result.path} into the database.`
        : `Part of ${result.path} has nowhere to go in the database, so the proposal is still open.`),
      result.message ? R.wrap(result.message, R.WIDTH, "  ") : null,
    ]),
    exit: result.resolved ? 0 : 1,
  };
}

async function cmdDocsReject(ctx) {
  const { rejectProposal } = await import("./docs/proposals.mjs");
  const path = requireWord(ctx.words, 2, "Say which document to reject: superdev docs reject <path>.");
  if (!ctx.apply) {
    return planned({ path }, "put the generated version back", R.stitch([
      R.wrap(`Rejecting ${path} writes the generated version back over the file.`),
      R.wrap("The discarded text is recorded first, so a rejection can be read back afterwards."),
    ]));
  }
  const result = await rejectProposal(ctx.root, path, { apply: true, actor: ctx.actor });
  return { data: result, text: R.wrap(`Wrote the generated version of ${result.path ?? path} back.`) };
}

// ---------------------------------------------------------------------- memory

async function cmdMemorySearch(ctx) {
  const { recall } = await import("./memory/index.mjs");
  const text = ctx.words.slice(2).join(" ") || (ctx.flags.text ? String(ctx.flags.text) : "");
  if (!text) throw new UsageError("Say what to look for: superdev memory search <text>.");
  const entries = await recall(ctx.root, {
    text,
    limit: Number(ctx.flags.limit ?? 10),
    kinds: ctx.flags.kind ? asList(ctx.flags.kind) : undefined,
    taskId: ctx.flags.task ?? undefined,
    featureId: ctx.flags.feature ?? undefined,
  });
  if (!entries.length) {
    return { data: { entries: [] }, text: `Nothing recorded matches "${text}".` };
  }
  return {
    data: { entries },
    text: R.stitch([
      R.heading(`Recalled ${countWord(entries.length, "entry", "entries")}`),
      entries.map((e) => R.stitch([
        `${e.id}  ${R.status(e.kind)}  ${R.shortDate(e.createdAt ?? e.created_at)}`,
        R.wrap(e.summary ?? e.content ?? "", R.WIDTH, "    "),
      ])).join("\n"),
      "",
      R.wrap("Recall is a memory, not an authority. Check anything load bearing against the records before acting on it.", R.WIDTH, ""),
    ]),
  };
}

// -------------------------------------------------------- questions, decisions

/**
 * Answer a question, from its options or in your own words.
 *
 * This wrote the answer and set the status itself, which is a third
 * implementation of answering alongside the engine's and the control centre's.
 * The engine's is the complete one: it settles the capability area the question
 * belongs to, turns "I do not know" into a reversible assumption with a revisit
 * trigger rather than a decision, and writes a project-level answer through to the
 * field it exists to fill. This one did none of that, so the same question
 * answered here and answered there left the project in different states. Both
 * surfaces now call the engine.
 */
async function cmdQuestionAnswer(ctx) {
  const id = requireWord(ctx.words, 2, "Say which question to answer: superdev question answer <id> --answer <text> or --option <one of its options>.");
  const chosen = asList(ctx.flags.option);
  const typed = ctx.flags.answer !== undefined ? String(ctx.flags.answer) : ctx.words.slice(3).join(" ");
  if (!chosen.length && !typed) {
    throw new UsageError("An answer needs an option or some text. Pass --option <one of its options>, or --answer <text>. Run superdev question list to read the options.");
  }

  const { query } = await store();
  const question = await query(ctx.root, (db) => db.get("SELECT * FROM questions WHERE id = ?", id));
  if (!question) throw new Refusal(`There is no question ${id}.`, "E_NOT_FOUND");
  if (question.status === "answered") {
    throw new Refusal(`${id} was already answered: ${question.answer}`, "E_ALREADY_ANSWERED");
  }

  const offered = json(question.alternatives_json, []);
  const unknown = chosen.filter((choice) => !offered.includes(choice));
  if (unknown.length) {
    throw new UsageError(`${id} does not offer ${unknown.map((u) => JSON.stringify(u)).join(", ")}. Its options are: ${offered.length ? offered.map((o) => JSON.stringify(o)).join(", ") : "none, so answer it in your own words with --answer"}.`);
  }
  if (question.select_mode !== "many" && chosen.length > 1) {
    throw new UsageError(`${id} takes one answer, and ${chosen.length} options were given. Pick one, or write what you mean with --answer.`);
  }

  const answer = [chosen.join("; "), typed].filter(Boolean).join(". ");

  if (!ctx.apply) {
    return planned({ id, answer, selected: chosen }, "record it", R.stitch([
      `Would answer ${id}: ${question.question}`,
      R.wrap(`Answer: ${answer}`, R.WIDTH, "  "),
      question.recommendation ? R.wrap(`The recommendation on file was: ${question.recommendation}`, R.WIDTH, "  ") : null,
    ]));
  }

  const { answerQuestion } = await import("./init/questions.mjs");
  const out = await answerQuestion(ctx.root, id, {
    answer, inOwnWords: typed || null, actor: ctx.actor, answeredBy: ctx.actor,
  });
  if (out.changed === false) throw new Refusal(out.reason, "E_ALREADY_ANSWERED");
  return {
    data: { applied: true, question: out.question ?? { id }, selected: chosen },
    text: R.wrap(out.area
      ? `${id} is answered, and ${out.area.id} ${out.area.area} is settled by it, which is what readiness counts.`
      : `${id} is answered.`),
  };
}

async function cmdDecisionList(ctx) {
  const { json } = await store();
  const decisions = await withProject(ctx.root, async (db, project) => {
    const rows = await db.all(
      `SELECT * FROM decisions WHERE project_id = ?
        ${ctx.flags.all ? "" : "AND status NOT IN ('rejected','superseded','deprecated')"}
        ORDER BY created_at DESC`,
      project.id,
    );
    // What a decision governs is the question this command exists to answer, and
    // it lived only in the control centre's own read model. Reading a decision
    // without its links says which decisions exist, never which one binds the
    // module in front of you.
    for (const d of rows) {
      d.links = await db.all(
        "SELECT target_type, target_id, relationship, scope_note FROM decision_links WHERE decision_id = ?",
        d.id,
      );
    }
    return rows;
  });
  if (!decisions.length) {
    return { data: { decisions: [] }, text: "No decision has been recorded yet." };
  }
  return {
    data: { decisions },
    text: R.stitch([
      R.heading(`Decisions (${decisions.length})`),
      R.table(["Id", "Status", "Expires", "Title"],
        decisions.map((d) => [d.id, R.status(d.status), d.expires_at ? R.shortDate(d.expires_at) : "", d.title])),
      "",
      R.block("What they govern", R.bullets(decisions.slice(0, 8).map((d) => {
        const binds = (d.links ?? []).filter((l) => l.relationship === "governs").map((l) => l.target_id);
        return `${d.id}: ${binds.length ? `binds ${binds.join(", ")}. ` : ""}${d.decision ?? d.title}`;
      }))),
    ]),
  };
}

// -------------------------------------------------------------------- dispatch


// ---------------------------------------------------------------- categories

async function cmdCategoryList(ctx) {
  const { listCategories } = await import("./tasks/categories.mjs");
  const rows = await listCategories(ctx.root);
  if (!rows.length) {
    return { data: { categories: [] }, text: "This project has no task categories yet. Run superdev init, or add one with superdev category add." };
  }
  const active = rows.filter((c) => c.active);
  const retired = rows.filter((c) => !c.active);
  return {
    data: { categories: rows },
    text: R.stitch([
      R.heading(`Task categories (${active.length} in use${retired.length ? `, ${retired.length} retired` : ""})`),
      R.table(["Id", "Category", "Origin", "Tasks", "Means"],
        active.map((c) => [c.id, c.name, c.system ? "seeded" : "yours", String(c.task_count), c.description ?? ""])),
      retired.length ? "" : null,
      retired.length ? R.block("Retired", R.bullets(retired.map((c) =>
        `${c.name} (${c.id}), still carried by ${c.task_count} task(s). Restore with superdev category restore ${c.id}.`))) : null,
    ].filter((x) => x !== null)),
  };
}

async function cmdCategoryAdd(ctx) {
  const name = ctx.words.slice(2).join(" ");
  if (!name) throw new UsageError("Say what to call it: superdev category add <name> [--description <text>]");
  const { createCategory } = await import("./tasks/categories.mjs");
  if (!ctx.apply) {
    return { data: { plan: { name } }, text: `Would add the task category ${name}. Re-run with --apply to create it.` };
  }
  const row = await createCategory(ctx.root, { name, description: ctx.flags.description ?? null, actor: ctx.actor });
  return { data: { category: row }, text: `Added the task category ${row.name} (${row.id}).` };
}

async function cmdCategoryRename(ctx) {
  const id = requireWord(ctx.words, 2, "Say which one and what to call it: superdev category rename <id> <new name>.");
  const name = ctx.words.slice(3).join(" ");
  if (!name) throw new UsageError("Say what to call it: superdev category rename <id> <new name>.");
  const { updateCategory } = await import("./tasks/categories.mjs");
  if (!ctx.apply) {
    return { data: { plan: { id, name } }, text: `Would rename ${id} to ${name}. Re-run with --apply.` };
  }
  const row = await updateCategory(ctx.root, id, { name, description: ctx.flags.description, actor: ctx.actor });
  return { data: { category: row }, text: `${row.id} is now ${row.name}.` };
}

async function cmdCategoryDescribe(ctx) {
  const id = requireWord(ctx.words, 2, "Say which one: superdev category describe <id> <what it means>.");
  const description = ctx.words.slice(3).join(" ");
  if (!description) throw new UsageError("Say what it means: superdev category describe <id> <what it means>.");
  const { updateCategory } = await import("./tasks/categories.mjs");
  if (!ctx.apply) {
    return { data: { plan: { id, description } }, text: `Would describe ${id} as: ${description}. Re-run with --apply.` };
  }
  const row = await updateCategory(ctx.root, id, { description, actor: ctx.actor });
  return { data: { category: row }, text: `${row.name} now reads: ${row.description}` };
}

async function cmdCategoryRetire(ctx) {
  const id = requireWord(ctx.words, 2, "Say which one: superdev category retire <id>.");
  const { setCategoryActive } = await import("./tasks/categories.mjs");
  if (!ctx.apply) {
    return { data: { plan: { id } }, text: `Would retire ${id}. Tasks already filed under it keep it. Re-run with --apply.` };
  }
  const row = await setCategoryActive(ctx.root, id, false, ctx.actor);
  return { data: { category: row }, text: `${row.name} is retired. It is off the pickable list; tasks that already carry it are untouched.` };
}

async function cmdCategoryRestore(ctx) {
  const id = requireWord(ctx.words, 2, "Say which one: superdev category restore <id>.");
  const { setCategoryActive } = await import("./tasks/categories.mjs");
  if (!ctx.apply) {
    return { data: { plan: { id } }, text: `Would restore ${id}. Re-run with --apply.` };
  }
  const row = await setCategoryActive(ctx.root, id, true, ctx.actor);
  return { data: { category: row }, text: `${row.name} is available again.` };
}


// ------------------------------------------------------- authoring the map
//
// Every product record could only be created by `init`, so a project was frozen
// the moment it was initialized. The read side was complete, which is why the
// gap was invisible: goal list and goal show both worked while nothing could
// write a goal. These are the writes.

async function cmdGoalRecord(ctx) {
  const { recordGoal } = await import("./product/authoring.mjs");
  const out = await recordGoal(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A goal needs a name that states the outcome, not the work."),
    why: ctx.flags.why ?? null,
    description: ctx.flags.description ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would record the goal "${out.name}".`));
  }
  // The harness has its own way of holding a session to a goal, and recording one
  // here does not engage it. In Claude Code that is `/goal`, which installs a stop
  // condition so the session keeps working toward it instead of stopping at the
  // first plausible pause. Superdev names it rather than trying to do it: the
  // record is Superdev's, the session is the harness's, and a goal recorded in one
  // that the other has never heard of is why a session drifts off it.
  const { detectHarness } = await import("./runtime/identity.mjs");
  const harness = detectHarness(process.env).harness;
  const holdIt = harness === "claude-code"
    ? `This records the goal. It does not hold this session to it: run /goal ${out.goal.name} so the harness keeps working toward it rather than stopping at the first plausible pause.`
    : null;

  return {
    data: out,
    text: R.stitch([
      R.wrap(`${out.goal.id} recorded: ${out.goal.name}`),
      R.wrap(`It has no success criteria yet, so nothing can say whether it is met and progress counts it as unmeasurable. Add one with superdev goal criterion ${out.goal.id} --criterion "<what is true>" --measurement "<how it is checked>" --apply.`),
      holdIt ? R.wrap(holdIt) : null,
    ]),
  };
}

async function cmdGoalCriterion(ctx) {
  const { count } = await import("./model/vocabulary.mjs");
  const id = requireWord(ctx.words, 2, "Say which goal: superdev goal criterion <GOAL-id>.");
  const { addGoalCriterion } = await import("./product/authoring.mjs");
  const out = await addGoalCriterion(ctx.root, id, {
    criterion: requireFlag(ctx.flags, "criterion", "Say what has to be true. A criterion nobody can check is not one."),
    measurement: ctx.flags.measurement ?? null,
    target: ctx.flags.target ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would add to ${id}: ${out.criterion}`));
  }
  return {
    data: out,
    text: R.stitch([
      R.wrap(`${out.criterion.id} recorded against ${out.goal.name}: ${out.criterion.criterion}`),
      R.wrap(`${out.goal.id} now carries ${count(out.total, "success criterion", "success criteria")}. It is met when every one of them is.`),
    ]),
  };
}

async function cmdMilestoneRecord(ctx) {
  const { recordMilestone } = await import("./product/authoring.mjs");
  const out = await recordMilestone(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A milestone needs a name that says what is delivered by it."),
    outcome: ctx.flags.outcome ?? null,
    targetDate: ctx.flags.date ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would record the milestone "${out.name}".`));
  }
  return {
    data: out,
    text: R.stitch([
      R.wrap(`${out.milestone.id} recorded: ${out.milestone.name}`),
      R.wrap(`It has no exit conditions, so nothing says when it is reached. Add one with superdev milestone condition ${out.milestone.id} --condition "<what must hold>" --apply.`),
    ]),
  };
}

async function cmdMilestoneCondition(ctx) {
  const { count } = await import("./model/vocabulary.mjs");
  const id = requireWord(ctx.words, 2, "Say which milestone: superdev milestone condition <MS-id>.");
  const { addMilestoneCondition } = await import("./product/authoring.mjs");
  const out = await addMilestoneCondition(ctx.root, id, {
    condition: requireFlag(ctx.flags, "condition", "Say what has to hold before this milestone is reached."),
    check: ctx.flags.check ?? null,
    entry: Boolean(ctx.flags.entry),
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would add to ${id} as ${out.entry ? "an entry" : "an exit"} condition: ${out.condition}`));
  }
  return {
    data: out,
    text: R.wrap(out.entry
      ? `Recorded against ${id}. It now carries ${count(out.total, "entry condition")}, and cannot be started until every one is met.`
      : `Recorded against ${id}. It now carries ${count(out.total, "exit condition")}, and is reached when every one is met.`),
  };
}

async function cmdModuleRecord(ctx) {
  const { recordModule } = await import("./product/authoring.mjs");
  const out = await recordModule(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A module needs a name."),
    purpose: ctx.flags.purpose ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would record the module "${out.name}".`));
  }
  return {
    data: out,
    text: R.wrap(`${out.module.id} recorded: ${out.module.name}. Put a feature in it with superdev feature create --module ${out.module.id}.`),
  };
}

async function cmdFeatureCreate(ctx) {
  const { createFeature } = await import("./product/authoring.mjs");
  const out = await createFeature(ctx.root, {
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    milestoneId: ctx.flags.milestone ? String(ctx.flags.milestone) : null,
    name: requireFlag(ctx.flags, "name", "A feature needs a name that states what somebody can do."),
    purpose: ctx.flags.purpose ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "create it", R.wrap(`Would draft "${out.name}" in module ${out.moduleId}.`));
  }
  return {
    data: out,
    text: R.stitch([
      R.wrap(`${out.feature.id} drafted in ${out.module.name}: ${out.feature.name}`),
      R.wrap(`It is Draft at microspec depth. Write its specification with superdev feature specify ${out.feature.id}, then accept it. The depth gate refuses acceptance while anything it promises is missing.`),
    ]),
  };
}

async function cmdModuleStep(ctx) {
  const id = requireWord(ctx.words, 2, "Say which module: superdev module step <MOD-id> <number> --summary \"<what is specified>\".");
  const step = requireWord(ctx.words, 3, "Say which step, by its number. Read them with superdev module show " + id + ".");
  const { settleModuleStep } = await import("./product/authoring.mjs");
  const out = await settleModuleStep(ctx.root, id, step, {
    summary: requireFlag(ctx.flags, "summary", "Say what is specified for this step."),
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would fill step ${out.step} of ${id}, ${out.stepName}: ${out.summary}`));
  }
  return {
    data: out,
    text: R.wrap(`${id} step ${out.step}, ${out.stepName}, is specified: "${out.summary}". Readiness now counts it as done.`),
  };
}

async function cmdModuleNotApplicable(ctx) {
  const id = requireWord(ctx.words, 2, "Say which module: superdev module not-applicable <MOD-id> <number> --reason \"<why>\".");
  const step = requireWord(ctx.words, 3, "Say which step, by its number. Read them with superdev module show " + id + ".");
  const { settleModuleStep } = await import("./product/authoring.mjs");
  const out = await settleModuleStep(ctx.root, id, step, {
    notApplicable: true,
    reason: requireFlag(ctx.flags, "reason", "Say why this step does not apply to this module."),
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would record step ${out.step} of ${id}, ${out.stepName}, as not applicable: ${out.reason}`));
  }
  return {
    data: out,
    text: R.wrap(`${id} step ${out.step}, ${out.stepName}, does not apply: "${out.reason}". It leaves the readiness total rather than counting against it, and the reason is required so this stays different from a step nobody looked at.`),
  };
}

async function cmdModuleSteps(ctx) {
  const id = requireWord(ctx.words, 2, "Say which module: superdev module steps <MOD-id>.");
  const { moduleSteps } = await import("./product/authoring.mjs");
  const rows = await moduleSteps(ctx.root, id, { openOnly: Boolean(ctx.flags.open) });
  if (!rows.length) {
    return {
      data: { steps: [] },
      text: R.wrap(ctx.flags.open
        ? `Every step of ${id} is settled.`
        : `${id} carries no completeness checklist. Seed it with superdev module rename ${id} --purpose "<what it owns>".`),
    };
  }
  const settled = rows.filter((r) => r.state !== "open").length;
  return {
    data: { steps: rows },
    text: R.stitch([
      R.table(["Step", "Name", "State", "Says"],
        rows.map((r) => [
          String(r.step),
          r.step_name,
          SETTLED_STEP[r.state] ?? r.state,
          r.summary ?? r.reason_not_applicable ?? "",
        ])),
      R.wrap(`${settled} of ${rows.length} settled. Fill one with superdev module step ${id} <number> --summary "<what is specified>", or set it aside with superdev module not-applicable ${id} <number> --reason "<why>".`),
    ]),
  };
}

/** How a checklist step's state reads to somebody scanning the table. */
const SETTLED_STEP = { open: "Open", filled: "Specified", not_applicable: "Not applicable" };

async function cmdCapabilitySpecify(ctx) {
  const id = requireWord(ctx.words, 2, "Say which area: superdev capability specify <CAP-id> --choice \"<what was chosen>\".");
  const { settleCapabilityArea } = await import("./product/authoring.mjs");
  const out = await settleCapabilityArea(ctx.root, id, {
    choice: requireFlag(ctx.flags, "choice", "Say what was chosen for this area."),
    evidence: ctx.flags.evidence ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would specify ${out.area}: ${out.choice}`));
  }
  return {
    data: out,
    text: R.wrap(`${id} ${out.area} is specified: "${out.choice}". It was ${R.status(out.was)}, and readiness now counts it as answered.`),
  };
}

async function cmdCapabilityNotApplicable(ctx) {
  const id = requireWord(ctx.words, 2, "Say which area: superdev capability not-applicable <CAP-id> --reason \"<why>\".");
  const { settleCapabilityArea } = await import("./product/authoring.mjs");
  const out = await settleCapabilityArea(ctx.root, id, {
    notApplicable: true,
    reason: requireFlag(ctx.flags, "reason", "Say why this area does not apply to this product."),
    evidence: ctx.flags.evidence ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would record ${out.area} as not applicable: ${out.reason}`));
  }
  return {
    data: out,
    // The reason is somebody's sentence and may not end in a full stop, so it is
    // quoted rather than run into the next sentence.
    text: R.wrap(`${id} ${out.area} is recorded as not applicable: "${out.reason}". A reason is required precisely so this stays different from an area nobody looked at.`),
  };
}

async function cmdCapabilityList(ctx) {
  const { capabilityList } = await import("./product/authoring.mjs");
  const rows = await capabilityList(ctx.root, {
    catalog: ctx.flags.catalog ? String(ctx.flags.catalog) : null,
    unsettled: Boolean(ctx.flags.open),
  });
  if (!rows.length) {
    return { data: { areas: [] }, text: R.wrap("No capability area matches. Superdev seeds them during init.") };
  }
  return {
    data: { areas: rows },
    text: R.stitch([
      R.heading(`Capability areas (${rows.length})`),
      R.table(["Id", "Area", "State", "What settled it"],
        rows.map((a) => [
          a.id,
          a.area,
          R.status(a.state),
          a.choice ?? a.reason ?? "Nothing yet",
        ])),
      "",
      "Settle one with superdev capability specify <id> --choice, or capability not-applicable <id> --reason.",
    ]),
  };
}

// ------------------------------------------------- the rest of the product map
//
// Surfaces, data entities, operations, workflows, requirements and integrations.
// Every one of these tables was readable, rendered, derived from and reported on,
// and none of them could be written, which is what made standard and full spec
// depth unreachable on every project.

const architecture = () => import("./product/architecture.mjs");

/** The shared shape: plan by default, apply on request, say what landed. */
function landed(out, verb, planLine, doneLine) {
  if (!out.applied) return planned(out, verb, R.wrap(planLine));
  return { data: out, text: R.wrap(doneLine) };
}

async function cmdTestPlanRecordNew(ctx) {
  const { recordTestPlan } = await architecture();
  const out = await recordTestPlan(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A test plan needs a name."),
    strategy: requireFlag(ctx.flags, "strategy", "Say what kind of testing this is and what it covers."),
    howToRun: requireFlag(ctx.flags, "howToRun", 'Say how to run it: --how-to-run "<command or steps>". A plan nobody can run is a promise.'),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    passing: ctx.flags.passing ?? null,
    cases: asList(ctx.flags.case),
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the test plan ${out.name}${out.cases?.length ? ` with ${countWord(out.cases.length, "case")}` : ""}.`,
    `${out.plan.id} ${out.plan.name} is recorded with ${countWord(out.cases, "case")}. Accept it before it can satisfy a completion condition.`);
}

async function cmdMigrationRecord(ctx) {
  const { recordMigration } = await architecture();
  const out = await recordMigration(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A migration needs a name."),
    forward: requireFlag(ctx.flags, "forward", "Say what the migration does."),
    rollback: requireFlag(ctx.flags, "rollback",
      "Say how it is rolled back. A migration with no way back is what turns a bad deploy into an outage."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    compatibility: ctx.flags.compatibility ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the migration ${out.name}, with its rollback.`,
    `${out.migration.id} ${out.migration.name} is recorded with its rollback, which is what full depth asks for.`);
}

async function cmdStatesRecord(ctx) {
  const { recordStateMachine } = await architecture();
  const out = await recordStateMachine(ctx.root, {
    entity: requireFlag(ctx.flags, "entity", 'Say what moves through these states: --entity "<the thing>".'),
    states: asList(ctx.flags.state),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    initial: ctx.flags.initial ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record ${countWord(out.states?.length ?? 0, "state")} for ${out.entity}, starting at ${out.initial}.`,
    `${out.machine.id} records ${countWord(out.states, "state")} for ${out.machine.entity_name} on ${out.module}.`);
}

async function cmdTermRecord(ctx) {
  const { recordTerm } = await architecture();
  const out = await recordTerm(ctx.root, {
    term: requireFlag(ctx.flags, "term", "Say which word."),
    meaning: requireFlag(ctx.flags, "meaning", "Say what it means here."),
    source: ctx.flags.source ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record ${out.term} as: ${out.meaning}`,
    `${out.term.id} records what ${out.term.term} means here. One meaning per term.`);
}

async function cmdFieldAdd(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which entity: superdev field add <ENT-id> --name "<field>" --type "<type>".');
  const { addField } = await architecture();
  const out = await addField(ctx.root, id, {
    name: requireFlag(ctx.flags, "name", "A field needs a name."),
    type: requireFlag(ctx.flags, "type", "Say what type it is. A field with no type is a word."),
    nullable: Boolean(ctx.flags.nullable),
    sensitivity: ctx.flags.sensitivity ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "add it", `Would add ${out.name} (${out.type}) to ${id}.`,
    `${out.entity} now has ${countWord(out.total, "field")}.`);
}

async function cmdRelationshipAdd(ctx) {
  const { addRelationship } = await architecture();
  const out = await addRelationship(ctx.root, {
    from: String(requireFlag(ctx.flags, "from", "Say which entity it is from: --from <ENT-id>.")),
    to: String(requireFlag(ctx.flags, "to", "Say which entity it is to: --to <ENT-id>.")),
    name: requireFlag(ctx.flags, "name", "Say what the relationship is called."),
    cardinality: ctx.flags.cardinality ?? null,
    onDelete: ctx.flags.onDelete ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would relate ${out.from} to ${out.to} as ${out.name}.`,
    `${out.from} relates to ${out.to}: ${out.relationship.name}.`);
}

async function cmdServiceRecord(ctx) {
  const { recordService } = await architecture();
  const out = await recordService(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A service needs a name."),
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    purpose: ctx.flags.purpose ?? null,
    style: ctx.flags.style ?? null,
    basePath: ctx.flags.basePath ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would record the service ${out.name}.`,
    `${out.service.id} ${out.service.name} is recorded. Operations can be grouped under it.`);
}

async function cmdTransitionAdd(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which state machine: superdev transition add <SM-id> --from "<state>" --to "<state>" --event "<what happens>".');
  const { addTransition } = await architecture();
  const out = await addTransition(ctx.root, id, {
    from: requireFlag(ctx.flags, "from", "Say which state it leaves."),
    to: requireFlag(ctx.flags, "to", "Say which state it reaches."),
    event: requireFlag(ctx.flags, "event", "Say what causes it."),
    guard: ctx.flags.guard ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would record ${out.from} to ${out.to} on ${out.event}.`,
    `${out.entity}: ${out.from} to ${out.to} on ${out.transition.event}.`);
}

async function cmdSurfaceState(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which surface: superdev surface state <SRF-id> --state empty --copy "<the words>".');
  const { addSurfaceState } = await architecture();
  const out = await addSurfaceState(ctx.root, id, {
    stateType: String(requireFlag(ctx.flags, "state", "Say which state: empty, loading, error, partial, stale, offline, unauthorized, success.")),
    behavior: ctx.flags.behaviour ?? ctx.flags.behavior ?? null,
    copy: ctx.flags.copy ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would describe the ${out.stateType} state of ${id}.`,
    `${out.surface} now describes its ${out.state.state_type} state.`);
}

async function cmdWorkflowActor(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which workflow: superdev workflow actor <WF-id> --who "<who acts>".');
  const { addWorkflowActor } = await architecture();
  const out = await addWorkflowActor(ctx.root, id, {
    actorName: requireFlag(ctx.flags, "who", "Say who or what acts."),
    actorType: ctx.flags.kind ? String(ctx.flags.kind) : "person",
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would record ${out.actorName} as acting in ${id}.`,
    `${out.workflow}: ${out.workflowActor.actor} acts.`);
}

async function cmdWorkflowBranch(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which workflow: superdev workflow branch <WF-id> --from-step 1 --condition "<what decides>".');
  const { addWorkflowBranch } = await architecture();
  const out = await addWorkflowBranch(ctx.root, id, {
    fromStep: requireFlag(ctx.flags, "fromStep", "Say which step it branches from, by its number."),
    condition: requireFlag(ctx.flags, "condition", "Say what decides the branch."),
    toStep: ctx.flags.toStep ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would branch ${id} after step ${out.fromStep}: ${out.condition}`,
    `${out.workflow} branches after ${out.from}.`);
}

async function cmdJobRecord(ctx) {
  const { recordJob } = await architecture();
  const out = await recordJob(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A job needs a name."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    trigger: requireFlag(ctx.flags, "trigger", "Say what starts it."),
    retry: ctx.flags.retry ?? null,
    observability: ctx.flags.observability ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would record the job ${out.name}, started by ${out.trigger}.`,
    `${out.job.id} ${out.job.name} is recorded on ${out.module}.`);
}

async function cmdWebhookRecord(ctx) {
  const { recordWebhook } = await architecture();
  const out = await recordWebhook(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A webhook needs a name."),
    direction: String(requireFlag(ctx.flags, "direction", "Say whether it is inbound or outbound.")),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    endpoint: ctx.flags.endpoint ?? null,
    verification: ctx.flags.verification ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would record the ${out.direction} webhook ${out.name}.`,
    `${out.webhook.id} ${out.webhook.name} is recorded on ${out.module}.`);
}

async function cmdRuntimeRecord(ctx) {
  const { recordRuntimePiece } = await architecture();
  const out = await recordRuntimePiece(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A runtime piece needs a name."),
    runsWhere: ctx.flags.runsWhere ?? null,
    evidence: ctx.flags.evidence ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it", `Would record the runtime piece ${out.name}.`,
    `${out.piece.id} ${out.piece.name} is recorded. It appears on the architecture map.`);
}

/**
 * Turn a concept from the brief into a goal, a module or a feature.
 *
 * The control centre could do this and the command line could not, so a terminal
 * session left every unconverted concept sitting at proposed forever, and nothing
 * reported them. An operation reachable from one surface only is the same defect as
 * one reachable from none: it depends on which door the reader came through.
 *
 * The engine is the control centre's own handler, called directly rather than
 * reimplemented, because two conversions that agreed by coincidence is what the
 * last four defects in this codebase were made of.
 */
async function cmdDiscoveryConvert(ctx) {
  const id = requireWord(ctx.words, 2, "Say which concept: superdev discovery convert <DIS-id> --to goal|module|feature.");
  const to = String(requireFlag(ctx.flags, "to", "Say what it becomes: --to goal, --to module or --to feature."));
  if (!["goal", "module", "feature"].includes(to)) {
    throw new UsageError(`A concept becomes a goal, a module or a feature, not ${JSON.stringify(to)}.`);
  }
  const { query } = await store();
  const item = await query(ctx.root, (db) => db.get("SELECT * FROM discovery_items WHERE id = ?", id));
  if (!item) throw new Refusal(`There is no concept ${id}. Run superdev plan to see what discovery found.`, "E_NOT_FOUND");
  if (item.status === "converted") {
    throw new Refusal(`${id} is already ${item.converted_type} ${item.converted_id}.`, "E_ALREADY_CONVERTED");
  }

  if (!ctx.apply) {
    return planned({ id, to, statement: item.statement }, "convert it", R.stitch([
      R.wrap(`Would turn ${id} into a ${to}: ${item.statement}`),
      to === "feature" && !ctx.flags.module
        ? R.wrap("A feature needs a module. Pass --module <MOD-id>.")
        : null,
    ]));
  }

  const { applyMutation } = await import("./service/mutations.mjs");
  const out = await applyMutation(ctx.root, "discovery.convert", {
    id,
    to,
    name: ctx.flags.name ?? undefined,
    moduleId: ctx.flags.module ?? undefined,
    milestoneId: ctx.flags.milestone ?? undefined,
    actor: ctx.actor,
  });
  return {
    data: out,
    // The handler returns { converted }, not { created }. Guessing the shape printed
    // "is now feature ." with an empty identifier, which is the sort of half sentence
    // that makes a reader doubt the write happened at all.
    text: R.wrap(`${id} is now ${to} ${out?.converted?.id ?? ""}. The concept stays on the map, marked converted, next to the record it became.`),
  };
}

async function cmdSurfaceRecord(ctx) {
  const { recordSurface } = await architecture();
  const out = await recordSurface(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A surface needs a name, which is what a person would call the screen."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    surfaceType: ctx.flags.type ? String(ctx.flags.type) : "screen",
    route: ctx.flags.route ?? null,
    purpose: ctx.flags.purpose ?? null,
    role: ctx.flags.role ?? null,
    actions: asList(ctx.flags.action),
    responsive: ctx.flags.responsive ?? null,
    accessibility: ctx.flags.accessibility ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the ${out.surfaceType} ${out.name}${out.actions?.length ? ` with ${countWord(out.actions.length, "action")}` : ""}.`,
    `${out.surface.id} ${out.surface.name} is recorded on ${out.module}${out.feature ? `, for ${out.feature}` : ""}, with ${countWord(out.actionsRecorded, "action")}. It counts toward what standard depth asks for.`);
}

async function cmdEntityRecord(ctx) {
  const { recordEntity } = await architecture();
  const out = await recordEntity(ctx.root, {
    name: requireFlag(ctx.flags, "name", "A data entity needs a name, which is the thing it holds."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    purpose: ctx.flags.purpose ?? null,
    store: ctx.flags.store ?? null,
    sensitivity: ctx.flags.sensitivity ?? null,
    retention: ctx.flags.retention ?? null,
    deletion: ctx.flags.deletion ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the data entity ${out.name}.`,
    `${out.entity.id} ${out.entity.name} is recorded on ${out.module}. It counts toward what standard depth asks for.`);
}

async function cmdOperationRecord(ctx) {
  const { recordOperation } = await architecture();
  const out = await recordOperation(ctx.root, {
    name: requireFlag(ctx.flags, "name", "An operation needs a name, which is what it does."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    style: ctx.flags.style ?? null,
    method: ctx.flags.method ?? null,
    path: ctx.flags.path ?? null,
    purpose: ctx.flags.purpose ?? null,
    auth: ctx.flags.auth ?? null,
    permission: ctx.flags.permission ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the operation ${out.name}.`,
    `${out.operation.id} ${out.operation.name} is recorded on ${out.module}. It counts toward what standard depth asks for.`);
}

async function cmdWorkflowRecord(ctx) {
  const { recordWorkflow } = await architecture();
  const out = await recordWorkflow(ctx.root, {
    featureId: String(requireFlag(ctx.flags, "feature", "A workflow belongs to a feature: --feature <FEAT-id>.")),
    name: requireFlag(ctx.flags, "name", "A workflow needs a name."),
    purpose: ctx.flags.purpose ?? null,
    trigger: ctx.flags.trigger ?? null,
    steps: asList(ctx.flags.step),
    completion: ctx.flags.completion ?? null,
    observability: ctx.flags.observability ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the workflow ${out.name} with ${countWord(out.steps?.length ?? 0, "step")}.`,
    `${out.workflow.id} ${out.workflow.name} is recorded on ${out.feature} with ${countWord(out.steps, "step")}. A workflow and its steps are what standard depth asks for.`);
}

async function cmdWorkflowStep(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which workflow: superdev workflow step <WF-id> --action "<what happens>".');
  const { addWorkflowStep } = await architecture();
  const out = await addWorkflowStep(ctx.root, id, {
    action: requireFlag(ctx.flags, "action", "A step needs to say what happens."),
    expected: ctx.flags.expected ?? null,
    failure: ctx.flags.failure ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would add a step to ${id}: ${out.action}`,
    `${out.workflow} now has ${countWord(out.total, "step")}.`);
}

async function cmdRequirementRecord(ctx) {
  const { recordRequirement } = await architecture();
  const out = await recordRequirement(ctx.root, {
    category: requireFlag(ctx.flags, "category",
      "Say what kind of requirement this is: security, privacy, performance, observability, accessibility. The depth gate reads this word."),
    requirement: requireFlag(ctx.flags, "requirement", "Say what has to hold."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    target: ctx.flags.target ?? null,
    measurement: ctx.flags.measurement ?? null,
    status: ctx.flags.status ? String(ctx.flags.status) : "unmeasured",
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record a ${out.category} requirement: ${out.requirement}`,
    `${out.requirement.id ?? ""} ${out.category ?? ""} requirement recorded. A security or privacy requirement is what full depth asks for, and an observability one is what standard depth asks for.`.trim());
}

async function cmdIntegrationRecord(ctx) {
  const { recordIntegration } = await architecture();
  const out = await recordIntegration(ctx.root, {
    name: requireFlag(ctx.flags, "name", "An integration needs the name of the service."),
    featureId: ctx.flags.feature ? String(ctx.flags.feature) : null,
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    purpose: ctx.flags.purpose ?? null,
    whenAbsent: requireFlag(ctx.flags, "whenAbsent",
      'Say what happens when it is unavailable: --when-absent "<behaviour>". Failure behaviour invented during the first outage is what this record prevents.'),
    auth: ctx.flags.auth ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  return landed(out, "record it",
    `Would record the integration ${out.name}, absent behaviour: ${out.whenAbsent}`,
    `${out.integration.id} ${out.integration.name} is recorded on ${out.module}, with what happens when it is unavailable.`);
}

async function cmdScopeRecord(ctx) {
  const { recordScopeItem } = await import("./product/authoring.mjs");
  // --not is the same word here as in feature specify, and means the same thing.
  const direction = ctx.flags.in !== undefined ? "in" : ctx.flags.out !== undefined ? "out" : "non_goal";
  const statement = ctx.flags.in ?? ctx.flags.out ?? ctx.flags.not ?? ctx.words[2];
  if (statement === undefined) {
    throw new UsageError('Say what is decided: superdev scope record --not "<what this will not do>" [--why "<reason>"].');
  }
  const out = await recordScopeItem(ctx.root, {
    statement: String(statement),
    direction,
    why: ctx.flags.why ?? null,
    horizon: ctx.flags.horizon ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would record as ${SAID_AS[out.direction]}: ${out.statement}`));
  }
  return {
    data: out,
    text: R.wrap(`${out.item.id} records this as ${out.said}. It appears in the product foundations, which is the one place a deliberate exclusion is distinguishable from something nobody thought of.`),
  };
}

async function cmdScopeRemove(ctx) {
  const id = requireWord(ctx.words, 2, "Say which scope item: superdev scope remove <SCOPE-id>.");
  const { removeScopeItem } = await import("./product/authoring.mjs");
  const out = await removeScopeItem(ctx.root, id, { actor: ctx.actor, apply: ctx.apply });
  if (!out.applied) {
    return planned(out, "remove it", R.wrap(`Would stop recording as ${out.said}: ${out.statement}`));
  }
  return { data: out, text: R.wrap(`${id} is no longer recorded as ${out.said}.`) };
}

async function cmdScopeList(ctx) {
  const { scopeList } = await import("./product/authoring.mjs");
  const rows = await scopeList(ctx.root);
  if (!rows.length) {
    return {
      data: { scope: [] },
      text: R.wrap('Nothing is recorded as in or out of scope. What a product deliberately does not do is the only place a decision is distinguishable from an oversight; record one with superdev scope record --not "<what this will not do>".'),
    };
  }
  return {
    data: { scope: rows },
    text: R.stitch([
      R.heading(`Scope (${rows.length})`),
      R.table(["Id", "Direction", "Statement", "Why"],
        rows.map((r) => [r.id, SAID_AS[r.direction] ?? r.direction, r.statement, r.why ?? "Not recorded"])),
    ]),
  };
}

const SAID_AS = { in: "in scope", out: "out of scope", non_goal: "a non-goal" };

async function cmdMilestoneMet(ctx) {
  const id = requireWord(ctx.words, 2, 'Say which milestone: superdev milestone met <MS-id> --condition "<its text>" --reading "<what was observed>".');
  const { markMilestoneCondition } = await import("./product/authoring.mjs");
  const out = await markMilestoneCondition(ctx.root, id, {
    condition: requireFlag(ctx.flags, "condition", "Say which condition, by its text. superdev milestone show lists them."),
    reading: requireFlag(ctx.flags, "reading", "Say what was observed. A condition marked met with nothing to read is an assertion."),
    entry: Boolean(ctx.flags.entry),
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "record it", R.wrap(`Would mark met on ${id}: ${out.condition}`));
  }
  return {
    data: out,
    text: R.wrap(`${id} ${out.name} now has ${out.met} of ${out.total} ${out.entry ? "entry" : "exit"} conditions met. The reading is on the record: ${out.reading}`),
  };
}

async function cmdMilestoneUpdate(ctx) {
  const id = requireWord(ctx.words, 2, "Say which milestone: superdev milestone update <MS-id> [--name <text>] [--outcome <text>] [--target <date>].");
  const { updateMilestone } = await import("./product/authoring.mjs");
  const out = await updateMilestone(ctx.root, id, {
    name: ctx.flags.name ?? null,
    outcome: ctx.flags.outcome ?? null,
    targetDate: ctx.flags.target ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  const said = Object.entries(out.changes).map(([field, value]) => `${SAYS[field] ?? field} to ${value}`).join(", ");
  if (!out.applied) return planned(out, "change it", R.wrap(`Would set ${id} ${said}.`));
  return { data: out, text: R.wrap(`${id} updated: ${said}.`) };
}

async function cmdModuleRename(ctx) {
  const id = requireWord(ctx.words, 2, "Say which module: superdev module rename <MOD-id> --name <text>.");
  const { renameModule } = await import("./product/authoring.mjs");
  const out = await renameModule(ctx.root, id, {
    name: ctx.flags.name ?? ctx.words[3] ?? null,
    purpose: ctx.flags.purpose ?? null,
    actor: ctx.actor, apply: ctx.apply,
  });
  const said = Object.entries(out.changes).map(([field, value]) => `${SAYS[field] ?? field} to ${value}`).join(", ");
  if (!out.applied) return planned(out, "change it", R.wrap(`Would set ${id} ${said}.`));
  return {
    data: out,
    text: R.stitch([
      R.wrap(out.changes.name
        ? `${id} is now ${out.changes.name}. Its documentation directory is named from the module, so run superdev docs generate to move it.`
        : `${id} updated: ${said}.`),
      out.seeded
        ? R.wrap(`It had no completeness checklist, so it now carries ${countWord(out.seeded, "step")} to specify or mark not applicable. Readiness can score it from here.`)
        : null,
    ]),
  };
}

/** Field names as a reader would say them. */
const SAYS = { name: "its name", purpose: "what it owns", outcome: "what it delivers", target_date: "its target date" };

async function cmdFeatureGoal(ctx) {
  const id = requireWord(ctx.words, 2, "Say which feature: superdev feature goal <FEAT-id> --goal <GOAL-id>.");
  const goalId = requireFlag(ctx.flags, "goal", "Say which goal it advances: --goal <GOAL-id>.");
  const { linkFeatureGoal } = await import("./product/authoring.mjs");
  const remove = Boolean(ctx.flags.remove);
  const out = await linkFeatureGoal(ctx.root, id, String(goalId), { remove, actor: ctx.actor, apply: ctx.apply });
  if (out.unchanged) {
    return { data: out, text: R.wrap(`${id} already serves ${out.goal}.`) };
  }
  if (!out.applied) {
    return planned(out, remove ? "unlink it" : "link it",
      R.wrap(remove
        ? `Would stop ${id} ${out.name} counting toward ${out.goal}.`
        : `Would record that ${id} ${out.name} advances ${out.goal}.`));
  }
  return {
    data: out,
    text: R.wrap(remove
      ? `${id} no longer serves ${out.goal}.`
      : `${id} now serves ${out.goal}. A feature that advances no goal is scope nobody can justify when scope is cut, which is what the alignment report was warning about.`),
  };
}

async function cmdFeatureMove(ctx) {
  const id = requireWord(ctx.words, 2, "Say which feature: superdev feature move <FEAT-id> --module <MOD-id>.");
  const { moveFeature } = await import("./product/authoring.mjs");
  const out = await moveFeature(ctx.root, id, {
    moduleId: ctx.flags.module ? String(ctx.flags.module) : null,
    milestoneId: ctx.flags.milestone ? String(ctx.flags.milestone) : null,
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "move it", R.stitch([
      R.wrap(`Would move ${id} ${out.name}.`),
      out.moduleId ? R.wrap(`Module: ${out.fromModule ?? "none"} to ${out.moduleId}`, R.WIDTH, "  ") : null,
      out.milestoneId ? R.wrap(`Milestone: ${out.fromMilestone ?? "none"} to ${out.milestoneId}`, R.WIDTH, "  ") : null,
    ]));
  }
  return {
    data: out,
    text: R.wrap(`${id} moved${out.toModule ? ` into module ${out.toModule}` : ""}${out.toMilestone ? ` into ${out.toMilestone}` : ""}. Its contract, tasks and evidence are untouched.`),
  };
}

async function cmdRetire(ctx) {
  const id = requireWord(ctx.words, 1, "Say which goal or milestone: superdev retire <id> --reason <why>.");
  const { retire } = await import("./product/authoring.mjs");
  const out = await retire(ctx.root, id, {
    reason: requireFlag(ctx.flags, "reason", "Say why it is being retired, so nobody later has to guess whether it was decided or forgotten."),
    actor: ctx.actor, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "retire it", R.wrap(`Would retire ${out.kind} ${id} ${out.name}. Because: ${out.reason}`));
  }
  return {
    data: out,
    text: R.wrap(`${id} is retired. Nothing is deleted: it keeps its history and stops counting toward progress.`),
  };
}

// ------------------------------------------------------------ feature depth

async function cmdFeatureAccept(ctx) {
  const id = requireWord(ctx.words, 2, "Say which feature: superdev feature accept <id>.");
  const { acceptFeature } = await import("./features/acceptance.mjs");
  const report = await acceptFeature(ctx.root, id, { apply: ctx.apply, actor: ctx.actor });
  return {
    data: report,
    text: report.applied
      ? `${report.name} is accepted at ${report.depth} depth, with all ${report.required} requirements recorded.`
      : R.stitch([
          R.heading(`${report.name} is ready to accept at ${report.depth} depth`),
          R.table(["Requirement", "State"], report.components.map((c) => [c.says, c.met ? "recorded" : "missing"])),
          "",
          "Re-run with --apply to accept it.",
        ]),
  };
}

/**
 * Write the specification the depth gate asks for.
 *
 * Section 12.4 names no command for this and the depth gate names a database
 * record for every gap, so the two only meet if something can write one. Until
 * this existed, `feature depth` reported six missing covers and no command
 * could close any of them.
 */
/** Set an acceptance criterion aside, with the reason on the record. */
async function cmdFeatureWaive(ctx) {
  const id = requireWord(ctx.words, 2, "Say which acceptance criterion: superdev feature waive <AC-id>.");
  const reason = requireFlag(ctx.flags, "reason",
    "Say why this criterion is being set aside. A waiver without a reason reads the same as forgetting.");
  const { waiveCriterion } = await import("./features/specify.mjs");
  const out = await waiveCriterion(ctx.root, id, {
    reason, actor: ctx.actor, sessionId: ctx.flags.session ?? null, apply: ctx.apply,
  });
  if (!out.applied) {
    return planned(out, "waive it",
      R.wrap(`Would waive ${id} on ${out.feature ?? "its feature"}: ${out.criterion}. Because: ${out.reason}`));
  }
  return {
    data: out,
    text: R.wrap(`${id} is waived on ${out.feature}: ${out.criterion}. The reason is on the record, and tasks verifying it are no longer held by it.`),
  };
}

async function cmdFeatureSpecify(ctx) {
  const id = requireWord(ctx.words, 2, "Say which feature to specify: superdev feature specify <FEATURE-id>.");
  const { specifyFeature } = await import("./features/specify.mjs");
  const { EDGE_CASE_CATEGORIES } = await import("./model/vocabulary.mjs");

  // --edge takes category:behavior, and a behavior beginning with "not
  // applicable" records the category as deliberately out rather than unwritten.
  const edgeCases = asList(ctx.flags.edge).map((value) => {
    const text = String(value);
    const at = text.indexOf(":");
    if (at < 1) {
      throw new UsageError(`--edge takes category:behavior, for example --edge empty_states:"The list says no notes yet." Categories: ${EDGE_CASE_CATEGORIES.join(", ")}.`);
    }
    const behavior = text.slice(at + 1).trim();
    return {
      category: text.slice(0, at).trim(),
      behavior,
      applicability: /^not[ _]applicable\b/i.test(behavior) ? "not_applicable" : "applicable",
    };
  });

  // --criterion takes the criterion, optionally with how it is verified after a
  // double bar, because the depth gate asks for both at standard depth.
  const criteria = asList(ctx.flags.criterion).map((value) => {
    const [criterion, verification] = String(value).split("||").map((x) => x.trim());
    return { criterion, verification: verification || null };
  });

  if (ctx.flags.out !== undefined) {
    throw new UsageError(
      "--out is the global flag for writing a command's output to a file. What is deliberately out of scope goes in --not, so that the two cannot be confused.",
    );
  }

  const input = {
    purpose: ctx.flags.purpose ? String(ctx.flags.purpose) : null,
    userStatement: ctx.flags.user ? String(ctx.flags.user) : null,
    scopeIn: asList(ctx.flags.in).map(String),
    // --not, never --out.
    //
    // This flag was --out, which is also the global "write this command's output
    // to this path" flag. The database write succeeded, then the joined scope-out
    // sentences were treated as a filename: three files named after their own
    // contents appeared in a real user's repository root, and the fourth call
    // died with ENAMETOOLONG. Both outcomes were silent, because the output that
    // would have said what happened went into the junk file.
    //
    // Renaming it is the fix rather than marking the flag consumed, because a
    // command where --out means something different from every other command is
    // a trap even when it works.
    scopeOut: asList(ctx.flags.not).map(String),
    flow: asList(ctx.flags.flow).map(String),
    criteria,
    edgeCases,
  };

  const out = await specifyFeature(ctx.root, id, input, {
    actor: ctx.actor, sessionId: ctx.flags.session ?? null, apply: ctx.apply,
  });

  const written = [
    out.purpose ? "its purpose" : null,
    out.userStatement ? "who wants it" : null,
    out.scopeIn ? `${out.scopeIn} in scope` : null,
    out.scopeOut ? `${out.scopeOut} out of scope` : null,
    out.flow ? `a ${out.flow} step flow` : null,
    out.criteria ? `${out.criteria} acceptance criteria` : null,
    out.edgeCases ? `${out.edgeCases} edge cases` : null,
  ].filter(Boolean).join(", ");

  if (!out.applied) {
    return planned({ id, ...input }, "write it", R.wrap(`Would record for ${id}: ${written}.`));
  }
  const { depthReadiness } = await import("./features/acceptance.mjs");
  const { query } = await store();
  const report = await query(ctx.root, (db) => depthReadiness(db, id));
  return {
    data: { applied: true, ...out, readiness: report },
    text: R.stitch([
      R.wrap(`Recorded for ${id}: ${written}.`),
      R.wrap(report.acceptable
        ? `${id} now carries everything ${report.depth} depth promises. Accept it with superdev feature accept ${id} --apply.`
        : `${id} still lacks ${report.missing.map((m) => m.says).join(", ")}.`),
    ]),
  };
}

async function cmdFeatureDepth(ctx) {
  const { depthReadiness, depthGaps } = await import("./features/acceptance.mjs");
  const id = ctx.words[2];
  // Section 12.4 specifies `feature depth <FEATURE-id> <depth>`, which sets it.
  // Only the report existed, so the depth a feature declared could be read and
  // never changed, and a feature drafted at one depth was stuck at it.
  const wanted = ctx.words[3];
  if (id && wanted) {
    const { setDepth } = await import("./features/specify.mjs");
    const out = await setDepth(ctx.root, id, wanted, { actor: ctx.actor, apply: ctx.apply });
    if (out.unchanged) return { data: out, text: R.wrap(`${id} is already at ${wanted} depth.`) };
    if (!out.applied) {
      return planned(out, "change the depth",
        R.wrap(`Would move ${id} from ${out.from} to ${wanted} depth, which changes what it must carry before it can be accepted.`));
    }
    return { data: out, text: R.wrap(`${id} is now ${wanted} depth, was ${out.from}. Run superdev feature depth ${id} to see what that now requires.`) };
  }
  if (id) {
    const { query } = await store();
    const report = await query(ctx.root, (db) => depthReadiness(db, id));
    return {
      data: report,
      text: R.stitch([
        R.heading(`${report.name}, declared ${report.depth} depth`),
        R.pairs([["Recorded", `${report.met} of ${report.required}`]]),
        "",
        R.table(["Requirement", "State", "What closes it"],
          report.components.map((c) => [c.says, c.met ? "recorded" : "missing", c.met ? "" : c.fix])),
      ]),
    };
  }
  const gaps = await depthGaps(ctx.root);
  if (!gaps.length) {
    return { data: { gaps: [] }, text: "Every accepted feature carries what its declared depth promises." };
  }
  return {
    data: { gaps },
    text: R.stitch([
      R.heading(`Accepted features thinner than they claim (${gaps.length})`),
      R.table(["Feature", "Depth", "Recorded", "Missing"],
        gaps.map((g) => [g.name, g.depth, `${g.met} of ${g.required}`, g.missing.map((m) => m.says).join("; ")])),
      "",
      "Record what is missing, or lower the depth so the record matches the feature.",
    ]),
  };
}

const COMMANDS = {
  init: cmdInit,
  adopt: cmdAdopt,
  plan: cmdPlan,
  status: cmdStatus,
  readiness: cmdReadiness,
  resume: cmdResume,
  doctor: cmdDoctor,
  ui: cmdUi,
  start: cmdStart,
  stop: cmdStop,
  restart: cmdRestart,
  services: cmdServices,
  export: cmdExport,
  import: cmdImport,
  derive: cmdDerive,
  "db status": cmdDbStatus,
  "db migrate": cmdDbMigrate,
  "db backup": cmdDbBackup,
  "db restore": cmdDbRestore,
  "task list": cmdTaskList,
  "task show": cmdTaskShow,
  "task create": cmdTaskCreate,
  "task update": cmdTaskUpdate,
  "task claim": cmdTaskClaim,
  "task start": cmdTaskStart,
  "task unblock": cmdTaskUnblock,
  "task release": cmdTaskRelease,
  verify: cmdVerify,
  "task evidence": cmdTaskEvidence,
  "task cancel": cmdTaskCancel,
  "task complete": cmdTaskComplete,
  "task block": cmdTaskBlock,
  "evidence supersede": cmdEvidenceSupersede,
  "task merge": cmdTaskMerge,
  "task reopen": cmdTaskReopen,
  "docs generate": cmdDocsGenerate,
  "docs diff": cmdDocsDiff,
  "docs accept": cmdDocsAccept,
  "docs reject": cmdDocsReject,
  "memory search": cmdMemorySearch,
  "question answer": cmdQuestionAnswer,
  settings: cmdSettings,
  hook: cmdHook,
  "cloud status": cmdCloudStatus,
  "cloud connect": cmdCloudConnect,
  sync: cmdSync,
  "module list": cmdModuleList,
  "module show": cmdModuleShow,
  "goal list": cmdGoalList,
  "goal show": cmdGoalShow,
  "milestone list": cmdMilestoneList,
  "milestone show": cmdMilestoneShow,
  "feature list": cmdFeatureList,
  "feature show": cmdFeatureShow,
  "workflow list": cmdWorkflowList,
  "workflow show": cmdWorkflowShow,
  "architecture show": cmdArchitectureShow,
  "schema show": cmdSchemaShow,
  "api show": cmdApiShow,
  "integration list": cmdIntegrationList,
  "memory show": cmdMemoryShow,
  "memory verify": cmdMemoryVerify,
  "memory consolidate": cmdMemoryConsolidate,
  "memory supersede": cmdMemorySupersede,
  "memory status": cmdMemoryStatus,
  "memory benchmark": cmdMemoryBenchmark,
  "question list": cmdQuestionList,
  "change record": cmdChangeRecord,
  "test-plan list": cmdTestPlanList,
  "test-plan show": cmdTestPlanShow,
  "test-plan run": cmdTestPlanRun,
  "test-plan record": cmdTestPlanRecord,
  "change list": cmdChangeList,
  "change show": cmdChangeShow,
  "assumption record": cmdAssumptionRecord,
  "assumption list": cmdAssumptionList,
  "assumption resolve": cmdAssumptionResolve,
  "decision record": cmdDecisionRecord,
  "decision supersede": cmdDecisionSupersede,
  "decision list": cmdDecisionList,
  "feature accept": cmdFeatureAccept,
  "goal record": cmdGoalRecord,
  "goal criterion": cmdGoalCriterion,
  "milestone record": cmdMilestoneRecord,
  "milestone condition": cmdMilestoneCondition,
  "module record": cmdModuleRecord,
  "feature create": cmdFeatureCreate,
  "feature move": cmdFeatureMove,
  "feature goal": cmdFeatureGoal,
  "milestone met": cmdMilestoneMet,
  "milestone update": cmdMilestoneUpdate,
  "module rename": cmdModuleRename,
  "module steps": cmdModuleSteps,
  "module step": cmdModuleStep,
  "module not-applicable": cmdModuleNotApplicable,
  "capability list": cmdCapabilityList,
  "capability specify": cmdCapabilitySpecify,
  "capability not-applicable": cmdCapabilityNotApplicable,
  "test-plan record-new": cmdTestPlanRecordNew,
  "migration record": cmdMigrationRecord,
  "states record": cmdStatesRecord,
  "term record": cmdTermRecord,
  "discovery convert": cmdDiscoveryConvert,
  "surface record": cmdSurfaceRecord,
  "surface state": cmdSurfaceState,
  "field add": cmdFieldAdd,
  "relationship add": cmdRelationshipAdd,
  "service record": cmdServiceRecord,
  "transition add": cmdTransitionAdd,
  "workflow actor": cmdWorkflowActor,
  "workflow branch": cmdWorkflowBranch,
  "job record": cmdJobRecord,
  "webhook record": cmdWebhookRecord,
  "runtime record": cmdRuntimeRecord,
  "entity record": cmdEntityRecord,
  "operation record": cmdOperationRecord,
  "workflow record": cmdWorkflowRecord,
  "workflow step": cmdWorkflowStep,
  "requirement record": cmdRequirementRecord,
  "integration record": cmdIntegrationRecord,
  "scope record": cmdScopeRecord,
  "scope remove": cmdScopeRemove,
  "scope list": cmdScopeList,
  retire: cmdRetire,
  "feature depth": cmdFeatureDepth,
  "feature specify": cmdFeatureSpecify,
  "feature waive": cmdFeatureWaive,
  "category list": cmdCategoryList,
  "category add": cmdCategoryAdd,
  "category rename": cmdCategoryRename,
  "category describe": cmdCategoryDescribe,
  "category retire": cmdCategoryRetire,
  "category restore": cmdCategoryRestore,
};

const GROUPS = new Set(["db", "task", "docs", "memory", "question", "decision", "category", "feature", "evidence",
  "surface", "entity", "operation", "requirement", "migration", "states", "term",
  "field", "relationship", "service", "transition", "job", "webhook", "runtime", "discovery",
  "module", "goal", "milestone", "workflow", "architecture", "schema", "api", "integration", "change", "assumption", "cloud"]);

function resolveCommand(words) {
  if (!words.length) return null;
  const two = `${words[0]} ${words[1] ?? ""}`.trim();
  if (COMMANDS[two]) return { name: two, handler: COMMANDS[two] };
  if (GROUPS.has(words[0])) {
    const known = Object.keys(COMMANDS)
      .filter((k) => k.startsWith(`${words[0]} `))
      .map((k) => k.split(" ")[1]);
    throw new UsageError(
      words[1]
        ? `There is no ${two} command. ${words[0]} takes: ${known.join(", ")}.`
        : `${words[0]} needs a subcommand: ${known.join(", ")}.`,
    );
  }
  if (COMMANDS[words[0]]) return { name: words[0], handler: COMMANDS[words[0]] };
  return null;
}

// Piping into head or less closes the pipe early. That is the reader's choice,
// not a failure of the command. Registered once, because run() is callable more
// than once in a process.
let pipeGuarded = false;
function guardPipe() {
  if (pipeGuarded) return;
  pipeGuarded = true;
  process.stdout.on("error", (err) => {
    if (err?.code !== "EPIPE") throw err;
  });
}

/** Write output where it was asked for. `--out` is a file, otherwise stdout. */
function emit(text, out) {
  if (!out) {
    guardPipe();
    process.stdout.write(`${text}\n`);
    return;
  }
  const file = resolve(String(out));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${text}\n`, "utf8");
}

export async function run(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }
  const { words, flags } = parsed;

  if (flags.version) {
    const { self } = await import("./runtime/version.mjs");
    const me = self();
    process.stdout.write(flags.json
      ? `${JSON.stringify({ ok: true, command: "version", data: me }, null, 2)}\n`
      : `${me.name} ${me.version}\n`);
    return 0;
  }
  if (flags.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  if (!words.length) {
    // Nothing was asked for, which is a misuse rather than an answer, so the
    // help goes to stdout and the exit code still says the command was wrong.
    process.stdout.write(`${HELP}\n`);
    return 2;
  }

  let resolved;
  try {
    resolved = resolveCommand(words);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }
  if (!resolved) {
    process.stderr.write(`There is no ${words.join(" ")} command. Run superdev --help for the list.\n`);
    return 2;
  }

  const ctx = {
    root: resolve(String(flags.root ?? process.cwd())),
    apply: Boolean(flags.apply),
    json: Boolean(flags.json),
    actor: flags.actor ? String(flags.actor) : "superdev",
    flags,
    words,
    command: resolved.name,
  };

  try {
    const result = await withFriendlyMissingProject(ctx, () => resolved.handler(ctx));
    const out = result.consumedOut ? null : flags.out;
    if (ctx.json) {
      emit(JSON.stringify({ ok: true, command: resolved.name, data: result.data ?? null }, null, 2), out);
    } else {
      emit(String(result.text ?? "").replace(/\n{3,}/g, "\n\n").trimEnd(), out);
      // After the answer, never before it, and never in JSON: a machine reading
      // --json is parsing a contract, and a courtesy about versions is not part
      // of it. This reads a file the last check wrote, so it cannot wait.
      await announceUpdates(ctx);
    }
    return result.exit ?? 0;
  } catch (err) {
    const usage = err instanceof UsageError || err?.code === "E_USAGE";
    // The engine is a static import inside src/db/connect.mjs, so when it is
    // absent every command dies at module load with a resolver message naming a
    // package the reader never asked for. This is the one place that sees all of
    // them. The case is common rather than exotic: a Claude Code marketplace
    // install copies the plugin into its own cache, and node_modules is
    // git-ignored, so the copy arrives with no engine at all.
    if (/Cannot find (package|module) '@tursodatabase\/database'/.test(String(err?.message ?? ""))) {
      err = new Refusal(
        "Superdev's storage engine is not installed, so it cannot open a database. " +
          "Run npm install in the Superdev plugin directory, the one holding its package.json, " +
          "then run this again. If Superdev was installed from a marketplace, that copy lives in " +
          "the harness's plugin cache and needs the install run there.",
        "E_ENGINE_MISSING",
      );
    }
    const payload = {
      ok: false,
      command: resolved.name,
      error: { code: err?.code ?? "E_FAILED", message: err?.message ?? String(err) },
    };
    if (ctx.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else process.stderr.write(`${R.wrap(err?.message ?? String(err), R.WIDTH, "")}\n`);
    return usage ? 2 : 1;
  }
}

/**
 * Whether this file is the program, rather than something that imported it.
 *
 * Compared through realpath on both sides, because npm installs a `bin` as a
 * symlink. Run as `superdev`, argv[1] is the link in the bin directory while
 * import.meta.url is the real file inside the package, so comparing them
 * directly is always false: every command exited 0 having printed nothing.
 *
 * That was invisible until the package had a binary at all. `node src/cli.mjs`
 * matches on the nose and had been the only way it was ever run.
 */
function isProgram() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return realpathOf(invoked) === realpathOf(fileURLToPath(import.meta.url));
}

// Imported, by a hook or by a test of the parser, it stays inert.
if (isProgram()) {
  process.exitCode = await run();
}
