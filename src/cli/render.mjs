// Everything a person reads in the terminal is built here, so `cli.mjs` stays
// about dispatch and this file stays about wording.
//
// Three rules the whole file obeys:
//   - eighty columns, because reflowed output in a narrow terminal is unreadable;
//   - a number always says what it counts, so a bare "12" never appears;
//   - a record with no completion contract prints Not measurable, never 0 percent.
//
// Nothing here reads the database. Every function takes plain data, which is
// what makes the same values renderable by the control center without a second
// implementation of the wording.

import { titleCase } from "../model/vocabulary.mjs";

export const WIDTH = 80;

// ------------------------------------------------------------------ primitives

export const clip = (text, width) => {
  const value = String(text ?? "");
  if (width < 4) return value.slice(0, Math.max(0, width));
  return value.length <= width ? value : `${value.slice(0, width - 3)}...`;
};

/** Greedy wrap. Long unbreakable tokens are left to overflow rather than cut. */
export function wrap(text, width = WIDTH, indent = "") {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const limit = Math.max(24, width - indent.length);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= limit) line += ` ${word}`;
    else {
      lines.push(indent + line);
      line = word;
    }
  }
  lines.push(indent + line);
  return lines.join("\n");
}

export const heading = (text) => `${text}\n${"-".repeat(Math.min(WIDTH, String(text).length))}`;

/** A bullet list with a hanging indent, so a wrapped item stays readable. */
export const bullets = (items, indent = "  ") => {
  const live = items.filter((item) => item !== null && item !== undefined && item !== "");
  if (!live.length) return null;
  return live
    .map((item) => {
      const body = wrap(`- ${item}`, WIDTH, `${indent}  `);
      return indent + body.slice(indent.length + 2);
    })
    .join("\n");
};

/**
 * An aligned table. One column absorbs the overflow when the natural widths do
 * not fit, because a table that wraps is worse than a table that truncates.
 */
export function table(headers, rows, { flex = headers.length - 1, width: limit = WIDTH } = {}) {
  if (!rows.length) return null;
  const body = rows.map((row) => headers.map((_, i) => String(row[i] ?? "")));
  const widths = headers.map((header, i) =>
    Math.max(String(header).length, ...body.map((row) => row[i].length), 1),
  );
  // Shrink the flex column first, then whichever is widest, until the row fits.
  // Trimming one column to nothing while another sprawls is how a table stops
  // being readable at exactly the moment it has something to say.
  const gap = 2;
  const MIN = 8;
  const width = () => widths.reduce((n, w) => n + w, 0) + gap * (headers.length - 1);
  while (width() > limit) {
    const widest = widths.indexOf(Math.max(...widths));
    const target = widths[flex] > MIN + 4 ? flex : widest;
    if (widths[target] <= MIN) break;
    widths[target] -= 1;
  }

  const line = (cells) =>
    cells
      .map((cell, i) => (i === cells.length - 1 ? clip(cell, widths[i]) : clip(cell, widths[i]).padEnd(widths[i])))
      .join(" ".repeat(gap))
      .trimEnd();
  return [line(headers.map(String)), ...body.map(line)].join("\n");
}

/** Key and value in two aligned columns, for short definition lists. */
export function pairs(entries, indent = "  ") {
  const live = entries.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!live.length) return null;
  const width = Math.max(...live.map(([key]) => String(key).length));
  return live
    .map(([key, value]) => {
      const label = String(key).padEnd(width);
      const text = String(value);
      const room = WIDTH - indent.length - width - 2;
      if (text.length <= room && !text.includes("\n")) return `${indent}${label}  ${text}`;
      const body = wrap(text, WIDTH, `${indent}${" ".repeat(width + 2)}`);
      return `${indent}${label}  ${body.trimStart()}`;
    })
    .join("\n");
}

// An empty string is a deliberate blank line; null and undefined are absent
// sections. Keeping the two apart is what lets a caller compose spacing.
const stitch = (parts) => parts.filter((part) => part !== null && part !== undefined).join("\n");

const block = (title, body) => (body ? `${heading(title)}\n${body}` : null);

export const status = (value) => titleCase(value);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const shortDate = (iso) => (iso ? String(iso).replace("T", " ").replace(/\.\d+Z?$/, "").replace("Z", "") : "never");

/**
 * The one place a percentage is turned into words. Progress with no completion
 * contract is not zero, it is unmeasurable, and saying so is the point.
 */
