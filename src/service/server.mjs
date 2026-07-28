// The local HTTP service. Brief section 14.2, routes fixed by MODULE_CONTRACT.md.
//
// One Node process per project, bound to the loopback interface, serving the
// compiled control center and the read and mutation API that backs it. No
// external network is involved at any point.
//
// Change detection polls `max(sequence)` from activity_events on a fresh
// readonly connection about once a second. Two cheaper approaches do not work on
// this engine and were measured, not assumed: `PRAGMA data_version` is absent,
// and watching the database file misses commits because they land in the
// write-ahead log first. A poll on a fresh connection is the only signal that is
// actually correct, and it costs about 0.3 ms.

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { query } from "../db/store.mjs";
import * as readModel from "./read-model.mjs";
import { applyMutation, ALLOWED_ACTIONS } from "./mutations.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(HERE, "assets", "control-center.html");
const DATA_PLACEHOLDER = "/*__SUPERDEV_DATA__*/null";

export const DEFAULTS = {
  host: "127.0.0.1",
  port: 4317,
  /** How many ports above the requested one to try before giving up. */
  portScan: 20,
  /** Largest mutation body accepted, in bytes. */
  bodyLimit: 1024 * 1024,
  /** How often the change poller asks the database for its latest sequence. */
  pollMs: 1000,
  heartbeatMs: 15_000,
  /** Change events kept for a reconnecting client. Older than this is a resync. */
  replayBuffer: 256,
  /** No request and no events client for this long shuts the service down. */
  idleTimeoutMs: 30 * 60 * 1000,
  idleCheckMs: 30_000,
};

/**
 * Consecutive change-poll failures before the stream admits it has gone blind.
 *
 * One failure is another process mid-commit and means nothing. Five in a row,
 * at one second apart, is a fault that is not clearing, and by then a quiet
 * stream is indistinguishable from a quiet project.
 */
