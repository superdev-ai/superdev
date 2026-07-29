// A command that writes must be reachable from the instructions somebody reads.
//
// The previous audit asked whether every record type could be written, and closed
// twenty-one gaps. This one asks a different question: does anything tell the reader
// to write it, at the moment it is needed. The answer was no for fifteen of the
// seventeen newest commands. They existed, they worked, and no skill mentioned any
// of them, so an agent following Superdev's own instructions would never call one.
// A write path nothing routes to is a write path nobody uses.
//
// The same audit found the trigger surfaces pointing at nothing runnable. None of
// the fourteen depth-gate remedies named a command, though the depth gate fires at
// exactly the right moment: you tried to accept a feature and four things are
// missing. None of the seven next-action remedies named one either. And step 7 of
// the feature skill said `SD plan` "stores what is accepted" when `plan` contains no
// write of any kind, so an agent following it believed a feature was recorded when
// nothing had been.
//
// This checks the routing half. Both halves matter: a command with no route is
// invisible, and a remedy with no command is advice.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ERROR, finding, isDirectory, readText, walk } from "./common.mjs";

export const name = "routed";

/**
 * Verbs that mean a command changes the product record.
 *
 * Read from the command names rather than from a list of commands, so a command
 * added later is checked without anybody remembering to add it here. The last two
 * validators written from a remembered list both went stale.
 */
const WRITES = /(?:^| )(record|record-new|create|add|specify|accept|met|supersede|convert|move|rename|update|criterion|condition|goal|state|step|actor|branch|not-applicable|waive|remove|merge|retire|waive)$/;

/**
 * Commands deliberately not routed by a skill, and why.
 *
 * A reason is required, because being on this list is a claim that a reader never
 * needs to be told about the command.
 */
const UNROUTED_ON_PURPOSE = {
  "db migrate": "run by the release and by init; a reader does not choose to migrate",
  "db restore": "recovery, reached from db backup's own output",
  "category restore": "the inverse of retire, named in retire's output",
};

export async function run(root) {
  const findings = [];
  if (!isDirectory(join(root, "skills"))) return { name, findings };

  // One long string per skill tree, so a command wrapped across two lines still
  // matches. Line-based matching missed `SD milestone\n  met` and reported a
  // false gap.
  const instructions = walk(join(root, "skills"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => readText(file) ?? "")
    .join(" ")
    .replace(/\s+/g, " ");

  const cli = readText(join(root, "src/cli.mjs"));
  if (!cli) {
    findings.push(finding("RT-000", ERROR, "src/cli.mjs", "cannot be read, so nothing can be checked against it"));
    return { name, findings };
  }
  const start = cli.indexOf("const COMMANDS = {");
  if (start < 0) {
    findings.push(finding("RT-000", ERROR, "src/cli.mjs", "has no COMMANDS table, so the command list cannot be read"));
    return { name, findings };
  }
  const table = cli.slice(start, cli.indexOf("\n};", start));

  for (const match of table.matchAll(/"([a-z][a-z-]*(?: [a-z][a-z-]*)?)":/g)) {
    const command = match[1];
    if (!WRITES.test(command)) continue;
    if (UNROUTED_ON_PURPOSE[command]) continue;
    if (instructions.includes(`SD ${command}`) || instructions.includes(`superdev ${command}`)) continue;
    findings.push(finding("RT-001", ERROR, "skills/",
      `nothing in skills/ tells a reader to run "${command}", so an agent following the instructions will never call it. Name it at the lifecycle moment it belongs to, or add it to UNROUTED_ON_PURPOSE with the reason it needs no route.`));
  }

  return { name, findings };
}
