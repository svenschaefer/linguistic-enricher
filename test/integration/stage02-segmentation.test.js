"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");
const errors = require("../../src/util/errors");

function segmentTexts(seedOut) {
  return seedOut.segments.map(function (s) {
    return seedOut.canonical_text.slice(s.span.start, s.span.end);
  });
}

test("runPipeline segmented target returns deterministic punctuation-based segmentation", async function () {
  const input = "First one.  Second two!\n\n  Third line\nFourth?";
  const out = await api.runPipeline(input, { target: "segmented" });

  assert.equal(out.stage, "segmented");
  assert.equal(Array.isArray(out.segments), true);
  assert.deepEqual(segmentTexts(out), [
    "First one.",
    "Second two!",
    "Third line\nFourth?"
  ]);
});

test("runPipeline segmented does not split known abbreviations", async function () {
  const out = await api.runPipeline("Dr. Smith went home.", { target: "segmented" });
  assert.deepEqual(segmentTexts(out), ["Dr. Smith went home."]);
});

test("runPipeline segmented rejects partial docs with token anchors", async function () {
  const partial = {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "tokenized",
    canonical_text: "Hello world",
    index_basis: { unit: "utf16_code_units" },
    segments: [
      {
        id: "s1",
        index: 0,
        span: { start: 0, end: 11 },
        token_range: { start: 0, end: 2 }
      }
    ],
    tokens: [
      {
        id: "t1",
        i: 0,
        segment_id: "s1",
        span: { start: 0, end: 5 },
        surface: "Hello"
      },
      {
        id: "t2",
        i: 1,
        segment_id: "s1",
        span: { start: 6, end: 11 },
        surface: "world"
      }
    ],
    annotations: []
  };

  await assert.rejects(
    api.runPipeline(partial, { target: "segmented" }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