export function completion(progress) {
  if (!progress) return "Not measurable";
  if (!progress.measurable || progress.percent === null || progress.percent === undefined) {
    return "Not measurable";
  }
  return `${progress.percent} percent (${progress.completed} of ${progress.total} tracked items done)`;
}

const componentRows = (components = []) =>
  components
    .filter((c) => c.applies)
    .map((c) => [c.name, `${c.done} of ${c.total}`]);

// A line like "Acceptance criteria: 3 of 7" is already in the component table
// directly above it, so repeating it as prose is noise rather than honesty.
const restated = (line, components) =>
  components.some((c) => String(line).startsWith(`${c.name}: `));

function progressBlock(progress) {
  if (!progress) return "";
  const components = progress.components ?? [];
  const rows = componentRows(components);
  const counts = (progress.whatCounts ?? []).filter((line) => !restated(line, components));
  const remains = (progress.whatRemains ?? []).filter((line) => !restated(line, components));
  return stitch([
    `Overall: ${completion(progress)}`,
    rows.length ? pairs(rows) : null,
    counts.length ? `What counts\n${bullets(counts)}` : null,
    remains.length ? `What is left\n${bullets(remains)}` : null,
  ]);
}

// --------------------------------------------------------------------- status

/**
 * The status report. Progress, freshness, one next action and the warnings, in
 * that order, because "how far along" is worthless without "as of when".
 */
export function renderStatus({ project, progress, freshness, next, warnings = [] } = {}) {
  const header = project
    ? stitch([
        `${project.name} (${project.id})`,
        pairs([
          ["Status", status(project.status)],
          ["Revision", progress?.sourceRevision ?? freshness?.revision ?? 0],
          ["Reported at", shortDate(progress?.generatedAt ?? freshness?.generatedAt)],
        ], ""),
      ])
    : "No project has been initialized in this directory yet.";

  return stitch([
    header,
    "",
    block("Progress", progressBlock(progress)),
    "",
    block("Freshness", freshnessBlock(freshness)),
    "",
    block("Next", nextBlock(next)),
    "",
    block(`Alignment warnings (${warnings.length})`, warningTable(warnings)),
  ]).replace(/\n{3,}/g, "\n\n");
}

function freshnessBlock(freshness) {
  if (!freshness) return "";
  const sessions = freshness.sessions ?? [];
  const quiet = sessions.filter((s) => s.stale).length;
  return stitch([
    pairs([
      ["Last activity", `${shortDate(freshness.lastEventAt)} at sequence ${freshness.revision}`],
      ["Last summary", freshness.lastEventSummary],
      ["Documentation", freshness.lastDocumentationGeneratedAt
        ? `built ${shortDate(freshness.lastDocumentationGeneratedAt)}, ${plural(freshness.documentsBehindRevision ?? 0, "file")} behind`
        : "never generated"],
      ["Sessions", `${plural(sessions.length, "active session")}, ${quiet} gone quiet`],
      ["Open conflicts", freshness.openSyncConflicts || null],
    ]),
    freshness.stale
      ? `This picture is out of date:\n${bullets(freshness.reasons ?? [])}`
      : "Nothing suggests this picture is out of date.",
  ]);
}

function nextBlock(next) {
  if (!next) return "";
  return stitch([
    wrap(next.title, WIDTH, ""),
    next.detail ? wrap(next.detail, WIDTH, "  ") : null,
    next.remedy ? wrap(next.remedy, WIDTH, "  ") : null,
    next.alsoWaiting ? `  ${plural(next.alsoWaiting, "other item")} also waiting.` : null,
  ]);
}

const SEVERITY = { high: "High", medium: "Medium", low: "Low" };

/** How many warning rows a summary prints before it starts folding them. */
const WARNING_ROWS = 12;

/**
 * Warnings for a summary, folded so the terminal stays readable.
 *
 * A real project reached 360 alignment warnings, 326 of them the same sentence
 * with a different identifier, and `status` printed every one. A status report
 * that fills the scrollback is a status report nobody reads, so identical
 * shapes are grouped and counted, and the full list stays one command away.
 */
