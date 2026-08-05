// Assertions on the words the product puts in front of a reader.
//
// Grammar is arithmetic here, and getting it wrong makes the product look
// broken. Doctor reported "1 session are still marked active but have gone
// quiet", which reads as a defect in Superdev rather than as a fact about
// somebody's housekeeping, and no validator could object: the sentence was
// structurally fine and only wrong about English.
//
// The vocabularies below are also load-bearing. Several are CHECK constraints in
// the schema, so a value drifting out of one of these lists is a write that
// fails at the database with a message nobody can act on.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ACTIVITY_EVENT_TYPES,
  TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  CAPABILITY_AREAS,
  EDGE_CASE_CATEGORIES,
  SPEC_DEPTHS,
  DEPTH_REQUIREMENTS,
  agrees,
  count,
  titleCase,
} from "./vocabulary.mjs";

describe("count", () => {
  it("uses the singular for exactly one", () => {
    assert.equal(count(1, "task"), "1 task");
    assert.equal(count(1, "session"), "1 session");
  });

  it("uses the plural for everything else, including zero", () => {
    assert.equal(count(0, "task"), "0 tasks");
    assert.equal(count(2, "task"), "2 tasks");
    assert.equal(count(97, "task"), "97 tasks");
  });

  it("takes an irregular plural rather than adding an s to it", () => {
    assert.equal(count(2, "category", "categories"), "2 categories");
    assert.equal(count(1, "category", "categories"), "1 category");
    assert.equal(count(3, "piece of evidence", "pieces of evidence"), "3 pieces of evidence");
  });
});

describe("agrees", () => {
  it("chooses the verb that matches the count", () => {
    // The half that was missing when doctor said "1 session are still marked
    // active": count() had the noun right and nothing chose the verb.
    assert.equal(agrees(1, "is", "are"), "is");
    assert.equal(agrees(2, "is", "are"), "are");
    assert.equal(agrees(0, "is", "are"), "are");
    assert.equal(agrees(1, "has", "have"), "has");
    assert.equal(agrees(5, "has", "have"), "have");
  });

  it("reads as a sentence when combined with count", () => {
    const sentence = (n) => `${count(n, "session")} ${agrees(n, "is", "are")} still marked active`;
    assert.equal(sentence(1), "1 session is still marked active");
    assert.equal(sentence(4), "4 sessions are still marked active");
  });
});

describe("titleCase", () => {
  it("turns a stored status into something a person reads", () => {
    assert.equal(titleCase("in_progress"), "In Progress");
    assert.equal(titleCase("complete"), "Complete");
    assert.equal(titleCase("awaiting_decision"), "Awaiting Decision");
  });

  it("leaves nothing behind when given nothing", () => {
    assert.equal(titleCase(""), "");
    assert.equal(titleCase(null), "");
    assert.equal(titleCase(undefined), "");
  });
});

describe("the fixed vocabularies", () => {
  it("names the three specification depths section 9.2 defines", () => {
    // The depth gate reads this list, and the schema constrains the column to
    // it. A fourth depth added here without a migration fails at the database.
    assert.deepEqual(SPEC_DEPTHS, ["microspec", "standard", "full"]);
  });

  it("asks a surface, a contract and a workflow of every depth above microspec", () => {
    // Readiness counts these three against the features whose depth requires
    // them, reading this table to decide which features those are. It used to ask
    // all three of every accepted feature, so a project of honestly-scoped
    // microspecs reported nought of a hundred and two three times over and held
    // readiness thirty points below the truth.
    //
    // Moving any of the three into microspec silently puts every microspec
    // feature back in that denominator, so the split is asserted rather than
    // assumed.
    for (const requirement of ["surfaces", "api_or_data", "workflow"]) {
      assert.ok(!DEPTH_REQUIREMENTS.microspec.includes(requirement),
        `microspec must not owe ${requirement}`);
      assert.ok(DEPTH_REQUIREMENTS.standard.includes(requirement),
        `standard must owe ${requirement}`);
      assert.ok(DEPTH_REQUIREMENTS.full.includes(requirement),
        `full must owe ${requirement}`);
    }
  });

  it("defines requirements for exactly the depths that exist", () => {
    // The gate looks a depth up in this table and a miss reads as "owes
    // nothing", which would accept anything at that depth without a word.
    assert.deepEqual(Object.keys(DEPTH_REQUIREMENTS).sort(), [...SPEC_DEPTHS].sort());
  });

  it("keeps every edge-case category unique and lowercase", () => {
    // The point of a fixed list is that a reader can walk it. A duplicate makes
    // a category unreachable, and a stray capital fails the schema CHECK.
    assert.ok(EDGE_CASE_CATEGORIES.length > 0);
    assert.equal(new Set(EDGE_CASE_CATEGORIES).size, EDGE_CASE_CATEGORIES.length);
    for (const category of EDGE_CASE_CATEGORIES) {
      assert.match(category, /^[a-z][a-z_]*$/, `${category} is not a snake_case identifier`);
    }
  });

  it("keeps the capability areas unique, because readiness answers each once", () => {
    assert.ok(CAPABILITY_AREAS.length > 0);
    assert.equal(new Set(CAPABILITY_AREAS).size, CAPABILITY_AREAS.length);
  });

  it("keeps every activity event type a snake_case identifier", () => {
    assert.ok(ACTIVITY_EVENT_TYPES.length > 0);
    assert.equal(new Set(ACTIVITY_EVENT_TYPES).size, ACTIVITY_EVENT_TYPES.length);
    for (const type of ACTIVITY_EVENT_TYPES) {
      assert.match(type, /^[a-z][a-z_]*$/, `${type} is not a snake_case identifier`);
    }
  });

  it("keeps the terminal task statuses inside the full set", () => {
    // A terminal status the lifecycle does not know about would make a task
    // unreachable: nothing could move it, and nothing would say why.
    for (const status of TERMINAL_TASK_STATUSES) {
      assert.ok(TASK_STATUSES.includes(status), `${status} is not a task status`);
    }
  });
});
