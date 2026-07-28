// Do the skills tell an agent to run commands that exist, with flags that exist?
//
// A skill is read by an agent that then runs what it says. A skill documenting
// a command shape the CLI never had does not fail loudly: the agent runs it,
// the flag is ignored or refused, and the agent spends its time working out why
// the product will not do what its own documentation promised.
//
// That is not hypothetical either. The task skill documented completion as
//   SD task complete <id> --evidence-type ... --result ... --reference ...
// for as long as task complete has existed, and task complete has never read
// any of those three flags. There was no command to record evidence at all, so
// the documented flow could not be followed and no task could be completed.
//
// This validator reads the CLI as the source of truth and the skills as claims
// about it.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ERROR, WARNING, finding, rel } from "./common.mjs";

export const name = "skill-commands";

/** Flags every command accepts, handled by the runner rather than a command. */
const GLOBAL_FLAGS = new Set([
  "apply", "json", "help", "root", "actor", "session", "quiet", "verbose", "yes",
]);

/**
 * The command table, and the flags each command actually reads.
 *
 * Flags are found by reading each command function for ctx.flags.<name> and
 * requireFlag(ctx.flags, "<name>"), which is how every command reads one.
 */
function cliContract(root) {
  const source = readFileSync(join(root, "src/cli.mjs"), "utf8");

  // The command table maps a command string to its handler function name.
  const table = source.slice(source.indexOf("const COMMANDS = {"));
  const commands = new Map();
  for (const m of table.matchAll(/(?:"([a-z][a-z ]*)"|([a-z][a-z0-9]*))\s*:\s*(cmd[A-Za-z0-9_]+)/g)) {
    commands.set(m[1] ?? m[2], m[3]);
  }

  // Some commands read their flags from a table of [flag, field] pairs rather
  // than naming each one, so a handler that loops over such a table accepts
  // every flag in it. Missing this would report a documented flag that works.
  const flagTables = new Map();
  for (const m of source.matchAll(/const ([A-Z][A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\];/g)) {
    const pairs = [...m[2].matchAll(/\[\s*"([a-zA-Z0-9_]+)"\s*,/g)].map((p) => p[1]);
    if (pairs.length) flagTables.set(m[1], pairs);
  }

  // Each handler's body, from its declaration to the next top level declaration.
  const flagsByHandler = new Map();
  for (const m of source.matchAll(/(?:async )?function (cmd[A-Za-z0-9_]+)\s*\(/g)) {
    const start = m.index;
    const next = source.indexOf("\nasync function ", start + 1);
    const alt = source.indexOf("\nfunction ", start + 1);
    const ends = [next, alt].filter((i) => i > 0);
    const end = ends.length ? Math.min(...ends) : source.length;
    const body = source.slice(start, end);
    const flags = new Set();
    for (const f of body.matchAll(/ctx\.flags\.([A-Za-z0-9_]+)/g)) flags.add(f[1]);
    for (const f of body.matchAll(/requireFlag\(\s*ctx\.flags\s*,\s*"([^"]+)"/g)) flags.add(f[1]);
    for (const f of body.matchAll(/ctx\.flags\[\s*"([^"]+)"\s*\]/g)) flags.add(f[1]);
    for (const [table, names] of flagTables) {
      if (body.includes(table)) for (const n of names) flags.add(n);
    }
    flagsByHandler.set(m[1], flags);
  }

  return { commands, flagsByHandler };
}

/** Every skill file that instructs an agent. */
function skillFiles(root) {
  const dir = join(root, "skills");
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".md")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export async function run(root) {
  const findings = [];
  if (!existsSync(join(root, "src/cli.mjs"))) return { name, findings };

  const { commands, flagsByHandler } = cliContract(root);
  if (commands.size === 0) {
    return {
      name,
      findings: [finding("cli-table-unreadable", ERROR, "src/cli.mjs",
        "No command table could be read from the CLI, so skill commands were not checked.")],
    };
  }

  // Longest first, so "task complete" matches before "task".
  const known = [...commands.keys()].sort((a, b) => b.length - a.length);

  for (const file of skillFiles(root)) {
    const text = readFileSync(file, "utf8");
    const where = rel(root, file);

    // Only code carries instructions. A sentence that mentions the product by
    // name is prose, and reading it as a command invented findings about
    // "why is this failing to start?" being an unknown command.
    // Each span is scanned on its own. Joining them let a lone `SD` span run
    // into the next span, so the alias definition read as an invocation.
    // A fenced block keeps its line breaks: each line is its own command, and
    // joining them ran one command's flags into the next.
    //
    // An inline span is unwrapped, because Markdown breaks a long one across
    // lines and requiring a single line missed every command that wrapped.
    const fenced = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
    // Fences are removed before inline spans are read. A single backtick pair
    // matches happily from the third backtick of an opening fence to the first
    // of the closing one, which swallowed a whole block as one inline span and
    // ran every command in it together.
    const withoutFences = text.replace(/```[a-z]*\n[\s\S]*?```/g, "\n");
    const spans = [
      ...fenced,
      ...[...withoutFences.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\s*\n\s*/g, " ")),
    ];

    // Two shapes carry an invocation: "SD task complete <id>" in a skill, and a
    // bare "task complete <id>" in the command reference tables. The reference
    // is where the flags are documented, so missing it left the canonical list
    // unchecked.
    const invocations = spans.flatMap((span) => {
      const prefixed = [...span.matchAll(/(?:^|\s)(?:SD|superdev)\s+([a-z][a-z0-9 ]*?)(\s*(?:--|<|\[)(?:[^\n]|\\\n)*|\s*$)/g)]
        .map((m) => ({ words: m[1], rest: m[2] || "" }));
      if (prefixed.length > 0) return prefixed;
      // A span is a bare invocation only when it opens with a real command, so
      // prose in backticks is never read as one.
      const bare = span.match(/^([a-z][a-z0-9 ]*?)(\s(?:<|\[|--)[\s\S]*)?$/);
      if (!bare) return [];
      const head = bare[1].trim();
      if (!known.some((c) => head === c || head.startsWith(c + " "))) return [];
      return [{ words: head, rest: bare[2] || "" }];
    });

    for (const m of invocations) {
      const rest = m.rest;
      const words = m.words.trim();
      const command = known.find((c) => words === c || words.startsWith(c + " "));

      if (!command) {
        const first = words.split(/\s+/)[0];
        // Only report when the first word is not a command at all, so a
        // subcommand this validator cannot resolve is not reported twice.
        if (!known.some((c) => c === first || c.startsWith(first + " "))) {
          findings.push(finding("skill-command-unknown", ERROR, where,
            `The skill tells an agent to run "${(words + " " + rest.trim()).trim().slice(0, 60)}", and the CLI has no such command.`));
        }
        continue;
      }

      const flags = flagsByHandler.get(commands.get(command)) ?? new Set();
      for (const f of rest.matchAll(/--([a-zA-Z][a-zA-Z0-9-]*)/g)) {
        const flag = f[1];
        // camelCase in the source, kebab-case in the documentation.
        const camel = flag.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (GLOBAL_FLAGS.has(flag) || flags.has(flag) || flags.has(camel)) continue;
        findings.push(finding("skill-flag-unknown", ERROR, where,
          `The skill documents "${command} --${flag}", and that command never reads --${flag}.`));
      }
    }
  }

  // One finding per distinct claim: a flag documented in four places is one
  // wrong instruction repeated, but each file still needs fixing, so they are
  // kept separate and only exact duplicates within a file are collapsed.
  const seen = new Set();
  const unique = findings.filter((f) => {
    const key = `${f.path}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { name, findings: unique };
}