const DEGRADE_AFTER = 5;

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(HERE, "..", "..", "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

// ------------------------------------------------------------------- helpers

// `<` and `>` would let a value close the script element early, and U+2028 and
// U+2029 are line terminators in JavaScript but ordinary characters in JSON.
const SCRIPT_UNSAFE = {
  "<": "\\u003c",
  ">": "\\u003e",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** Make a JSON string safe to place inside a script element. */
export const escapeForScript = (jsonText) =>
  jsonText.replace(/[<>\u2028\u2029]/g, (c) => SCRIPT_UNSAFE[c]);

const NO_STORE = { "cache-control": "no-store" };

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    ...NO_STORE,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
}

function sendHtml(res, status, html, headOnly = false) {
  res.writeHead(status, {
    ...NO_STORE,
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(html),
  });
  // A HEAD reply carries the headers and no body, including the length the
  // body would have had.
  res.end(headOnly ? undefined : html);
}

/**
 * Turn any thrown value into the error envelope the interface knows how to
 * render: a stable code and a sentence that says what to do next.
 */
function errorBody(err) {
  const code = typeof err?.code === "string" && err.code.startsWith("E_") ? err.code : "E_INTERNAL";
  // An error with no stable code is a defect, not a refusal. The response says
  // so in one sentence; the stack belongs in the log, which is what the log is
  // for and the only place anyone can find it afterwards.
  if (code === "E_INTERNAL") process.stderr.write(`${err?.stack ?? err}\n`);
  const status = {
    E_NOT_FOUND: 404,
    E_UNKNOWN_ACTION: 400,
    E_INVALID_PAYLOAD: 400,
    E_INVALID_TRANSITION: 409,
    E_VERSION_CONFLICT: 409,
    E_ALREADY_CLAIMED: 409,
    E_NOT_CLAIMED: 409,
    E_OPEN_SUBTASKS: 409,
    E_EVIDENCE_MISSING: 409,
    E_EVIDENCE_FAILING: 409,
    E_ACCEPTANCE_UNMET: 409,
    E_TASK_WITHOUT_CONTRACT: 409,
    E_ENABLING_WITHOUT_TARGET: 409,
    E_APPEND_ONLY: 409,
    E_REASON_REQUIRED: 400,
    E_UNKNOWN_TARGET: 400,
    E_STATUS_VIA_TRANSITION: 400,
    E_STYLE_EM_DASH: 400,
    E_STYLE_EMOJI: 400,
    E_SECRET_SHAPED: 400,
    E_ABSOLUTE_HOME_PATH: 400,
    E_MODEL_REASONING_FIELD: 400,
    E_DB_LOCKED: 503,
    E_INTERNAL: 500,
    // A module error carrying a stable code is a refusal the caller can act on,
    // never a crash, so an unlisted one is a conflict rather than a 500.
  }[code] ?? 409;
  return {
    status,
    body: {
      code,
      message:
        code === "E_INTERNAL"
          ? "The service hit an unexpected problem handling that request. Check the service log, then try again."
          : String(err.message ?? code),
      ...(err?.detail !== undefined ? { details: err.detail } : null),
    },
  };
}

/**
 * A request is same origin when it declares no origin (a direct fetch from the
 * page or a command line client) or declares one of the addresses this service
 * is actually reachable on. Anything else is another site trying to drive the
 * local service through the browser.
 */
const LOOPBACK = ["127.0.0.1", "localhost", "[::1]", "::1"];

function sameOrigin(req, port) {
  const origin = req.headers.origin;
  if (!origin) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return LOOPBACK.includes(url.hostname) && url.port === String(port);
}

/**
 * Whether the request addressed this service by a loopback name.
 *
 * This is the DNS rebinding defence, and it is the reason the origin check is
 * not enough on its own. A page on another site can point a hostname it owns at
 * 127.0.0.1, and once it resolves there the browser treats the service as that
 * site's own origin: it will send no `Origin` header at all on a plain read, so
 * `sameOrigin` returns true and the project database answers a stranger. What
 * the attacker cannot forge is `Host`, which still carries the name they used.
 * A service bound to loopback is only ever legitimately addressed as loopback.
 */
function addressedAsLoopback(req) {
  const header = req.headers.host;
  // No Host at all is HTTP/1.0 or a handmade request, never a browser.
  if (!header) return true;
  const hostname = header.startsWith("[")
    ? header.slice(0, header.indexOf("]") + 1)
    : header.split(":")[0];
  return LOOPBACK.includes(hostname);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        // Stop reading rather than tearing the socket down, so the refusal has
        // a chance to reach the caller instead of arriving as a reset.
        req.pause();
        const err = new Error(
          `The request body is larger than ${Math.round(limit / 1024)} KB, which this service refuses. Send a smaller change.`,
        );
        err.code = "E_PAYLOAD_TOO_LARGE";
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

const FALLBACK_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Superdev</title>
<style>
 :root { color-scheme: light dark; }
 body { font: 16px/1.6 system-ui, sans-serif; margin: 0 auto; max-width: 42rem; padding: 3rem 1.5rem; }
 code { background: rgba(127,127,127,.18); border-radius: .25rem; padding: .1em .35em; }
 h1 { font-size: 1.4rem; }
</style>
</head>
<body>
<h1>The Superdev control center has not been built yet</h1>
<p>The service is running and the API is answering. The compiled interface is not
in this installation, so there is nothing to show here yet.</p>
<p>Build it from the repository root:</p>
<p><code>npm run ui:build</code></p>
<p>Then reload this page. The API is available meanwhile at
<code>/api/overview</code>, and <code>/health</code> reports which project this
service is pointed at.</p>
</body>
</html>
`;

// ---------------------------------------------------------------- the service

/**
 * Start the service for one project.
 *
 * Returns the port it actually bound (which may not be the one requested) and a
 * `close` that shuts the listener, the timers and every open events client down.
 */
export async function serve(root, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const instanceToken = options.instanceToken ?? randomUUID();

  const clients = new Set();
  /** Recent change events, newest last, for a client that reconnects. */
  const replay = [];
  let lastSequence = 0;
  let lastRequestAt = Date.now();
  let closing = false;
  /** Mutations running right now, so the change poller can stand out of the way. */
  let writesInFlight = 0;
  /** Consecutive change-poll failures, and whether clients have been told. */
  let pollFailures = 0;
  let degraded = false;

  const server = createServer((req, res) => {
    lastRequestAt = Date.now();
    handle(req, res).catch((err) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      const { status, body } = errorBody(err);
      sendJson(res, status, body);
    });
  });

  async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Ahead of every route, including the reads and the stream. The write path
    // guarded itself and the read path did not, which made the whole project
    // database readable by any page that could rebind a name to this port. A
    // read surface that leaks the project is not a smaller problem than a write
    // surface that changes it.
    if (settings.host === "127.0.0.1" && !addressedAsLoopback(req)) {
      return sendJson(res, 403, {
        code: "E_FOREIGN_HOST",
        message:
          "That request reached this service under a name that is not loopback. The Superdev service answers only to 127.0.0.1 and localhost on this machine.",
      });
    }

    if (path === "/health") {
      return sendJson(res, 200, { ok: true, projectRoot: root, instanceToken, version: VERSION });
    }

    // Reads and the stream carry project content, so they answer the same
    // question the write path asks: did this come from our own page.
    if (path.startsWith("/api/") && !sameOrigin(req, boundPort)) {
      return sendJson(res, 403, {
        code: "E_CROSS_ORIGIN",
        message:
          "That request came from another origin. The Superdev service only answers its own page on this machine.",
      });
    }

    if (path === "/api/events") {
      if (req.method !== "GET") return sendJson(res, 405, methodNotAllowed("GET"));
      return openEventStream(req, res, url);
    }

    if (path === "/api/mutations") {
      if (req.method !== "POST") return sendJson(res, 405, methodNotAllowed("POST"));
      return handleMutation(req, res);
    }

    if (path.startsWith("/api/")) {
      if (req.method !== "GET") return sendJson(res, 405, methodNotAllowed("GET"));
      return handleRead(req, res, url, path);
    }

    // HEAD is how a person or a script checks the service is serving the
  // interface at all. Answering 404 to it says the page does not exist.
  if (path === "/" && (req.method === "GET" || req.method === "HEAD")) {
    return sendPage(res, req.method === "HEAD");
  }

    return sendJson(res, 404, {
      code: "E_NOT_FOUND",
      message: `${req.method} ${path} is not part of this service. The routes are /health, /api/events, /api/mutations and the /api read routes.`,
    });
  }

  const methodNotAllowed = (allowed) => ({
    code: "E_METHOD_NOT_ALLOWED",
    message: `That route only answers ${allowed}.`,
  });

  // ------------------------------------------------------------------- reads

  async function handleRead(req, res, url, path) {
    const builder = readModel.routes[path];
    if (builder) return sendJson(res, 200, await builder(root));

    const featureMatch = /^\/api\/features\/([^/]+)$/.exec(path);
    if (featureMatch) {
      return sendJson(res, 200, await readModel.feature(root, decodeURIComponent(featureMatch[1])));
    }

    if (path === "/api/activity") {
      const numeric = (name) => {
        const raw = url.searchParams.get(name);
        if (raw === null) return undefined;
        const value = Number(raw);
        return Number.isFinite(value) ? value : undefined;
      };
      return sendJson(
        res,
        200,
        await readModel.activity(root, {
          before: numeric("before"),
          limit: numeric("limit"),
          search: url.searchParams.get("search") ?? undefined,
        }),
      );
    }

    return sendJson(res, 404, {
      code: "E_NOT_FOUND",
      message: `${path} is not one of this service's read routes.`,
    });
  }

  // --------------------------------------------------------------- mutations

  async function handleMutation(req, res) {
    if (!sameOrigin(req, boundPort)) {
      return sendJson(res, 403, {
        code: "E_CROSS_ORIGIN",
        message:
          "That request came from another origin. The Superdev service only accepts changes from its own page on this machine.",
      });
    }
    const type = String(req.headers["content-type"] ?? "");
    if (!type.startsWith("application/json")) {
      return sendJson(res, 415, {
        code: "E_UNSUPPORTED_MEDIA_TYPE",
        message: "A mutation has to be sent as application/json.",
      });
    }

    let raw;
    try {
      raw = await readBody(req, settings.bodyLimit);
    } catch (err) {
      const oversized = err.code === "E_PAYLOAD_TOO_LARGE";
      if (oversized) res.setHeader("connection", "close");
      sendJson(res, oversized ? 413 : 400, {
        code: err.code ?? "E_BAD_REQUEST",
        message: String(err.message),
      });
      if (oversized) req.destroy();
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, {
        code: "E_INVALID_PAYLOAD",
        message: "The request body was not valid JSON.",
      });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return sendJson(res, 400, {
        code: "E_INVALID_PAYLOAD",
        message: `A mutation is an object with an action and a payload. Accepted actions: ${ALLOWED_ACTIONS.join(", ")}.`,
      });
    }

    let data;
    try {
      data = await runMutation(parsed.action, parsed.payload);
    } catch (err) {
      const { status, body } = errorBody(err);
      return sendJson(res, status, body);
    }

    const revision = (await query(root, (db) => db.value("SELECT max(sequence) FROM activity_events"))) ?? 0;
    return sendJson(res, 200, {
      data,
      meta: {
        revision,
        lastEventSequence: revision,
        generatedAt: new Date().toISOString(),
        stale: false,
      },
    });
  }

  /**
   * The engine refuses to open a write connection while this same process still
   * holds a readonly one, and it reports that as "Resource is read-only" rather
   * than as a lock, so the retry in connect.mjs does not cover it. This service
   * is the one place that reads and writes from a single process, so it owns the
   * problem: the poller stands down while a mutation runs, and a mutation that
   * still lands on top of an in-flight read backs off and tries again. Retrying
   * is safe because the refusal arrives on BEGIN IMMEDIATE, before any statement.
   */
  async function runMutation(action, payload) {
    writesInFlight += 1;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await applyMutation(root, action, payload);
        } catch (err) {
          if (attempt >= 5 || !/read[- ]?only/i.test(String(err?.message ?? ""))) throw err;
          await new Promise((r) => setTimeout(r, 12 * (attempt + 1)));
        }
      }
    } finally {
      writesInFlight -= 1;
    }
  }

  // ------------------------------------------------------------------ events

  function write(client, text) {
    if (client.res.writableEnded) return;
    client.res.write(text);
  }

  function openEventStream(req, res, url) {
    res.writeHead(200, {
      ...NO_STORE,
      "content-type": "text/event-stream; charset=utf-8",
      connection: "keep-alive",
      // Proxies that buffer would defeat the whole point of the stream.
      "x-accel-buffering": "no",
    });
    // A reverse proxy or an idle-socket timeout would otherwise cut a stream
    // that is deliberately quiet between commits.
    res.socket?.setNoDelay(true);
    res.socket?.setTimeout(0);

    const client = { res };
    clients.add(client);

    const header = req.headers["last-event-id"];
    const fromQuery = url.searchParams.get("lastEventId");
    const resumeFrom = Number(header ?? fromQuery ?? 0);
    const resume = Number.isFinite(resumeFrom) && resumeFrom > 0 ? Math.floor(resumeFrom) : 0;

    write(client, `event: hello\ndata: ${JSON.stringify({ sequence: lastSequence })}\n\n`);

    // Arriving into a stream that is already blind. Saying hello and nothing
    // else would let this client draw the same wrong conclusion as the ones
    // that were here when it broke.
    if (degraded) {
      write(
        client,
        `event: degraded\ndata: ${JSON.stringify({
          sequence: lastSequence,
          reason: "the change poller is not reaching the project database",
        })}\n\n`,
      );
    }

    if (resume > 0 && resume < lastSequence) {
      const oldest = replay.length ? replay[0].sequence : lastSequence + 1;
      if (resume + 1 < oldest) {
        // Their position fell out of the buffer, so an incremental catch-up
        // would silently skip changes. Ask for a full reload instead.
        write(client, `event: resync\ndata: ${JSON.stringify({ sequence: lastSequence })}\n\n`);
      } else {
        for (const event of replay) {
          if (event.sequence > resume) write(client, frame(event));
        }
      }
    }

    const done = () => clients.delete(client);
    req.on("close", done);
    req.on("error", done);
    res.on("close", done);
  }

  const frame = (event) =>
    `id: ${event.sequence}\nevent: change\ndata: ${JSON.stringify(event)}\n\n`;

  function broadcast(event) {
    replay.push(event);
    if (replay.length > settings.replayBuffer) replay.splice(0, replay.length - settings.replayBuffer);
    broadcastRaw(frame(event));
  }

  /** For frames that are about the stream itself rather than a recorded change. */
  function broadcastRaw(text) {
    for (const client of clients) write(client, text);
  }

  /**
   * Announce only what actually moved. Emitting on every poll would make the
   * interface refetch once a second forever, which is exactly the busy-work
   * this stream exists to avoid.
   */
  async function poll() {
    if (closing || writesInFlight) return;
    let rows;
    try {
      rows = await query(root, async (db) => {
        const latest = (await db.value("SELECT max(sequence) FROM activity_events")) ?? 0;
        if (latest <= lastSequence) return null;
        return db.all(
          `SELECT sequence, event_type, task_id, feature_id, summary
             FROM activity_events WHERE sequence > ? ORDER BY sequence LIMIT ?`,
          lastSequence,
          settings.replayBuffer,
        );
      });
    } catch (error) {
      // A locked or half-written database is a transient state during another
      // process's commit, and the next tick sees the committed result. A fault
      // that keeps returning is not that. Swallowing it forever left the socket
      // open and the interface calling itself live while it had gone blind, so
      // after enough consecutive failures the stream says so.
      pollFailures += 1;
      if (pollFailures === DEGRADE_AFTER) {
        degraded = true;
        broadcastRaw(
          `event: degraded\ndata: ${JSON.stringify({
            sequence: lastSequence,
            reason: String(error?.message ?? error).slice(0, 200),
          })}\n\n`,
        );
      }
      return;
    }
    if (pollFailures > 0) {
      pollFailures = 0;
      if (degraded) {
        degraded = false;
        broadcastRaw(`event: recovered\ndata: ${JSON.stringify({ sequence: lastSequence })}\n\n`);
      }
    }
    if (!rows?.length) return;
    for (const row of rows) {
      lastSequence = row.sequence;
      broadcast({
        sequence: row.sequence,
        eventType: row.event_type,
        summary: row.summary,
        taskId: row.task_id,
        featureId: row.feature_id,
        scopes: scopesFor(row.event_type),
      });
    }
  }

  // ------------------------------------------------------------------- pages

  async function sendPage(res, headOnly = false) {
    if (!existsSync(BUNDLE)) return sendHtml(res, 200, FALLBACK_PAGE, headOnly);
    let html = readFileSync(BUNDLE, "utf8");
    let bootstrap = "null";
    try {
      // The first paint has real data rather than a spinner. A failure here is
      // never fatal: the page fetches the same route on mount anyway.
      bootstrap = escapeForScript(JSON.stringify(await readModel.overview(root)));
    } catch {
      bootstrap = "null";
    }
    if (html.includes(DATA_PLACEHOLDER)) html = html.replace(DATA_PLACEHOLDER, bootstrap);
    return sendHtml(res, 200, html, headOnly);
  }

  // ------------------------------------------------------------------ timers

  const boundPort = await listen(server, settings.host, settings.port, settings.portScan);

  lastSequence =
    (await query(root, (db) => db.value("SELECT max(sequence) FROM activity_events")).catch(() => 0)) ?? 0;

  const pollTimer = setInterval(() => {
    poll().catch(() => {});
  }, settings.pollMs);
  pollTimer.unref();

  const heartbeat = setInterval(() => {
    for (const client of clients) write(client, `: keepalive ${Date.now()}\n\n`);
  }, settings.heartbeatMs);
  heartbeat.unref();

  let idleTimer = null;
  if (settings.idleTimeoutMs > 0) {
    // A short idle window has to be checked more often than the default, or the
    // configured timeout would silently round up to the check interval.
    const idleCheck = Math.max(1000, Math.min(settings.idleCheckMs, Math.floor(settings.idleTimeoutMs / 4)));
    idleTimer = setInterval(() => {
      // Idle means nobody asked for anything and nobody is listening. A tab
      // holding the events stream open counts as someone using the service.
      if (clients.size) return;
      if (Date.now() - lastRequestAt < settings.idleTimeoutMs) return;
      close().catch(() => {});
    }, idleCheck);
    idleTimer.unref();
  }

  async function close() {
    if (closing) return;
    closing = true;
    clearInterval(pollTimer);
    clearInterval(heartbeat);
    if (idleTimer) clearInterval(idleTimer);
    for (const client of clients) {
      try {
        client.res.end();
      } catch {
        // The socket is already gone, which is the state we wanted anyway.
      }
    }
    clients.clear();
    await new Promise((resolve) => server.close(resolve));
    if (typeof settings.onClose === "function") settings.onClose();
  }

  return {
    port: boundPort,
    host: settings.host,
    url: `http://${settings.host}:${boundPort}`,
    instanceToken,
    version: VERSION,
    projectRoot: root,
    close,
  };
}