function warningTable(warnings) {
  if (!warnings.length) return "Nothing is out of alignment.";

  // Group by the wording with identifiers removed, so "AC-0001 is met with no
  // current evidence" and "AC-0002 is met..." collapse into one counted row.
  const groups = new Map();
  for (const w of warnings) {
    const shape = String(w.title ?? "").replace(/\b[A-Z]{2,10}-\d{3,}\b/g, "").replace(/\s+/g, " ").trim();
    const key = `${w.severity}\u0000${w.code ?? shape}\u0000${shape}`;
    const group = groups.get(key) ?? { severity: w.severity, shape, members: [] };
    group.members.push(w);
    groups.set(key, group);
  }

  const rows = [];
  for (const g of [...groups.values()].slice(0, WARNING_ROWS)) {
    const first = g.members[0];
    if (g.members.length === 1) {
      rows.push([SEVERITY[g.severity] ?? status(g.severity), first.recordId ?? "", first.title ?? ""]);
      continue;
    }
    const ids = g.members.map((m) => m.recordId).filter(Boolean);
    rows.push([
      SEVERITY[g.severity] ?? status(g.severity),
      `${ids.length} records`,
      `${g.shape || first.title} (${ids.slice(0, 3).join(", ")}${ids.length > 3 ? ", and more" : ""})`,
    ]);
  }

  const shown = [...groups.values()].slice(0, WARNING_ROWS).reduce((n, g) => n + g.members.length, 0);
  const rest = warnings.length - shown;
  const note = rest > 0
    ? `\n${rest} further warning${rest === 1 ? "" : "s"} not shown. Run superdev doctor for the full list with remediation.`
    : "";
  return table(["Severity", "Record", "What is wrong"], rows) + note;
}

/**
 * The same warnings at length. `status` shows the table because it is a summary;
 * `doctor` shows this, because a health report that names a problem without the
 * thing to do about it has made the reader's job harder, not easier.
 */
function findingList(warnings) {
  if (!warnings.length) return null;
  return warnings
    .map((w) => stitch([
      `${(SEVERITY[w.severity] ?? status(w.severity)).padEnd(6)}  ${w.title}`,
      w.detail ? wrap(w.detail, WIDTH, "    ") : null,
      w.remedy ? wrap(`Do: ${w.remedy}`, WIDTH, "    ") : null,
    ]))
    .join("\n");
}

// ---------------------------------------------------------------------- tasks

/** The task list. Statuses are Title Case; ids come after the plain words. */
export function renderTaskList(tasks, { title = "Tasks" } = {}) {
  if (!tasks.length) return stitch([heading(title), "No task matches that filter."]);
  const rows = tasks.map((t) => [
    t.id,
    status(t.status),
    status(t.priority ?? "normal"),
    t.feature_id ?? "",
    t.name ?? "",
  ]);
  return stitch([
    heading(`${title} (${tasks.length})`),
    table(["Id", "Status", "Priority", "Feature", "Name"], rows),
  ]);
}

const listOf = (values) => (Array.isArray(values) ? values : []).map((v) =>
  typeof v === "string" ? v : v?.text ?? v?.criterion ?? JSON.stringify(v));

/** One task in full: what it is for, what it implements, and who holds it. */
export function renderTaskDetail(detail) {
  const {
    task, feature = null, links = [], dependencies = [], subtasks = [],
    assignment = null, evidence = [], history = [],
  } = detail;

  const holder = assignment
    ? `Held since ${shortDate(assignment.assigned_at)} by ${assignment.holder ?? "an unnamed session"}`
    : "Nobody has claimed it.";

  return stitch([
    `${task.id}  ${task.name}`,
    pairs([
      ["Status", status(task.status)],
      ["Priority", status(task.priority ?? "normal")],
      ["Feature", feature ? `${feature.id} ${feature.name}` : task.feature_id],
      ["Parent", task.parent_task_id],
      // A superseded task that does not say what replaced it leaves anybody who
      // found the old identifier, in a commit message or a branch name, with
      // nowhere to go.
      ["Merged into", task.superseded_by],
      ["Estimate", task.estimate],
      ["Due", task.due_at ? shortDate(task.due_at) : null],
      ["Blocked because", task.block_reason],
      ["Enabling work for", task.enabling ? task.enabled_feature_id : null],
    ], ""),
    "",
    block("Why it is needed", task.why_needed ? wrap(task.why_needed, WIDTH, "  ") : ""),
    block("Expected outcome", task.expected_outcome ? wrap(task.expected_outcome, WIDTH, "  ") : ""),
    block("Description", task.description ? wrap(task.description, WIDTH, "  ") : ""),
    block("Completion criteria", bullets(listOf(detail.completionCriteria))),
    block("Verification required", bullets(listOf(detail.verificationRequirements))),
    block("Implements", links.length
      ? bullets(links.map((l) => `${status(l.target_type)} ${l.target_id} (${l.relationship})`))
      : "  Nothing yet. A task cannot leave draft until it implements something."),
    block("Depends on", dependencies.length
      ? bullets(dependencies.map((d) => `${d.id} ${status(d.status)} ${d.name ?? ""}`.trim()))
      : ""),
    block("Subtasks", subtasks.length
      ? table(["Id", "Status", "Name"], subtasks.map((s) => [s.id, status(s.status), s.name]))
      : ""),
    block("Claimed", holder),
    block("Verification recorded", evidence.length
      ? table(["Result", "Recorded", "What was observed"],
          evidence.map((e) => [status(e.result), shortDate(e.recorded_at), e.summary]))
      : "  None recorded."),
    block("History", history.length
      ? table(["When", "From", "To"],
          history.map((h) => [shortDate(h.created_at), status(h.from_status), status(h.to_status)]))
      : ""),
  ]).replace(/\n{3,}/g, "\n\n");
}

