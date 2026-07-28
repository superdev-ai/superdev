#!/usr/bin/env node
// Agent lifecycle hooks. Brief section 12.
//
// One entry point for every harness event. It is importable as a module and
// runnable as a script:
//
//   node src/runtime/hooks.mjs session-start   < payload.json > response.json
//
// Three properties hold for every path through this file, because a hook is the
// one piece of Superdev that runs whether or not anyone wanted it to:
//
//  - IT NEVER BREAKS THE SESSION. Every failure produces valid JSON and exit 0.
//    A hook that could not build context must never be the reason a session
//    stops working.
//  - IT IS BOUNDED. Work is raced against a 3500 ms budget and the response is
//    written with a synchronous write before the process exits, so a slow
//    database or a slow git can never hold the harness open.
//  - IT NEVER INSTALLS, MIGRATES OR BACKS UP. All three are unbounded and belong
//    to explicit commands. On schema drift this says to run superdev db migrate;
//    it does not migrate.
//
// Secrets never reach the output: everything user facing goes through
// sanitizeExternal, which strips secret-shaped values and home paths.

import { existsSync, mkdirSync, readFileSync, writeFileSync, writeSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { paths, query } from "../db/store.mjs";
import { availableMigrations } from "../db/migrate.mjs";
import { sanitizeExternal } from "../model/screening.mjs";
import { detectHarness, gitState } from "./identity.mjs";
import { harnessMatrix } from "./harness.mjs";
import { activeSession, compactSession, endSession, startSession, touchSession } from "./session.mjs";
import { resumeContext, sessionStartReport } from "./resume.mjs";

/** Self-imposed deadline. The harness timeout is stricter than the work is. */
const BUDGET_MS = 3500;

/** A payload larger than this is not a hook payload worth parsing. */
const MAX_STDIN_BYTES = 512 * 1024;

/** Tools whose use means the working tree may have moved away from the records. */
const MUTATING_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/**
 * A shell command that plausibly wrote to a file.
 *
 * The file-editing tools were the only ones watched, and an agent that edits
 * through the shell was invisible: a session that rewrote a dozen source files
 * with sed, a heredoc and a python one-liner left no marker at all, because
 * none of it went through Write or Edit. Whether the record falls behind cannot
 * depend on which tool an agent happens to prefer.
 *
 * This only decides whether to look. What actually changed is then read from
 * git, which is the authority and cannot be fooled by a command that looks like
 * a write and is not.
 */
const SHELL_MIGHT_WRITE = /(^|[\s;&|])(sed\s+-i|tee|cp|mv|rm|install|touch|mkdir|patch|dd)\s|>>?\s*\S|<<\s*['"]?[A-Z]|\b(python3?|node|ruby|perl|awk)\b[^|]*(-e|-c|<<)|\bgit\s+(apply|checkout|restore|revert|stash|merge|rebase|reset)\b/;

/** What git says actually changed, which is the only reliable answer. */
async function changedFiles(root) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  try {
    const { stdout } = await promisify(execFile)("git", ["status", "--porcelain"], {
      cwd: root, timeout: 4000, maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.split("\n").map((line) => line.slice(3).trim()).filter(Boolean).slice(0, MAX_TOUCHED);
  } catch {
    return [];
  }
}

/**
 * At most one activity event per this interval, and one per batch boundary.
 * Brief 12.3: no event per token, file read or shell command. Twenty edits in
 * five minutes are one piece of work to a human reading the timeline.
 */
const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;

/** Paths kept in the touch marker. Enough to describe the work, not a log. */
const MAX_TOUCHED = 40;

/** A provider readiness report older than this is stale and worth mentioning. */
const PROVIDER_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Records carried into a compaction packet, per list. See preparePacket. */
const PACKET_LIMIT = 3;

const EMPTY = Object.freeze({});

// --------------------------------------------------------------- entry point

/**
 * Handle one lifecycle event and return the harness response.
 *
 * `root` is resolved by the caller so the same function serves the script, the
 * CLI and a future in-process harness without each guessing at a directory.
 */
export async function handleHook(event, payload = {}, { root = null } = {}) {
  if (!root) return EMPTY;

  switch (event) {
    case "session-start":
      return sessionStart(root, payload);
    case "user-prompt-submit":
      return userPromptSubmit(root, payload);
    case "pre-tool-use":
      // Deliberately empty. Superdev is a development orchestrator, not a
      // security sandbox: destructive and outward-facing actions are governed
      // by the harness permission model, never by a command parser here. With
      // nothing to decide, launching a process before every tool call would be
      // pure latency, so hooks.json does not wire this event either.
      return EMPTY;
    case "post-tool-use":
      return postToolUse(root, payload);
    case "post-tool-batch":
      return postToolBatch(root, payload);
    case "pre-compact":
      return preCompact(root);
    case "session-end":
      return sessionEnd(root);
    default:
      return EMPTY;
  }
}

// -------------------------------------------------------------- session start

/**
 * Whether the installed CLI is old enough to break these skills.
 *
 * The plugin declares the minimum it needs. Nothing is enforced: an agent told
 * its tools are mismatched can decide what to do, and refusing to start a
 * session over a version number would be worse than the problem.
 */
async function versionSkew() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) return null;
  try {
    const { self, isNewer } = await import("./version.mjs");
    const manifest = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"));
    const needed = manifest?.requires?.cli;
    if (!needed) return null;
    const me = self();
    if (me.version === "unknown" || !isNewer(needed, me.version)) return null;
    return `Superdev: these skills need CLI ${needed} or newer and ${me.version} is installed, so some commands they name will not exist. Update with npm install -g ${me.name}.`;
  } catch {
    return null;
  }
}

async function sessionStart(root, payload) {
  const lines = [];

  // Before anything about the project, whether the two halves agree.
  //
  // The skills and the CLI ship separately now: the skills come from the plugin
  // and the CLI from npm. A skill that tells an agent to run a command a newer
  // CLI introduced gets "there is no such command" on an older one, and the
  // agent has no way to work out why. Saying it here costs nothing and turns a
  // confusing refusal into a sentence naming the fix.
  const skew = await versionSkew();
  if (skew) lines.push(skew);

  const schema = await schemaState(root);

  if (!schema.ok) {
    // A database that is missing, unreadable or behind is reported and left
    // alone. Migrating from a hook would run an unbounded schema change with a
    // backup inside a five second window, against a database another process
    // may be holding.
    lines.push(`Superdev: ${schema.message}`);
    lines.push(`Do this first: ${schema.remedy}`);
    return context("SessionStart", lines.join("\n"));
  }

  // Registers developer, agent, branch and worktree, rejoins a live session
  // rather than opening a second one, and reports any assignment this actor
  // already holds. Best effort: a session that cannot be opened is worth
  // reporting, never worth failing the hook over.
  let session = null;
  try {
    session = await startSession(root, {
      env: payload?.env,
      sessionExternalId: payload?.session_id ?? null,
      modelLabel: payload?.model?.display_name ?? payload?.model ?? null,
    });
  } catch (err) {
    lines.push(`Superdev: session not recorded (${message(err)}). Run superdev resume to record it.`);
  }

  const report = await sessionStartReport(root, { env: payload?.env });
  if (report) lines.push(report);

  if (session?.assignment) {
    lines.push(
      `Assignment already held: ${session.assignment.task_id} ${session.assignment.task_name} (${session.assignment.task_status}). It stays claimed; there is no need to claim it again.`,
    );
  }

  const providers = providerReadiness(root);
  if (providers) lines.push(providers);

  const gaps = coverageNote(payload?.env);
  if (gaps) lines.push(gaps);

  return context("SessionStart", lines.join("\n"));
}

/**
 * Which lifecycle points this harness cannot drive from a hook.
 *
 * Stated at session start rather than discovered later, because an agent that
 * assumes a hook is tracking its work will not run the command that actually
 * records it. Nothing is printed for a harness with full hook coverage.
 */
function coverageNote(env) {
  const detected = detectHarness(env);
  const matrix = harnessMatrix();
  const known = matrix.harnesses.find((h) => h.harness === detected.harness);
  if (!known) return null;

  const uncovered = matrix.lifecycle.filter(
    (l) => l.coverage[detected.harness]?.state === "command",
  );
  if (!uncovered.length) return null;

  const points = uncovered.slice(0, 4).map((l) => `${l.point} (${l.fallback.command})`);
  const rest = uncovered.length - points.length;
  return [
    `Not driven by a hook on ${detected.harness}: ${points.join("; ")}${rest > 0 ? `; and ${rest} more` : ""}.`,
    "Run the command. Superdev never treats a hook as proof that something happened.",
  ].join("\n");
}

// -------------------------------------------------------------- prompt submit

/**
 * The 12.2 gate, stated only when it is not already satisfied.
 *
 * A reminder printed before every prompt stops being read, so this stays silent
 * once a task is claimed and in progress. When nothing is claimed, the agent is
 * about to change the product without a tracked unit of work, which is the one
 * case worth interrupting.
 */
/**
 * Does this prompt ask for work that changes the product?
 *
 * Deliberately generous about what counts as changing the product and strict
 * about what counts as a question, because the cost of the two mistakes is not
 * symmetric: a missed warning lets untracked work happen, and a false warning
 * on "what is the status" is the noise that makes every warning ignorable.
 */
function asksForProductWork(prompt) {
  const text = String(prompt).toLowerCase();
  // A question about state is not a request to change it.
  const ASKS = /^\s*(what|which|where|when|who|why|how|is|are|does|do|can|could|show|list|tell|explain|describe)\b/;
  const CHANGES = /\b(add|build|create|implement|write|fix|change|update|remove|delete|refactor|rename|migrate|wire|expose|support|make it|set up|generate|install|upgrade|improve|redesign)\b/;
  if (CHANGES.test(text)) return true;
  if (ASKS.test(text)) return false;
  // Anything else is treated as work. An unrecognised instruction is more
  // likely to be a change than a question.
  return true;
}

/**
 * Does this prompt ask for something an accepted decision already settled?
 *
 * Section 13.2 requires detecting requests that contradict accepted decisions
 * and asking for confirmation before overriding one. Section 22 makes it
 * acceptance criterion 11. Nothing implemented it, so an agent could quietly
 * undo a decision the owner made and nobody would know until the record
 * disagreed with the code.
 *
 * The match is lexical and deliberately conservative. A decision is surfaced
 * when the prompt names the thing the decision is about, and the agent is asked
 * to check rather than told it is wrong: a hook cannot know whether a request
 * genuinely conflicts, only that a decision exists in the same territory, and
 * overstating that would make the warning ignorable.
 */
async function decisionsInTheWay(root, prompt) {
  const text = String(prompt ?? "").toLowerCase();
  if (text.length < 12) return [];
  const { query } = await import("../db/store.mjs");
  const decisions = await query(root, (db) => db.all(
    `SELECT id, title, decision FROM decisions
      WHERE status IN ('accepted', 'time_boxed') ORDER BY id`)).catch(() => []);

  const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "should",
    "must", "will", "when", "then", "than", "there", "which", "what", "make", "use", "using",
    "superdev", "project", "record", "records", "every", "each", "through", "rather", "never",
    "always", "would", "could", "before", "after", "about", "their", "these", "those", "them"]);
  const words = (t) => new Set(String(t).toLowerCase().match(/[a-z][a-z-]{4,}/g)?.filter((w) => !STOP.has(w)) ?? []);
  const asked = words(text);
  if (asked.size === 0) return [];

  const hits = [];
  for (const d of decisions) {
    const subject = words(`${d.title} ${d.decision ?? ""}`);
    if (subject.size === 0) continue;
    const shared = [...subject].filter((w) => asked.has(w));
    // Two shared subject words is the floor. One is a coincidence in any
    // reasonably sized vocabulary; the whole point is to stay quiet unless the
    // prompt is plausibly in the same territory.
    if (shared.length >= 2) hits.push({ ...d, shared });
  }
  return hits.sort((a, b) => b.shared.length - a.shared.length).slice(0, 3);
}

