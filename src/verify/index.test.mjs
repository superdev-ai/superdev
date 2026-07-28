// Assertions on the gate that decides what may run unattended.
//
// This is the one piece of arithmetic here with a security consequence. A
// recorded check is text that arrived from somewhere, usually from an agent, and
// `superdev verify` executes it on the machine of whoever runs it.
//
// The module's own comment records the reasoning: an earlier version allowed a
// list of programs and rejected a list of dangerous substrings, and a review was
// right to say that is the wrong way round, because the danger usually lives in
// a flag rather than in the program name. The shapes below are the ones that
// pass a program allowlist and are still arbitrary code execution:
//
//   rg --pre=/bin/sh          runs a program of its choosing per file
//   node --require=./evil.js  loads a module before the script
//   npm run <anything>        runs whatever package.json says
//   git --exec-path=/tmp      relocates the helpers git then runs
//
// Each is asserted here, so a later widening of the allowlist cannot let one
// back in unnoticed.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { refuseReason, tokenize } from "./index.mjs";

/** Reads better than comparing against null at every call. */
// Containment cannot be judged without knowing what the script would be inside
// of, so every case names a root. The repository itself is a real project root and
// serves as one; cases that must be refused for reasons other than containment
// are refused before the root is consulted.
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

const allowed = (command) => refuseReason(command, ROOT) === null;
const refused = (command) => typeof refuseReason(command, ROOT) === "string";

