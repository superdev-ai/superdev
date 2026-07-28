// What kind of testing this repository permits, and what it still refuses.
//
// The rule used to be absolute: no test file of any kind. Its reason was sound
// and is worth restating, because it is the thing this validator still protects.
// Every earlier attempt to keep "just a few" tests grew a fixture project, then
// phase gates over that fixture, then completion claims measured in test counts.
// A simulated product passing its own gates says nothing about the real one, and
// it is worse than saying nothing, because it feels like proof.
//
// What the absolute version also refused was cheap and valuable: an assertion
// that a pure function returns the right answer. The cost of that refusal was
// measured rather than guessed. Of thirteen defects found in one session, seven
// were in pure functions and would each have been caught by two or three lines:
// a paragraph joiner that split a wrapped sentence and produced a feature named
// after half a clause; a backup restore that resolved a bare filename against
// the wrong directory, so the name the product printed could not be handed back
// to it; a version comparison that told nobody on a pre-release that the release
// existed. None of them could fail a validator, because none of them is a
// structural claim. They are arithmetic, and arithmetic is what an assertion is
// for.
//
// So the line moved to where the original reasoning actually pointed:
//
//   Allowed: a `.test.mjs` file beside the source it tests, run by node's own
//   test runner, asserting on functions called directly.
//
//   Still refused: a test directory, a fixture project, any third-party
//   framework, and anything that stands a simulated product up to pass its own
//   gates.
//
// The completion rule is untouched, and it is the part that matters most. A task
// completes on recorded evidence about the real product. A green suite is not
// evidence, a coverage figure is not progress, and neither may ever be offered
// as either.

import { join } from "node:path";
import { ERROR, WARNING, finding, isDirectory, readJson, rel, walk } from "./common.mjs";

export const name = "no-tests";

/** A tree of tests is the shape that grew a fixture project last time. */
const TEST_DIRECTORIES = new Set(["tests", "test", "__tests__", "spec", "fixtures"]);

/** Allowed: beside the source, named for it. Refused: every other shape. */
const COLOCATED_TEST = /^[a-z0-9-]+\.test\.mjs$/;
const OTHER_TEST_FILE = /\.(?:test|spec)\.(?:cjs|js|ts|tsx|jsx)$|\.spec\.mjs$/;

/**
 * Frameworks and their runners. Node's own runner is deliberately absent: it
 * needs no dependency, so it cannot grow one.
 */
const TEST_RUNNER = /\b(?:jest|vitest|mocha|ava|tap|jasmine|karma|cypress|playwright test)\b/;

/** Where a colocated test may live: beside source, not anywhere in the tree. */
const TESTABLE_ROOTS = ["src/", "scripts/"];

export async function run(root) {
  const findings = [];
  if (!isDirectory(root)) {
    findings.push(finding("NT-000", ERROR, ".", "the project root does not exist"));
    return { name, findings };
  }

  // Read the tree once. walk() is a generator over the whole repository and
  // calling it per file turned this validator quadratic.
  const paths = new Set();
  for (const file of walk(root)) paths.add(rel(root, file));

  const trees = new Map();
  let colocated = 0;

  for (const path of paths) {
    const segments = path.split("/");
    const name_ = segments.at(-1);
    const at = segments.findIndex((segment) => TEST_DIRECTORIES.has(segment));

    if (at !== -1 && at < segments.length - 1) {
      const tree = segments.slice(0, at + 1).join("/");
      trees.set(tree, (trees.get(tree) ?? 0) + 1);
      continue;
    }

    if (COLOCATED_TEST.test(name_)) {
      if (!TESTABLE_ROOTS.some((prefix) => path.startsWith(prefix))) {
        findings.push(finding("NT-005", ERROR, path,
          `a unit test belongs beside the source it tests, under ${TESTABLE_ROOTS.join(" or ")}`));
        continue;
      }
      // The source it names has to exist, or it tests nothing and will keep
      // passing after that source is deleted.
      const subject = path.replace(/\.test\.mjs$/, ".mjs");
      if (!paths.has(subject)) {
        findings.push(finding("NT-006", ERROR, path,
          `there is no ${subject} for this to test, so it asserts on nothing that ships`));
        continue;
      }
      colocated += 1;
      continue;
    }

    if (OTHER_TEST_FILE.test(name_)) {
      findings.push(finding("NT-001", ERROR, path,
        "test file; a unit test is named <source>.test.mjs and sits beside its source"));
    }
  }

  for (const [tree, count] of [...trees].sort()) {
    findings.push(finding("NT-002", ERROR, tree,
      `test or fixture tree holding ${count} file(s); a unit test sits beside the source it tests, and this repository keeps no fixture project`));
  }

  const { value: pkg } = readJson(join(root, "package.json"));

  // `npm test` is allowed now, and only for node's own runner. A script that
  // reaches for a framework is the first step back toward the tree this refuses.
  for (const [script, command] of Object.entries(pkg?.scripts ?? {})) {
    if (TEST_RUNNER.test(String(command))) {
      findings.push(finding("NT-003", ERROR, "package.json",
        `script "${script}" runs a third-party test runner; unit tests use node --test, which needs no dependency`));
    }
  }
  for (const dependency of Object.keys({ ...pkg?.devDependencies, ...pkg?.dependencies })) {
    if (TEST_RUNNER.test(dependency)) {
      findings.push(finding("NT-004", ERROR, "package.json",
        `dependency "${dependency}" is a test framework; unit tests use node --test`));
    }
  }

  // Tests that nothing runs are the same as no tests, with more upkeep.
  if (colocated > 0 && !pkg?.scripts?.test) {
    findings.push(finding("NT-007", WARNING, "package.json",
      `${colocated} unit test file(s) exist and no "test" script runs them`));
  }

  return { name, findings };
}
