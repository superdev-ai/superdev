// The plugin's hook launcher. Node builtins only, on purpose.
//
// The plugin and the CLI ship separately: skills and this file come from the
// plugin, and everything that touches the database comes from the CLI, which npm
// installs with its native storage engine. So a hook cannot do the work itself,
// and it must not need the engine to exist in order to run.
//
// Pointing hooks.json straight at `superdev hook <event>` almost works. What it
// gets wrong is the case that matters most: somebody who installed the plugin
// and not the CLI sees `sh: superdev: command not found` in their harness, which
// says nothing about what to install or why. A first impression should not be a
// shell error.
//
// So this launcher sits in between. It finds the CLI and hands over, or it
// returns a valid hook response saying exactly what to install. Either way the
// harness gets well-formed output and the session continues, because a hook that
// breaks a session is worse than a hook that does nothing.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const EVENT = process.argv[2] ?? "";

/** Hook events that can carry text back to the agent. */
const CONTEXT_EVENTS = new Set(["SessionStart", "UserPromptSubmit"]);

const EVENT_NAMES = {
  "session-start": "SessionStart",
  "user-prompt-submit": "UserPromptSubmit",
  "post-tool-use": "PostToolUse",
  "pre-compact": "PreCompact",
  "session-end": "SessionEnd",
};

/**
 * Where the CLI would be if it is installed.
 *
 * PATH is searched by hand rather than trusting the shell, because a harness may
 * run this with a PATH that does not include a user's npm prefix, and the answer
 * "not installed" is very different from "installed somewhere I did not look".
 */
function findCli() {
  const name = process.platform === "win32" ? "superdev.cmd" : "superdev";
  const extra = [
    join(process.env.HOME ?? "", ".local", "bin"),
    join(process.env.HOME ?? "", ".npm-global", "bin"),
    "/usr/local/bin",
    "/opt/homebrew/bin",
  ];
  for (const dir of [...(process.env.PATH ?? "").split(delimiter), ...extra]) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** A response the harness will accept, whatever went wrong. */
function respond(text) {
  const hookEventName = EVENT_NAMES[EVENT] ?? EVENT;
  if (text && CONTEXT_EVENTS.has(hookEventName)) {
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: { hookEventName, additionalContext: text },
      suppressOutput: true,
    })}\n`);
  } else {
    process.stdout.write("{}\n");
  }
  process.exit(0);
}

const cli = findCli();
if (!cli) {
  respond([
    "Superdev: the plugin is installed and its command-line tool is not, so nothing can read or write the project record.",
    "Install it with: npm install -g superdev-cli",
    "The plugin carries the skills; the CLI carries the database engine, which npm installs for your platform. Nothing else is needed.",
  ].join("\n"));
}

// Hand over completely: same stdin, same stdout, same exit code. From here the
// CLI owns the hook contract and this file has no further opinion about it.
const child = spawn(cli, ["hook", EVENT], { stdio: "inherit" });
child.on("error", () => respond(
  "Superdev: its command-line tool was found but could not be started. Check that npm install -g superdev-cli completed, then run superdev --version.",
));
child.on("close", (code) => process.exit(code ?? 0));
