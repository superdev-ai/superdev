// Manual-edit detection and the proposal flow. Brief section 6.2.
//
// Generated Markdown is a projection of the database, never a second writable
// source of truth, so a human edit is neither silently overwritten nor silently
// promoted. A file whose normalized body no longer hashes to
// `documents.generated_hash` becomes a pending proposal that a person resolves.
//
// Accepting writes the human's values into the database first and only then
// touches the file, because the reverse order would leave the file authoritative
// for however long the write took. Rejecting restores the stored generation, but
// only after the discarded text is recorded in an activity event, so a rejection
// is recoverable rather than destructive.

import { readFile, writeFile, rename, mkdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  query, mutate, patch, recordActivity, currentProject, DbError,
} from "../db/store.mjs";
import { kindOf, tableFor } from "../model/ids.mjs";
import { assertStorable, sanitizeExternal } from "../model/screening.mjs";
// The renderer owns the marker grammar and the body's normal form. Both are
// imported rather than restated, because a second copy that drifted by one
// trailing newline would make every file look edited.
import { parseMarker, bodyHash, withMarker, normalizeBody, MARKER } from "./render.mjs";

export const E = {
  NOT_FOUND: "E_NOT_FOUND",
  DERIVED_VIEW: "E_DOC_DERIVED_VIEW",
  NOT_A_PROPOSAL: "E_DOC_NOT_A_PROPOSAL",
  NO_GENERATED_BODY: "E_DOC_NO_GENERATED_BODY",
  OUTSIDE_PROJECT: "E_PATH_OUTSIDE_PROJECT",
};

const nowIso = () => new Date().toISOString();

// --------------------------------------------------------------- file access

/**
 * A document path is data from the database or from a browser, so it is
 * confined to the project before it reaches the filesystem.
 */
function resolveInside(root, docPath) {
  const base = resolve(root);
  const abs = resolve(base, String(docPath ?? ""));
  const rel = relative(base, abs);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new DbError(E.OUTSIDE_PROJECT, `${docPath} resolves outside the project directory.`);
  }
  return abs;
}

