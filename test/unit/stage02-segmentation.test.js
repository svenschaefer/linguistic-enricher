"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage02 = require("../../src/pipeline/stages/segmentation");
const errors = require("../../src/util/errors");

function makeSeed(text) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "canonical",
    canonical_text: text,
    index_basis: {
      unit: "utf16_code_units"
    }
  };
}

function sentenceTexts(seedOut) {
  return seedOut.segments.map(function (s) {
    return seedOut.canonical_text.slice(s.span.start, s.span.end);
  });
}

test("stage02 splits sentences deterministically by sentence punctuation", async function () {
  const out = await stage02.runStage(makeSeed("First one. Second two!\nThird three? Last"));
  assert.equal(out.stage, "segmented");
  assert.deepEqual(sentenceTexts(out), [
    "First one.",
    "Second two!",
    "Third three?",
    "Last"
  ]);
});

test("stage02 does not split after known abbreviations", async function () {
  const out = await stage02.runStage(makeSeed("Dr. Smith went home."));
  assert.deepEqual(sentenceTexts(out), ["Dr. Smith went home."]);
});

test("stage02 does not split period + lowercase patterns", async function () {
  const out = await stage02.runStage(makeSeed("Use e.g. examples."));
  assert.deepEqual(sentenceTexts(out), ["Use e.g. examples."]);
});

test("stage02 preserves empty lines inside sentence spans without emitting empty segments", async function () {
  const out = await stage02.runStage(makeSeed("A.\n\n  B line  \n\nC!"));
  assert.deepEqual(sentenceTexts(out), ["A.\n\n  B line  \n\nC!"]);
});

test("stage02 emits ordered non-overlapping spans and empty token ranges", async function () {
  const out = await stage02.runStage(makeSeed("A. B. C."));
  for (let i = 0; i < out.segments.length; i += 1) {
    const segment = out.segments[i];
    assert.equal(segment.index, i);
    assert.deepEqual(segment.token_range, { start: 0, end: 0 });
    if (i > 0) {
      assert.equal(segment.span.start >= out.segments[i - 1].span.end, true);
    }
  }
});

test("stage02 rejects text that cannot produce sentence segments", async function () {
  await assert.rejects(
    stage02.runStage(makeSeed(" \n   \n\t ")),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("stage02 rejects partial docs with downstream anchors", async function () {
  const seed = makeSeed("A.");
  seed.tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A" }
  ];
  await assert.rejects(
    stage02.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
