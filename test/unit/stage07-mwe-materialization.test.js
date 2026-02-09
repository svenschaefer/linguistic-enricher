"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage07 = require("../../src/pipeline/stages/mwe-materialization");
const errors = require("../../src/util/errors");

function buildSeed() {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "mwe_pattern_candidates",
    canonical_text: "online store shopping cart",
    index_basis: { unit: "utf16_code_units" },
    segments: [
      { id: "s1", index: 0, kind: "sentence", span: { start: 0, end: 26 }, token_range: { start: 0, end: 4 } }
    ],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 6 }, surface: "online", flags: { is_punct: false } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 7, end: 12 }, surface: "store", flags: { is_punct: false } },
      { id: "t3", i: 2, segment_id: "s1", span: { start: 13, end: 21 }, surface: "shopping", flags: { is_punct: false } },
      { id: "t4", i: 3, segment_id: "s1", span: { start: 22, end: 26 }, surface: "cart", flags: { is_punct: false } }
    ],
    annotations: [
      {
        id: "a1",
        kind: "mwe",
        status: "candidate",
        label: "online store",
        surface: "online store",
        anchor: {
          selectors: [
            { type: "TokenSelector", token_ids: ["t1", "t2"] }
          ]
        },
        sources: [{ name: "candidate-construction", kind: "rule" }]
      },
      {
        id: "a2",
        kind: "mwe",
        status: "candidate",
        label: "online store",
        surface: "online store",
        anchor: {
          selectors: [
            { type: "TokenSelector", token_ids: ["t1", "t2"] }
          ]
        },
        sources: [{ name: "candidate-construction", kind: "rule" }]
      },
      {
        id: "x1",
        kind: "dependency",
        status: "observation",
        label: "nsubj"
      }
    ]
  };
}

test("stage07 materializes mwe candidates to accepted with normalized selectors and source evidence", async function () {
  const out = await stage07.runStage(buildSeed());
  assert.equal(out.stage, "mwe_materialized");
  const first = out.annotations[0];
  assert.equal(first.status, "accepted");

  const span = first.anchor.selectors.find(function (s) { return s.type === "TextPositionSelector"; });
  const quote = first.anchor.selectors.find(function (s) { return s.type === "TextQuoteSelector"; });
  assert.deepEqual(span.span, { start: 0, end: 12 });
  assert.equal(quote.exact, "online store");

  const materialization = first.sources.find(function (s) { return s.name === "mwe-materialization"; });
  assert.equal(typeof materialization, "object");
  assert.equal(materialization.evidence.head_token_id, "t2");
});

test("stage07 marks duplicate candidate token spans as observation and leaves non-mwe untouched", async function () {
  const out = await stage07.runStage(buildSeed());
  assert.equal(out.annotations[1].status, "observation");
  assert.equal(out.annotations[2].kind, "dependency");
  assert.equal(out.annotations[2].status, "observation");
});

test("stage07 rejects unknown token references", async function () {
  const seed = buildSeed();
  seed.annotations[0].anchor.selectors[0].token_ids = ["t1", "missing"];
  await assert.rejects(
    stage07.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("stage07 rejects non-contiguous token spans", async function () {
  const seed = buildSeed();
  seed.annotations[0].anchor.selectors[0].token_ids = ["t1", "t3"];
  await assert.rejects(
    stage07.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

