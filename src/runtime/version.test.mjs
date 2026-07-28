// Assertions on the version comparison the update notice depends on.
//
// This file exists because the function was wrong and nothing could have said
// so. It stripped the pre-release from both sides, so 1.0.0 and 1.0.0-beta.1
// compared equal, and anybody running a pre-release was never told the release
// had shipped. No validator can catch that: it is not a structural claim about
// an artifact, it is arithmetic.
//
// Every case below is a question somebody would ask of the notice, not a case
// invented to raise a count.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { isNewer } from "./version.mjs";

describe("isNewer", () => {
  it("orders by major, then minor, then patch", () => {
    assert.equal(isNewer("1.0.0", "0.9.9"), true);
    assert.equal(isNewer("0.2.0", "0.1.9"), true);
    assert.equal(isNewer("0.1.1", "0.1.0"), true);
    assert.equal(isNewer("0.9.9", "1.0.0"), false);
    assert.equal(isNewer("0.1.9", "0.2.0"), false);
  });

  it("compares numbers rather than text, so 10 beats 9", () => {
    // A string comparison would put 0.9.0 above 0.10.0 and never offer the
    // update, which is the failure this line exists to prevent.
    assert.equal(isNewer("0.10.0", "0.9.0"), true);
    assert.equal(isNewer("0.9.0", "0.10.0"), false);
    assert.equal(isNewer("1.0.0", "0.100.0"), true);
  });

  it("says no when the versions are the same", () => {
    assert.equal(isNewer("0.1.0", "0.1.0"), false);
    assert.equal(isNewer("1.2.3", "1.2.3"), false);
  });

  it("treats a release as newer than any pre-release of it", () => {
    // The defect this file was written for. Reported false, so a user on a
    // pre-release was told nothing when the release arrived.
    assert.equal(isNewer("1.0.0", "1.0.0-beta.1"), true);
    assert.equal(isNewer("1.0.0", "1.0.0-rc.1"), true);
    assert.equal(isNewer("0.2.0", "0.2.0-alpha"), true);
  });

  it("never offers a pre-release to somebody on the release", () => {
    assert.equal(isNewer("1.0.0-beta.1", "1.0.0"), false);
    assert.equal(isNewer("0.2.0-alpha", "0.2.0"), false);
  });

  it("orders two pre-releases the way semver states", () => {
    assert.equal(isNewer("1.0.0-beta.2", "1.0.0-beta.1"), true);
    assert.equal(isNewer("1.0.0-beta.1", "1.0.0-beta.2"), false);
    assert.equal(isNewer("1.0.0-beta.11", "1.0.0-beta.2"), true);
    assert.equal(isNewer("1.0.0-beta", "1.0.0-alpha"), true);
    // Fewer identifiers is lower precedence, rather than a missing zero.
    assert.equal(isNewer("1.0.0-beta.1", "1.0.0-beta"), true);
    // A numeric identifier ranks below an alphanumeric one.
    assert.equal(isNewer("1.0.0-alpha", "1.0.0-1"), true);
  });

  it("offers nothing when either version cannot be read", () => {
    // The registry can return an unexpected shape, and self() reports "unknown"
    // when the manifest is unreadable. Neither is evidence that an update
    // exists, so both mean no notice. Writing this down found the second defect
    // in this function: an unreadable version left minor and patch undefined,
    // every comparison ran through NaN, and false came back by accident.
    assert.equal(isNewer(undefined, "0.1.0"), false);
    assert.equal(isNewer(null, "0.1.0"), false);
    assert.equal(isNewer("", "0.1.0"), false);
    assert.equal(isNewer("0.1.0", undefined), false);
    assert.equal(isNewer("0.1.0", "unknown"), false);
    assert.equal(isNewer("not-a-version", "0.1.0"), false);
    assert.equal(isNewer("1.2", "1.1.0"), false);
  });

  it("reads a version with a leading v, which tags carry", () => {
    assert.equal(isNewer("v1.0.0", "0.9.0"), true);
    assert.equal(isNewer("v0.1.0", "v0.1.0"), false);
  });

  it("ignores build metadata, which carries no precedence", () => {
    assert.equal(isNewer("1.0.0+build.7", "1.0.0"), false);
    assert.equal(isNewer("1.0.1+build.7", "1.0.0"), true);
  });
});
