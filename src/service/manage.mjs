// Starting, stopping and finding the local service.
//
// The lock file is a real mutex: it is created with the exclusive `wx` flag
// before anything binds a port, so two launchers racing in the same directory
// cannot both win. A PID existence check is not a mutex, because process ids are
// reused and the process wearing one a minute later is somebody else's.
//
// Liveness is therefore never "is that pid alive". It is an HTTP GET of /health
// that has to echo back the same project root and the same instance token. A
// lock whose service does not answer that is stale by definition, so it is
// removed and the acquire is retried exactly once. Anything that answers on the
// port but is not this project's service is a state of its own, not an error to
// paper over.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { request } from "node:http";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { paths } from "../db/store.mjs";
import { DEFAULTS } from "./server.mjs";

const SERVER = join(dirname(fileURLToPath(import.meta.url)), "server.mjs");

/** Every runtime file is owner-only: a log can quote a project's own content. */
const PRIVATE = 0o600;

/** How long a launcher waits for the child to answer /health before giving up. */
const START_TIMEOUT_MS = 15_000;
/** How long a lock with no port yet is treated as a start in progress. */
const STARTING_GRACE_MS = 20_000;
const STOP_TIMEOUT_MS = 10_000;
const PROBE_TIMEOUT_MS = 1500;

export const E = {
  RUNNING: "E_SERVICE_RUNNING",
  FOREIGN: "E_FOREIGN_SERVICE",
  START_FAILED: "E_SERVICE_START_FAILED",
  STOP_FAILED: "E_SERVICE_STOP_FAILED",
};

export class ServiceError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

const lockPath = (root) => join(paths(root).runtime, "service.lock");
const logPath = (root) => join(paths(root).runtime, "service.log");

/** One file per project under the user's home, so listing crosses projects. */
const registryDir = () => join(homedir(), ".superdev", "services");
const registryPath = (root) =>
  join(registryDir(), `${createHash("sha256").update(root).digest("hex").slice(0, 16)}.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Write through a temporary file so a reader never sees a half-written record. */
function writeAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: PRIVATE });
  renameSync(tmp, file);
}

const remove = (file) => {
  try {
    unlinkSync(file);
  } catch {
    // Already gone, which is the state the caller wanted.
  }
};

// ------------------------------------------------------------------ liveness

/**
 * Ask the service on a port who it is. Returns the health body, or null when
 * nothing answers, the answer is not JSON, or it takes too long.
 */
export function probeHealth(host, port, timeout = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = request(
      { host, port, path: "/health", method: "GET", timeout, headers: { accept: "application/json" } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
          // A health body is tiny. Anything larger is not this service.
          if (body.length > 8192) req.destroy();
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}

/**
 * What is actually true for this project right now. Distinguishes a service we
 * manage from a stale lock, from a start in progress, from someone else holding
 * the port.
 */
export async function inspect(root, { port = null, host = DEFAULTS.host } = {}) {
  const lock = readJson(lockPath(root));

  if (!lock) {
    // No lock does not mean nothing is listening: another project's service, or
    // an unrelated program, may already hold the port we would ask for.
    const candidate = port ?? DEFAULTS.port;
    const health = await probeHealth(host, candidate);
    if (health && health.projectRoot === root) {
      return {
        state: "running",
        managed: false,
        lock: null,
        health,
        port: candidate,
        host,
        explanation: `A Superdev service for this project is answering on port ${candidate} but this directory has no lock file for it.`,
      };
    }
    if (health) {
      return {
        state: "foreign",
        managed: false,
        lock: null,
        health,
        port: candidate,
        host,
        explanation: `Port ${candidate} is held by a Superdev service for a different project. Start this one on another port.`,
      };
    }
    return {
      state: "stopped",
      managed: false,
      lock: null,
      health: null,
      port: null,
      host,
      explanation: "No service is running for this project.",
    };
  }

  if (!lock.port) {
    const age = Date.now() - Date.parse(lock.startedAt ?? "");
    const starting = Number.isFinite(age) && age < STARTING_GRACE_MS;
    return {
      state: starting ? "starting" : "stale",
      managed: true,
      lock,
      health: null,
      port: null,
      host: lock.host ?? host,
      explanation: starting
        ? "A service for this project is starting."
        : "A lock file is left over from a service that never finished starting. Run `superdev stop` to clear it.",
    };
  }

  const health = await probeHealth(lock.host ?? host, lock.port);
  if (!health) {
    return {
      state: "stale",
      managed: true,
      lock,
      health: null,
      port: lock.port,
      host: lock.host ?? host,
      explanation: `The lock file names a service on port ${lock.port} that is not answering. It is stale and will be cleared on the next start.`,
    };
  }
  if (health.projectRoot !== root || health.instanceToken !== lock.instanceToken) {
    return {
      state: "foreign",
      managed: false,
      lock,
      health,
      port: lock.port,
      host: lock.host ?? host,
      explanation: `Port ${lock.port} is answering, but it is not the service this lock file describes. Something else took the port.`,
    };
  }
  return {
    state: "running",
    managed: true,
    lock,
    health,
    port: lock.port,
    host: lock.host ?? host,
    explanation: `The service for this project is running on port ${lock.port}.`,
  };
}

const summarize = (root, view) => ({
  state: view.state,
  managed: view.managed,
  projectRoot: root,
  pid: view.lock?.pid ?? null,
  port: view.port,
  host: view.host,
  url: view.port ? `http://${view.host}:${view.port}` : null,
  instanceToken: view.health?.instanceToken ?? view.lock?.instanceToken ?? null,
  version: view.health?.version ?? view.lock?.version ?? null,
  startedAt: view.lock?.startedAt ?? null,
  logPath: logPath(root),
  explanation: view.explanation,
});

