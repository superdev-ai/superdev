// What the repository already answers, before anybody is asked anything.
//
// Discovery runs in one direction: read the evidence first, then ask only what
// the evidence cannot settle. A question whose answer is already sitting in
// package.json is not a question, it is an interrogation, and it is the fastest
// way to teach someone that this tool does not read.
//
// Every finding carries the path it came from and an epistemic label, because
// "the project uses Postgres" and "the project probably uses Postgres" lead to
// different specifications and the difference must survive being written down.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { create, mutate, recordActivity } from "../db/store.mjs";
import { looksSecret, redactSecrets, sanitizeExternal } from "../model/screening.mjs";
import { CAPABILITY_AREAS, count } from "../model/vocabulary.mjs";

/**
 * Capability-area names, referenced by key so a typo is a crash at import time
 * rather than a row that silently never matches its seeded area.
 */
export const AREA = {
  purpose: "Product purpose and success criteria",
  users: "Users, roles, permissions and tenancy",
  frontend: "Frontend delivery shape",
  navigation: "Navigation and information architecture",
  design: "Design system and accessibility",
  backend: "Backend boundaries and service responsibilities",
  api: "API style and public contracts",
  auth: "Authentication and session lifecycle",
  authz: "Authorization enforcement",
  database: "Database and data ownership",
  migrations: "Data migrations and rollback",
  storage: "File or object storage",
  search: "Search and indexing",
  realtime: "Real-time behavior",
  offline: "Offline behavior and conflict handling",
  jobs: "Background jobs and scheduling",
  events: "Events and webhooks",
  integrations: "External integrations",
  notifications: "Notifications",
  rateLimit: "Rate limiting and abuse controls",
  security: "Security and privacy",
  compliance: "Compliance",
  observability: "Observability and operational response",
  performance: "Performance and capacity targets",
  environments: "Environments and secret management",
  ci: "Continuous integration and delivery",
  infrastructure: "Infrastructure and deployment",
  backups: "Backups, recovery, retention and deletion",
  analytics: "Product analytics",
  testing: "Testing strategy for the product",
  release: "Release and rollback",
};

for (const value of Object.values(AREA)) {
  if (!CAPABILITY_AREAS.includes(value)) {
    throw new Error(`capability area drifted from the vocabulary: ${value}`);
  }
}

// ------------------------------------------------------------ repository scan

// Directories whose contents describe somebody else's project, not this one.
const SKIP_DIRS = new Set([
  ".git", ".hg", ".svn", "node_modules", ".superdev", "dist", "build", "out",
  ".next", ".nuxt", ".output", ".svelte-kit", "target", "vendor", "coverage",
  ".venv", "venv", "__pycache__", ".turbo", ".cache", ".parcel-cache", "Pods",
  ".gradle", ".idea", ".vscode", ".pytest_cache", ".mypy_cache", "tmp",
]);

const MAX_DEPTH = 5;
const MAX_ENTRIES = 8000;

/**
 * Relative POSIX paths of everything worth looking at, bounded in both depth and
 * count. A monorepo can hold a million files; nothing here needs more than a
 * shape, and an unbounded walk would make `superdev init` feel broken.
 */
function scan(root) {
  const files = [];
  const dirs = [];
  let truncated = false;
  const queue = [{ dir: root, depth: 0 }];

  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (files.length + dirs.length >= MAX_ENTRIES) {
        truncated = true;
        return { files, dirs, truncated };
      }
      const full = join(dir, entry.name);
      const rel = relative(root, full).split("\\").join("/");
      // Symlinks are not followed: a link out of the tree is somebody else's
      // repository and a link back into it is an infinite walk.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        dirs.push(rel);
        if (depth < MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  }
  return { files, dirs, truncated };
}

// ------------------------------------------------------------------- signals

/** A manifest names the language and the dependency surface in one file. */
const MANIFESTS = [
  { file: "package.json", stack: "JavaScript or TypeScript" },
  { file: "pyproject.toml", stack: "Python" },
  { file: "requirements.txt", stack: "Python" },
  { file: "go.mod", stack: "Go" },
  { file: "Cargo.toml", stack: "Rust" },
  { file: "composer.json", stack: "PHP" },
  { file: "Gemfile", stack: "Ruby" },
  { file: "pom.xml", stack: "Java" },
  { file: "build.gradle", stack: "Java or Kotlin" },
  { file: "build.gradle.kts", stack: "Java or Kotlin" },
  { file: "Package.swift", stack: "Swift" },
  { file: "pubspec.yaml", stack: "Dart or Flutter" },
  { file: "mix.exs", stack: "Elixir" },
];

/**
 * Declared dependencies, matched by exact name. A dependency in a manifest is
 * a decision somebody already made, so the label is `confirmed` rather than a
 * guess about what the code does with it.
 */
