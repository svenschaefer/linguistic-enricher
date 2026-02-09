"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage08 = require("../../src/pipeline/stages/linguistic-analysis");
const errors = require("../../src/util/errors");

function seed(text, tokens) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "mwe_materialized",
    canonical_text: text,
    index_basis: { unit: "utf16_code_units" },
    segments: [
      { id: "s1", index: 0, kind: "sentence", span: { start: 0, end: text.length }, token_range: { start: 0, end: tokens.length } }
    ],
    tokens: tokens,
    annotations: []
  };
}

test("stage08 emits dependency and lemma observations with one root", async function () {
  const text = "Alice sees Bob.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alice", pos: { tag: "NNP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "sees", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 14 }, surface: "Bob", pos: { tag: "NNP" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 14, end: 15 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  assert.equal(out.stage, "parsed");

  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });
  const lemmas = out.annotations.filter(function (a) { return a.kind === "lemma"; });
  assert.equal(deps.length, tokens.length);
  assert.equal(lemmas.length, 3);

  const roots = deps.filter(function (a) { return a.is_root === true; });
  assert.equal(roots.length, 1);
  assert.equal(roots[0].dep.id, "t2");
});

test("stage08 emits noun_phrase and named_entity observations", async function () {
  const text = "The online store in New York";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "The", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 10 }, surface: "online", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 16 }, surface: "store", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 17, end: 19 }, surface: "in", pos: { tag: "IN" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 20, end: 23 }, surface: "New", pos: { tag: "NNP" }, flags: { is_punct: false } },
    { id: "t6", i: 5, segment_id: "s1", span: { start: 24, end: 28 }, surface: "York", pos: { tag: "NNP" }, flags: { is_punct: false } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const nps = out.annotations.filter(function (a) { return a.kind === "noun_phrase"; });
  const nes = out.annotations.filter(function (a) { return a.kind === "named_entity"; });
  assert.equal(nps.length >= 1, true);
  assert.equal(nes.length >= 1, true);
});

test("stage08 rejects partially parsed docs with existing dependency annotation", async function () {
  const text = "A test";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 2, end: 6 }, surface: "test", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];
  const doc = seed(text, tokens);
  doc.annotations.push({ id: "d1", kind: "dependency", status: "observation", dep: { id: "t1" }, is_root: true });

  await assert.rejects(
    stage08.runStage(doc),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