export async function serviceStatus(root, options = {}) {
  return summarize(root, await inspect(root, options));
}

// ------------------------------------------------------------------- the lock

/**
 * Take the mutex. `wx` fails rather than truncating when the file exists, which
 * is what makes this a lock instead of a race. On a collision the existing lock
 * is checked for liveness once; a dead one is removed and the acquire is retried
 * exactly once, so a permanently unwritable directory cannot spin.
 */
async function acquire(root, record, options) {
  mkdirSync(paths(root).runtime, { recursive: true });
  const file = lockPath(root);

  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = openSync(file, "wx", PRIVATE);
    } catch (err) {
      if (err.code !== "EEXIST" || attempt === 1) throw err;
      const view = await inspect(root, options);
      if (view.state === "running" || view.state === "starting") return { held: false, view };
      if (view.state === "foreign") return { held: false, view };
      remove(file);
      continue;
    }
    try {
      writeSync(fd, `${JSON.stringify(record, null, 2)}\n`);
    } finally {
      closeSync(fd);
    }
    return { held: true, view: null };
  }
  return { held: false, view: await inspect(root, options) };
}

/** Called by the service once it has bound, so the lock names a real port. */
export function publish(root, info) {
  writeAtomic(lockPath(root), { ...info, state: "running" });
  writeAtomic(registryPath(root), { ...info, state: "running" });
}

/** Called by the service on the way out. A crash is the only way to skip it. */
export function retract(root) {
  remove(lockPath(root));
  remove(registryPath(root));
}

// ------------------------------------------------------------------- control

/**
 * Start the service detached, with its output going to an owner-only log, and
 * wait until /health actually answers. A process that spawned but never bound is
 * a failure, not a success with a delay.
 */