async function userPromptSubmit(root, payload) {
  if (!existsSync(paths(root).db)) return EMPTY;

  const session = await activeSession(root, {}).catch(() => null);
  if (session?.activeTaskId && session.activeTaskStatus === "in_progress") return EMPTY;

  // Only warn when the prompt asks for work that changes the product. Section
  // 13.2 says to avoid blocking harmless conversational questions, and a
  // warning that fires on every prompt is noise: it trains the reader to skip
  // it, which is exactly how untracked work gets built while the hook is
  // firing correctly on every turn.
  const prompt = String(payload?.prompt ?? "");
  const changesProduct = !prompt || asksForProductWork(prompt);

  // A decision already in force on the same subject is worth raising even when
  // the prompt reads as a question, because reading and then acting is the
  // common path and the warning is cheap once the subject matches.
  const governing = await decisionsInTheWay(root, prompt).catch(() => []);
  if (!changesProduct && governing.length === 0) return EMPTY;

  const lines = [];
  if (governing.length > 0) {
    lines.push(`Superdev: ${governing.length === 1 ? "a decision is" : `${governing.length} decisions are`} already in force on this subject.`);
    for (const d of governing) {
      lines.push(`  ${d.id} ${d.title}: ${String(d.decision ?? "").slice(0, 160)}`);
    }
    lines.push("Check whether this request agrees with them. To change one, supersede it with superdev decision supersede, which keeps the chain, rather than editing around it.");
  }
  if (!changesProduct) {
    return context("UserPromptSubmit", sanitizeExternal(lines.join("\n")), { suppress: true });
  }
  if (session?.activeTaskId) {
    lines.push(
      `Superdev: ${session.activeTaskId} ${session.activeTaskName ?? ""} is ${session.activeTaskStatus ?? "not started"}. Move it to in progress before changing the product.`.replace(/\s+/g, " "),
    );
  } else {
    lines.push("Superdev: no task is claimed in this session.");
    // What has already been built without one. A general reminder is easy to
    // read past; a count of changes the record cannot explain is not, and it
    // is the difference between a rule and a consequence.
    const behind = await untrackedSince(root).catch(() => 0);
    if (behind > 0) {
      lines.push(
        `${behind} ${behind === 1 ? "change has" : "changes have"} already been made with no task claimed, so that work is attached to no feature and counts toward nothing. Cover it with a task before adding more.`,
      );
    }
    lines.push(
      "Before product-changing work: find or create the task, link it to a feature and a workflow step or contract, check the decisions in force, claim it, then move it to in progress. Run superdev resume to see what is already open.",
    );
  }
  return context("UserPromptSubmit", sanitizeExternal(lines.join("\n")), { suppress: true });
}