describe("refuseReason", () => {
  it("allows this project's own scripts", () => {
    assert.ok(allowed("node src/cli.mjs status"));
    assert.ok(allowed("node scripts/validate/validate-all.mjs"));
    assert.ok(allowed("node scripts/validate/validate-all.mjs --only privacy"));
  });

  it("allows grep, which cannot execute anything", () => {
    assert.ok(allowed("grep -n TODO src/cli.mjs"));
    assert.ok(allowed("grep -r pattern src"));
  });

  it("allows combined short flags, letter by letter", () => {
    // Checking the token whole refused `grep -rn pattern src`, which is both
    // safe and the way people actually write it.
    assert.ok(allowed("grep -rn pattern src"));
    assert.ok(allowed("grep -rln pattern src"));
    assert.ok(allowed("grep -iE pattern src"));
  });

  it("still refuses a combined flag hiding one that is not allowed", () => {
    // The reason for decomposing is to check every letter, not to wave them
    // through because they arrived together.
    const why = refuseReason("grep -rf pattern src");
    assert.equal(typeof why, "string");
    assert.ok(why.includes("-f"), "names the letter that is not allowed");
    assert.ok(why.includes("-rf"), "and the token it came in");
  });

  it("refuses a command with nothing in it", () => {
    assert.ok(refused(""));
    assert.ok(refused("   "));
    assert.ok(refused(null));
    assert.ok(refused(undefined));
  });

  it("refuses anything written for a shell", () => {
    // Shell punctuation cannot do anything through execFile, but its presence
    // means the command was written expecting a shell and will not behave.
    for (const command of [
      "node src/cli.mjs status | head",
      "node src/cli.mjs status && rm -rf /",
      "node src/cli.mjs status; echo hi",
      "node src/cli.mjs status > /tmp/out",
      "node src/cli.mjs status $(whoami)",
      "node src/cli.mjs status `whoami`",
    ]) {
      assert.ok(refused(command), `should refuse: ${command}`);
    }
  });

  it("refuses a program that is not on the list", () => {
    for (const command of [
      "curl https://example.com",
      "rm -rf build",
      "npm run something",
      "git log",
      "sh script.sh",
      "python3 script.py",
    ]) {
      assert.ok(refused(command), `should refuse: ${command}`);
    }
  });

  it("refuses node loading anything before the script", () => {
    // The reason node is allowed at all is that it runs this project's scripts.
    // An option ahead of the script path defeats that entirely.
    assert.ok(refused("node --require=./evil.js src/cli.mjs status"));
    assert.ok(refused("node --import=./evil.js src/cli.mjs status"));
    assert.ok(refused("node -e console.log(1)"));
  });

  it("refuses node running a script outside this project", () => {
    assert.ok(refused("node /tmp/evil.mjs"));
    assert.ok(refused("node ../outside/thing.mjs"));
    assert.ok(refused("node node_modules/.bin/something"));
  });

  it("allows a script anywhere inside the project, whatever the layout", () => {
    // The allowlist used to be Superdev's own two paths, so a check at
    // apps/web/lib/thing.check.mjs or lib/check.mjs was permanently unrunnable in
    // anybody else's repository, and the refusal called them "not this project's
    // own scripts" while describing a different project entirely.
    assert.ok(allowed("node src/cli.mjs status"));
    assert.ok(allowed("node scripts/check/release-criteria.mjs"));
    assert.ok(allowed("node apps/web/lib/thing.check.mjs"));
    assert.ok(allowed("node lib/check.mjs"));
    assert.ok(allowed("node tools/verify/data.cjs"));
  });

  it("refuses a path that climbs out of the project even with a script name", () => {
    assert.ok(refused("node ../../etc/hosts.mjs"));
    assert.ok(refused("node subdir/../../outside.mjs"));
  });

  it("refuses an option in the script position even when it ends in .js", () => {
    // The reason this is its own case: checking the extension first let
    // --require=./evil.js through, because it does end in .js and names no script.
    assert.ok(refused("node --require=./evil.js src/cli.mjs status"));
    assert.ok(refused("node --import=./evil.mjs src/cli.mjs"));
  });

  it("refuses a node command when no project root is known", () => {
    // Whether a relative path is inside the project is not answerable without
    // one, and guessing would be the wrong way to be wrong.
    assert.equal(typeof refuseReason("node lib/check.mjs"), "string");
  });

  it("refuses something that is not a script at all", () => {
    assert.ok(refused("node tools/check.txt"));
    assert.ok(refused("node README.md"));
  });

  it("refuses node with no script at all", () => {
    assert.ok(refused("node"));
  });

  it("refuses a check that would change something", () => {
    // A check that mutates is not a check. Verify runs these unattended and
    // repeatedly, so anything that writes would compound every run.
    for (const command of [
      "node src/cli.mjs db migrate --apply",
      "node src/cli.mjs task complete TASK-0001 --apply",
      "node scripts/thing.mjs --force",
      "node scripts/thing.mjs --write",
      "node scripts/thing.mjs --fix",
      "node scripts/thing.mjs --delete",
      "node scripts/thing.mjs --remove",
    ]) {
      assert.ok(refused(command), `should refuse: ${command}`);
    }
  });

  it("refuses a grep flag that is not on its list", () => {
    // grep cannot execute, and its arguments are still constrained so a pattern
    // can never be read as a flag.
    assert.ok(refused("grep --include=*.mjs pattern src"));
    assert.ok(refused("grep -f patternfile src"));
  });

  it("refuses grep with no pattern", () => {
    assert.ok(refused("grep -n"));
  });

  it("refuses a check that runs verify, which is what runs it", () => {
    // Verify exits non-zero whenever anything could not run, so verify running
    // verify can never pass however healthy the project is. One piece of
    // evidence recorded exactly this and reported only the loop.
    assert.ok(refused("node src/cli.mjs verify"));
    assert.ok(refused("node src/cli.mjs verify --apply"));
  });

  it("says why, in a sentence somebody can act on", () => {
    const why = refuseReason("curl https://example.com");
    assert.equal(typeof why, "string");
    assert.ok(why.includes("curl"), "names the program it will not run");
  });
});

describe("tokenize", () => {
  it("splits on whitespace", () => {
    assert.deepEqual(tokenize("node src/cli.mjs status"), ["node", "src/cli.mjs", "status"]);
  });

  it("keeps a double-quoted run whole", () => {
    // A pattern with a space in it is one argument, and splitting it would
    // silently search for something else.
    assert.deepEqual(
      tokenize('grep -n "two words" src/cli.mjs'),
      ["grep", "-n", "two words", "src/cli.mjs"],
    );
  });

  it("keeps a single-quoted run whole", () => {
    assert.deepEqual(tokenize("grep -n 'two words' src"), ["grep", "-n", "two words", "src"]);
  });

  it("collapses repeated whitespace", () => {
    assert.deepEqual(tokenize("node    src/cli.mjs   status"), ["node", "src/cli.mjs", "status"]);
  });

  it("returns nothing for an empty command", () => {
    assert.deepEqual(tokenize(""), []);
  });
});
