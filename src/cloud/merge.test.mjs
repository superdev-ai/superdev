// Assertions on the merge, where being wrong loses somebody's work in silence.
//
// This is the highest-stakes arithmetic in the product. DEC-TBD-006 refuses last
// writer wins precisely because it drops an edit without saying so, and every
// guarantee of that refusal rests on `compare` returning the right verdict for
// three values that may each be absent.
//
// The engine's first version had exactly that failure, in the orchestration
// rather than here: it advanced the agreed base to this side's own unsent value,
// so the next incoming change looked like the only movement and overwrote a
// local edit with no conflict. Running two copies found it. These assertions
// pin down the half that can be pinned down, so a later edit to the comparison
// cannot reintroduce it quietly.
//
// The vocabulary below is the one the module exports, so a renamed outcome
// breaks these rather than passing under a new name.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { rowHash } from "./crypto.mjs";
import {
  LEASE_MINUTES,
  OUTCOME,
  compare,
  differingFields,
  foreignLeases,
  leaseExpiry,
  leaseHolds,
  mergeFields,
} from "./merge.mjs";

/** A record as it would arrive, with a hash that follows its content. */
const row = (fields) => ({ id: "FEAT-0001", ...fields });

describe("compare", () => {
  it("says nothing to do when neither side has the record", () => {
    assert.equal(compare({ local: null, remote: null, base: null }).outcome, OUTCOME.UNCHANGED);
  });

  it("takes a record only the remote has", () => {
    const verdict = compare({ local: null, remote: row({ purpose: "a" }), base: null });
    assert.equal(verdict.outcome, OUTCOME.NEW_REMOTE);
  });

  it("keeps a record only this side has, rather than treating absence as deletion", () => {
    // Deletion deliberately does not cross. A record removed elsewhere stays
    // here until somebody removes it here too, because a propagated accidental
    // deletion is unrecoverable.
    const verdict = compare({ local: row({ purpose: "a" }), remote: null, base: { base_hash: "x" } });
    assert.equal(verdict.outcome, OUTCOME.LOCAL_ONLY);
  });

  it("does nothing when both sides already hold the same content", () => {
    const same = row({ purpose: "a", version: 3 });
    assert.equal(compare({ local: same, remote: { ...same }, base: null }).outcome, OUTCOME.UNCHANGED);
  });

  it("calls it a conflict when they differ and nothing says what they agreed", () => {
    // Without a base, neither side can claim the other's value is the stale one.
    const verdict = compare({
      local: row({ purpose: "mine" }),
      remote: row({ purpose: "theirs" }),
      base: null,
    });
    assert.equal(verdict.outcome, OUTCOME.BOTH);
  });

  it("takes the remote change when only the remote moved from the base", () => {
    const agreed = row({ purpose: "agreed" });
    const base = { base_hash: hashOf(agreed) };
    const verdict = compare({ local: agreed, remote: row({ purpose: "theirs" }), base });
    assert.equal(verdict.outcome, OUTCOME.REMOTE_ONLY);
  });

  it("keeps the local change when only this side moved from the base", () => {
    const agreed = row({ purpose: "agreed" });
    const base = { base_hash: hashOf(agreed) };
    const verdict = compare({ local: row({ purpose: "mine" }), remote: agreed, base });
    assert.equal(verdict.outcome, OUTCOME.LOCAL_ONLY);
  });

  it("calls it a conflict when both moved from the base", () => {
    // The case the whole design exists for. Anything other than BOTH here means
    // one side's edit is about to be overwritten without anybody being asked.
    const agreed = row({ purpose: "agreed" });
    const base = { base_hash: hashOf(agreed) };
    const verdict = compare({
      local: row({ purpose: "mine" }),
      remote: row({ purpose: "theirs" }),
      base,
    });
    assert.equal(verdict.outcome, OUTCOME.BOTH);
  });

  it("says unchanged when neither moved, even with a base recorded", () => {
    const agreed = row({ purpose: "agreed" });
    const base = { base_hash: hashOf(agreed) };
    assert.equal(compare({ local: agreed, remote: { ...agreed }, base }).outcome, OUTCOME.UNCHANGED);
  });
});

describe("differingFields", () => {
  it("names the fields that actually differ", () => {
    const fields = differingFields(
      row({ purpose: "mine", status: "draft" }),
      row({ purpose: "theirs", status: "draft" }),
    );
    assert.deepEqual(fields.map((f) => f.field), ["purpose"]);
    assert.equal(fields[0].local, "mine");
    assert.equal(fields[0].remote, "theirs");
  });

  it("ignores version and updated_at, which differ by definition", () => {
    // Reporting them tells a reader nothing: once anything else moved, these
    // moved too, and a conflict listing them buries the field that matters.
    const fields = differingFields(
      row({ purpose: "same", version: 1, updated_at: "a" }),
      row({ purpose: "same", version: 9, updated_at: "b" }),
    );
    assert.deepEqual(fields, []);
  });

  it("reports a field present on one side only", () => {
    const fields = differingFields(row({ purpose: "a" }), row({ purpose: "a", note: "added" }));
    assert.deepEqual(fields.map((f) => f.field), ["note"]);
  });

  it("handles a missing side without throwing", () => {
    assert.equal(differingFields(null, row({ purpose: "a" })).length, 2);
    assert.equal(differingFields(row({ purpose: "a" }), null).length, 2);
  });
});

