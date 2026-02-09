"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");
const errors = require("../../src/util/errors");

test("runPipeline pos_tagged target emits POS tags on all tokens", async function () {
  const out = await api.runPipeline("customer's payment failed.", { target: "pos_tagged" });
  assert.equal(out.stage, "pos_tagged");
  assert.equal(Array.isArray(out.tokens), true);
  assert.equal(out.tokens.length > 0, true);

  for (let i = 0; i < out.tokens.length; i += 1) {
    assert.equal(typeof out.tokens[i].pos, "object");
    assert.equal(typeof out.tokens[i].pos.tag, "string");
    assert.equal(typeof out.tokens[i].pos.coarse, "string");
  }
});

test("runPipeline pos_tagged applies possessive POS marker behavior", async function () {
  const out = await api.runPipeline("customer's payment", { target: "pos_tagged" });
  const surfaces = out.tokens.map(function (t) { return t.surface; });
  const idx = surfaces.indexOf("'s");
  assert.equal(idx !== -1, true);
  assert.equal(out.tokens[idx].pos.tag, "POS");
});

test("runPipeline pos_tagged rejects partial docs with existing annotations", async function () {
  const partial = {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "tokenized",
    canonical_text: "A test.",
    index_basis: { unit: "utf16_code_units" },
    segments: [
      {
        id: "s1",
        index: 0,
        kind: "sentence",
        span: { start: 0, end: 7 },
        token_range: { start: 0, end: 3 }
      }
    ],
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A" },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 2, end: 6 }, surface: "test" },
      { id: "t3", i: 2, segment_id: "s1", span: { start: 6, end: 7 }, surface: "." }
    ],
    annotations: [
      {
        id: "a1",
        kind: "mwe",
        status: "candidate",
        label: "A test",
        anchor: { selectors: [{ type: "TokenSelector", token_ids: ["t1", "t2"] }] },
        sources: [{ name: "rule", kind: "rule" }]
      }
    ]
  };

  await assert.rejects(
    api.runPipeline(partial, { target: "pos_tagged" }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test(
  "runPipeline pos_tagged can enrich token lexicon evidence from live wikipedia-title-index",
  {
    skip: !process.env.WIKI_INDEX_ENDPOINT
      ? "Set WIKI_INDEX_ENDPOINT to run live lexicon integration check"
      : false
  },
  async function () {
    const out = await api.runPipeline("An online store has a shopping cart.", {
      target: "pos_tagged",
      services: {
        "wikipedia-title-index": {
          endpoint: process.env.WIKI_INDEX_ENDPOINT
        }
      }
    });

    const hasSignal = out.tokens.some(function (token) {
      return Boolean(
        token &&
        token.lexicon &&
        token.lexicon.wikipedia_title_index &&
        token.lexicon.wikipedia_title_index.wiki_any_signal === true
      );
    });

    assert.equal(hasSignal, true);
  }
);
