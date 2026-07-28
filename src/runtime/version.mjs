// What version this is, and whether a newer one exists.
//
// Two separate questions, and only the first can be answered offline. Keeping
// them in one module keeps the one that touches the network in a single place a
// reader can audit, rather than spread across the commands that report it.
//
// The update check is the only outbound request this product makes. Everything
// about it is arranged so that it cannot become a condition of working:
//
//   It never blocks. The answer comes from a file written by the previous
//   check, so a command reports what was already known and never waits.
//   A command that had to wait on a registry would make an offline machine
//   slower than an online one, which is the wrong way round for a tool whose
//   first promise is that it works with no network.
//
//   It runs at most once a day, and only when something already ran.
//
//   It fails silently. No network, a proxy, a firewall, a registry outage: the
//   check writes nothing and the next command behaves as though it had never
//   been asked.
//
//   It can be turned off, and says so the first time it runs.
//
// What it sends is a GET for one package's metadata. What that discloses is
// that somebody uses Superdev. That is a real disclosure, small but not zero,
// which is why it is documented in the README rather than buried here.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The package this CLI was published as, read from its own manifest. */
const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, "..", "..", "package.json");

let cached = null;

/** This CLI's own name and version. Always available, never a network call. */
export function self() {
  if (cached) return cached;
  try {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    cached = {
      name: manifest.name ?? "superdev-cli",
      version: manifest.version ?? "0.0.0",
      root: join(HERE, "..", ".."),
    };
  } catch {
    // A tree with no manifest still has to report something rather than crash.
    cached = { name: "superdev-cli", version: "unknown", root: join(HERE, "..", "..") };
  }
  return cached;
}

/**
 * Compare two semantic versions. True when `candidate` is newer than `current`.
 *
 * Pre-releases are the part worth spelling out, because the first version of
 * this dropped them from both sides and so reported 1.0.0 and 1.0.0-beta.1 as
 * the same version. The consequence was silence exactly where a notice matters
 * most: somebody running a pre-release was never told the release had shipped.
 *
 * The rule is the one semver states. A release outranks any pre-release of the
 * same numbers, and between two pre-releases the identifiers are compared left
 * to right, numerically where both are numeric and otherwise as text.
 */
export function isNewer(candidate, current) {
  const a = parse(candidate);
  const b = parse(current);
  // A version nobody can read is not evidence that an update exists. Without
  // this, an unreadable version left minor and patch undefined, every
  // comparison went through NaN, and the answer came back false by accident
  // rather than by decision. False is the right answer; it should be given on
  // purpose, and only after saying why.
  if (!a || !b) return false;

  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  if (a.patch !== b.patch) return a.patch > b.patch;

  // Same numbers. A release beats a pre-release of them; a pre-release loses to
  // the release and is compared identifier by identifier against another.
  if (!a.pre && !b.pre) return false;
  if (!a.pre) return true;
  if (!b.pre) return false;
  return comparePre(a.pre, b.pre) > 0;
}

/** A version split into its parts, or null when it is not a version at all. */
function parse(value) {
  const text = String(value ?? "").trim();
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(text);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? "",
  };
}

/** Semver pre-release ordering: numeric parts numerically, the rest as text. */
function comparePre(left, right) {
  const a = left.split(".");
  const b = right.split(".");
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    // A shorter set of identifiers is the lower precedence, so a missing part
    // loses rather than being treated as zero.
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] === b[i]) continue;
    const numericA = /^\d+$/.test(a[i]);
    const numericB = /^\d+$/.test(b[i]);
    if (numericA && numericB) return Number(a[i]) - Number(b[i]);
    // A numeric identifier always has lower precedence than an alphanumeric one.
    if (numericA) return -1;
    if (numericB) return 1;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

// ------------------------------------------------------------------ settings

const stateFile = (root) => join(root, ".superdev", "runtime", "update-check.json");

const readState = (root) => {
  try {
    return JSON.parse(readFileSync(stateFile(root), "utf8"));
  } catch {
    return {};
  }
};

const writeState = (root, state) => {
  try {
    mkdirSync(dirname(stateFile(root)), { recursive: true });
    writeFileSync(stateFile(root), JSON.stringify(state, null, 1));
  } catch {
    // A read-only project directory is not a reason to fail a command.
  }
};

/**
 * Whether checking is allowed at all.
 *
 * The environment variable wins, because that is what somebody reaches for in
 * a build, a container or a locked-down network where an outbound request is
 * not merely unwanted but refused.
 */
export function checkingEnabled(root) {
  if (process.env.SUPERDEV_NO_UPDATE_CHECK) return false;
  if (process.env.NO_UPDATE_NOTIFIER) return false;
  if (process.env.CI) return false;
  return readState(root).disabled !== true;
}

