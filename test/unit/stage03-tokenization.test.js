"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage03 = require("../../src/pipeline/stages/tokenization");
const errors = require("../../src/util/errors");

function makeSeed(text, unit, segments) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "segmented",
    canonical_text: text,
    index_basis: {
      unit: unit || "utf16_code_units"
    },
    segments: segments || [
      {
        id: "s1",
        index: 0,
        kind: "sentence",
        span: { start: 0, end: text.length },
        token_range: { start: 0, end: 0 }
      }
    ]
  };
}

test("stage03 tokenizes punctuation and preserves token ranges per segment", async function () {
  const seed = makeSeed("A (B), C.");
  const out = await stage03.runStage(seed);
  assert.equal(out.stage, "tokenized");
  assert.deepEqual(
    out.tokens.map(function (t) { return t.surface; }),
    ["A", "(", "B", ")", ",", "C", "."]
  );
  assert.deepEqual(out.segments[0].token_range, { start: 0, end: 7 });
});

test("stage03 keeps curly-apostrophe lexical token as one word", async function () {
  const seed = makeSeed("customer’s payment");
  const out = await stage03.runStage(seed);
  assert.deepEqual(
    out.tokens.map(function (t) { return t.surface; }),
    ["customer’s", "payment"]
  );
});

test("stage03 supports unicode_codepoints index basis", async function () {
  const seed = makeSeed("A😀 B.", "unicode_codepoints", [
    {
      id: "s1",
      index: 0,
      kind: "sentence",
      span: { start: 0, end: 5 },
      token_range: { start: 0, end: 0 }
    }
  ]);
  const out = await stage03.runStage(seed);
  assert.deepEqual(
    out.tokens.map(function (t) { return t.span; }),
    [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 3, end: 4 },
      { start: 4, end: 5 }
    ]
  );
});

test("stage03 supports bytes_utf8 index basis", async function () {
  const seed = makeSeed("A😀 B.", "bytes_utf8", [
    {
      id: "s1",
      index: 0,
      kind: "sentence",
      span: { start: 0, end: 8 },
      token_range: { start: 0, end: 0 }
    }
  ]);
  const out = await stage03.runStage(seed);
  assert.deepEqual(
    out.tokens.map(function (t) { return t.span; }),
    [
      { start: 0, end: 1 },
      { start: 1, end: 5 },
      { start: 6, end: 7 },
      { start: 7, end: 8 }
    ]
  );
});

test("stage03 rejects partial docs with existing token/annotation anchors", async function () {
  const seed = makeSeed("A test.");
  seed.tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A" }
  ];
  await assert.rejects(
    stage03.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("stage03 rejects when segments are missing", async function () {
  const seed = makeSeed("A test.");
  seed.segments = [];
  await assert.rejects(
    stage03.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