export async function startService(root, options = {}) {
  const host = options.host ?? DEFAULTS.host;
  const port = options.port ?? DEFAULTS.port;
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULTS.idleTimeoutMs;
  const timeout = options.timeoutMs ?? START_TIMEOUT_MS;
  // Identity, not a credential. It answers one question: is the service now
  // answering on this port the one this manager started for this project, or
  // somebody else's process that took the port after ours died. `/health` hands
  // it to anyone who asks and the browser never sends it, so it must never be
  // treated as proof that a caller is allowed to do something. What actually
  // bounds access is the loopback bind, the Host check and the origin check.
  const instanceToken = createHash("sha256")
    .update(`${root}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 32);

  const existing = await inspect(root, { port, host });
  if (existing.state === "running") {
    return { ...summarize(root, existing), alreadyRunning: true };
  }
  if (existing.state === "starting") {
    return { ...summarize(root, existing), alreadyRunning: true };
  }

  const startedAt = new Date().toISOString();
  const { held, view } = await acquire(
    root,
    { projectRoot: root, instanceToken, startedAt, pid: null, port: null, host, state: "starting" },
    { port, host },
  );
  if (!held) {
    if (view.state === "foreign") {
      throw new ServiceError(E.FOREIGN, view.explanation, { port: view.port });
    }
    return { ...summarize(root, view), alreadyRunning: true };
  }

  const log = logPath(root);
  const fd = openSync(log, "a", PRIVATE);
  // A log created under an older umask could be group readable, and it can quote
  // the project's own content, so the mode is asserted rather than assumed.
  chmodSync(log, PRIVATE);

  let child;
  try {
    child = spawn(
      process.execPath,
      [
        SERVER,
        "--root", root,
        "--port", String(port),
        "--host", host,
        "--idle-timeout", String(idleTimeoutMs),
      ],
      {
        cwd: root,
        detached: true,
        stdio: ["ignore", fd, fd],
        env: { ...process.env, SUPERDEV_INSTANCE_TOKEN: instanceToken },
      },
    );
  } catch (err) {
    closeSync(fd);
    remove(lockPath(root));
    throw new ServiceError(E.START_FAILED, `The service could not be started: ${err.message}`);
  }
  closeSync(fd);
  child.unref();

  let exited = null;
  child.once("exit", (code, signal) => {
    exited = { code, signal };
  });

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const lock = readJson(lockPath(root));
    if (lock?.port) {
      const health = await probeHealth(lock.host ?? host, lock.port);
      if (health?.projectRoot === root && health.instanceToken === instanceToken) {
        return { ...summarize(root, await inspect(root, { port, host })), alreadyRunning: false };
      }
    }
    if (exited) break;
    await sleep(120);
  }

  try {
    process.kill(child.pid, "SIGTERM");
  } catch {
    // It is already gone, which is what the failure path wants anyway.
  }
  remove(lockPath(root));
  remove(registryPath(root));
  throw new ServiceError(
    E.START_FAILED,
    exited
      ? `The service exited immediately (${exited.signal ?? `code ${exited.code}`}). The reason is at the end of ${log}.`
      : `The service did not answer /health within ${Math.round(timeout / 1000)} seconds. Check ${log}.`,
    { log, tail: tailOf(log) },
  );
}

/** The last few lines of the log, which is where the reason for a failure is. */
function tailOf(file, lines = 12) {
  try {
    return readFileSync(file, "utf8").trimEnd().split("\n").slice(-lines).join("\n");
  } catch {
    return null;
  }
}

/**
 * Stop the service. The pid is only ever signalled after /health has just
 * confirmed that this pid's service is ours, so the pid-reuse hazard is closed
 * by the check rather than by hoping.
 */
export async function stopService(root, options = {}) {
  const view = await inspect(root, options);

  if (view.state === "stopped") {
    return { ...summarize(root, view), alreadyStopped: true };
  }
  if (view.state === "stale" || view.state === "starting") {
    remove(lockPath(root));
    remove(registryPath(root));
    return {
      ...summarize(root, view),
      state: "stopped",
      clearedStaleLock: true,
      explanation: "There was no live service, so the leftover lock file was cleared.",
    };
  }
  if (view.state === "foreign") {
    throw new ServiceError(E.FOREIGN, view.explanation, { port: view.port });
  }

  const pid = view.lock?.pid;
  if (!pid) {
    throw new ServiceError(
      E.STOP_FAILED,
      `The service on port ${view.port} is answering but its lock file records no process id, so it cannot be stopped from here. Stop it in the terminal that started it.`,
    );
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    if (err.code !== "ESRCH") throw err;
  }

  const deadline = Date.now() + (options.timeoutMs ?? STOP_TIMEOUT_MS);
  while (Date.now() < deadline) {
    if (!(await probeHealth(view.host, view.port))) {
      remove(lockPath(root));
      remove(registryPath(root));
      return {
        ...summarize(root, view),
        state: "stopped",
        explanation: `The service on port ${view.port} was stopped.`,
      };
    }
    await sleep(120);
  }

  throw new ServiceError(
    E.STOP_FAILED,
    `The service on port ${view.port} is still answering after a shutdown request. Stop process ${pid} directly, then run this again.`,
    { pid, port: view.port },
  );
}

export async function restartService(root, options = {}) {
  await stopService(root, options).catch((err) => {
    if (err.code !== E.FOREIGN) throw err;
    return null;
  });
  return startService(root, options);
}

/**
 * Every service this machine knows about. The registry is written on start and
 * removed on a clean stop, so a crashed process leaves an entry behind; each one
 * is probed and the dead entries are cleared as a side effect of listing.
 */
export async function listServices() {
  const dir = registryDir();
  if (!existsSync(dir)) return [];

  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const file = join(dir, name);
    const record = readJson(file);
    if (!record?.projectRoot) {
      remove(file);
      continue;
    }
    const health = await probeHealth(record.host ?? DEFAULTS.host, record.port);
    const live = health?.projectRoot === record.projectRoot && health.instanceToken === record.instanceToken;
    if (!live) {
      remove(file);
      continue;
    }
    out.push({
      state: "running",
      projectRoot: record.projectRoot,
      pid: record.pid ?? null,
      port: record.port,
      host: record.host ?? DEFAULTS.host,
      url: `http://${record.host ?? DEFAULTS.host}:${record.port}`,
      instanceToken: record.instanceToken,
      version: health.version ?? record.version ?? null,
      startedAt: record.startedAt ?? null,
      logPath: logPath(record.projectRoot),
    });
  }
  return out.sort((a, b) => a.projectRoot.localeCompare(b.projectRoot));
}

/**
 * Refuse work that would move the database underneath a running service. The
 * service holds no connection open, but a migration or a restore swaps the file
 * a live reader is about to open, and a half-answered interface is worse than a
 * clear refusal.
 */
export async function assertNoLiveService(root, options = {}) {
  const view = await inspect(root, options);
  if (view.state === "running" || view.state === "starting") {
    throw new ServiceError(
      E.RUNNING,
      `The Superdev service for this project is ${view.state === "starting" ? "starting" : `running on port ${view.port}`}. Stop it with \`superdev stop\` before changing the database, then start it again.`,
      { port: view.port, pid: view.lock?.pid ?? null },
    );
  }
  return true;
}
