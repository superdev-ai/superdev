// Assertions on the parser that reads somebody's brief.
//
// This is the first thing a new user meets, and the place where being wrong is
// least visible: a misread brief produces a plausible-looking product map, and
// nobody can tell it is wrong without comparing it against the document by hand.
//
// Two defects here were found that way, both by running a real initialization
// and reading the output:
//
//   A hard-wrapped sentence was read line by line, so half a clause became a
//   feature named "The outgoing chef records what is prepped, what ran out, and
//   what the next". Joining the paragraph first fixed it, and also fixed a
//   second symptom: a summary paragraph restating the feature list had been
//   landing as extra features, because each of its lines looked like one
//   sentence on its own.
//
//   The project was named after the directory it happened to be initialized in,
//   so a brief titled "Kitchen Handover" produced a product called Journey.
//
// Every case below is a shape a real brief takes.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { extractFromDocument, paragraphs, titleOf } from "./discovery.mjs";

describe("paragraphs", () => {
  it("joins a hard-wrapped sentence back into one", () => {
    // The defect. Read line by line, this produced two statements and the first
    // was half a clause.
    const joined = paragraphs(
      "The outgoing chef records what is prepped, what ran out, and what the next\nshift must start first.",
    );
    assert.deepEqual(joined, [
      "The outgoing chef records what is prepped, what ran out, and what the next shift must start first.",
    ]);
  });

  it("keeps separate paragraphs separate", () => {
    assert.deepEqual(paragraphs("First one.\n\nSecond one."), ["First one.", "Second one."]);
  });

  it("keeps a heading on its own", () => {
    // A heading classifies everything under it, so joining it to the following
    // prose would lose the classification.
    assert.deepEqual(paragraphs("## Features\nSave a recipe."), ["## Features", "Save a recipe."]);
  });

  it("keeps each bullet on its own", () => {
    assert.deepEqual(
      paragraphs("- Save a recipe.\n- Read the last one.\n* And a third.\n1. And a fourth."),
      ["- Save a recipe.", "- Read the last one.", "* And a third.", "1. And a fourth."],
    );
  });

  it("does not join a bullet into the prose above it", () => {
    assert.deepEqual(
      paragraphs("Some prose here.\n- A bullet."),
      ["Some prose here.", "- A bullet."],
    );
  });

  it("keeps a quote and a fence out of the prose", () => {
    assert.deepEqual(paragraphs("Prose.\n> A quote."), ["Prose.", "> A quote."]);
    assert.deepEqual(paragraphs("Prose.\n```\ncode\n```"), ["Prose.", "```", "code", "```"]);
  });

  it("returns nothing for nothing", () => {
    assert.deepEqual(paragraphs(""), []);
    assert.deepEqual(paragraphs("\n\n\n"), []);
  });
});

describe("titleOf", () => {
  it("takes the document's first heading", () => {
    assert.equal(titleOf("# Kitchen Handover\n\nSome prose."), "Kitchen Handover");
  });

  it("ignores a deeper heading, which names a section rather than the product", () => {
    assert.equal(titleOf("## Features\n\n- One."), null);
  });

  it("skips leading blank lines and prose before the heading", () => {
    assert.equal(titleOf("\n\nA note.\n\n# Recipe Keeper\n"), "Recipe Keeper");
  });

  it("strips Markdown decoration from the title", () => {
    assert.equal(titleOf("# **Kitchen** Handover"), "Kitchen Handover");
  });

  it("finds nothing when the document has no heading", () => {
    assert.equal(titleOf("Just prose, no heading."), null);
    assert.equal(titleOf(""), null);
    assert.equal(titleOf(null), null);
  });
});

