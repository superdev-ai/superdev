#!/usr/bin/env node
/**
 * Complete-history confidentiality scanner. Where scan.mjs covers the working
 * tree and the git index, this covers ALL of git history: every reachable object
 * (blob, commit, annotated tag), every historical path a blob ever had, commit
 * and tag MESSAGES, and symlink target blobs (a symlink is a blob whose content
 * is its target string, so byte-scanning every blob covers it).
 *
 * Guarantees:
 *  - Never silently skips: an unreadable/oversize object yields a SCAN-UNREADABLE
 *    P0 finding (fail closed), never a silent pass.
 *  - Reuses the exact scanner rules and external denylist (no policy drift).
 *  - Byte-scans binary blobs (denylist / abs-home path / non-allowlisted email /
 *    key markers survive an embedded NUL); text blobs get the full content scan.
 *  - History is immutable: a historical binary-in-a-text-extension blob (e.g. the
 *    pre-fix ingest.mjs) is STILL byte-scanned; only its BIN-TEXT *classification*
 *    finding may be suppressed via an exact (object-id, path) exception, which is
 *    documented and never suppresses a denylist/path/email/key result.
 *  - Denylist values are never echoed.
 *
 * Exit codes: 0 clean, 1 findings, 2 usage/environment error.
 */
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { classifyExtension, bufferIsBinary, loadDenylist, scanBytes, scanContent, redactText, loadAllowBinary } from "./scan.mjs";

const USAGE = `Usage: node scan-history.mjs --root <repo> [--denylist <file>] [--allow-binary <file>] [--history-allow <file>] [--json] [--out <file>]
  Scans every reachable git object, path, and commit/tag message across ALL history.`;
const MAX_BLOB = 512 * 1024 * 1024; // bounded read; overflow fails closed, never silently skips

function git(root, args, opts = {}) {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: MAX_BLOB, ...opts });
}

/** Load the (oid, path) BIN-TEXT exceptions: one "oid path" per line, # comments. */
export function loadHistoryAllow(file) {
  if (!file || !fs.existsSync(file)) return new Set();
  return new Set(
    fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  );
}

/** Map every blob oid to the set of historical paths it ever appeared under. */
function blobPaths(root) {
  const out = git(root, ["rev-list", "--all", "--objects"], { encoding: "utf8" });
  const map = new Map();
  for (const line of out.split("\n")) {
    if (!line) continue;
    const sp = line.indexOf(" ");
    if (sp === -1) continue; // commits/tags have no path
    const oid = line.slice(0, sp), p = line.slice(sp + 1);
    if (!map.has(oid)) map.set(oid, new Set());
    map.get(oid).add(p);
  }
  return map;
}

/** The set of REACHABLE object ids (from all refs, including annotated tag
 *  objects). Dangling/unreachable objects - e.g. a transient staged blob that was
 *  edited before commit and will be garbage-collected - are not part of the
 *  history that can be published, so they are out of scope. */
function reachableOids(root) {
  const set = new Set();
  for (const line of git(root, ["rev-list", "--all", "--objects"], { encoding: "utf8" }).split("\n")) {
    if (line) set.add(line.split(" ")[0]);
  }
  for (const line of git(root, ["for-each-ref", "--format=%(objecttype) %(objectname)", "refs/tags"], { encoding: "utf8" }).split("\n")) {
    if (line.startsWith("tag ")) set.add(line.slice(4).trim()); // annotated tag objects carry a message
  }
  return set;
}

