// Repository footprint. Superdev must not turn a repository into a database
// made of small Markdown and JSON tracking files. Tasks, subtasks, assignments,
// status transitions, evidence, activity, sessions, agents, branches, memory,
// sync cursors and conflicts live in SQLite and appear in the control center.
// One file per database row is the failure this rebuild exists to remove.
//
// Two signals, both name-shaped, both checkable without opening a file:
// a file named after a record identifier, and a directory named after an
// operational record kind that has filled up with data documents. Source
// modules are never data documents, so a module named tasks/ or memory/ is not
// a tracking directory and is not reported as one.

import { basename, extname } from "node:path";
import { ERROR, finding, isDirectory, rel, walk } from "./common.mjs";

export const name = "footprint";

/** Identifier prefixes for records that must never become files. */
const OPERATIONAL_IDS = /^(TASK|ASG|SH|EV|EVT|SES|AGT|GBR|MEM|ML|PEER|CONF|POS)-\d{3,}$/;

/** Directory names that describe operational tracking rather than a component. */
const OPERATIONAL_DIRS = new Set([
  "tasks", "subtasks", "assignments", "transitions", "status-history",
  "evidence", "events", "activity", "sessions", "agents", "branches",
  "heartbeats", "memory", "sync", "cursors", "conflicts", "revisions",
  "snapshots", "progress",
]);

/** Extensions that carry data rather than behavior. */
const DATA_EXTENSIONS = new Set([".md", ".json", ".jsonl", ".ndjson", ".yaml", ".yml", ".txt"]);

// Two is already a pattern. One data document in a directory that happens to
// carry an operational name is a specification, not a ledger.
const TRACKING_THRESHOLD = 2;

export async function run(root) {
  const findings = [];
  if (!isDirectory(root)) {
    findings.push(finding("FP-000", ERROR, ".", "the project root does not exist"));
    return { name, findings };
  }

  const files = walk(root);
  if (!files.length) {
    findings.push(finding("FP-000", ERROR, ".", "the project root holds no files"));
    return { name, findings };
  }

  const perDirectory = new Map();

  for (const file of files) {
    const path = rel(root, file);
    const extension = extname(path);
    const stem = basename(path, extension);

    if (DATA_EXTENSIONS.has(extension) && OPERATIONAL_IDS.test(stem)) {
      findings.push(finding("FP-001", ERROR, path,
        `named after the record ${stem}; operational records live in SQLite, never one file each`));
    }

    if (!DATA_EXTENSIONS.has(extension)) continue;
    const segments = path.split("/");
    const kind = segments.slice(0, -1).findLast((segment) => OPERATIONAL_DIRS.has(segment));
    if (!kind) continue;
    const directory = segments.slice(0, segments.lastIndexOf(kind) + 1).join("/");
    const seen = perDirectory.get(directory) ?? { kind, count: 0 };
    seen.count += 1;
    perDirectory.set(directory, seen);
  }

  for (const [directory, { kind, count }] of [...perDirectory].sort()) {
    if (count < TRACKING_THRESHOLD) continue;
    findings.push(finding("FP-002", ERROR, directory,
      `${count} data documents under a directory named ${kind}; this is file-per-record tracking, which belongs in SQLite`));
  }

  return { name, findings };
}