describe("extractFromDocument", () => {
  /** What the parser found, as kind and statement pairs, for readable assertions. */
  const found = (text) => extractFromDocument(text).map((i) => [i.kind, i.statement]);

  it("takes the bullets under a features heading", () => {
    const items = found([
      "# Recipe Keeper",
      "",
      "## Features",
      "",
      "- Save a recipe with its ingredients.",
      "- Read the last one.",
    ].join("\n"));
    assert.deepEqual(items, [
      ["feature_candidate", "Save a recipe with its ingredients."],
      ["feature_candidate", "Read the last one."],
    ]);
  });

  it("does not take a wrapped summary paragraph as another feature", () => {
    // The second symptom of the same defect. Each line of this paragraph looked
    // like a single sentence, so both were taken, duplicating the bullets below.
    const items = found([
      "## What it does",
      "",
      "The outgoing chef records what is prepped, what ran out, and what the next",
      "shift must start first. The incoming chef reads it before service.",
      "",
      "## Features",
      "",
      "- Record a handover note.",
    ].join("\n"));
    assert.deepEqual(items, [["feature_candidate", "Record a handover note."]]);
  });

  it("takes a problem written as prose, because that is how a problem is written", () => {
    // Every brief writes its problem as a paragraph. The single-sentence rule
    // dropped a two-sentence one silently, and the report then told somebody who
    // had just stated their problem that nothing stated it.
    const items = found([
      "## Problem",
      "",
      "Handover happens verbally, at the busiest moment of the day. What is",
      "prepped gets lost, so the next shift duplicates prep.",
    ].join("\n"));
    assert.equal(items.length, 1);
    assert.equal(items[0][0], "problem");
    assert.match(items[0][1], /^Handover happens verbally.*duplicates prep\.$/);
  });

  it("still refuses a multi-sentence paragraph for a kind written as a list", () => {
    // The rule the prose exception must not undo. A summary paragraph under a
    // features heading is prose about the features, not another feature.
    const items = found([
      "## Features",
      "",
      "The chef records what is prepped. The next chef reads it before service.",
      "",
      "- Record a handover note.",
    ].join("\n"));
    assert.deepEqual(items, [["feature_candidate", "Record a handover note."]]);
  });

  it("takes a single-sentence paragraph under a heading, which is a statement", () => {
    const items = found("## Features\n\nThe chef saves a note at the end of a shift.");
    assert.deepEqual(items, [["feature_candidate", "The chef saves a note at the end of a shift."]]);
  });

  it("never takes a question, which asks for content rather than being content", () => {
    // The rule that would have prevented thirty-three modules named after the
    // questions a module interview asks.
    const items = found("## Features\n\n- Which users interact with it?\n- Save a recipe.");
    assert.deepEqual(items, [["feature_candidate", "Save a recipe."]]);
  });

  it("never takes an instruction to go and find something out", () => {
    const items = found("## Features\n\n- Identify the users.\n- Save a recipe.");
    assert.deepEqual(items, [["feature_candidate", "Save a recipe."]]);
  });

  it("classifies by the heading the text sits under", () => {
    const items = found([
      "## Users", "", "- Head chef.", "",
      "## Constraints", "", "- Runs on a tablet.",
    ].join("\n"));
    assert.deepEqual(items, [
      ["user", "Head chef."],
      ["constraint", "Runs on a tablet."],
    ]);
  });

  it("ignores section numbering when classifying", () => {
    // "4.1 Primary Users" has to classify the same as "Primary Users".
    assert.deepEqual(found("## 4.1 Primary Users\n\n- Head chef."), [["user", "Head chef."]]);
  });

  it("skips anything under an unrecognised heading", () => {
    assert.deepEqual(found("## Appendix\n\n- Something.") , []);
  });

  it("skips a section describing an interview rather than the product", () => {
    // A requirements document's own discovery questions are not the product's
    // features, and reading them as such produced modules named after prompts.
    assert.deepEqual(found("## Discovery\n\n- Save a recipe."), []);
  });

  it("takes nothing from an empty document", () => {
    assert.deepEqual(found(""), []);
  });
});