// ------------------------------------------------------------------ tool use

/**
 * Mark the work touched, and flush at most one activity event.
 *
 * The marker is a file rather than a database write because this fires after
 * every edit: a write per edit would cost a lock acquisition per keystroke-sized
 * change and bury the timeline. The flush is rate limited, so a burst of twenty
 * edits produces one event that says what changed.
 */
/**
 * Mark generated documentation as possibly behind when its source changes.
 *
 * Section 13.3 requires it, and nothing did it, so a document could describe a
 * schema that had moved underneath it and doctor would still call the two in
 * step. Only source under src/ counts: editing the generated Markdown itself is
 * a hand edit, which the proposal path already handles.
 *
 * "Possibly" is the honest word. This hook knows a file changed, not whether
 * the change altered what any document says, and docs diff answers that
 * properly by comparing content.
 */
async function markDocsPossiblyStale(root, file) {
  const path = String(file ?? "");
  if (!path || !/\/(src|scripts)\//.test(path)) return;
  if (!existsSync(paths(root).db)) return;
  const session = await activeSession(root, {}).catch(() => null);
  if (!session?.id) return;

  const { query, mutate } = await import("../db/store.mjs");
  const recent = await query(root, (db) => db.get(
    `SELECT created_at FROM activity_events
      WHERE event_type = 'documentation_possibly_stale' ORDER BY sequence DESC LIMIT 1`)).catch(() => null);
  if (recent?.created_at && Date.now() - Date.parse(recent.created_at) < UNTRACKED_QUIET_MS) return;

  await mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) return;
    const behind = await db.get(
      "SELECT COUNT(*) n FROM documents WHERE sync_status = 'generated'");
    if (!behind?.n) return;
    const { recordActivity } = await import("../db/store.mjs");
    await recordActivity(db, project.id, {
      type: "documentation_possibly_stale",
      actor: "superdev",
      sessionId: session.id,
      summary: `Source changed while ${behind.n} generated documents stand. They may now describe something that moved. Run superdev docs diff to find out, and docs generate to bring them back in line.`,
    });
  }).catch(() => {});
}

