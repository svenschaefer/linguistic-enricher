"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");
const errors = require("../../src/util/errors");

test("runPipeline tokenized target returns deterministic token stream", async function () {
  const input = "Alice's cart, paid.";
  const out = await api.runPipeline(input, { target: "tokenized" });

  assert.equal(out.stage, "tokenized");
  assert.deepEqual(
    out.tokens.map(function (t) { return t.surface; }),
    ["Alice", "'s", "cart", ",", "paid", "."]
  );
  assert.deepEqual(out.segments[0].token_range, { start: 0, end: 6 });
});

test("runPipeline tokenized preserves prototype-like contraction and abbreviation semantics", async function () {
  const out = await api.runPipeline("U.S. don't state-of-the-art", { target: "tokenized" });
  assert.deepEqual(
    out.tokens.map(function (t) { return t.surface; }),
    ["U.S.", "do", "n't", "state-of-the-art"]
  );
});

test("runPipeline tokenized rejects partial docs with existing token anchors", async function () {
  const partial = {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "segmented",
    canonical_text: "A test.",
    index_basis: { unit: "utf16_code_units" },
    segments: [
      {
        id: "s1",
        index: 0,
        kind: "sentence",
        span: { start: 0, end: 7 },
        token_range: { start: 0, end: 0 }
      }
    ],
    tokens: [
      {
        id: "t1",
        i: 0,
        segment_id: "s1",
        span: { start: 0, end: 1 },
        surface: "A"
      }
    ],
    annotations: []
  };

  await assert.rejects(
    api.runPipeline(partial, { target: "tokenized" }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
