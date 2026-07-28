// Who is working, in which harness, on which worktree.
//
// Identity is resolved before anything else in a session, because every later
// write is attributed to it. Harness detection reports the evidence that decided
// it rather than a bare verdict: brief section 12.6 requires hook coverage to be
// stated honestly, and a wrong guess about hook support is the difference
// between a tracked session and a silent one.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { userInfo } from "node:os";
import { resolve } from "node:path";
import { paths, mutate, create, currentProject, DbError } from "../db/store.mjs";
import { sanitizeExternal } from "../model/screening.mjs";

/**
 * Environment signals per harness, with the hook coverage each one actually
 * guarantees. `hooks` is what the orchestrator must plan around: anything less
 * than "supported" means state is updated explicitly rather than on a hook.
 */
const HARNESSES = [
  {
    harness: "claude-code",
    hooks: "supported",
    note: "Claude Code lifecycle hooks fire. Superdev still verifies state from the database rather than trusting the hook alone.",
    vars: ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SESSION_ID", "CLAUDE_PLUGIN_ROOT", "CLAUDE_PROJECT_DIR"],
    sessionVars: ["CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID"],
  },
  {
    harness: "codex",
    hooks: "partial",
    note: "Codex hook coverage is partial. Superdev runs an explicit preflight and an explicit handoff instead of relying on a hook.",
    vars: ["CODEX_SANDBOX", "CODEX_SANDBOX_NETWORK_DISABLED", "CODEX_HOME", "CODEX_THREAD_ID", "CODEX_CLI_VERSION"],
    sessionVars: ["CODEX_THREAD_ID", "CODEX_SESSION_ID"],
  },
  {
    harness: "skills-sh",
    hooks: "none",
    note: "skills.sh gives no lifecycle-hook guarantee, so session start, compaction and handoff are written explicitly by the orchestrator.",
    vars: ["SKILLS_SH", "SKILLS_SH_SESSION", "SKILLS_SH_HOME", "SKILL_SH_RUN"],
    sessionVars: ["SKILLS_SH_SESSION", "SKILL_SH_SESSION_ID"],
  },
];

const UNKNOWN = {
  harness: "unknown",
  hooks: "none",
  note: "No harness signal in the environment. Nothing in Superdev depends on a hook firing here; state is written explicitly.",
};

/**
 * Which harness this process is running under, and why.
 *
 * Evidence carries variable names, never their values, so a report built from
 * this can never leak a token that happened to be in the environment.
 */
export function detectHarness(env = process.env) {
  const vars = env ?? {};
  const present = (name) => typeof vars[name] === "string" && vars[name] !== "";

  const override = String(vars.SUPERDEV_HARNESS ?? "").trim();
  const named = HARNESSES.find((h) => h.harness === override);
  if (named) {
    return {
      ...describe(named, vars),
      evidence: [{ signal: "SUPERDEV_HARNESS", source: "env", value: named.harness }],
      confidence: "confirmed",
    };
  }

  const scored = HARNESSES
    .map((h) => ({ h, hits: h.vars.filter(present) }))
    .filter((s) => s.hits.length)
    .sort((a, b) => b.hits.length - a.hits.length);

  if (!scored.length) return { ...UNKNOWN, evidence: [], confidence: "assumed", sessionExternalId: null };

  const winner = scored[0];
  return {
    ...describe(winner.h, vars),
    evidence: winner.hits.map((signal) => ({ signal, source: "env" })),
    // Two harnesses claiming the environment at once means one is nested inside
    // the other, so the verdict is a best guess and says so.
    confidence: scored.length > 1 ? "inferred" : "confirmed",
  };
}

function describe(harness, vars) {
  const sessionVar = harness.sessionVars.find((name) => vars[name]);
  return {
    harness: harness.harness,
    hooks: harness.hooks,
    note: harness.note,
    // A harness session id is an opaque correlation handle, not a credential.
    sessionExternalId: sessionVar ? clean(vars[sessionVar]) : null,
  };
}

// ---------------------------------------------------------------------- git

const RUN = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000, maxBuffer: 8 * 1024 * 1024 };

function git(root, args) {
  return execFileSync("git", args, { cwd: root, ...RUN }).trim();
}

function gitOrNull(root, args) {
  try {
    return git(root, args) || null;
  } catch {
    return null;
  }
}

/**
 * Branch, HEAD and cleanliness for a working tree.
 *
 * This shells out, so it must be called before a write transaction is opened and
 * never inside one: the engine holds an exclusive process lock for a
 * connection's whole life, and a subprocess inside that window blocks every
 * other writer for as long as git takes.
 */
export function gitState(root) {
  const top = gitOrNull(root, ["rev-parse", "--show-toplevel"]);
  if (!top) return { branch: null, head: null, dirty: false, worktreeFingerprint: null };

  // --show-current is empty on a detached HEAD and on an unborn branch, where
  // rev-parse --abbrev-ref would throw or answer "HEAD".
  const branch = gitOrNull(root, ["branch", "--show-current"]);
  const head = gitOrNull(root, ["rev-parse", "HEAD"]);
  const status = gitOrNull(root, ["status", "--porcelain"]);
  const common = gitOrNull(root, ["rev-parse", "--git-common-dir"]) ?? ".git";

  return {
    branch: clean(branch),
    head,
    dirty: Boolean(status),
    worktreeFingerprint: fingerprint(top, resolve(top, common)),
  };
}

/**
 * A stable handle for one working tree. The paths are hashed rather than stored
 * because an absolute path carries the machine's account name, which must never
 * reach a record. Linked worktrees share a common git dir but differ at the top
 * level, so both go into the hash.
 */