/** How long between markers, so a long editing run leaves one, not hundreds. */
const UNTRACKED_QUIET_MS = 15 * 60 * 1000;

/**
 * Record that the product changed while nothing was tracking it.
 *
 * This does not create a task. Section 17.1 puts that duty on the agent and
 * P-010 says no required behaviour may depend on a hook firing, so inventing
 * one here would be the hook asserting work it cannot describe. What it can do
 * honestly is leave a marker, so the gap between what was built and what the
 * record knows is visible in the record itself.
 */
/**
 * Changes made since the last task was claimed or created.
 *
 * An older marker describes work somebody has since accounted for, so counting
 * every marker ever recorded would keep reporting a gap that was closed.
 */
export async function untrackedSince(root) {
  if (!existsSync(paths(root).db)) return 0;
  const { query } = await import("../db/store.mjs");
  const row = await query(root, (db) => db.get(
    `SELECT COUNT(*) AS n FROM activity_events
      WHERE event_type = 'untracked_work'
        AND created_at > coalesce(
          (SELECT MAX(created_at) FROM activity_events
            WHERE event_type IN ('task_claimed', 'task_created')), '')`)).catch(() => null);
  return Number(row?.n ?? 0);
}

async function noteUntrackedWork(root, file) {
  if (!existsSync(paths(root).db)) return;
  const session = await activeSession(root, {}).catch(() => null);
  if (session?.activeTaskId) return;

  const { query, mutate } = await import("../db/store.mjs");
  const recent = await query(root, (db) => db.get(
    `SELECT created_at FROM activity_events
      WHERE event_type = 'untracked_work' ORDER BY sequence DESC LIMIT 1`)).catch(() => null);
  if (recent?.created_at && Date.now() - Date.parse(recent.created_at) < UNTRACKED_QUIET_MS) return;

  await mutate(root, async (db) => {
    const project = await db.get("SELECT id FROM projects LIMIT 1");
    if (!project) return;
    const { recordActivity } = await import("../db/store.mjs");
    await recordActivity(db, project.id, {
      type: "untracked_work",
      actor: "superdev",
      summary: "The product changed while no task was claimed, so this work is not attached to any feature or contract. Claim or create a task to bring the record back in line.",
      metadata: { firstFile: file ? String(file).split("/").slice(-2).join("/") : null },
    });
  }).catch(() => {});
}

