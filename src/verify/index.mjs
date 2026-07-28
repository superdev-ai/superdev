// Re-run the checks that evidence stands on.
//
// Completion is gated on evidence, and evidence was a sentence written once and
// believed forever. Nothing re-read it, so a task completed in January still
// claimed to be proven in June by a check that had stopped passing in March.
// The schema always expected better: verification_evidence has carried status,
// stale_at and content_hash from the first migration, and nothing ever set them.
//
// So evidence carries the command that proved it, and this re-runs them. A
// claim that no longer holds is marked stale and reported. Whether that reopens
// the task is a separate decision: reporting first, and gating once the backlog
// is clean, is the order that does not disrupt work in flight.
//
// Not every verification has a command. Reading a screenshot, confirming a
// decision with the owner, watching a migration take a backup: requiring a
// command for those would only encourage inventing one, which is worse than
// saying plainly that a check is manual.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { mutate, query } from "../db/store.mjs";

const run = promisify(execFile);

/**
 * What may run unattended, enumerated by exact shape.
 *
 * A recorded command is text that arrived from somewhere, most often from an
 * agent, and it is executed on the machine of whoever runs verify. An earlier
 * version of this allowed a list of programs and rejected a list of dangerous
 * substrings. That is the wrong way round, and a security review was right to
 * say so: a program allowlist plus a substring blocklist does not make argv
 * safe, because the danger usually lives in a flag rather than in the program.
 *
 *   rg --pre=/bin/sh          runs an arbitrary program per file
 *   node --require=./evil.js  loads a module before the script
 *   npm run <anything>        runs whatever package.json says
 *   git --exec-path=/tmp      relocates the helper binaries git then runs
 *
 * Each of those passes a program allowlist and carries no shell punctuation.
 *
 * So the shapes are enumerated instead. Only two are allowed, and both are
 * things this project actually records: one of its own scripts, and grep. Every
 * token beginning with a hyphen must appear in that program's flag allowlist,
 * and no positional argument may look like a flag. Nothing here needs npm, git,
 * sed or ripgrep, and breadth that is never used is only attack surface.
 *
 * This is a narrow gate, not a sandbox. A check that needs more than this
 * should be run by a person who has read it.
 */

/** Scripts of this project that may be run, and nothing else. */
const SCRIPT = /^(src\/cli\.mjs|scripts\/[A-Za-z0-9_\/-]+\.mjs)$/;

/**
 * Flags each program may carry.
 *
 * grep cannot execute anything, but its arguments are still constrained so a
 * pattern can never be read as a flag.
 */
const FLAGS = {
  grep: new Set(["-n", "-i", "-c", "-l", "-L", "-E", "-F", "-w", "-x", "-o", "-r", "-R", "-q", "-s", "-H", "-h", "-a"]),
  // The script's own flags are read by the script, not by node, so they are
  // constrained only by refusing anything that would change state.
  node: null,
};

const CHANGES_STATE = /^--(apply|force|write|fix|delete|remove)\b/;

export const E = { UNSAFE: "E_UNSAFE_CHECK" };

/** Why a command will not be run here, or null when it will. */
export function refuseReason(command) {
  const text = String(command ?? "").trim();
  if (!text) return "no command recorded";
  // Shell punctuation cannot do anything through execFile, but its presence
  // means the command was written expecting a shell and will not behave.
  if (/[;&|<>`$()]/.test(text)) return "written for a shell, so it cannot run without one";

  const tokens = tokenize(text);
  const [bin, ...rest] = tokens;

  // A check that runs the checker is a loop, and it always reports a failure
  // that says nothing: verify exits non-zero whenever anything could not run,
  // so verify running verify can never pass however healthy the project is.
  // The same shape made the integrity test plan unable to pass once it had
  // failed once. A claim about verify has to be proven by watching it, not by
  // asking it about itself.
  if (/\bcli\.mjs\s+verify\b/.test(text)) {
    return "it runs verify, which is what is running it, so the answer would only ever describe the loop";
  }

  if (bin === "node") {
    // The script path must come first. A node option before it can load
    // arbitrary code, which is the whole risk with running node at all.
    const [script, ...args] = rest;
    if (!script) return "node with no script";
    if (!SCRIPT.test(script)) return `node may only run this project's own scripts, not ${script}`;
    for (const a of args) {
      if (CHANGES_STATE.test(a)) return "it would change something, and a check must not";
    }
    return null;
  }

  if (bin === "grep") {
    const allowed = FLAGS.grep;
    let seenSeparator = false;
    let positionals = 0;
    for (const a of rest) {
      if (a === "--") { seenSeparator = true; continue; }
      if (!seenSeparator && a.startsWith("-") && a !== "-") {
        // Combined short flags are one token and several flags. Checking the
        // token whole refused `grep -rn pattern src`, which is safe and
        // ordinary, so each letter is checked instead. A long flag has no
        // letters to split and is still checked as itself.
        const combined = /^-[A-Za-z]{2,}$/.test(a)
          ? [...a.slice(1)].map((letter) => `-${letter}`)
          : [a];
        for (const flag of combined) {
          if (!allowed.has(flag)) {
            return combined.length > 1
              ? `grep flag ${flag}, part of ${a}, is not one this will run`
              : `grep flag ${flag} is not one this will run`;
          }
        }
        continue;
      }
      positionals += 1;
    }
    if (positionals < 1) return "grep with no pattern";
    return null;
  }

  return `${bin} is not a program this will run unattended`;
}

/** Split on whitespace, keeping quoted runs whole. */
export function tokenize(command) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(command))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/**
 * Run one recorded check.
 *
 * A non-zero exit that still produced output counts as a run that failed, not
 * as a broken command: that is exactly the signal worth having, because a
 * validator which starts finding things is how a claim stops being true.
 */