/** Every REACHABLE object, with type. */
function allObjects(root) {
  const reachable = reachableOids(root);
  const out = git(root, ["cat-file", "--batch-all-objects", "--unordered", "--batch-check=%(objecttype) %(objectname)"], { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((l) => { const [type, oid] = l.split(" "); return { type, oid }; }).filter((o) => reachable.has(o.oid));
}

/** Message body of a commit/tag object (everything after the first blank line). */
function objectMessage(root, oid) {
  const raw = git(root, ["cat-file", oid.startsWith("tag:") ? "tag" : "commit", oid.replace(/^tag:/, "")], { encoding: "utf8" });
  const blank = raw.indexOf("\n\n");
  return blank === -1 ? "" : raw.slice(blank + 2);
}

export function runScanHistory({ root, denylistPath, allowBinaryPath, historyAllowPath, allowBinary }) {
  // Confirm this is a git repository up front; a non-repo is an environment error.
  try { git(root, ["rev-parse", "--git-dir"], { encoding: "utf8" }); }
  catch { throw new Error("not a git repository (or git unavailable)"); }

  const denylist = denylistPath ? loadDenylist(denylistPath) : [];
  const allow = allowBinary ?? loadAllowBinary(allowBinaryPath);
  const historyAllow = loadHistoryAllow(historyAllowPath);
  const findings = [];
  const paths = blobPaths(root);
  const objects = allObjects(root);
  let blobs = 0, commits = 0, tags = 0;

  for (const { type, oid } of objects) {
    if (type === "commit") {
      commits++;
      // Author/committer emails live in the header (not the message body) and are
      // scanned as ordinary allowlisted emails; the message body is scanned for
      // denylist entries, absolute home paths, non-allowlisted emails, and keys.
      let msg;
      try { msg = objectMessage(root, oid); }
      catch (e) { findings.push({ ruleId: "SCAN-UNREADABLE", severity: "P0", file: `commit:${oid}`, line: 0, detail: `commit unreadable (${e.code ?? "err"}) - fail closed` }); continue; }
      findings.push(...scanBytes(`commit-message:${oid}`, Buffer.from(msg, "utf8"), denylist));
    } else if (type === "tag") {
      tags++;
      let msg;
      try { msg = objectMessage(root, `tag:${oid}`); }
      catch (e) { findings.push({ ruleId: "SCAN-UNREADABLE", severity: "P0", file: `tag:${oid}`, line: 0, detail: `tag unreadable (${e.code ?? "err"}) - fail closed` }); continue; }
      findings.push(...scanBytes(`tag-message:${oid}`, Buffer.from(msg, "utf8"), denylist));
    } else if (type === "blob") {
      blobs++;
      let buf;
      try { buf = git(root, ["cat-file", "blob", oid]); }
      catch (e) { findings.push({ ruleId: "SCAN-UNREADABLE", severity: "P0", file: `blob:${oid}`, line: 0, detail: `blob unscannable (${e.code ?? "err"}) - fail closed` }); continue; }
      const names = [...(paths.get(oid) ?? [`blob:${oid}`])];
      const label = names[0];
      const binary = bufferIsBinary(buf);
      // Content scan once per blob (same bytes regardless of path).
      if (binary) findings.push(...scanBytes(label, buf, denylist).map((f) => ({ ...f, oid })));
      else findings.push(...scanContent(label, buf.toString("utf8"), denylist).map((f) => ({ ...f, oid })));
      // Classification per historical path (extension depends on the name).
      if (binary) for (const name of names) {
        const cls = classifyExtension(name.split(path.sep).join("/"));
        if (cls === "text") {
          if (!historyAllow.has(`${oid} ${name}`)) // documented, object-scoped exception; content still byte-scanned above
            findings.push({ ruleId: "BIN-TEXT", severity: "P0", file: name, line: 0, oid, detail: "historical text-expected file is binary (leak-scan blind spot)" });
        } else if (cls === "unknown" && !allow.has(name)) {
          findings.push({ ruleId: "BIN-UNCLASSIFIED", severity: "P0", file: name, line: 0, oid, detail: "historical unclassified binary" });
        }
      }
    }
  }

  const safe = findings.map((f) => ({ ...f, file: redactText(f.file, denylist) }));
  const counts = { P0: findings.filter((f) => f.severity === "P0").length, P1: findings.filter((f) => f.severity === "P1").length };
  return { version: 1, mode: "history", root: redactText(path.resolve(root), denylist), stats: { objects: objects.length, blobs, commits, tags }, rulesLoaded: { denylist: denylist.length }, counts, findings: safe };
}

function main() {
  let args;
  try {
    args = parseArgs({ options: { root: { type: "string", default: "." }, denylist: { type: "string" }, "allow-binary": { type: "string" }, "history-allow": { type: "string" }, json: { type: "boolean", default: false }, out: { type: "string" }, help: { type: "boolean", default: false } } }).values;
  } catch (e) { console.error(String(e.message ?? e)); console.error(USAGE); process.exit(2); }
  if (args.help) { console.log(USAGE); process.exit(0); }
  let report;
  try {
    report = runScanHistory({ root: args.root, denylistPath: args.denylist, allowBinaryPath: args["allow-binary"], historyAllowPath: args["history-allow"] });
  } catch (e) { console.error(String(e.message ?? e)); process.exit(2); }
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(`history scan - ${report.findings.length} finding(s), P0=${report.counts.P0} P1=${report.counts.P1} over ${report.stats.objects} objects (${report.stats.blobs} blobs, ${report.stats.commits} commits, ${report.stats.tags} tags)` + report.findings.map((f) => `\n  [${f.severity}] ${f.ruleId} ${f.file}${f.oid ? ` @${f.oid.slice(0, 10)}` : ""}`).join(""));
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 2) + "\n");
  process.exit(report.counts.P0 + report.counts.P1 > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href) main();