// ------------------------------------------------------------------ readiness

const AREA_STATES = ["specified", "awaiting_decision", "deferred", "not_applicable"];

/** The production-readiness checklist. Silent gaps are named, not counted. */
export function renderReadiness(report) {
  const counts = report.areaCounts ?? {};
  const unresolved = (report.areas ?? []).filter(
    (a) => a.state === "awaiting_decision" || a.state === "deferred",
  );
  const modules = (report.modules ?? []).filter((m) => m.applicable > 0);
  const open = report.questions?.open ?? [];
  const deferred = report.questions?.deferred ?? [];

  return stitch([
    heading("Production readiness"),
    progressBlock(report),
    "",
    block("Capability areas", stitch([
      pairs(AREA_STATES.map((s) => [status(s), counts[s] ?? 0])),
      "",
      unresolved.length
        ? bullets(unresolved.map((a) =>
            `${a.area}: ${status(a.state)}${a.silentGap ? " with no owner and no question raised" : ""}`))
        : "  Every area has been answered or recorded as not applicable.",
    ])),
    "",
    block("Module completeness", modules.length
      ? modules.map((m) => stitch([
          `${m.id}  ${m.name}: ${m.filled} of ${m.applicable} applicable steps filled`,
          m.openSteps.length ? wrap(`Still open: ${m.openSteps.map((s) => s.name).join(", ")}`, WIDTH, "    ") : null,
        ])).join("\n")
      : "  No module has a completeness checklist yet."),
    "",
    block(`Open questions (${open.length})`, open.length
      ? open.map((q) => stitch([
          `${q.id}  ${q.question}`,
          wrap(`Why it matters: ${q.whyItMatters}`, WIDTH, "    "),
          q.recommendation ? wrap(`Recommended: ${q.recommendation}`, WIDTH, "    ") : null,
        ])).join("\n")
      : "  Nothing is waiting on an answer."),
    deferred.length
      ? block(`Deferred questions (${deferred.length})`,
          bullets(deferred.map((q) => `${q.id} ${q.question}${q.deferralReason ? ` (deferred: ${q.deferralReason})` : ""}`)))
      : "",
    "",
    block("Documents waiting on a decision", (report.pendingDocumentProposals ?? []).length
      ? bullets(report.pendingDocumentProposals.map((d) => `${d.path} (${d.id})`))
      : "  None."),
  ]).replace(/\n{3,}/g, "\n\n");
}

// ----------------------------------------------------------------------- diff

// A touched section arrives as {heading, added, removed}; older callers pass a
// plain heading. Both are named the same way here.
const sectionName = (section) =>
  typeof section === "string" ? section : section?.heading ?? "the preamble";

/** One document proposal: what changed, where, and the diff itself. */
export function renderDiff(diff) {
  return stitch([
    diff.path,
    pairs([
      ["Status", status(diff.status)],
      ["Changed", `${plural(diff.added ?? 0, "line")} added, ${diff.removed ?? 0} removed`],
      ["Sections", (diff.sections ?? []).map(sectionName).join(", ") || null],
    ], ""),
    "",
    diff.diff ? String(diff.diff).trimEnd() : "  The file matches the database.",
  ]);
}

/** The list of files whose text and records have parted company. */
export function renderProposals(report) {
  const proposals = report.proposals ?? [];
  if (!proposals.length) {
    return `Every generated document matches the database. ${plural(report.scanned ?? 0, "file")} checked.`;
  }
  return stitch([
    heading(`Documents waiting on a decision (${proposals.length})`),
    table(["Path", "Why"], proposals.map((p) => [p.path, status(p.status)]), { flex: 0 }),
    "",
    wrap("Run docs diff with a path to read the change, then docs accept to take it into the database or docs reject to write the generated version back.", WIDTH, ""),
  ]);
}