export function setChecking(root, enabled) {
  writeState(root, { ...readState(root), disabled: !enabled });
  return enabled;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// --------------------------------------------------------------- the notice

/**
 * The notice to print, from what the last check found. Never makes a request.
 *
 * Returns null when there is nothing to say, which is the usual case, so a
 * caller can print it unconditionally without deciding anything.
 */
export function pendingNotice(root) {
  const state = readState(root);
  if (!checkingEnabled(root)) return null;
  const lines = [];
  const me = self();

  if (state.cli && isNewer(state.cli, me.version)) {
    lines.push(
      `A newer Superdev CLI is available: ${state.cli}, you have ${me.version}. Update with npm install -g ${me.name}.`,
    );
  }
  if (state.plugin && state.pluginCurrent && isNewer(state.plugin, state.pluginCurrent)) {
    lines.push(
      `A newer Superdev plugin is available: ${state.plugin}, you have ${state.pluginCurrent}. Update with claude plugin marketplace update superdev.`,
    );
  }
  if (!lines.length) return null;
  if (!state.told) {
    lines.push("Turn these off with superdev settings --no-update-check, or set SUPERDEV_NO_UPDATE_CHECK.");
    writeState(root, { ...state, told: true });
  }
  return lines.join("\n");
}

/**
 * Start a check in a process this one does not wait for.
 *
 * Firing the request here and not awaiting it is not enough: a pending fetch
 * keeps the event loop alive, so the command still paid for the round trip
 * before it could exit. Measured at 573 ms against 136 ms warm, which is a
 * courtesy charging half a second for itself.
 *
 * So the work happens in a detached child that is unref'd immediately. The
 * parent exits as though nothing had been asked, and whatever the child learns
 * is read by the next command from the file it writes.
 */
export function startRefresh(root, { pluginVersion = null } = {}) {
  if (!checkingEnabled(root)) return false;
  const state = readState(root);
  const age = state.checkedAt ? Date.now() - Date.parse(state.checkedAt) : Infinity;
  if (age < DAY_MS) return false;
  // Stamped before the child runs, so a machine with no network does not spawn
  // a process on every single command.
  writeState(root, { ...state, checkedAt: new Date().toISOString() });

  try {
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "--refresh", root, pluginVersion ?? ""],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the registry and the plugin marketplace what the latest versions are.
 *
 * Runs in the detached child, or directly when something wants to wait for it.
 * Every failure is swallowed: this is a courtesy, and a courtesy that
 * interrupts is worse than none.
 */
export async function refreshInBackground(root, { pluginVersion = null, force = false } = {}) {
  if (!checkingEnabled(root)) return null;
  const state = readState(root);
  const age = state.checkedAt ? Date.now() - Date.parse(state.checkedAt) : Infinity;
  if (!force && age < DAY_MS) return null;

  const me = self();
  const next = { ...state, checkedAt: new Date().toISOString() };
  if (pluginVersion) next.pluginCurrent = pluginVersion;

  const [cli, plugin] = await Promise.all([
    latestOnNpm(me.name),
    latestPluginVersion(),
  ]);
  if (cli) next.cli = cli;
  if (plugin) next.plugin = plugin;

  writeState(root, next);
  return next;
}

/** The newest published version of a package, or nothing. */
async function latestOnNpm(name) {
  return withTimeout(async (signal) => {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
      signal,
      headers: { accept: "application/vnd.npm.install-v1+json" },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.version === "string" ? body.version : null;
  });
}

/**
 * The plugin version the marketplace advertises.
 *
 * Read from the repository's own manifest over HTTPS rather than through git,
 * because a clone is far more work than reading one small file and this is only
 * ever a courtesy.
 */
async function latestPluginVersion() {
  return withTimeout(async (signal) => {
    const response = await fetch(
      "https://raw.githubusercontent.com/superdev-ai/superdev/main/.claude-plugin/plugin.json",
      { signal, headers: { accept: "application/json" } },
    );
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.version === "string" ? body.version : null;
  });
}

/** Three seconds, then give up. Nothing here is worth waiting longer for. */
async function withTimeout(work, ms = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ the child
//
// Run as `node version.mjs --refresh <root> [pluginVersion]` by startRefresh.
// Nothing else invokes this, and it writes one small file.
if (process.argv[2] === "--refresh") {
  const root = process.argv[3];
  const pluginVersion = process.argv[4] || null;
  if (root) {
    await refreshInBackground(root, { pluginVersion, force: true }).catch(() => {});
  }
}