async function postToolUse(root, payload) {
  const tool = String(payload?.tool_name ?? payload?.tool ?? "");
  const command = String(payload?.tool_input?.command ?? "");
  const viaShell = tool === "Bash" && SHELL_MIGHT_WRITE.test(command);
  if (!MUTATING_TOOLS.has(tool) && !viaShell) return EMPTY;

  let file = payload?.tool_input?.file_path ?? payload?.tool_input?.notebook_path ?? payload?.tool_input?.path;
  if (viaShell) {
    const changed = await changedFiles(root);
    // A command that looked like a write and changed nothing is not work.
    if (!changed.length) return EMPTY;
    markTouched(root, changed);
    file = file ?? changed[0];
  }
  markTouched(root, [file]);
  await flushTouched(root, { force: false });

  // A file changed with no task claimed is the record falling behind, and
  // recording nothing is how it stays invisible. Section 13.3 says to record
  // files touched by the active task; when there is no active task, that
  // absence is the fact worth keeping. Rate limited so a long editing run
  // leaves one honest marker rather than one per keystroke.
  await noteUntrackedWork(root, file).catch(() => {});
  await markDocsPossiblyStale(root, file).catch(() => {});
  return EMPTY;
}

/**
 * A batch is a natural boundary, so it flushes regardless of the interval.
 *
 * PostToolBatch has no first-party source and may never fire; see
 * UNVERIFIED_EVENTS in harness.mjs. Nothing depends on it: post-tool-use flushes
 * on its own interval, so the timeline is the same either way, just coarser.
 */
async function postToolBatch(root, payload) {
  const files = [];
  for (const call of payload?.tool_calls ?? []) {
    if (!MUTATING_TOOLS.has(String(call?.tool_name ?? ""))) continue;
    files.push(call?.tool_input?.file_path ?? call?.tool_input?.notebook_path ?? call?.tool_input?.path);
  }
  markTouched(root, files);
  await flushTouched(root, { force: true });
  return EMPTY;
}

const touchFile = (root) => join(paths(root).runtime, "touched.json");

function readTouched(root) {
  try {
    const raw = readFileSync(touchFile(root), "utf8");
    const parsed = JSON.parse(raw);
    return {
      paths: Array.isArray(parsed.paths) ? parsed.paths.filter((p) => typeof p === "string") : [],
      total: Number.isFinite(parsed.total) ? parsed.total : 0,
      since: typeof parsed.since === "string" ? parsed.since : null,
      lastEventAt: typeof parsed.lastEventAt === "string" ? parsed.lastEventAt : null,
    };
  } catch {
    return { paths: [], total: 0, since: null, lastEventAt: null };
  }
}

