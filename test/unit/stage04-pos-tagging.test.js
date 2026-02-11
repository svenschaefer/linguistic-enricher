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
    assert.equal(typeof out.tokens[i].lexicon, "undefined");
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

test("stage04 disambiguates coordinated finite verbs from NNS to VBZ", async function () {
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 2 }, surface: "It" },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 3, end: 9 }, surface: "starts" },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 10, end: 12 }, surface: "at" },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 13, end: 14 }, surface: "a" },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 15, end: 20 }, surface: "given" },
    { id: "t6", i: 5, segment_id: "s1", span: { start: 21, end: 28 }, surface: "minimum" },
    { id: "t7", i: 6, segment_id: "s1", span: { start: 29, end: 34 }, surface: "value" },
    { id: "t8", i: 7, segment_id: "s1", span: { start: 35, end: 38 }, surface: "and" },
    { id: "t9", i: 8, segment_id: "s1", span: { start: 39, end: 44 }, surface: "tests" },
    { id: "t10", i: 9, segment_id: "s1", span: { start: 45, end: 49 }, surface: "each" },
    { id: "t11", i: 10, segment_id: "s1", span: { start: 50, end: 60 }, surface: "successive" },
    { id: "t12", i: 11, segment_id: "s1", span: { start: 61, end: 68 }, surface: "integer" },
    { id: "t13", i: 12, segment_id: "s1", span: { start: 68, end: 69 }, surface: "." }
  ];

  const out = await stage04.runStage(makeSeed(tokens));
  assert.equal(out.tokens[1].pos.tag, "VBZ");
  assert.equal(out.tokens[1].pos.coarse, "VERB");
  assert.equal(out.tokens[8].pos.tag, "VBZ");
  assert.equal(out.tokens[8].pos.coarse, "VERB");
});

test("stage04 keeps noun coordination as NNS in nominal list context", async function () {
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 4 }, surface: "cats" },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 5, end: 8 }, surface: "and" },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 9, end: 13 }, surface: "dogs" },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 13, end: 14 }, surface: "." }
  ];

  const out = await stage04.runStage(makeSeed(tokens));
  assert.equal(out.tokens[0].pos.tag, "NNS");
  assert.equal(out.tokens[2].pos.tag, "NNS");
});