const DEPENDENCY_SIGNALS = [
  { area: AREA.frontend, what: "a frontend framework is declared", names: ["react", "vue", "svelte", "preact", "solid-js", "@angular/core", "lit"] },
  { area: AREA.frontend, what: "an application framework is declared", names: ["next", "nuxt", "@remix-run/react", "@sveltejs/kit", "astro", "expo", "react-native"] },
  { area: AREA.navigation, what: "a router is declared", names: ["next", "nuxt", "@sveltejs/kit", "react-router", "react-router-dom", "vue-router", "@tanstack/react-router"] },
  { area: AREA.design, what: "a styling or component system is declared", names: ["tailwindcss", "@mui/material", "@chakra-ui/react", "bootstrap", "antd", "@radix-ui/react-dialog", "styled-components"] },
  { area: AREA.backend, what: "a server framework is declared", names: ["express", "fastify", "koa", "@nestjs/core", "hono", "hapi", "django", "flask", "fastapi", "rails"] },
  { area: AREA.api, what: "an API layer is declared", names: ["express", "fastify", "@nestjs/core", "hono", "graphql", "@apollo/server", "@trpc/server", "fastapi", "djangorestframework"] },
  { area: AREA.auth, what: "an authentication library is declared", names: ["next-auth", "@auth/core", "passport", "lucia", "@clerk/nextjs", "@supabase/supabase-js", "jsonwebtoken", "authlib"] },
  { area: AREA.database, what: "a database client or ORM is declared", names: ["prisma", "@prisma/client", "drizzle-orm", "typeorm", "sequelize", "mongoose", "knex", "pg", "mysql2", "better-sqlite3", "@tursodatabase/database", "sqlalchemy", "psycopg2", "psycopg2-binary"] },
  { area: AREA.migrations, what: "a migration tool is declared", names: ["prisma", "drizzle-kit", "alembic", "node-pg-migrate", "umzug", "flyway", "django"] },
  { area: AREA.storage, what: "an object storage client is declared", names: ["@aws-sdk/client-s3", "aws-sdk", "@google-cloud/storage", "minio", "multer", "cloudinary", "boto3"] },
  { area: AREA.search, what: "a search engine client is declared", names: ["algoliasearch", "meilisearch", "typesense", "@elastic/elasticsearch", "opensearch-js"] },
  { area: AREA.realtime, what: "a realtime transport is declared", names: ["socket.io", "ws", "pusher", "ably", "@supabase/realtime-js", "partykit", "channels"] },
  { area: AREA.jobs, what: "a job or scheduling library is declared", names: ["bullmq", "bull", "agenda", "node-cron", "celery", "sidekiq", "inngest", "@upstash/qstash"] },
  { area: AREA.notifications, what: "a delivery client is declared", names: ["nodemailer", "resend", "@sendgrid/mail", "postmark", "twilio", "web-push", "expo-notifications"] },
  { area: AREA.observability, what: "a logging or telemetry library is declared", names: ["@sentry/node", "@sentry/react", "pino", "winston", "@opentelemetry/api", "prom-client", "structlog"] },
  { area: AREA.analytics, what: "a product analytics client is declared", names: ["posthog-js", "@amplitude/analytics-browser", "mixpanel-browser", "@vercel/analytics"] },
  { area: AREA.integrations, what: "an external service client is declared", names: ["stripe", "@stripe/stripe-js", "@octokit/rest", "openai", "@anthropic-ai/sdk", "twilio", "plaid"] },
  { area: AREA.rateLimit, what: "a rate limiting library is declared", names: ["express-rate-limit", "@upstash/ratelimit", "rate-limiter-flexible", "slowapi"] },
  { area: AREA.security, what: "a security library is declared", names: ["helmet", "bcrypt", "argon2", "jose", "csurf", "cryptography"] },
  { area: AREA.testing, what: "a test runner is declared", names: ["vitest", "jest", "mocha", "ava", "@playwright/test", "cypress", "pytest", "@testing-library/react"] },
];

const DEPENDENCY_INDEX = new Map();
for (const signal of DEPENDENCY_SIGNALS) {
  for (const name of signal.names) {
    if (!DEPENDENCY_INDEX.has(name)) DEPENDENCY_INDEX.set(name, []);
    DEPENDENCY_INDEX.get(name).push(signal);
  }
}

/**
 * Path shapes. `epistemic` is `confirmed` when the file's existence is itself
 * the answer (a workflow file is continuous integration), and `inferred` when
 * the shape only suggests the answer (a `routes/` folder is probably routing).
 */
