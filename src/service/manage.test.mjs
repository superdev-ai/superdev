// Assertions on how a service names the project holding a port.
//
// Every message about a busy port described it without saying whose it was, even
// though the health probe had already been handed the answer, so diagnosing a
// UI that showed the wrong project meant opening candidate directories one at a
// time. The path is what the reader retypes, so it has to be both correct and
// short enough that the identifying part is not buried.

import { strict as assert } from "node:assert";
import { homedir } from "node:os";
import { describe, it } from "node:test";

import { displayRoot } from "./manage.mjs";

describe("displayRoot", () => {
  const home = homedir();

  it("shortens a path under the home directory", () => {
    assert.equal(displayRoot(`${home}/Projects/thing`), "~/Projects/thing");
  });

  it("leaves a path outside the home directory alone", () => {
    assert.equal(displayRoot("/opt/services/thing"), "/opt/services/thing");
  });

  it("does not shorten a sibling directory that merely starts with the home path", () => {
    // A sibling whose name extends the home directory's must not become a tilde
    // followed by the rest of its name. The separator is the test, not the prefix.
    assert.equal(displayRoot(`${home}-backup/thing`), `${home}-backup/thing`);
  });

  it("leaves the home directory itself alone rather than answering with a bare tilde", () => {
    assert.equal(displayRoot(home), home);
  });
});