function writeTouched(root, state) {
  try {
    mkdirSync(paths(root).runtime, { recursive: true });
    writeFileSync(touchFile(root), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Record which project-relative paths changed.
 *
 * Anything outside the root is dropped rather than recorded: an absolute path
 * carries the machine's account name, and a path outside the project is not this
 * project's history.
 */
export function markTouched(root, files) {
  const kept = [];
  for (const file of files) {
    if (!file) continue;
    const rel = relative(root, canonical(root, file)).split(sep).join("/");
    if (!rel || rel.startsWith("../") || isAbsolute(rel)) continue;
    if (rel.startsWith(".superdev/")) continue; // Superdev's own runtime state is not project work.
    kept.push(rel);
  }
  if (!kept.length) return null;

  const state = readTouched(root);
  const merged = [...new Set([...state.paths, ...kept])].slice(0, MAX_TOUCHED);
  const next = {
    paths: merged,
    total: state.total + kept.length,
    since: state.since ?? new Date().toISOString(),
    lastEventAt: state.lastEventAt,
  };
  writeTouched(root, next);
  return next;
}

/**
 * Resolve a tool's path the same way the root was resolved.
 *
 * The root is a realpath, so a path the harness reports through a symlink would
 * compare as outside the project and the edit would be dropped. A symlinked
 * project directory is ordinary (/tmp on macOS, home directories on network
 * mounts), and silently losing every edit there is worse than the extra stat.
 * The parent is resolved rather than the file itself, because a path is often
 * reported after the file it names has been moved or deleted.
 */
function canonical(root, file) {
  const abs = resolve(root, String(file));
  let dir = dirname(abs);
  const rest = [basename(abs)];
  // Walk up to the deepest ancestor that exists. A newly written file often has
  // a parent directory that was created in the same batch, and a path that
  // cannot be resolved at all must stay absolute so the caller rejects it.
  for (let depth = 0; depth < 24; depth++) {
    try {
      return join(realpathSync(dir), ...rest);
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return abs;
      rest.unshift(basename(dir));
      dir = parent;
    }
  }
  return abs;
}

/**
 * Append one activity event for everything touched since the last one.
 *
 * Nothing is written when there is no live session: a session-less edit belongs
 * to whoever runs superdev resume next, and the marker survives to tell them.
 */
export async function flushTouched(root, { force = false } = {}) {
  const state = readTouched(root);
  if (!state.paths.length) return { recorded: false, reason: "nothing touched" };

  // The window opens at the first change, not at the last event, so a session's
  // opening edit joins the work around it instead of becoming an event that says
  // one file changed. `since` is always set while paths are pending.
  const anchor = Date.parse(state.lastEventAt ?? state.since ?? "") || 0;
  if (!force && Date.now() - anchor < ACTIVITY_INTERVAL_MS) {
    return { recorded: false, reason: "within the activity interval" };
  }
  if (!existsSync(paths(root).db)) return { recorded: false, reason: "no project database" };

  const session = await activeSession(root, {}).catch(() => null);
  if (!session?.id || session.endedAt) {
    return { recorded: false, reason: "no live session to attribute the work to" };
  }

  // Shells out, so it happens before the write transaction opens. The engine
  // holds an exclusive process lock for a connection's whole life.
  const git = safeGit(root);

  const result = await touchSession(root, session.id, {
    type: "code_changed",
    summary: describeTouched(state),
    taskId: session.activeTaskId ?? null,
    git,
    metadata: { files: state.paths.length, changes: state.total },
  }).catch((err) => ({ recorded: false, reason: message(err) }));

  writeTouched(root, { paths: [], total: 0, since: null, lastEventAt: new Date().toISOString() });
  return result;
}

/** A line a human would want in the timeline, not a file listing. */
function describeTouched(state) {
  const dirs = [...new Set(state.paths.map((p) => (p.includes("/") ? dirname(p) : "the project root")))];
  const where = dirs.slice(0, 3).join(", ");
  const more = dirs.length > 3 ? ` and ${dirs.length - 3} more places` : "";
  const files = state.paths.length;
  return `Changed ${files} file${files === 1 ? "" : "s"} in ${where}${more}.`;
}

// ------------------------------------------------------- compaction and end

/**
 * Persist the 12.5 packet before the transcript is discarded.
 *
 * Everything comes from the database rather than the conversation, so the next
 * agent resumes from records. A session that is already over has nothing to
 * persist, and saying so is better than opening a second one at the moment the
 * first is being thrown away.
 */
async function preCompact(root) {
  const prepared = await preparePacket(root);
  if (!prepared) return EMPTY;

  await flushTouched(root, { force: true });
  const result = await compactSession(root, prepared.sessionId, prepared.details);
  return note(
    `Superdev persisted the session state to the database: ${result.memories.length} entries kept. Next action: ${prepared.details.nextAction ?? "not recorded"}`,
  );
}

/**
 * Close the session, write its outcome and next action, release its claims.
 *
 * SessionEnd is not guaranteed on a killed process, which is exactly why the
 * next session's start re-derives everything from records rather than trusting
 * that this ran.
 */
async function sessionEnd(root) {
  const prepared = await preparePacket(root);
  if (!prepared) return EMPTY;

  await flushTouched(root, { force: true });

  // Section 13.5 asks for short-term memory to be consolidated as the session
  // closes, which is the moment it is worth doing: the session's memories are
  // complete and nothing is mid-write. Failure here never blocks the close,
  // because losing the session record would cost more than a skipped pass.
  let consolidated = null;
  try {
    const { consolidate } = await import("../memory/consolidate.mjs");
    consolidated = await consolidate(root, { apply: true });
  } catch { consolidated = null; }

  const result = await endSession(root, prepared.sessionId, {
    ...prepared.details,
    outcome: prepared.details.lastVerifiedResult?.content ?? prepared.details.objective ?? null,
  });
  const released = result.released?.length ?? 0;
  const tidied = consolidated && (consolidated.duplicatesMerged || consolidated.noiseDiscarded || consolidated.contradictionsFound)
    ? ` Memory: ${consolidated.duplicatesMerged} duplicates merged, ${consolidated.contradictionsFound} contradictions marked, ${consolidated.noiseDiscarded} discarded.`
    : "";
  return note(
    `Superdev closed session ${prepared.sessionId}${released ? `, releasing ${released} claim${released === 1 ? "" : "s"}` : ""}.${tidied} Next action: ${prepared.details.nextAction ?? "not recorded"}`,
  );
}

/**
 * Build the compaction and handoff packet from the records.
 *
 * The lists are capped: the authoritative copy of a decision, a blocker, a scope
 * change and a pending document is its own record, and the memory entry written
 * here is a pointer for recall. Copying all of them on every compaction would
 * grow the memory table without adding a single fact.
 */
async function preparePacket(root) {
  if (!existsSync(paths(root).db)) return null;

  const context = await resumeContext(root);
  const session = context.session;
  if (!session?.id || session.endedAt) return null;

  // A session compacts many times. Without this, every compaction copies the
  // same blockers and decisions again, and the resume report those entries feed
  // ends up listing one blocker five times: the module's own output degrades the
  // longer a session runs.
  const seen = await query(root, (db) =>
    db.all("SELECT source_ref FROM memory_entries WHERE session_id = ? AND source_ref IS NOT NULL", session.id),
  ).then((rows) => new Set(rows.map((r) => r.source_ref))).catch(() => new Set());

  const cap = (list, fn) =>
    (list ?? []).map(fn).filter((e) => e.sourceRef && !seen.has(e.sourceRef)).slice(0, PACKET_LIMIT);
  const verified = context.lastVerified;

  return {
    sessionId: session.id,
    details: {
      objective: session.objective ?? null,
      activeTaskId: context.activeTask?.id ?? null,
      featureId: context.feature?.id ?? null,
      git: context.git,
      nextAction: context.nextAction?.action ?? null,
      actor: context.developer?.displayName ?? context.agent?.harness ?? "superdev",
      decisions: cap(context.governingDecisions, (d) => ({
        title: `${d.id} ${d.title}`,
        content: d.decision ?? d.observable_rationale ?? d.title,
        sourceRef: d.id,
      })),
      blockers: cap(context.blockedTasks, (t) => ({
        title: `${t.id} ${t.name}`,
        content: t.reason ?? "The blocker was never given a reason. Record one before continuing.",
        sourceRef: t.id,
      })),
      scopeChanges: cap(context.scopeChanges, (s) => ({
        title: s.summary,
        content: s.summary,
        sourceRef: s.taskId ?? s.id,
      })),
      pendingDocumentation: cap(context.pendingDocumentation, (d) => ({
        title: d.path,
        content: `${d.path} is ${String(d.sync_status ?? "out of step").replace(/_/g, " ")} and is waiting on a person.`,
        sourceRef: d.id,
      })),
      // Not deduplicated: this is the value the session's `outcome` column is
      // written from, so it has to be present on every compaction.
      lastVerifiedResult: verified
        ? {
          title: `${verified.result ?? "recorded"} ${verified.evidence_type ?? verified.evidenceType ?? "evidence"}`,
          content: verified.summary ?? "Evidence was recorded without a summary.",
          // The session's `outcome` column is filled from `summary`, so leaving
          // it out writes the stringified object into the record instead.
          summary: verified.summary ?? "Evidence was recorded without a summary.",
          sourceRef: verified.id ?? null,
        }
        : null,
    },
  };
}

// ------------------------------------------------------------------- checks

/**
 * Is the database there, readable, and at the revision this build expects?
 *
 * Two cheap questions and no repair. `PRAGMA quick_check` catches a truncated or
 * corrupt file, and `PRAGMA user_version` against the highest migration on disk
 * catches a database that predates this build. Repair is a command.
 */
export async function schemaState(root) {
  const file = paths(root).db;
  const expected = availableMigrations().at(-1)?.version ?? 0;

  if (!existsSync(file)) {
    return {
      ok: false,
      state: "missing",
      expected,
      version: null,
      message: "no project database in this directory.",
      remedy: "run superdev init to create it.",
    };
  }

  try {
    const found = await query(root, async (db) => {
      const quick = await db.get("PRAGMA quick_check(1)");
      const version = await db.get("PRAGMA user_version");
      return {
        quick: String(quick?.quick_check ?? "unknown"),
        version: Number(version?.user_version ?? 0),
      };
    });

    if (found.quick !== "ok") {
      return {
        ok: false,
        state: "corrupt",
        expected,
        version: found.version,
        message: `the project database failed its integrity check (${found.quick}).`,
        remedy: "run superdev db restore to recover from the most recent backup.",
      };
    }
    if (found.version < expected) {
      return {
        ok: false,
        state: "behind",
        expected,
        version: found.version,
        message: `the project database is at schema revision ${found.version}, this build expects ${expected}.`,
        remedy: "run superdev db migrate.",
      };
    }
    if (found.version > expected) {
      return {
        ok: false,
        state: "ahead",
        expected,
        version: found.version,
        // Downgrading is not a migration and there is no safe automatic answer,
        // so this reports the mismatch and stops.
        message: `the project database is at schema revision ${found.version}, ahead of this build's ${expected}.`,
        remedy: "update Superdev; do not write to the project with an older build.",
      };
    }
    return { ok: true, state: "current", expected, version: found.version };
  } catch (err) {
    return {
      ok: false,
      state: "unreadable",
      expected,
      version: null,
      message: `the project database could not be read (${message(err)}).`,
      remedy: "run superdev doctor.",
    };
  }
}

/**
 * Provider readiness, reported only when the recorded check has gone stale.
 *
 * Detection probes external CLIs, which is unbounded and belongs to superdev
 * doctor. This reads what that already wrote and says nothing when the answer is
 * fresh, because a readiness line on every session start is noise. Provider ids
 * and states only, never a path or a credential.
 */
export function providerReadiness(root, { now = Date.now() } = {}) {
  const file = join(paths(root).runtime, "providers.json");
  if (!existsSync(file)) return null;

  let report;
  try {
    report = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return "Provider readiness: the recorded report could not be read. Run superdev doctor to check the providers again.";
  }

  const checkedAt = Date.parse(report?.checkedAt ?? "");
  const age = Number.isFinite(checkedAt) ? now - checkedAt : Infinity;
  if (age < PROVIDER_STALE_MS) return null;

  const notReady = (report?.providers ?? [])
    .filter((p) => p && p.state && p.state !== "available-and-ready")
    .map((p) => `${p.id} ${p.state}`)
    .slice(0, 4);

  const when = Number.isFinite(checkedAt)
    ? `last checked ${Math.round(age / 86_400_000)} days ago`
    : "never checked";
  const detail = notReady.length ? ` Last known not ready: ${notReady.join("; ")}.` : "";
  return sanitizeExternal(
    `Provider readiness is stale (${when}).${detail} Run superdev doctor to check again. Nothing is installed automatically.`,
  );
}

// ------------------------------------------------------------------ helpers

/** Never let a git failure look like a hook failure. */
function safeGit(root) {
  try {
    return gitState(root);
  } catch {
    return null;
  }
}

const message = (err) => sanitizeExternal(String(err?.message ?? err ?? "unknown error")).slice(0, 200);

/** The documented shape for injecting context. */
function context(hookEventName, text, { suppress = false } = {}) {
  const additionalContext = sanitizeExternal(String(text ?? "")).trim();
  if (!additionalContext) return EMPTY;
  const out = { hookSpecificOutput: { hookEventName, additionalContext } };
  if (suppress) out.suppressOutput = true;
  return out;
}

/** One line the person sees, for events where context injection is pointless. */
const note = (text) => ({ systemMessage: sanitizeExternal(String(text)).slice(0, 500), suppressOutput: true });

/**
 * Walk up for the directory that owns the project database.
 *
 * A hook fires wherever the person happens to be, which is often a subdirectory.
 * Only what the filesystem confirms is trusted: the payload supplies a candidate,
 * realpath decides whether it exists.
 */
export function resolveRoot(payload = {}, env = process.env) {
  const candidate = payload?.cwd ?? env.CLAUDE_PROJECT_DIR ?? process.cwd();
  let dir;
  try {
    dir = realpathSync(String(candidate));
  } catch {
    return null;
  }

  for (let depth = 0; depth < 24; depth++) {
    if (existsSync(paths(dir).db)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No project anywhere above. The starting directory is still the honest
  // answer: session start reports that there is no project here.
  return realpathSync(String(candidate));
}

// ------------------------------------------------------------------- script

function readStdin() {
  try {
    const buf = readFileSync(0);
    if (buf.length > MAX_STDIN_BYTES) return {};
    const text = buf.toString("utf8").trim();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/**
 * Write the response and stop. `writeSync` rather than `process.stdout.write`
 * because the harness reads a pipe and an ordinary write can still be buffered
 * when `process.exit` runs, which truncates the JSON the harness is parsing.
 */
function emit(value) {
  let text;
  try {
    text = JSON.stringify(value ?? EMPTY);
  } catch {
    text = "{}";
  }
  const buf = Buffer.from(text ?? "{}", "utf8");
  for (let attempt = 0, written = 0; attempt < 50 && written < buf.length; attempt++) {
    try {
      written += writeSync(1, buf, written);
    } catch (err) {
      if (err?.code !== "EAGAIN") return; // A closed pipe is not worth failing over.
    }
  }
}

export async function main(argv = process.argv) {
  const event = String(argv[2] ?? "");
  let response = EMPTY;

  try {
    const payload = readStdin();
    const root = resolveRoot(payload);

    // Raced rather than awaited: the point of the budget is that a slow database
    // or a slow git cannot hold the harness open past its own timeout.
    let timer;
    const budget = new Promise((r) => {
      timer = setTimeout(() => r(EMPTY), BUDGET_MS);
      timer.unref?.();
    });
    response = await Promise.race([
      handleHook(event, payload, { root }).catch(() => EMPTY),
      budget,
    ]);
    clearTimeout(timer);
  } catch {
    response = EMPTY;
  }

  emit(response ?? EMPTY);
  // Hard exit: work may still be in flight behind the budget race, and an
  // abandoned write transaction rolls back rather than committing half of itself.
  process.exit(0);
}

if (process.argv[1] && realpathSafe(process.argv[1]) === realpathSafe(new URL(import.meta.url).pathname)) {
  await main();
}

function realpathSafe(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