/** Which views a change touches, so a listener refetches only what it shows. */
function scopesFor(eventType) {
  const type = String(eventType ?? "");
  if (type.startsWith("task_")) return ["overview", "tasks", "activity", "product"];
  if (type.startsWith("session_")) return ["overview", "team", "activity"];
  if (type.startsWith("decision_")) return ["decisions", "activity", "readiness"];
  if (type.startsWith("documentation_")) return ["readiness", "activity"];
  if (type === "scope_changed") return ["discovery", "product", "overview", "activity"];
  if (type === "verification_attached") return ["tasks", "features", "readiness", "activity"];
  return ["overview", "activity", "product", "readiness"];
}

/**
 * Bind the requested port, then scan upward. Another project's service on the
 * default port is the ordinary case, not an error, so the second one moves up
 * rather than refusing to start.
 */
function listen(server, host, port, scan) {
  return new Promise((resolve, reject) => {
    let candidate = port;
    let attempts = 0;

    const onError = (err) => {
      if (err.code !== "EADDRINUSE" || attempts >= scan) {
        server.removeListener("error", onError);
        reject(
          err.code === "EADDRINUSE"
            ? Object.assign(
                new Error(
                  `Ports ${port} to ${port + scan} are all in use on ${host}. Stop another service or start this one with an explicit port.`,
                ),
                { code: "E_NO_FREE_PORT" },
              )
            : err,
        );
        return;
      }
      attempts += 1;
      candidate += 1;
      server.listen(candidate, host);
    };

    server.on("error", onError);
    server.once("listening", () => {
      server.removeListener("error", onError);
      resolve(server.address().port);
    });
    server.listen(candidate, host);
  });
}