export async function runCheck(root, command, { timeoutMs = 120000 } = {}) {
  const refused = refuseReason(command);
  if (refused) return { result: "error", detail: refused };

  const [bin, ...rest] = tokenize(command);
  try {
    const { stdout } = await run(bin, rest, { cwd: root, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
    return { result: "pass", detail: String(stdout).trim().split("\n").slice(-1)[0]?.slice(0, 160) ?? "" };
  } catch (error) {
    if (typeof error.code === "number") {
      const out = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
      return { result: "fail", detail: out.split("\n").slice(-1)[0]?.slice(0, 160) || `exit ${error.code}` };
    }
    return { result: "error", detail: String(error.message).slice(0, 160) };
  }
}

/**
 * Re-run every current piece of evidence that carries a command.
 *
 * Without `apply` nothing is written, which makes this safe to run at any time
 * and is the mode worth putting in front of a person: it answers "is what we
 * believe still true?" without changing the answer.
 */
export async function verifyEvidence(root, { apply = false, taskId = null, limit = null } = {}) {
  const rows = await query(root, (db) => db.all(
    `SELECT e.id, e.task_id, e.summary, e.check_command, e.result, e.last_check_result, t.status AS task_status
       FROM verification_evidence e
       LEFT JOIN tasks t ON t.id = e.task_id
      WHERE e.status = 'current'
        ${taskId ? "AND e.task_id = ?" : ""}
      ORDER BY e.id`,
    ...(taskId ? [taskId] : []),
  ));

  const withCommand = rows.filter((r) => String(r.check_command ?? "").trim());
  const manual = rows.length - withCommand.length;
  const targets = limit ? withCommand.slice(0, limit) : withCommand;

  const checked = [];
  for (const row of targets) {
    const outcome = await runCheck(root, row.check_command);
    checked.push({ ...row, ...outcome });
  }

  const nowFailing = checked.filter((c) => c.result === "fail");
  const errored = checked.filter((c) => c.result === "error");

  if (apply && checked.length) {
    const at = new Date().toISOString();
    await mutate(root, async (db) => {
      for (const c of checked) {
        await db.run(
          "UPDATE verification_evidence SET last_checked_at = ?, last_check_result = ? WHERE id = ?",
          at, c.result, c.id,
        );
        // Only a check that ran and failed retracts the claim. A command that
        // could not run says nothing about whether the product is correct, and
        // marking evidence stale for it would turn a broken check into a false
        // accusation against working code.
        if (c.result === "fail") {
          await db.run(
            "UPDATE verification_evidence SET status = 'stale', stale_at = ? WHERE id = ?",
            at, c.id,
          );
        }
      }
    });
  }

  return {
    applied: apply,
    evidenceCurrent: rows.length,
    withCommand: withCommand.length,
    manualOnly: manual,
    checked: checked.length,
    stillPassing: checked.filter((c) => c.result === "pass").length,
    noLongerPassing: nowFailing.length,
    couldNotRun: errored.length,
    failing: nowFailing.map((c) => ({ evidence: c.id, task: c.task_id, taskStatus: c.task_status, command: c.check_command, detail: c.detail })),
    unrunnable: errored.map((c) => ({ evidence: c.id, task: c.task_id, command: c.check_command, why: c.detail })),
  };
}