/** Project-relative, forward slashed, which is how `documents.path` is stored. */
function toRelative(root, docPath) {
  const value = String(docPath ?? "");
  const rel = isAbsolute(value) ? relative(resolve(root), resolve(value)) : value;
  return rel.split(sep).join("/").replace(/^\.\//, "");
}

/**
 * The body of a generated file, without its marker. `parseMarker` owns the
 * grammar and refuses a marker it cannot fully read, so a marker that a person
 * damaged while editing is still stripped here rather than being diffed as
 * content the human wrote.
 */
function readBody(text) {
  const parsed = parseMarker(text);
  if (parsed) return parsed.body;
  const first = String(text).split("\n", 1)[0];
  return first.includes(MARKER) ? text.slice(first.length).replace(/^\r?\n/, "") : text;
}

async function writeAtomic(file, text) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.superdev-${process.pid}.tmp`;
  try {
    await writeFile(tmp, text, "utf8");
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------- inspection

async function inspect(root, doc) {
  const file = resolveInside(root, doc.path);
  let text = null;
  try {
    text = await readFile(file, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  if (text === null) return { doc, file, body: null, diskHash: null, status: "missing" };
  const body = readBody(text);
  const diskHash = bodyHash(body);
  // A row with no recorded hash has never been generated, so anything on disk
  // at that path is a human's file and is treated as an edit, not as ours.
  const status = diskHash === doc.generated_hash ? "in_sync" : "manual_edit_pending";
  return { doc, file, body, diskHash, status };
}

const entryOf = (state) => ({
  id: state.doc.id,
  path: state.doc.path,
  kind: state.doc.kind,
  template: state.doc.template,
  scopeType: state.doc.scope_type,
  scopeId: state.doc.scope_id,
  status: state.status,
  recordedStatus: state.doc.sync_status,
  generatedHash: state.doc.generated_hash,
  diskHash: state.diskHash,
});

/**
 * An in-sync file only clears a stale pending or missing flag. An `accepted` or
 * `rejected` resolution stays on the row until the next real generation, so the
 * control center can still show how the last proposal ended.
 */
function effectiveStatus(state) {
  if (state.status !== "in_sync") return state.status;
  return ["manual_edit_pending", "missing"].includes(state.doc.sync_status)
    ? "generated"
    : state.doc.sync_status;
}

/**
 * Scan every authored projection and report the ones whose file no longer
 * matches the generation it came from. Persists the pending state and raises
 * `documentation_proposal_raised` once per distinct edit, so rescanning is
 * silent instead of filling the feed with the same proposal.
 */
export async function detectProposals(root, { apply = true, actor = "superdev" } = {}) {
  // Deliberately not `SELECT *`: the control center polls the summary, and
  // `generated_body` is the one column a scan never reads.
  const all = await query(root, (db) =>
    db.all(
      `SELECT id, project_id, kind, scope_type, scope_id, path, template,
              regeneration_mode, generated_hash, manual_hash, sync_status
         FROM documents ORDER BY path`,
    ));
  // A retired document described a record that no longer exists, and its file
  // was removed on purpose. Inspecting one finds the file absent and reports it
  // missing, which turns a finished document into an open decision nobody can
  // close: regenerating will never bring it back, because nothing generates it
  // any more.
  const authored = all.filter((d) =>
    d.regeneration_mode === "authored_projection" && d.sync_status !== "retired");

  const states = [];
  for (const doc of authored) states.push(await inspect(root, doc));

  const writes = [];
  for (const state of states) {
    const next = effectiveStatus(state);
    const manualHash = state.status === "manual_edit_pending" ? state.diskHash : null;
    if (next === state.doc.sync_status && manualHash === (state.doc.manual_hash ?? null)) continue;
    writes.push({
      state,
      next,
      manualHash,
      raise: state.status !== "in_sync",
    });
  }

  const raised = [];
  if (apply && writes.length) {
    await mutate(root, async (db) => {
      for (const w of writes) {
        // `documents` carries no optimistic version, so `patch` cannot drive it.
        // The activity event that keeps this honest is written right here.
        await db.run(
          "UPDATE documents SET sync_status = ?, manual_hash = ? WHERE id = ?",
          w.next, w.manualHash, w.state.doc.id,
        );
        if (!w.raise) continue;
        await recordActivity(db, w.state.doc.project_id, {
          type: "documentation_proposal_raised",
          summary:
            w.state.status === "missing"
              ? `${w.state.doc.path} is missing and no longer matches the database`
              : `${w.state.doc.path} was edited by hand and is waiting for a decision`,
          actor,
          metadata: {
            document_id: w.state.doc.id,
            path: w.state.doc.path,
            reason: w.state.status,
            generated_hash: w.state.doc.generated_hash,
            disk_hash: w.state.diskHash,
          },
        });
        raised.push(w.state.doc.id);
      }
    });
  }

  const byStatus = {};
  for (const state of states) {
    const key = effectiveStatus(state);
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  }

  return {
    scanned: authored.length,
    derivedViews: all.length - authored.length,
    inSync: states.filter((s) => s.status === "in_sync").length,
    proposals: states.filter((s) => s.status !== "in_sync").map(entryOf),
    byStatus,
    raised,
  };
}

/** Counts for the control center. Read only: nothing is written or raised. */
export async function proposalSummary(root) {
  const report = await detectProposals(root, { apply: false });
  const pending = report.proposals.filter((p) => p.status === "manual_edit_pending");
  const missing = report.proposals.filter((p) => p.status === "missing");
  return {
    documents: report.scanned,
    derivedViews: report.derivedViews,
    inSync: report.inSync,
    pending: pending.length,
    missing: missing.length,
    accepted: report.byStatus.accepted ?? 0,
    rejected: report.byStatus.rejected ?? 0,
    open: report.proposals.length,
    paths: report.proposals.map((p) => p.path),
  };
}

// ---------------------------------------------------------------- diffing

const splitLines = (text) => (text === "" ? [] : text.replace(/\n$/, "").split("\n"));

// ponytail: plain O(n*m) LCS. Documents are hundreds of lines, so the matrix is
// cheap; past the cap the diff degrades to one replace hunk rather than
// allocating hundreds of megabytes. Swap in a Myers diff only if that cap is
// ever reached in practice.
const DIFF_CELL_CAP = 4_000_000;

function diffLines(a, b) {
  const ops = [];
  if ((a.length + 1) * (b.length + 1) > DIFF_CELL_CAP) {
    a.forEach((line, i) => ops.push({ op: "-", line, ai: i, bi: -1 }));
    b.forEach((line, j) => ops.push({ op: "+", line, ai: -1, bi: j }));
    return ops;
  }
  const w = b.length + 1;
  const dp = new Int32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j]
        ? dp[(i + 1) * w + j + 1] + 1
        : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ op: " ", line: a[i], ai: i, bi: j });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      ops.push({ op: "-", line: a[i], ai: i, bi: -1 });
      i++;
    } else {
      ops.push({ op: "+", line: b[j], ai: -1, bi: j });
      j++;
    }
  }
  while (i < a.length) ops.push({ op: "-", line: a[i], ai: i++, bi: -1 });
  while (j < b.length) ops.push({ op: "+", line: b[j], ai: -1, bi: j++ });
  return ops;
}

function unified(ops, fromName, toName, context = 3) {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, k) => {
    if (op.op === " ") return;
    for (let d = -context; d <= context; d++) if (k + d >= 0 && k + d < ops.length) keep[k + d] = true;
  });

  const out = [];
  let k = 0;
  while (k < ops.length) {
    if (!keep[k]) {
      k++;
      continue;
    }
    let end = k;
    while (end < ops.length && keep[end]) end++;
    let aStart = null;
    let bStart = null;
    let aCount = 0;
    let bCount = 0;
    for (let x = k; x < end; x++) {
      const op = ops[x];
      if (op.op !== "+") {
        if (aStart === null) aStart = op.ai;
        aCount++;
      }
      if (op.op !== "-") {
        if (bStart === null) bStart = op.bi;
        bCount++;
      }
    }
    out.push(
      `@@ -${aCount === 0 ? 0 : (aStart ?? 0) + 1},${aCount} +${bCount === 0 ? 0 : (bStart ?? 0) + 1},${bCount} @@`,
    );
    for (let x = k; x < end; x++) out.push(ops[x].op + ops[x].line);
    k = end;
  }
  if (!out.length) return "";
  return [`--- ${fromName}`, `+++ ${toName}`, ...out].join("\n") + "\n";
}

// ---------------------------------------------------------------- sections

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const PREAMBLE = "(document preamble)";

/** Flat section list. A heading inside a fenced code block is not a heading. */
function sectionsOf(lines) {
  const out = [{ heading: null, level: 0, start: 0, end: lines.length }];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) fenced = !fenced;
    if (fenced) continue;
    const m = HEADING.exec(lines[i]);
    if (!m) continue;
    out[out.length - 1].end = i;
    out.push({ heading: m[2], level: m[1].length, start: i, end: lines.length });
  }
  for (const s of out) s.lines = lines.slice(s.heading === null ? s.start : s.start + 1, s.end);
  return out[0].end === 0 && out.length > 1 ? out.slice(1) : out;
}

const sectionAt = (sections, index) =>
  sections.find((s) => index >= s.start && index < s.end) ?? sections[0];

function touchedSections(ops, aLines, bLines) {
  const before = sectionsOf(aLines);
  const after = sectionsOf(bLines);
  const seen = new Map();
  for (const op of ops) {
    if (op.op === " ") continue;
    const section = op.op === "-" ? sectionAt(before, op.ai) : sectionAt(after, op.bi);
    const key = section?.heading ?? PREAMBLE;
    const row = seen.get(key) ?? { heading: key, level: section?.level ?? 0, added: 0, removed: 0 };
    if (op.op === "-") row.removed++;
    else row.added++;
    seen.set(key, row);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------- documents

async function loadDocument(root, path) {
  const rel = toRelative(root, path);
  const doc = await query(root, (db) => db.get("SELECT * FROM documents WHERE path = ?", rel));
  if (!doc) {
    throw new DbError(
      E.NOT_FOUND,
      `No generated document is recorded at ${rel}. Generate documentation before reviewing an edit to it.`,
    );
  }
  if (doc.regeneration_mode !== "authored_projection") {
    throw new DbError(
      E.DERIVED_VIEW,
      `${rel} is a derived view. It is rewritten on every generation and never holds a manual edit.`,
    );
  }
  return doc;
}

/**
 * A readable unified diff between the stored generation and what is on disk,
 * plus the template sections the edit touched.
 */
export async function diffProposal(root, path) {
  const doc = await loadDocument(root, path);
  const state = await inspect(root, doc);
  const before = splitLines(normalizeBody(doc.generated_body ?? ""));
  const after = state.body === null ? [] : splitLines(normalizeBody(state.body));
  const ops = diffLines(before, after);
  return {
    id: doc.id,
    path: doc.path,
    status: state.status,
    generatedHash: doc.generated_hash,
    diskHash: state.diskHash,
    added: ops.filter((o) => o.op === "+").length,
    removed: ops.filter((o) => o.op === "-").length,
    sections: touchedSections(ops, before, after),
    diff: unified(ops, `database ${doc.id} ${doc.path}`, `working tree ${doc.path}`),
  };
}

// ------------------------------------------------------------ field mapping

const normalizeHeading = (heading) =>
  String(heading ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Only the template's phrasings that do not already normalize onto a column
 * name. Everything else resolves by name, so a new column is readable without
 * an entry here.
 */
const ALIAS = {
  why: "purpose",
  overview: "purpose",
  product: "statement",
  user: "user_statement",
  user_story: "user_statement",
  value: "user_value",
  in_scope: "scope_in",
  out_of_scope: "scope_out",
  rationale: "observable_rationale",
  problem_statement: "problem",
  completion: "completion_criteria",
  telemetry: "observability",
  accessibility: "accessibility_notes",
  responsive: "responsive_behavior",
  next: "next_action",
  what_is_left: "what_remains",
  what_works_today: "what_works_now",
  how_it_is_verified: "verification",
  implemented_at: "implementation_path",
  owner_or_approver: "accepted_by",
};

// Identity, lifecycle and derived columns are never taken from Markdown. A
// status moves through `setStatus` so its transition is recorded, a slug and a
// name decide the file's own path, and timestamps are not prose.
const NEVER = new Set([
  "id", "project_id", "version", "slug", "name", "title", "status", "sequence",
  "position_x", "position_y", "body_hash", "database_revision",
]);

const deniedColumn = (column, constrained) =>
  NEVER.has(column) ||
  constrained.has(column) ||
  column.endsWith("_id") ||
  column.endsWith("_at") ||
  column.endsWith("_hash");

/**
 * Columns the schema pins to a fixed set. Read from the schema itself so a new
 * enumerated column cannot quietly become writable from a Markdown heading.
 */
async function constrainedColumns(db, table) {
  const sql = await db.value("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", table);
  const found = new Set();
  for (const m of String(sql ?? "").matchAll(/CHECK\s*\(\s*(\w+)\s+IN\s*\(/gi)) found.add(m[1]);
  return found;
}

function bulletItems(lines) {
  const items = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = /^[-*]\s+(.*\S)\s*$/.exec(line);
    if (!m) return null;
    items.push(m[1]);
  }
  return items.length ? items : null;
}

/**
 * The value a section would write into a column. A JSON column only accepts a
 * flat bullet list, which is the one shape that survives the round trip back
 * out through the renderer. Anything else stays unmapped rather than guessed.
 */
function valueFor(column, lines) {
  if (column.endsWith("_json")) {
    const items = bulletItems(lines);
    return items ? JSON.stringify(items) : undefined;
  }
  return lines.join("\n").trim();
}

/**
 * Sections that are lists of records rather than one field, and the command that
 * writes each. These cannot be read back out of Markdown, because a bullet list
 * cannot say which record each line is, but every one of them can be written.
 */
const WRITTEN_BY = {
  non_goals: 'Non-goals are records rather than one field. Add one with superdev scope record --not "<what this will not do>" --why "<reason>" --apply.',
  out_of_scope: 'This is a list of records. Add one with superdev scope record --out "<what is out>" --apply.',
  success_criteria: 'Success criteria belong to a goal. Add one with superdev goal criterion <GOAL-id> --criterion "<what must be true>" --measurement "<how it is read>" --apply.',
  goals: 'A goal is a record. Add one with superdev goal record --name "<the outcome>" --apply.',
  milestones: 'A milestone is a record. Add one with superdev milestone record --name "<the stage>" --apply.',
};

function columnFor(name, columns, constrained) {
  const key = normalizeHeading(name);
  if (!key) return null;
  const base = ALIAS[key] ?? key;
  for (const candidate of [base, `${base}_json`, key, `${key}_json`]) {
    if (columns.has(candidate) && !deniedColumn(candidate, constrained)) return candidate;
  }
  return null;
}

// The templates put a scalar field on its own `- **Name:** value` line and a
// prose field under its own heading. Those are the only two shapes a document
// can be read back through; a table row belongs to child records that the
// document does not address.
const LABEL_LINE = /^-\s+\*\*([^*]+?):\*\*\s*(.*)$/;
const TABLE_ROW = /^\s*\|/;

/** The renderer escapes pipes so a value cannot break a table. */
const unescapePipes = (value) => String(value).replace(/\\\|/g, "|");

/**
 * What the edit is proposing, per changed line. A line that is neither a label
 * nor part of a prose section is left for `planAcceptance` to refuse by name,
 * so nothing is interpreted just because it moved.
 */
function proposedChanges(beforeBody, afterBody) {
  const beforeLines = splitLines(normalizeBody(beforeBody));
  const afterLines = splitLines(normalizeBody(afterBody));
  const beforeSections = sectionsOf(beforeLines);
  const afterSections = sectionsOf(afterLines);

  const added = new Map();
  const removed = new Map();
  const prose = new Map();

  for (const op of diffLines(beforeLines, afterLines)) {
    if (op.op === " ") continue;
    const isAdd = op.op === "+";
    const section = isAdd ? sectionAt(afterSections, op.bi) : sectionAt(beforeSections, op.ai);
    const heading = section?.heading ?? null;
    const m = LABEL_LINE.exec(op.line);
    if (m) {
      const name = m[1].trim();
      (isAdd ? added : removed).set(`${heading} ${name.toLowerCase()}`, {
        heading, name, value: unescapePipes(m[2]).trim(),
      });
      continue;
    }
    if (prose.has(heading)) continue;
    prose.set(heading, { heading, section: afterSections.find((s) => s.heading === heading) ?? null });
  }

  // A label that was rewritten shows up as a removal and an addition of the
  // same name. Only the ones with no replacement are real deletions.
  for (const key of added.keys()) removed.delete(key);

  return { labels: [...added.values()], deleted: [...removed.values()], prose: [...prose.values()] };
}

/**
 * Work out what accepting the on-disk file would write. Read only, so the same
 * plan drives a dry run and the real thing.
 */
async function planAcceptance(db, doc, state) {
  const applied = [];
  const unmapped = [];
  const values = {};
  const reject = (where, reason) => unmapped.push({ section: where ?? PREAMBLE, reason });
  // Diffing against the empty string would report every line of the document as
  // newly proposed, including the renderer's own "Not recorded" placeholders,
  // and those would then be written into the record as if a person had typed
  // them. Without a cached body there is nothing to compare and nothing safe to
  // apply.
  if (typeof doc.generated_body !== "string") {
    throw new DocsError(
      E.NO_GENERATED_BODY,
      `${doc.path} has no stored copy of what was generated, so there is nothing to compare this edit against. Run docs generate to rebuild it, then read the difference again.`,
      { path: doc.path },
    );
  }
  const changes = proposedChanges(doc.generated_body, state.body ?? "");

  const scopeId = doc.scope_id || (await currentProject(db))?.id;
  const kind = scopeId ? kindOf(scopeId) : null;
  const table = kind ? tableFor(kind) : null;
  const record = table ? await db.get(`SELECT * FROM ${table} WHERE id = ?`, scopeId) : null;

  const everything = [
    ...changes.labels.map((l) => `${l.heading ?? PREAMBLE} / ${l.name}`),
    ...changes.deleted.map((l) => `${l.heading ?? PREAMBLE} / ${l.name}`),
    ...changes.prose.map((p) => p.heading ?? PREAMBLE),
  ];
  if (!record) {
    for (const where of everything) reject(where, `${doc.path} is not attached to a record this flow can update.`);
    return { applied, unmapped, record: null, kind, values };
  }
  if (record.version === undefined) {
    for (const where of everything) {
      reject(where, `${kind} ${scopeId} has no optimistic version, so it cannot be updated from a document.`);
    }
    return { applied, unmapped, record: null, kind, values };
  }

  const columns = new Set((await db.all(`PRAGMA table_info(${table})`)).map((c) => c.name));
  const constrained = await constrainedColumns(db, table);

  const take = (where, column, value) => {
    if (values[column] !== undefined && values[column] !== value) {
      reject(where, `${column} is edited in two places at once, so the intended value is ambiguous.`);
      return;
    }
    try {
      assertStorable(column, value);
    } catch (err) {
      reject(where, err.message);
      return;
    }
    values[column] = value === "" ? null : value;
    applied.push({ section: where, column, kind, recordId: record.id });
  };

  for (const item of changes.labels) {
    const where = `${item.heading ?? PREAMBLE} / ${item.name}`;
    const column = columnFor(item.name, columns, constrained);
    if (!column) {
      reject(where, `No ${kind} field is stored behind "${item.name}", so this line cannot be accepted.`);
      continue;
    }
    if (column.endsWith("_json")) {
      reject(where, `${column} holds structured items. Edit them in Superdev; one comma separated line cannot be split back apart safely.`);
      continue;
    }
    take(where, column, item.value);
  }

  for (const item of changes.deleted) {
    reject(
      `${item.heading ?? PREAMBLE} / ${item.name}`,
      "This line was removed. Clear the value in Superdev rather than deleting the line.",
    );
  }

  for (const item of changes.prose) {
    const where = item.heading ?? PREAMBLE;
    if (!item.section) {
      reject(where, "This section was removed. Clear the value in Superdev rather than deleting the section.");
      continue;
    }
    const column = item.heading ? columnFor(item.heading, columns, constrained) : null;
    if (!column) {
      // A section backed by child records has a command, and naming it is the
      // difference between a refusal and a dead end. Non-goals invited an edit
      // in its own generated prose and then refused it with nowhere to go, so a
      // reader who did exactly what the document asked had no next step.
      reject(where, WRITTEN_BY[normalizeHeading(item.heading ?? "")]
        ?? `No ${kind} field is projected from this section, so its edit cannot be stored.`);
      continue;
    }
    if (item.section.lines.some((line) => TABLE_ROW.test(line) || LABEL_LINE.test(line))) {
      reject(where, "This section mixes a stored field with child records, so it cannot be read back as one value.");
      continue;
    }
    const value = valueFor(column, item.section.lines);
    if (value === undefined) {
      reject(where, `${column} holds a list, and only a flat bullet list can be read back into it.`);
      continue;
    }
    take(where, column, value);
  }

  return { applied, unmapped, record, kind, values };
}

// ----------------------------------------------------------------- decisions

/**
 * Apply a human edit as the new truth. The mapped sections go into the database
 * first; the file is only touched once every changed section landed, so an edit
 * that is partly unmappable is never half-overwritten.
 */
export async function acceptProposal(root, path, { apply = true, actor = "superdev" } = {}) {
  const doc = await loadDocument(root, path);
  const state = await inspect(root, doc);
  if (state.status === "missing") {
    throw new DbError(
      E.NOT_FOUND,
      `${doc.path} does not exist, so there is no manual edit to accept. Reject the proposal to write it back from the database.`,
    );
  }
  if (state.status === "in_sync") {
    throw new DbError(
      E.NOT_A_PROPOSAL,
      `${doc.path} already matches the database, so there is nothing to accept.`,
    );
  }

  const acceptedBody = normalizeBody(state.body);

  if (!apply) {
    const plan = await query(root, (db) => planAcceptance(db, doc, state));
    return {
      id: doc.id,
      path: doc.path,
      applied: false,
      resolved: false,
      wouldApply: plan.applied,
      unmapped: plan.unmapped,
      message: describe(plan, doc),
    };
  }

  const result = await mutate(root, async (db) => {
    const plan = await planAcceptance(db, doc, state);

    if (plan.applied.length) {
      await patch(db, plan.kind, plan.record.id, plan.record.version, plan.values, {
        projectId: doc.project_id,
        actor,
        activitySummary: `Accepted manual edits to ${doc.path} into ${plan.kind} ${plan.record.id}`,
      });
    }

    if (plan.unmapped.length || !plan.applied.length) {
      // Part of the edit has nowhere to go, so the file keeps the human's text
      // and the proposal stays open. Recording that here means the row never
      // claims to be resolved while the file still differs.
      await db.run(
        "UPDATE documents SET sync_status = 'manual_edit_pending', manual_hash = ? WHERE id = ?",
        state.diskHash, doc.id,
      );
      return { plan, revision: null };
    }

    // Every changed section reached a column, so the file and the database now
    // say the same thing. The body is stored as the current generation and
    // restamped; the next full generation run re-derives it from these values.
    const hash = bodyHash(acceptedBody);
    const event = await recordActivity(db, doc.project_id, {
      type: "documentation_proposal_resolved",
      summary: `Accepted the manual edit to ${doc.path}`,
      actor,
      metadata: {
        document_id: doc.id,
        path: doc.path,
        resolution: "accepted",
        record_id: plan.record.id,
        fields: plan.applied.map((a) => a.column),
        previous_hash: doc.generated_hash,
        accepted_hash: hash,
      },
    });
    await db.run(
      `UPDATE documents
          SET sync_status = 'accepted', manual_hash = NULL, generated_body = ?,
              generated_hash = ?, generated_at = ?, database_revision = ?
        WHERE id = ?`,
      acceptedBody, hash, nowIso(), event.sequence, doc.id,
    );
    return { plan, revision: event.sequence, hash };
  });

  const { plan, revision } = result;
  if (revision !== null) {
    await writeAtomic(
      state.file,
      withMarker({ sourceId: doc.scope_id ?? doc.project_id, revision, body: acceptedBody }),
    );
  }

  return {
    id: doc.id,
    path: doc.path,
    applied: plan.applied,
    unmapped: plan.unmapped,
    resolved: revision !== null,
    revision,
    message: describe(plan, doc),
  };
}

/** Tense neutral, because a dry run and a real acceptance report the same plan. */
function describe(plan, doc) {
  if (!plan.applied.length && !plan.unmapped.length) {
    return `Nothing in ${doc.path} maps to a stored field.`;
  }
  const names = plan.unmapped.map((u) => u.section).join(", ");
  if (!plan.unmapped.length) {
    return `${plan.applied.length} edited section(s) map onto ${plan.kind} ${plan.record.id}.`;
  }
  return plan.applied.length
    ? `${plan.applied.length} section(s) map onto ${plan.kind} ${plan.record.id}. ${doc.path} is left as it is, because these sections could not be applied: ${names}.`
    : `Nothing can be applied. These sections have nowhere to be stored: ${names}.`;
}

/**
 * Discard the edit and put the stored generation back. The discarded text is
 * recorded first, so a rejection is recoverable from the activity feed rather
 * than being the one operation that destroys a person's work.
 */
/** Longest discarded body kept in history. Enough to recognise, not to archive. */
const HISTORY_BODY_LIMIT = 2000;

/**
 * What is safe to keep forever. The text is screened for credentials and home
 * paths and then capped, because the table it lands in cannot be edited or
 * deleted afterwards.
 */
function clipForHistory(body) {
  const clean = sanitizeExternal(String(body ?? ""));
  return clean.length > HISTORY_BODY_LIMIT
    ? `${clean.slice(0, HISTORY_BODY_LIMIT)}\n[truncated, ${clean.length - HISTORY_BODY_LIMIT} more characters]`
    : clean;
}

export async function rejectProposal(root, path, { apply = true, actor = "superdev" } = {}) {
  const doc = await loadDocument(root, path);
  const state = await inspect(root, doc);
  if (state.status === "in_sync") {
    throw new DbError(
      E.NOT_A_PROPOSAL,
      `${doc.path} already matches the database, so there is no edit to discard.`,
    );
  }
  if (doc.generated_body === null || doc.generated_body === undefined) {
    throw new DbError(
      E.NO_GENERATED_BODY,
      `${doc.path} has no stored generation to restore. Regenerate documentation before rejecting this edit.`,
    );
  }

  const body = normalizeBody(doc.generated_body);
  const hash = bodyHash(body);

  if (!apply) {
    return {
      id: doc.id,
      path: doc.path,
      applied: false,
      resolved: false,
      discardedHash: state.diskHash,
      message: `Would discard the edit to ${doc.path} and restore the generated file.`,
    };
  }

  const revision = await mutate(root, async (db) => {
    const event = await recordActivity(db, doc.project_id, {
      type: "documentation_proposal_resolved",
      summary: `Discarded the manual edit to ${doc.path} and restored the generated file`,
      actor,
      metadata: {
        document_id: doc.id,
        path: doc.path,
        resolution: "rejected",
        discarded_hash: state.diskHash,
        // Kept in full. A rejection that could not be undone would make the
        // proposal flow more dangerous than the silent overwrite it replaces.
        // Sanitized and capped before it enters an append-only table. A hand
        // edit can contain anything, activity_events refuses UPDATE and DELETE,
        // and there is no code path in this repository that could redact a
        // credential once it lands there.
        discarded_body: clipForHistory(state.body),
      },
    });
    await db.run(
      `UPDATE documents
          SET sync_status = 'rejected', manual_hash = NULL, generated_hash = ?,
              generated_at = ?, database_revision = ?
        WHERE id = ?`,
      hash, nowIso(), event.sequence, doc.id,
    );
    return event.sequence;
  });

  await writeAtomic(
    state.file,
    withMarker({ sourceId: doc.scope_id ?? doc.project_id, revision, body }),
  );

  return {
    id: doc.id,
    path: doc.path,
    applied: true,
    resolved: true,
    revision,
    discardedHash: state.diskHash,
    message: `Discarded the manual edit to ${doc.path}. The text is recoverable from the activity event.`,
  };
}