describe("mergeFields", () => {
  it("takes each side's change when they moved different fields", () => {
    const base = { row: { id: "FEAT-0001", purpose: "old", status: "draft" } };
    const { merged, unsettled } = mergeFields({
      local: row({ purpose: "mine", status: "draft" }),
      remote: row({ purpose: "old", status: "accepted" }),
      base,
    });
    assert.deepEqual(unsettled, []);
    assert.equal(merged.purpose, "mine", "the field only this side moved");
    assert.equal(merged.status, "accepted", "the field only the remote moved");
  });

  it("refuses to choose when both moved the same field", () => {
    // There is no correct answer, and inventing one is how a merge quietly
    // loses an edit. The caller is told which field it has to settle.
    const base = { row: { id: "FEAT-0001", purpose: "old" } };
    const { unsettled } = mergeFields({
      local: row({ purpose: "mine" }),
      remote: row({ purpose: "theirs" }),
      base,
    });
    assert.deepEqual(unsettled, ["purpose"]);
  });

  it("treats every difference as unsettled when there is no base", () => {
    const { unsettled } = mergeFields({
      local: row({ purpose: "mine" }),
      remote: row({ purpose: "theirs" }),
      base: null,
    });
    assert.deepEqual(unsettled, ["purpose"]);
  });

  it("leaves the local record alone when nothing differs", () => {
    const same = row({ purpose: "a" });
    const { merged, unsettled } = mergeFields({ local: same, remote: { ...same }, base: null });
    assert.deepEqual(unsettled, []);
    assert.deepEqual(merged, same);
  });
});

describe("leaseHolds", () => {
  it("is not a hold without a holder", () => {
    assert.equal(leaseHolds({ lease_holder: null }), false);
    assert.equal(leaseHolds({}), false);
    assert.equal(leaseHolds(null), false);
  });

  it("holds indefinitely when no expiry was recorded", () => {
    assert.equal(leaseHolds({ lease_holder: "laptop", lease_expires_at: null }), true);
  });

  it("stops holding once it has lapsed", () => {
    // A machine that crashed holding a task must not hold it forever, and
    // nobody should have to clean up after a failure they did not cause.
    assert.equal(leaseHolds(
      { lease_holder: "laptop", lease_expires_at: "2020-01-01T00:00:00.000Z" },
      "2026-01-01T00:00:00.000Z",
    ), false);
  });

  it("holds while it is still in the future", () => {
    assert.equal(leaseHolds(
      { lease_holder: "laptop", lease_expires_at: "2026-06-01T00:00:00.000Z" },
      "2026-01-01T00:00:00.000Z",
    ), true);
  });

  it("does not hold at the exact moment it expires", () => {
    const at = "2026-01-01T00:00:00.000Z";
    assert.equal(leaseHolds({ lease_holder: "laptop", lease_expires_at: at }, at), false);
  });
});

describe("leaseExpiry", () => {
  it("adds the default window to the moment given", () => {
    const from = "2026-01-01T00:00:00.000Z";
    const expected = new Date(Date.parse(from) + LEASE_MINUTES * 60 * 1000).toISOString();
    assert.equal(leaseExpiry(from), expected);
  });

  it("accepts a window of its own", () => {
    assert.equal(leaseExpiry("2026-01-01T00:00:00.000Z", 15), "2026-01-01T00:15:00.000Z");
  });
});

describe("foreignLeases", () => {
  const now = "2026-01-01T00:00:00.000Z";
  const future = "2026-01-01T01:00:00.000Z";
  const past = "2025-12-31T23:00:00.000Z";

  it("reports a live lease held by somebody else", () => {
    const held = foreignLeases(
      { leases: [{ taskId: "TASK-0001", holder: "laptop", expiresAt: future }] },
      "desktop", now,
    );
    assert.deepEqual(held, [{ taskId: "TASK-0001", holder: "laptop", expiresAt: future }]);
  });

  it("ignores this machine's own lease", () => {
    // Refusing a machine its own claim would make a task unclaimable after the
    // first sync.
    const held = foreignLeases(
      { leases: [{ taskId: "TASK-0001", holder: "desktop", expiresAt: future }] },
      "desktop", now,
    );
    assert.deepEqual(held, []);
  });

  it("ignores a lease that has lapsed", () => {
    const held = foreignLeases(
      { leases: [{ taskId: "TASK-0001", holder: "laptop", expiresAt: past }] },
      "desktop", now,
    );
    assert.deepEqual(held, []);
  });

  it("copes with a bundle carrying no leases at all", () => {
    assert.deepEqual(foreignLeases({}, "desktop", now), []);
    assert.deepEqual(foreignLeases(null, "desktop", now), []);
  });
});

/**
 * The hash the module itself would compute, so a base built here matches what
 * the comparison expects. Using the real one keeps these assertions honest: a
 * change to how rows are hashed changes both sides together.
 */
function hashOf(record) {
  return rowHash(record);
}