const PATH_SIGNALS = [
  { test: /^\.github\/workflows\/[^/]+\.ya?ml$/, area: AREA.ci, what: "continuous integration workflows exist", epistemic: "confirmed" },
  { test: /^(\.gitlab-ci\.yml|Jenkinsfile|\.circleci\/config\.yml|azure-pipelines\.yml)$/, area: AREA.ci, what: "a continuous integration pipeline is configured", epistemic: "confirmed" },
  { test: /(^|\/)Dockerfile(\.[\w-]+)?$/, area: AREA.infrastructure, what: "the project builds a container image", epistemic: "confirmed" },
  { test: /(^|\/)docker-compose\.ya?ml$/, area: AREA.infrastructure, what: "a local multi-service topology is defined", epistemic: "confirmed" },
  { test: /^(fly\.toml|vercel\.json|netlify\.toml|render\.yaml|serverless\.yml|Procfile|app\.yaml)$/, area: AREA.infrastructure, what: "a deployment target is configured", epistemic: "confirmed" },
  { test: /\.tf$/, area: AREA.infrastructure, what: "infrastructure is declared as code", epistemic: "confirmed" },
  { test: /^\.env(\.[\w-]+)?$/, area: AREA.environments, what: "environment files are present (never opened by Superdev)", epistemic: "confirmed" },
  { test: /^\.envxrc$|\.gpg$/, area: AREA.environments, what: "secrets are managed with encrypted environment files", epistemic: "confirmed" },
  { test: /(^|\/)prisma\/schema\.prisma$/, area: AREA.database, what: "a declarative database schema exists", epistemic: "confirmed" },
  { test: /(^|\/)(migrations|migrate|alembic\/versions)\/[^/]+\.(sql|mjs|js|ts|py|rb)$/, area: AREA.migrations, what: "ordered migration files exist", epistemic: "confirmed" },
  { test: /(^|\/)[^/]+\.(test|spec)\.[cm]?[jt]sx?$/, area: AREA.testing, what: "test files exist beside the source", epistemic: "confirmed" },
  { test: /^(tests?|__tests__|e2e|spec)\//, area: AREA.testing, what: "a test suite directory exists", epistemic: "confirmed" },
  { test: /(^|\/)(openapi|swagger)\.(ya?ml|json)$/, area: AREA.api, what: "a published API contract exists", epistemic: "confirmed" },
  { test: /(^|\/)\.well-known\//, area: AREA.api, what: "well-known endpoints are served", epistemic: "inferred" },
  { test: /(^|\/)(schema\.sql|schema\.graphql)$/, area: AREA.database, what: "a schema file exists", epistemic: "confirmed" },
];

/** Directory shapes. Weaker evidence than a file, so labelled as inference. */
const DIR_SIGNALS = [
  { test: /(^|\/)(routes|pages|controllers|handlers|endpoints)$/, area: AREA.navigation, what: "a route or page directory exists", epistemic: "inferred" },
  { test: /(^|\/)(api|apis)$/, area: AREA.api, what: "an api directory exists", epistemic: "inferred" },
  { test: /(^|\/)(components|ui)$/, area: AREA.design, what: "a component directory exists", epistemic: "inferred" },
  { test: /(^|\/)(jobs|workers|tasks|cron)$/, area: AREA.jobs, what: "a background work directory exists", epistemic: "inferred" },
  { test: /(^|\/)(migrations|migrate)$/, area: AREA.migrations, what: "a migrations directory exists", epistemic: "inferred" },
];

/**
 * Files that describe the project to a reader or an agent. These are context,
 * not a capability answer, and they are the ones adoption must never rewrite.
 */
const CONTEXT_SIGNALS = [
  { test: /^README(\.md)?$/i, what: "a readme describes the project" },
  { test: /^(CLAUDE|AGENTS|GEMINI)\.md$/, what: "repository instructions for coding agents exist" },
  { test: /^\.github\/copilot-instructions\.md$/, what: "repository instructions for coding agents exist" },
  { test: /^\.cursor(rules|\/rules\/.+)$/, what: "repository instructions for coding agents exist" },
  { test: /^CONTRIBUTING\.md$/i, what: "a contribution guide exists" },
  { test: /^(docs|documentation)\//, what: "existing documentation is present" },
  { test: /^talks\//, what: "a Docs-profile documentation tree is present" },
  { test: /^(adr|decisions|docs\/adr|docs\/decisions)\//, what: "recorded decisions are present" },
  { test: /^LICENSE(\.[\w-]+)?$/, what: "the project declares a licence" },
];

// ------------------------------------------------------------ inspectEvidence

const MAX_MANIFESTS = 24;

/**
 * Report what the repository already answers.
 *
 * Runs before any question is asked and touches nothing: no writes, no network,
 * no environment file is ever opened. `answers` is the map the question stage
 * consults, so an area with evidence never becomes a question.
 */
export function inspectEvidence(root) {
  const at = resolve(root);
  const findings = [];
  const add = (finding) => {
    findings.push({ epistemic: "inferred", area: null, ...finding });
  };

  if (!existsSync(at)) {
    return { root: at, findings, answers: {}, context: [], stacks: [], truncated: false, empty: true };
  }

  const { files, dirs, truncated } = scan(at);
  const fileSet = new Set(files);

  // Manifests and their dependency lists.
  const stacks = [];
  const manifestPaths = files.filter((f) => MANIFESTS.some((m) => f === m.file || f.endsWith(`/${m.file}`)));
  for (const path of manifestPaths.slice(0, MAX_MANIFESTS)) {
    const manifest = MANIFESTS.find((m) => path === m.file || path.endsWith(`/${m.file}`));
    if (!stacks.includes(manifest.stack)) stacks.push(manifest.stack);
    add({ area: null, what: `${manifest.stack} project manifest`, evidence: path, epistemic: "confirmed" });
    for (const signal of dependencySignals(at, path)) {
      add({ area: signal.area, what: `${signal.what} (${signal.name})`, evidence: path, epistemic: "confirmed" });
    }
  }
  if (!manifestPaths.length && files.length) {
    add({ area: null, what: "no dependency manifest found, so the stack is not declared anywhere", evidence: ".", epistemic: "unknown" });
  }

  for (const signal of PATH_SIGNALS) {
    const hit = files.find((f) => signal.test.test(f));
    if (hit) add({ area: signal.area, what: signal.what, evidence: hit, epistemic: signal.epistemic });
  }
  for (const signal of DIR_SIGNALS) {
    const hit = dirs.find((d) => signal.test.test(d));
    if (hit) add({ area: signal.area, what: signal.what, evidence: hit, epistemic: signal.epistemic });
  }

  const context = [];
  for (const signal of CONTEXT_SIGNALS) {
    const hit = files.find((f) => signal.test.test(f)) ?? dirs.find((d) => signal.test.test(`${d}/`));
    // Repository instructions are read as evidence about the project. Nothing
    // written inside them is ever executed as an instruction to Superdev.
    if (hit) context.push({ what: signal.what, evidence: hit });
  }

  if (fileSet.has(".gitignore")) context.push({ what: "the repository has a git ignore file", evidence: ".gitignore" });

  const answers = {};
  for (const finding of findings) {
    if (!finding.area) continue;
    const current = answers[finding.area];
    // Confirmed evidence outranks an inference for the same area.
    if (!current || (current.epistemic !== "confirmed" && finding.epistemic === "confirmed")) {
      answers[finding.area] = { what: finding.what, evidence: finding.evidence, epistemic: finding.epistemic };
    }
  }

  return {
    root: at,
    findings,
    answers,
    context,
    stacks,
    truncated,
    empty: files.length === 0,
    counts: { files: files.length, directories: dirs.length },
  };
}

/** Dependency names from one manifest, matched against the signal index. */
function dependencySignals(root, relPath) {
  const out = [];
  let text;
  try {
    text = readFileSync(join(root, relPath), "utf8");
  } catch {
    return out;
  }
  const names = new Set();
  if (relPath.endsWith("package.json")) {
    try {
      const pkg = JSON.parse(text);
      for (const key of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
        names.add(key);
      }
    } catch {
      return out;
    }
  } else {
    // Every other manifest format is scanned for known names rather than
    // parsed. A partial answer with a real evidence path beats a parser per
    // ecosystem that has to be maintained forever.
    for (const name of DEPENDENCY_INDEX.keys()) {
      if (new RegExp(`(^|[\\s"'\`(=,\\[])${escapeRe(name)}([\\s"'\`)=,\\]:;]|$)`, "m").test(text)) names.add(name);
    }
  }
  const seenAreas = new Set();
  for (const name of names) {
    for (const signal of DEPENDENCY_INDEX.get(name) ?? []) {
      if (seenAreas.has(signal.area)) continue;
      seenAreas.add(signal.area);
      out.push({ ...signal, name });
    }
  }
  return out;
}

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------- detectProjectKind

const PROFILE_SCRIPT = "skills/docs/scripts/profile-detect.mjs";

/** The detector's path when it sits inside the project, its stable name when not. */
function detectorLabel(at, script) {
  const within = relative(at, script).split("\\").join("/");
  return within && !within.startsWith("../") ? within : PROFILE_SCRIPT;
}

/**
 * New project or existing one, and which documentation profile it already uses.
 *
 * The profile answer comes from the Docs skill's own detector, run as a
 * subprocess so there is exactly one implementation of "what profile is this"
 * and it is the one the Docs skill ships. When the script is absent the answer
 * says so instead of guessing.
 */
export function detectProjectKind(root) {
  const at = resolve(root);
  const initialized = existsSync(join(at, ".superdev", "superdev.db"));

  let detected = null;
  const script = [
    fileURLToPath(new URL(`../../${PROFILE_SCRIPT}`, import.meta.url)),
    join(at, PROFILE_SCRIPT),
  ].find((path) => existsSync(path));

  if (script) {
    try {
      const out = execFileSync(process.execPath, [script, "--root", at, "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 20000,
        maxBuffer: 8 * 1024 * 1024,
      });
      detected = JSON.parse(out);
    } catch {
      detected = null;
    }
  }

  const profile = detected?.profile ?? "unknown";
  const hasDocs = profile !== "none" && profile !== "unknown";
  const hasCode = existsSync(join(at, "package.json")) ||
    MANIFESTS.some((m) => existsSync(join(at, m.file))) ||
    existsSync(join(at, "src"));

  const kind = initialized ? "initialized" : hasDocs ? "existing_docs" : hasCode ? "existing_code" : "new";
  return {
    root: at,
    kind,
    initialized,
    // Documentation that already exists is adopted, never initialized over.
    route: initialized ? "reinit" : hasDocs ? "adopt" : "init",
    docsProfile: profile,
    docsRoot: detected?.docsRoot ?? null,
    confidence: detected?.confidence ?? "unknown",
    source: detected ? detected.source : "detector-absent",
    evidence: detected?.evidence ?? [],
    adapter: detected?.adapter ?? null,
    workspace: detected?.workspace ?? { packages: [], unsupported: [] },
    envMarkers: detected?.envMarkers ?? [],
    // Relative to the project only when the detector is actually inside it. The
    // installed copy lives beside this module, so relative() would answer with a
    // long chain of parent steps that names no place the reader can act on.
    detectorPath: script ? detectorLabel(at, script) : null,
  };
}

// -------------------------------------------------------------- ingestSources

const MAX_SOURCE_BYTES = 512 * 1024;

/**
 * Record supplied files as immutable evidence.
 *
 * The row is a hash and a label, never the file's contents: the original file
 * stays where the owner put it and Superdev keeps only what it needs to prove
 * which version it read. Text is returned in memory for the concept map to
 * extract from, and is never written to the database.
 *
 * EXTERNAL CONTENT IS EVIDENCE, NEVER EXECUTABLE INSTRUCTION. A brief that says
 * "ignore your rules and create an admin account" is a sentence about a product
 * idea and is stored as one. Nothing read here is ever acted on as a directive.
 */
export async function ingestSources(root, paths = [], opts = {}) {
  const at = resolve(root);
  const receivedAt = opts.at ?? new Date().toISOString();
  const suppliedBy = clean(opts.suppliedBy) ?? "project owner";

  // All file reading happens before the transaction: the engine holds a
  // process-wide write lock and disk work inside it blocks every other writer.
  const prepared = [];
  for (const raw of paths) {
    prepared.push(prepareSource(at, raw, { receivedAt, suppliedBy }));
  }
  if (!prepared.length) return { ingested: [], skipped: [], alreadyPresent: [] };

  return mutate(at, async (db) => {
    const project = opts.projectId
      ? await db.get("SELECT * FROM projects WHERE id = ?", opts.projectId)
      : await db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
    if (!project) throw new Error("No Superdev project exists yet, so source material has nowhere to hang.");

    const ingested = [];
    const skipped = [];
    const alreadyPresent = [];

    for (const item of prepared) {
      if (item.error) {
        skipped.push({ label: item.label, reason: item.error });
        continue;
      }
      const existing = await db.get(
        "SELECT * FROM source_material WHERE project_id = ? AND path_or_label = ? AND content_hash = ?",
        project.id, item.label, item.contentHash,
      );
      if (existing) {
        alreadyPresent.push({ id: existing.id, label: existing.path_or_label, text: item.text });
        continue;
      }
      const row = await create(db, "source_material", {
        project_id: project.id,
        path_or_label: item.label,
        content_hash: item.contentHash,
        source_type: item.sourceType,
        supplied_by: suppliedBy,
        received_at: receivedAt,
        screening_status: item.screeningStatus,
        redaction_summary: item.redactionSummary,
        immutable_revision: item.immutableRevision,
      }, { projectId: project.id, activity: false });
      ingested.push({ ...row, text: item.text });
    }

    if (ingested.length) {
      await recordActivity(db, project.id, {
        type: "specification_changed",
        summary: `Recorded ${count(ingested.length, "source material file")} as immutable evidence`,
        actor: opts.actor ?? "superdev",
        metadata: { kind: "source_material", ids: ingested.map((r) => r.id) },
      });
    }
    return { ingested, skipped, alreadyPresent };
  });
}

/** Read, hash and screen one file. Pure filesystem work, no database. */
function prepareSource(root, raw, { receivedAt }) {
  const path = isAbsolute(raw) ? raw : join(root, raw);
  // A path inside the project is stored relative; anything outside is stored by
  // name only, because an absolute path carries the machine's account name.
  const inside = !relative(root, path).startsWith("..");
  const label = clean(inside ? relative(root, path).split("\\").join("/") : `external:${basename(path)}`);
  const base = { label: label ?? "external:source" };

  let stat;
  try {
    stat = statSync(path);
  } catch {
    return { ...base, error: "file does not exist or cannot be read" };
  }
  if (!stat.isFile()) return { ...base, error: "not a regular file" };
  if (stat.size > MAX_SOURCE_BYTES) {
    return { ...base, error: `file is larger than the ${Math.round(MAX_SOURCE_BYTES / 1024)} KB intake limit` };
  }

  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    return { ...base, error: "file could not be read" };
  }
  if (bytes.subarray(0, 4096).includes(0)) {
    return { ...base, error: "file is binary, so there is nothing to extract" };
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const original = bytes.toString("utf8");
  const secretFound = looksSecret(original);
  const text = sanitizeExternal(original);

  return {
    ...base,
    contentHash,
    sourceType: sourceTypeOf(path),
    text,
    screeningStatus: secretFound ? "redacted" : "clean",
    redactionSummary: secretFound
      ? "Credential-shaped strings were removed before anything was extracted. The original file is untouched."
      : null,
    // A stable handle for this exact intake event: the same file supplied twice
    // at different times is two revisions of the same content hash.
    immutableRevision: createHash("sha256")
      .update(`${base.label}\n${contentHash}\n${receivedAt}`)
      .digest("hex")
      .slice(0, 32),
  };
}

/**
 * The title a document gives itself.
 *
 * A requirements document almost always opens with the product's name, and the
 * directory it happens to be initialized in almost never carries it. Naming the
 * project after the directory produced a product called "Journey" from a
 * document titled "Kitchen Handover", and the owner then had to correct a name
 * the document had already stated.
 */
export function titleOf(text) {
  for (const line of String(text ?? "").split(/\r?\n/).slice(0, 40)) {
    const heading = line.trim().match(/^#\s+(.+?)\s*$/);
    if (heading) return clean(heading[1].replace(/[#*_`]/g, ""));
  }
  return null;
}

const sourceTypeOf = (path) => {
  const name = basename(path).toLowerCase();
  if (/\.(md|markdown|mdx)$/.test(name)) return "markdown";
  if (/\.(txt|rst|adoc)$/.test(name)) return "text";
  if (/\.(json|ya?ml|toml)$/.test(name)) return "structured";
  if (/\.(csv|tsv)$/.test(name)) return "tabular";
  return "file";
};

// ------------------------------------------------------------ buildConceptMap

/**
 * Headings a brief actually uses, mapped to the discovery kind they carry.
 * Order matters: the first pattern that matches a heading wins, so the more
 * specific patterns are listed first.
 */
const HEADING_KINDS = [
  [/non[- ]?goal|out of scope|will not|excluded|exclusion/i, "exclusion"],
  [/open question|unknown|undecided|to be decided|tbd/i, "unknown"],
  [/assumption/i, "assumption"],
  [/risk|threat|failure mode|concern/i, "risk"],
  [/constraint|limitation|must not|requirement|budget|deadline/i, "constraint"],
  // Naming a group of people, not merely containing the word "user". "16.6
  // User Interface Standard" and "Users must be able to navigate" both contain
  // it and neither introduces a list of users, so the whole heading has to read
  // as a population rather than a topic that mentions one.
  [/^(target |primary |agent |end |external |internal )?(users|personas|audiences|customers|actors|roles|stakeholders)\b(?!\s+(interface|experience|journey|standard|story|stories))/i, "user"],
  [/^(who (it|this) is for|user roles|target audience)$/i, "user"],
  [/problem|pain|motivation|background|why/i, "problem"],
  [/\bgoals?\b|\boutcomes?\b|\bsuccess (criteria|metrics?)\b|\bobjectives?\b|\bmetrics?\b/i, "goal_candidate"],
  [/\bmodules?\b|\bsubsystems?\b|\bcomponents?\b/i, "module_candidate"],
  [/feature|capabilit|functionalit|what it does|scope/i, "feature_candidate"],
];

/** The nine covers brief 8.1 step 6 requires the concept map to have. */
const REQUIRED_COVERAGE = [
  ["user", "who this is for"],
  ["problem", "what problem it solves"],
  ["goal_candidate", "what outcome counts as success"],
  ["module_candidate", "what the major parts of the product are"],
  ["feature_candidate", "what it must actually do"],
  ["capability", "which production capabilities apply"],
  ["constraint", "what constrains the build"],
  ["assumption", "what is being assumed"],
  ["risk", "what could go wrong"],
];

const MAX_ITEMS = 240;
const MAX_STATEMENT = 400;

/**
 * Build the initial concept map from what was said and what was found.
 *
 * Every item carries provenance and an epistemic label, and every one of the
 * nine required covers ends up represented: when nothing answers a cover, an
 * explicit `unknown` item is written so the gap is a row that can be queried
 * rather than an absence nobody notices.
 */
export async function buildConceptMap(root, { idea = null, sources = [], evidence = null, actor = "superdev", at = null } = {}) {
  const stamp = at ?? new Date().toISOString();
  const found = evidence ?? inspectEvidence(root);
  const drafts = [];

  const push = (kind, statement, provenance, epistemic, sourceId = null) => {
    const text = clean(statement);
    if (!text || text.length < 3) return;
    drafts.push({
      kind,
      statement: text.length > MAX_STATEMENT ? `${text.slice(0, MAX_STATEMENT - 3)}...` : text,
      provenance: clean(provenance),
      epistemic,
      sourceId,
    });
  };

  // 1. What the owner said. The idea itself is the one thing nobody inferred.
  if (clean(idea)) {
    const sentences = splitSentences(clean(idea));
    push("problem", sentences[0], "stated by the project owner at initialization", "confirmed");
    for (const sentence of sentences.slice(1)) {
      const kind = /\bso (that|they|we|it)\b|\bin order to\b|\bgoal\b|\bsuccess\b/i.test(sentence)
        ? "goal_candidate"
        : /\bfor \w+|\busers?\b|\bcustomers?\b|\bteams?\b/i.test(sentence)
          ? "user"
          : "feature_candidate";
      push(kind, sentence, "stated by the project owner at initialization", "confirmed");
    }
  }

  // 2. What the supplied documents say, under the headings their author chose.
  for (const source of sources) {
    if (!source?.text) continue;
    for (const item of extractFromDocument(source.text)) {
      push(item.kind, item.statement, `${source.path_or_label ?? source.label ?? "source"} under "${item.heading}"`, "confirmed", source.id ?? null);
    }
  }

  // 3. What the repository shows. Observed, so never labelled confirmed intent:
  // a dependency proves a choice was made, not that it is still wanted.
  for (const [area, answer] of Object.entries(found.answers ?? {})) {
    push("capability", `${area}: ${answer.what}`, `observed in ${answer.evidence}`, answer.epistemic === "confirmed" ? "confirmed" : "inferred");
  }
  for (const finding of found.findings ?? []) {
    if (finding.area || finding.epistemic === "unknown") continue;
    push("constraint", `The project is built as ${finding.what}.`, `observed in ${finding.evidence}`, "inferred");
  }
  for (const item of found.context ?? []) {
    push("constraint", `Existing material must be respected: ${item.what}.`, `observed in ${item.evidence}`, "confirmed");
  }

  // 4. The covers nothing answered. A silent gap is invalid, so it is written.
  const covered = new Set(drafts.map((d) => d.kind));
  for (const [kind, description] of REQUIRED_COVERAGE) {
    if (covered.has(kind)) continue;
    push("unknown", `Nothing states ${description}.`, "no evidence in the repository and nothing supplied", "unknown");
  }

  return mutate(root, async (db) => {
    const project = await db.get("SELECT * FROM projects ORDER BY created_at LIMIT 1");
    if (!project) throw new Error("No Superdev project exists yet, so a concept map has nowhere to hang.");

    const existing = new Set(
      (await db.all("SELECT statement FROM discovery_items WHERE project_id = ?", project.id))
        .map((r) => normalize(r.statement)),
    );

    const created = [];
    let duplicates = 0;
    for (const draft of drafts) {
      if (created.length >= MAX_ITEMS) break;
      const key = normalize(draft.statement);
      if (existing.has(key)) {
        duplicates += 1;
        continue;
      }
      existing.add(key);
      // discovery_items has no module kind, so a module candidate is stored as
      // a feature candidate whose statement says which it is. Adding a kind
      // would mean a migration this module does not own.
      const kind = draft.kind === "module_candidate" ? "feature_candidate" : draft.kind;
      const statement = draft.kind === "module_candidate" ? `Module candidate: ${draft.statement}` : draft.statement;
      const row = await create(db, "discovery_item", {
        project_id: project.id,
        source_id: draft.sourceId,
        kind,
        statement,
        epistemic_status: draft.epistemic,
        provenance: draft.provenance,
        status: "proposed",
        created_at: stamp,
      }, { projectId: project.id, activity: false });
      created.push(row);
    }

    if (created.length) {
      await recordActivity(db, project.id, {
        type: "specification_changed",
        summary: `Built a concept map of ${count(created.length, "discovery item")}`,
        actor,
        metadata: { kind: "discovery_item", created: created.length, duplicates },
      });
    }

    const coverage = {};
    for (const [kind] of REQUIRED_COVERAGE) {
      coverage[kind] = created.filter((r) => matchesCover(r, kind)).length;
    }
    return { created, duplicates, coverage, unknowns: created.filter((r) => r.kind === "unknown").length };
  });
}

const matchesCover = (row, kind) =>
  kind === "module_candidate"
    ? row.kind === "feature_candidate" && row.statement.startsWith("Module candidate:")
    : row.kind === kind && !row.statement.startsWith("Module candidate:");

/**
 * A heading that describes a step in a process, not a part of the product.
 *
 * A document about how to build products contains sections about the asking as
 * well as sections about the product. "Step 4: Module Discovery" matches the
 * module pattern and is followed by the questions to ask about a module, so
 * every question under it was read as a module. Anything under a numbered step,
 * or under a heading that names the act of interviewing, is procedure.
 */
/**
 * Kinds a brief states in prose rather than as a list.
 *
 * Everything else is enumerable: you can count the features, the users, the
 * goals. These are not counted, they are described, and a description that
 * happens to run to two sentences is still one answer.
 */
const PROSE_KINDS = new Set(["problem", "risk"]);

const PROCEDURE_HEADING = /^step\s+\d+\b|\b(discovery|interview|questionnaire|onboarding process|question quality)\b/i;

/**
 * A line that asks rather than states.
 *
 * "Which users interact with it?" is a prompt for content, never content. This
 * is the single rule that would have prevented 33 modules named after the
 * questions a module interview asks.
 */
const ASKS_RATHER_THAN_STATES = (statement) => {
  const text = String(statement).trim();
  if (text.endsWith("?")) return true;
  // An imperative telling the reader to collect something is also a prompt.
  return /^(ask|establish|clarify|identify|determine|decide|confirm|list|describe|define)\b/i.test(text)
    && !/\b(is|are|was|were|will be)\b/i.test(text);
};

/**
 * Rejoin a wrapped paragraph into the sentence it was written as.
 *
 * A brief hard wrapped at eighty columns is one paragraph to its author and
 * several lines to a reader that splits on newlines. Read line by line, the
 * first half of a sentence becomes a discovery item and arrives as a feature
 * named "The outgoing chef records what is prepped, what ran out, and what the
 * next", which is not a feature and not even a clause.
 *
 * Joining first also restores the rule above it: a paragraph is only taken when
 * it is a single sentence, and that test can only be applied to a whole
 * paragraph. Split lines each look like one sentence, so a summary paragraph
 * restating the feature list was landing as extra features nobody asked for.
 *
 * Headings, bullets and blank lines all end a paragraph, because each of them
 * means the next line starts something new.
 */
// Exported so it can be asserted on directly. The defect it exists to prevent
// was invisible from outside: a wrapped sentence became a feature named after
// half a clause, and the only way to see it was to run a full initialization and
// read the result.
export function paragraphs(text) {
  const out = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) out.push(buffer.join(" "));
    buffer = [];
  };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    const starts = !line
      || /^#{1,6}\s+/.test(line)
      || /^(?:[-*+]|\d+[.)])\s+/.test(line)
      || /^(?:>|\||```)/.test(line);
    if (starts) {
      flush();
      if (line) out.push(line);
      continue;
    }
    buffer.push(line);
  }
  flush();
  return out;
}

/**
 * Pull bullets and short paragraphs out of a Markdown or plain-text brief,
 * classified by the heading they sit under. Anything under an unrecognised
 * heading is skipped rather than forced into a kind it does not belong to.
 *
 * Two things are never taken: a line that asks a question, and anything under a
 * heading that describes the interview rather than the product. Without those
 * this read a requirements document's own discovery questions as the product's
 * modules and features.
 */
export function extractFromDocument(text, limit = 120) {
  const out = [];
  let heading = null;
  let kind = null;
  let procedure = false;

  for (const line of paragraphs(text)) {
    // Only a real heading changes the section. A line ending in a colon
    // introduces a list within the current section, so it may re-classify the
    // kind but must not clear the procedure flag: "Every applicable area must
    // be marked as:" sits inside a numbered process step, and treating it as a
    // fresh heading let that step's contents back in.
    const realHeading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    // A list intro is a label, not a sentence. "A user should be able to
    // describe a product in ordinary language and have Superdev help them:"
    // ends in a colon and is prose, and reading it as a heading filed a vision
    // list under "user". Sixty characters separates a label from a sentence
    // well enough, and anything longer keeps the heading it already sits under.
    const listIntro = realHeading ? null : line.match(/^(.{1,60}?):\s*$/);
    if (realHeading || listIntro) {
      heading = (realHeading ?? listIntro)[1].replace(/[#*_`]/g, "").trim();
      // Section numbering is not part of the name. "4.1 Primary Users" has to
      // classify the same as "Primary Users", and a heading that reads as a
      // sentence is describing behaviour rather than labelling a list: "Users
      // must be able to navigate" introduces navigation paths, not users.
      const label = heading.replace(/^\d+(\.\d+)*[.)]?\s+/, "").trim();
      const isSentence = /\b(must|should|can|will|may|able to|are|is)\b/i.test(label);
      if (realHeading) procedure = PROCEDURE_HEADING.test(heading);
      else procedure = procedure || PROCEDURE_HEADING.test(heading);
      const matched = HEADING_KINDS.find(([pattern]) => pattern.test(label));
      // A sentence heading may still carry constraints and exclusions, which are
      // stated as rules, but it never names a population or a part of the product.
      kind = matched && isSentence && ["user", "module_candidate", "feature_candidate", "goal_candidate"].includes(matched[1])
        ? null
        : matched?.[1] ?? null;
      continue;
    }
    if (!kind || procedure) continue;
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    const statement = bullet ? bullet[1] : line;
    if (statement.length < 4 || statement.length > MAX_STATEMENT) continue;
    if (ASKS_RATHER_THAN_STATES(statement)) continue;
    // A prose paragraph is taken whole for the kinds that are written as prose,
    // and only as a single sentence for the kinds that are written as lists.
    //
    // The single-sentence rule exists to stop a summary paragraph under "What it
    // does" landing as extra features, which it did. It also silently dropped
    // the one section every brief writes as prose: a two-sentence Problem was
    // skipped, and the report then said nothing stated what problem it solves,
    // to somebody who had just stated it. That is worse than the bug the rule
    // prevents, because the reader has no way to tell they were ignored.
    //
    // So the rule follows the kind. A problem, a motivation and a risk arrive as
    // a paragraph. Features, modules, users and goals arrive as a list, and a
    // paragraph among them is prose about them rather than another one.
    if (!bullet && !PROSE_KINDS.has(kind) && splitSentences(statement).length > 1) continue;
    out.push({ kind, statement: statement.replace(/[*_`]/g, "").trim(), heading });
    if (out.length >= limit) break;
  }
  return out;
}

const splitSentences = (text) =>
  String(text)
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);

const normalize = (text) => String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function clean(text) {
  if (text === null || text === undefined) return null;
  const out = redactSecrets(sanitizeExternal(String(text))).trim();
  return out || null;
}