const fingerprint = (top, commonDir) =>
  createHash("sha256").update(`${top}\n${commonDir}`).digest("hex").slice(0, 16);

const clean = (text) => {
  const out = sanitizeExternal(text).trim();
  return out || null;
};

// ----------------------------------------------------------------- identity

/**
 * Find or register the developer, agent and branch this process is working as.
 *
 * Everything that shells out happens first; only then is the transaction opened.
 * Pass `git` if the caller already has a `gitState` result, so the same session
 * start does not run git twice.
 */
export async function resolveIdentity(root, opts = {}) {
  const harness = opts.harness && typeof opts.harness === "object"
    ? opts.harness
    : detectHarness(opts.env);
  const state = opts.git ?? gitState(root);

  // Checked before the connection is opened: opening a write connection on a
  // path that has no database creates an empty one, so a hook firing in the
  // wrong directory would leave a stray .superdev behind and then fail on a
  // missing table rather than saying what is actually wrong.
  if (!existsSync(paths(root).db)) {
    throw new DbError("E_NOT_FOUND", "This directory has no Superdev project yet. Run superdev init first.");
  }

  const env = opts.env ?? process.env;
  const externalIdentity = clean(
    opts.externalIdentity ?? env.SUPERDEV_EXTERNAL_IDENTITY ?? gitOrNull(root, ["config", "--get", "user.email"]),
  );
  const displayName = clean(
    opts.displayName ?? gitOrNull(root, ["config", "--get", "user.name"]) ?? safeUsername(),
  ) ?? "developer";
  const sessionExternalId = clean(opts.sessionExternalId ?? harness.sessionExternalId);
  const modelLabel = clean(opts.modelLabel);
  const at = opts.at ?? new Date().toISOString();

  return mutate(root, async (db) => {
    const project = await currentProject(db);
    if (!project) {
      throw new DbError("E_NOT_FOUND", "This directory has no Superdev project yet. Run superdev init first.");
    }

    const developer = await upsertDeveloper(db, project.id, { displayName, externalIdentity, at });
    const agent = await upsertAgent(db, developer.id, {
      harness: harness.harness, modelLabel, sessionExternalId, at,
    });
    const branch = await upsertBranch(db, project.id, state, at);

    return { developer, agent, branch, project, harness, git: state };
  });
}

function safeUsername() {
  try {
    return userInfo().username;
  } catch {
    return null;
  }
}

// developers, agents, branches and work_sessions carry no `version` column, so
// `patch` and `setStatus` cannot touch them: both go through versionedUpdate,
// which always writes `version = version + 1`. These four tables are presence
// bookkeeping rather than specification records, so the update is written here
// and the lifecycle events that matter to a human are recorded by session.mjs.

async function upsertDeveloper(db, projectId, { displayName, externalIdentity, at }) {
  const found = externalIdentity
    ? await db.get("SELECT * FROM developers WHERE project_id = ? AND external_identity = ?", projectId, externalIdentity)
    : null;
  const row = found
    ?? await db.get("SELECT * FROM developers WHERE project_id = ? AND display_name = ?", projectId, displayName);

  if (!row) {
    // No activity event: registering an actor is bookkeeping, and the
    // session_started event that follows names the developer anyway.
    return create(db, "developer", {
      project_id: projectId,
      display_name: displayName,
      external_identity: externalIdentity,
      status: "active",
      created_at: at,
    });
  }

  // The display name is never rewritten: it is half of a unique key, and a
  // rename would collide with whoever already holds the new name.
  const external = row.external_identity ?? externalIdentity;
  if (row.status !== "active" || external !== row.external_identity) {
    await db.run(
      "UPDATE developers SET status = 'active', external_identity = ? WHERE id = ?",
      external, row.id,
    );
    return db.get("SELECT * FROM developers WHERE id = ?", row.id);
  }
  return row;
}

async function upsertAgent(db, developerId, { harness, modelLabel, sessionExternalId, at }) {
  const row = await db.get(
    `SELECT * FROM agents
      WHERE developer_id = ? AND harness = ? AND session_external_id IS ?
      ORDER BY last_seen_at DESC LIMIT 1`,
    developerId, harness, sessionExternalId,
  );

  if (!row) {
    return create(db, "agent", {
      developer_id: developerId,
      harness,
      model_label: modelLabel,
      session_external_id: sessionExternalId,
      status: "active",
      last_seen_at: at,
    });
  }

  await db.run(
    "UPDATE agents SET status = 'active', last_seen_at = ?, model_label = coalesce(?, model_label) WHERE id = ?",
    at, modelLabel, row.id,
  );
  return db.get("SELECT * FROM agents WHERE id = ?", row.id);
}

async function upsertBranch(db, projectId, state, at) {
  if (!state.branch && !state.worktreeFingerprint) return null;
  const name = state.branch ?? "detached";

  const row = await db.get(
    "SELECT * FROM branches WHERE project_id = ? AND name = ? AND worktree_fingerprint IS ?",
    projectId, name, state.worktreeFingerprint,
  );

  if (!row) {
    return create(db, "branch", {
      project_id: projectId,
      name,
      worktree_fingerprint: state.worktreeFingerprint,
      head_revision: state.head,
      dirty: state.dirty ? 1 : 0,
      status: "active",
      last_seen_at: at,
    });
  }

  await db.run(
    "UPDATE branches SET head_revision = ?, dirty = ?, last_seen_at = ? WHERE id = ?",
    state.head, state.dirty ? 1 : 0, at, row.id,
  );
  return db.get("SELECT * FROM branches WHERE id = ?", row.id);
}
