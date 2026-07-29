// Assertions on the status-to-state mapping the charts are filled from.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { stateOf } from "./figure-state.mjs";

describe("stateOf", () => {
  it("reads the finished statuses as complete", () => {
    for (const status of ["complete", "verified", "specified", "met", "accepted", "passed"]) {
      assert.equal(stateOf(status), "complete", status);
    }
  });

  it("reads the in-flight statuses as active", () => {
    for (const status of ["in_progress", "in_review", "verifying", "live"]) {
      assert.equal(stateOf(status), "active", status);
    }
  });

  it("keeps needing attention separate from stopped", () => {
    // At risk is not blocked. Colouring them alike overstates every one of them.
    for (const status of ["at_risk", "awaiting_decision", "stale", "unmet"]) {
      assert.equal(stateOf(status), "attention", status);
    }
    for (const status of ["blocked", "failed", "conflict", "offline"]) {
      assert.equal(stateOf(status), "blocked", status);
    }
  });

  it("reads a withdrawn thing as retired rather than as finished", () => {
    for (const status of ["superseded", "deprecated", "deferred", "retired"]) {
      assert.equal(stateOf(status), "retired", status);
    }
  });

  it("falls back to idle for anything unknown, never to complete", () => {
    for (const status of ["draft", "ready", "paused", "cancelled", "something_new", "", null, undefined]) {
      assert.equal(stateOf(status), "idle", String(status));
    }
  });

  it("does not care about case", () => {
    assert.equal(stateOf("In_Progress"), "active");
    assert.equal(stateOf("COMPLETE"), "complete");
  });
});
