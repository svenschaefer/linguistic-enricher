"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage05 = require("../../src/pipeline/stages/mwe-candidate-extraction");

function buildSeed(text, tokens) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "pos_tagged",
    canonical_text: text,
    index_basis: { unit: "utf16_code_units" },
    segments: [
      {
        id: "s1",
        index: 0,
        kind: "sentence",
        span: { start: 0, end: text.length },
        token_range: { start: 0, end: tokens.length }
      }
    ],
    tokens: tokens,
    annotations: []
  };
}

test("stage05 extracts spaCy-style candidates and removes DT from labels", async function () {
  const text = "prime number generator placing an order";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "prime", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 12 }, surface: "number", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 13, end: 22 }, surface: "generator", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 23, end: 30 }, surface: "placing", pos: { tag: "VBG" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 31, end: 33 }, surface: "an", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t6", i: 5, segment_id: "s1", span: { start: 34, end: 39 }, surface: "order", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];

  const out = await stage05.runStage(buildSeed(text, tokens), { options: {} });
  const labels = out.annotations.map(function (ann) { return ann.label; });

  assert.equal(labels.includes("prime number generator"), true);
  assert.equal(labels.includes("placing order"), true);

  const placing = out.annotations.find(function (ann) { return ann.label === "placing order"; });
  assert.equal(placing.anchor.selectors.find(function (s) { return s.type === "TextQuoteSelector"; }).exact, "placing an order");
  assert.equal(placing.sources.some(function (s) { return s.name === "spacy:matcher/verb_det_noun"; }), true);
});

test("stage05 does not match across punctuation boundaries", async function () {
  const text = "shopping, cart";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 8 }, surface: "shopping", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 8, end: 9 }, surface: ",", pos: { tag: "," }, flags: { is_punct: true } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 10, end: 14 }, surface: "cart", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];

  const out = await stage05.runStage(buildSeed(text, tokens), { options: {} });
  const labels = out.annotations.map(function (ann) { return ann.label; });
  assert.equal(labels.includes("shopping cart"), false);
});

test("stage05 emits spacy matcher sources and lexicon evidence structure", async function () {
  const text = "online store";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 6 }, surface: "online", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 7, end: 12 }, surface: "store", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];

  const out = await stage05.runStage(buildSeed(text, tokens), { options: {} });
  assert.equal(out.annotations.length > 0, true);

  const first = out.annotations[0];
  assert.equal(first.sources.some(function (s) { return typeof s.name === "string" && s.name.startsWith("spacy:matcher/"); }), true);

  const lexicon = first.sources.find(function (s) { return s.name === "wikipedia-title-index"; });
  assert.equal(typeof lexicon, "object");
  assert.equal(typeof lexicon.evidence, "object");
  assert.equal(typeof lexicon.evidence.wiki_any_signal, "boolean");
});
