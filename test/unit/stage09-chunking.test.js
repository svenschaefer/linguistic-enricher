"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage09 = require("../../src/pipeline/stages/chunking");
const errors = require("../../src/util/errors");

function buildSeed(text, tokens, annotations) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "parsed",
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
    annotations: Array.isArray(annotations) ? annotations : []
  };
}

test("stage09 emits NP and O chunks including punctuation", async function () {
  const text = "Online store.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 6 }, surface: "Online", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 7, end: 12 }, surface: "store", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 12, end: 13 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage09.runStage(buildSeed(text, tokens, []));
  assert.equal(out.stage, "chunked");

  const chunks = out.annotations.filter(function (a) { return a.kind === "chunk"; });
  assert.equal(chunks.length, 2);

  const np = chunks.find(function (a) { return a.chunk_type === "NP"; });
  const o = chunks.find(function (a) { return a.chunk_type === "O"; });
  assert.ok(np);
  assert.ok(o);
  assert.equal(np.label, "Online store");
  assert.equal(o.label, ".");
});

test("stage09 emits VP and PP chunks with POS-FSM matching", async function () {
  const text = "Ships to Berlin";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Ships", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 8 }, surface: "to", pos: { tag: "TO" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 9, end: 15 }, surface: "Berlin", pos: { tag: "NNP" }, flags: { is_punct: false } }
  ];

  const out = await stage09.runStage(buildSeed(text, tokens, []));
  const chunks = out.annotations.filter(function (a) { return a.kind === "chunk"; });

  const vp = chunks.find(function (a) { return a.chunk_type === "VP"; });
  const pp = chunks.find(function (a) { return a.chunk_type === "PP"; });
  assert.ok(vp);
  assert.ok(pp);
  assert.equal(vp.label, "Ships");
  assert.equal(pp.label, "to Berlin");
});

test("stage09 treats accepted MWE annotations as atomic noun units", async function () {
  const text = "online store works";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 6 }, surface: "online", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 7, end: 12 }, surface: "store", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 13, end: 18 }, surface: "works", pos: { tag: "VBZ" }, flags: { is_punct: false } }
  ];

  const annotations = [
    {
      id: "mwe-1",
      kind: "mwe",
      status: "accepted",
      label: "online store",
      anchor: {
        selectors: [
          { type: "TokenSelector", token_ids: ["t1", "t2"] },
          { type: "TextPositionSelector", span: { start: 0, end: 12 } }
        ]
      },
      sources: [{ name: "mwe-materialization", kind: "rule" }]
    }
  ];

  const out = await stage09.runStage(buildSeed(text, tokens, annotations));
  const chunks = out.annotations.filter(function (a) { return a.kind === "chunk"; });
  const np = chunks.find(function (a) { return a.chunk_type === "NP"; });
  assert.ok(np);
  assert.deepEqual(
    np.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; }).token_ids,
    ["t1", "t2"]
  );
  assert.equal(np.label, "online store");
});

test("stage09 rejects partially chunked inputs", async function () {
  const text = "A test.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "A", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 2, end: 6 }, surface: "test", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 6, end: 7 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];
  const annotations = [
    {
      id: "chunk-old",
      kind: "chunk",
      status: "accepted",
      chunk_type: "NP",
      anchor: { selectors: [{ type: "TokenSelector", token_ids: ["t1", "t2"] }] },
      sources: [{ name: "chunking-pos-fsm", kind: "rule" }]
    }
  ];

  await assert.rejects(
    stage09.runStage(buildSeed(text, tokens, annotations)),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
