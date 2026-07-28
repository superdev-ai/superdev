// Assertions on the rule that tells new work from work being noticed again.
//
// git reports a file as changed until it is committed, so every shell command run
// between an edit and its commit re-reported the same files. The hook recorded
// those as fresh untracked work, and the readiness report then raised its only
// high-severity warning about edits a completed task had already produced and
// evidenced. Any redirect or heredoc is enough to make the hook look, so this
// happened on the first command after every completion.
//
// A modification time settles it. The pending path list cannot, because a flush
// empties it.

import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { movedSince } from "./hooks.mjs";

/** A directory with one file in it, stamped at a known time. */
function project(mtimeSeconds) {
  const root = mkdtempSync(join(tmpdir(), "superdev-hooks-"));
  writeFileSync(join(root, "thing.txt"), "content\n");
  utimesSync(join(root, "thing.txt"), mtimeSeconds, mtimeSeconds);
  return root;
}

describe("movedSince", () => {
  it("reports a file with no attribution at all", () => {
    const root = project(1000);
    assert.deepEqual(movedSince(root, ["thing.txt"], {}).map((m) => m[0]), ["thing.txt"]);
  });

  it("stays silent when the file has not moved since it was accounted for", () => {
    // The defect. This is the same edit being re-reported by git, not new work.
    const root = project(1000);
    assert.deepEqual(movedSince(root, ["thing.txt"], { "thing.txt": 1000 * 1000 }), []);
  });

  it("reports a file that moved after it was accounted for", () => {
    const root = project(2000);
    assert.deepEqual(
      movedSince(root, ["thing.txt"], { "thing.txt": 1000 * 1000 }).map((m) => m[0]),
      ["thing.txt"],
    );
  });

  it("reports a file it cannot read, because missing real work is the worse mistake", () => {
    const root = project(1000);
    assert.deepEqual(movedSince(root, ["gone.txt"], { "gone.txt": 9e15 }).map((m) => m[0]), ["gone.txt"]);
  });

  it("never reports Superdev's own runtime state", () => {
    // The write-ahead log moves on every command. Counting it would make every
    // command look like new work, which decides nothing.
    const root = project(1000);
    mkdirSync(join(root, ".superdev", "runtime"), { recursive: true });
    writeFileSync(join(root, ".superdev", "superdev.db-log"), "x");
    assert.deepEqual(movedSince(root, [".superdev/superdev.db-log"], {}), []);
  });

  it("carries the stamp it read, so the caller records what it actually saw", () => {
    const root = project(1500);
    const [[path, stamp]] = movedSince(root, ["thing.txt"], {});
    assert.equal(path, "thing.txt");
    assert.equal(stamp, 1500 * 1000);
  });
});
