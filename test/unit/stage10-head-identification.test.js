"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage10 = require("../../src/pipeline/stages/head-identification");
const errors = require("../../src/util/errors");

function buildSeed(text, tokens, annotations) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-head-1",
    stage: "chunked",
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
    annotations: annotations
  };
}

function chunkAnnotation(id, chunkType, tokenIds, span, text) {
  return {
    id: id,
    kind: "chunk",
    status: "accepted",
    chunk_type: chunkType,
    label: text,
    anchor: {
      selectors: [
        { type: "TextQuoteSelector", exact: text },
        { type: "TextPositionSelector", span: span },
        { type: "TokenSelector", token_ids: tokenIds }
      ]
    },
    sources: [{ name: "chunking-pos-fsm", kind: "rule" }]
  };
}

function depAnnotation(id, dep, head, isRoot, span, text, tokenIds) {
  const out = {
    id: id,
    kind: "dependency",
    status: "observation",
    dep: { id: dep },
    is_root: isRoot,
    label: isRoot ? "root" : "dep",
    anchor: {
      selectors: [
        { type: "TextQuoteSelector", exact: text },
        { type: "TextPositionSelector", span: span },
        { type: "TokenSelector", token_ids: tokenIds || [dep] }
      ]
    },
    sources: [{ name: "linguistic-analysis", kind: "model" }]
  };
  if (!isRoot && head) {
    out.head = { id: head };
  }
  return out;
}

test("stage10 identifies NP head using dependency root-over-chunk", async function () {
  const text = "the online store";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "the", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 10 }, surface: "online", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 16 }, surface: "store", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-1", "NP", ["t1", "t2", "t3"], { start: 0, end: 16 }, "the online store"),
    depAnnotation("dep-1", "t1", "t3", false, { start: 0, end: 3 }, "the", ["t1", "t3"]),
    depAnnotation("dep-2", "t2", "t3", false, { start: 4, end: 10 }, "online", ["t2", "t3"]),
    depAnnotation("dep-3", "t3", null, true, { start: 11, end: 16 }, "store", ["t3"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  assert.equal(out.stage, "heads_identified");

  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-1"; });
  assert.ok(head);
  assert.equal(head.head.id, "t3");
  assert.equal(head.label, "store");
});

test("stage10 applies VP lexical override for demoted auxiliary-like head", async function () {
  const text = "authenticate using credentials";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 12 }, surface: "authenticate", pos: { tag: "VBP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 13, end: 18 }, surface: "using", pos: { tag: "VBG" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 19, end: 30 }, surface: "credentials", pos: { tag: "NNS" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3"], { start: 0, end: 30 }, "authenticate using credentials"),
    depAnnotation("dep-1", "t2", null, true, { start: 13, end: 18 }, "using", ["t2"]),
    depAnnotation("dep-2", "t1", "t2", false, { start: 0, end: 12 }, "authenticate", ["t1", "t2"]),
    depAnnotation("dep-3", "t3", "t2", false, { start: 19, end: 30 }, "credentials", ["t3", "t2"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t1");
  assert.equal(head.notes, "vp_lexical_head_override=true");
});

test("stage10 rejects partially head-identified docs", async function () {
  const text = "a store";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 1 }, surface: "a", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 2, end: 7 }, surface: "store", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-1", "NP", ["t1", "t2"], { start: 0, end: 7 }, "a store"),
    {
      id: "head-1",
      kind: "chunk_head",
      status: "accepted",
      chunk_id: "chunk-1",
      head: { id: "t2" },
      anchor: { selectors: [{ type: "TokenSelector", token_ids: ["t2"] }] },
      sources: [{ name: "head-identification", kind: "rule" }]
    }
  ];

  await assert.rejects(
    stage10.runStage(buildSeed(text, tokens, annotations)),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