// --------------------------------------------------------------- entry point

/**
 * Started detached by manage.mjs. It writes the lock file with the port it
 * actually bound so the launcher, and later `superdev services`, can find it,
 * and removes the lock on the way out so a crash is the only way to leave one
 * behind.
 */
async function main(argv) {
  const arg = (name, fallback = null) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const root = arg("root", process.cwd());
  const port = Number(arg("port", DEFAULTS.port));
  const host = arg("host", DEFAULTS.host);
  const idle = Number(arg("idle-timeout", DEFAULTS.idleTimeoutMs));

  const { publish, retract } = await import("./manage.mjs");
  const service = await serve(root, {
    port: Number.isFinite(port) ? port : DEFAULTS.port,
    host,
    idleTimeoutMs: Number.isFinite(idle) ? idle : DEFAULTS.idleTimeoutMs,
    instanceToken: process.env.SUPERDEV_INSTANCE_TOKEN || undefined,
    onClose: () => retract(root),
  });

  publish(root, {
    pid: process.pid,
    port: service.port,
    host: service.host,
    projectRoot: root,
    instanceToken: service.instanceToken,
    version: service.version,
    startedAt: new Date().toISOString(),
  });

  const shutdown = () => {
    service.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.stdout.write(`superdev service listening on ${service.url} for ${root}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err?.message ?? err}\n`);
    process.exit(1);
  });
}
