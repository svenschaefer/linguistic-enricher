"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage04 = require("../../src/pipeline/stages/pos-tagging");
const errors = require("../../src/util/errors");

const PENN_TAGS = new Set([
  "CC", "CD", "DT", "EX", "FW", "IN", "JJ", "JJR", "JJS", "LS", "MD", "NN", "NNS", "NNP", "NNPS",
  "PDT", "POS", "PRP", "PRP$", "RB", "RBR", "RBS", "RP", "SYM", "TO", "UH", "VB", "VBD", "VBG",
  "VBN", "VBP", "VBZ", "WDT", "WP", "WP$", "WRB", ",", ".", ":", "$", "``", "''", "#"
]);

function makeSeed(tokens) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "tokenized",
    canonical_text: "customer 's payment",
    index_basis: {
      unit: "utf16_code_units"
    },
    segments: [
      {
        id: "s1",
        index: 0,
        kind: "sentence",
        span: { start: 0, end: 20 },
        token_range: { start: 0, end: tokens.length }
      }
    ],
    tokens: tokens
  };
}

test("stage04 tags each token with Penn tag and coarse class", async function () {
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A" },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 2, end: 6 }, surface: "test" },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 6, end: 7 }, surface: "." }
  ];

  const out = await stage04.runStage(makeSeed(tokens));
  assert.equal(out.stage, "pos_tagged");
  assert.equal(out.tokens.length, 3);
  for (let i = 0; i < out.tokens.length; i += 1) {
    assert.equal(typeof out.tokens[i].pos, "object");
    assert.equal(PENN_TAGS.has(out.tokens[i].pos.tag), true);
    assert.equal(typeof out.tokens[i].pos.coarse, "string");
  }
});

test("stage04 applies possessive override to POS marker in possessive context", async function () {
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 8 }, surface: "customer" },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 9, end: 11 }, surface: "'s" },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 12, end: 19 }, surface: "payment" }
  ];

  const out = await stage04.runStage(makeSeed(tokens));
  assert.equal(out.tokens[1].pos.tag, "POS");
});

test("stage04 rejects empty token stream", async function () {
  await assert.rejects(
    stage04.runStage(makeSeed([])),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("stage04 rejects partial docs with existing annotations", async function () {
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A" }
  ];
  const seed = makeSeed(tokens);
  seed.annotations = [{ id: "a1", kind: "mwe", status: "candidate", anchor: { selectors: [{ type: "TokenSelector", token_ids: ["t1"] }] }, sources: [{ name: "x" }] }];

  await assert.rejects(
    stage04.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