// --------------------------------------------------------------------- doctor

/**
 * The health report. Every check states its verdict in one word and its reason
 * in one line, so the failing one is findable without reading the rest.
 */
export function renderDoctor({ checks = [], findings = [] } = {}) {
  // Three verdicts, because a check that threw is neither. Pass beside "could
  // not be determined" was a real defect: it is the answer a reader trusts least
  // once they notice it, and most when they do not.
  const verdict = (ok) => (ok === true ? "Pass" : ok === false ? "Problem" : "Unknown");
  const rows = checks.map((c) => [c.name, verdict(c.ok), c.detail ?? ""]);
  const bad = checks.filter((c) => c.ok === false).length;
  const unknown = checks.filter((c) => c.ok !== true && c.ok !== false).length;
  return stitch([
    heading("Doctor"),
    table(["Check", "Verdict", "Detail"], rows),
    "",
    bad
      ? `${plural(bad, "check")} found a problem.`
      : unknown
        ? "No check found a problem."
        : "Every check passed.",
    unknown ? `${plural(unknown, "check")} could not determine an answer, so nothing here vouches for it.` : null,
    findings.length ? "" : null,
    findings.length ? block(`Findings (${findings.length})`, findingList(findings)) : null,
  ]);
}

// -------------------------------------------------------------------- generic

const SENTENCE = (key) =>
  String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

// Keys whose values are vocabulary rather than prose. A raw "manual_edit_pending"
// in otherwise plain output is internal vocabulary leaking into a person's face.
const VOCABULARY = new Set(["status", "state", "kind", "severity", "result", "verdict"]);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const scalar = (value, key = null) => {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && ISO.test(value)) return shortDate(value);
  if (key && VOCABULARY.has(String(key).toLowerCase()) && typeof value === "string") {
    return status(value);
  }
  return String(value);
};

const isScalar = (value) => value === null || value === undefined || typeof value !== "object";

/**
 * A readable outline for a shape this file does not know in advance, which is
 * what plan objects and service reports are. Bounded depth: past four levels the
 * reader wants the JSON output, not more indentation.
 */
export function outline(value, indent = "", depth = 0) {
  if (isScalar(value)) return wrap(scalar(value), WIDTH, indent);
  if (depth >= 4) return `${indent}(nested detail, use --json to read it)`;

  if (Array.isArray(value)) {
    if (!value.length) return `${indent}none`;
    // A list of same-shaped flat records is a table. Printing it as one nested
    // outline per row is how a plan with sixteen entries becomes unreadable.
    const uniform =
      value.length > 1 &&
      value.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry)
        && Object.values(entry).every(isScalar));
    if (uniform) {
      const keys = [...new Set(value.flatMap((entry) => Object.keys(entry)))];
      if (keys.length <= 4) {
        const rows = table(
          keys.map(SENTENCE),
          value.map((entry) => keys.map((k) => scalar(entry[k], k))),
          { width: WIDTH - indent.length },
        );
        if (rows) return rows.split("\n").map((row) => indent + row).join("\n");
      }
    }
    return value
      .map((entry) =>
        isScalar(entry)
          ? wrap(`- ${scalar(entry)}`, WIDTH, indent)
          : `${indent}-\n${outline(entry, `${indent}  `, depth + 1)}`,
      )
      .join("\n");
  }

  const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length));
  if (!entries.length) return `${indent}none`;
  const flat = entries.filter(([, v]) => isScalar(v));
  const deep = entries.filter(([, v]) => !isScalar(v));
  return stitch([
    flat.length ? pairs(flat.map(([k, v]) => [SENTENCE(k), scalar(v, k)]), indent) : null,
    ...deep.map(([k, v]) => `${indent}${SENTENCE(k)}:\n${outline(v, `${indent}  `, depth + 1)}`),
  ]);
}

/** A named block of unknown data, used by the commands whose shape is a plan. */
export const renderReport = (title, value) => stitch([heading(title), outline(value)]);

/**
 * The dry-run footer. It exists once so that no command can forget to say that
 * nothing happened, which is the failure a plan-by-default surface exists to
 * prevent.
 */
export const dryRunNote = (what) =>
  `\nNothing has changed. Re-run with --apply to ${what}.`;

export { stitch, block, plural, shortDate };
