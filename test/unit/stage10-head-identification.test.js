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
  assert.ok(head.head_decision);
  assert.deepEqual(head.head_decision.candidates, ["t3"]);
  assert.equal(head.head_decision.chosen, "t3");
  assert.equal(head.head_decision.rule, "dependency_root");
  assert.deepEqual(head.head_decision.tie_break, {});
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
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
  assert.ok(head.head_decision);
  assert.equal(head.head_decision.rule, "matrix_lexical_preference");
  assert.equal(head.head_decision.chosen, "t1");
  assert.deepEqual(head.head_decision.candidates, ["t1"]);
  assert.equal(typeof head.head_decision.tie_break.degree, "number");
  assert.equal(head.head_decision.tie_break.index, 0);
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

test("stage10 excludes MD as VP head when lexical verb exists and dep root is MD", async function () {
  const text = "may use credentials";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "may", pos: { tag: "MD" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 7 }, surface: "use", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 8, end: 19 }, surface: "credentials", pos: { tag: "NNS" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3"], { start: 0, end: 19 }, "may use credentials"),
    depAnnotation("dep-1", "t1", null, true, { start: 0, end: 3 }, "may", ["t1"]),
    depAnnotation("dep-2", "t2", "t1", false, { start: 4, end: 7 }, "use", ["t2", "t1"]),
    depAnnotation("dep-3", "t3", "t2", false, { start: 8, end: 19 }, "credentials", ["t3", "t2"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t2");
  assert.equal(head.label, "use");
  assert.equal(Boolean(head.notes), false);
});

test("stage10 selects lexical verb as VP head in MD + VB chunk", async function () {
  const text = "may authenticate";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "may", pos: { tag: "MD" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 16 }, surface: "authenticate", pos: { tag: "VB" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2"], { start: 0, end: 16 }, "may authenticate"),
    depAnnotation("dep-1", "t2", null, true, { start: 4, end: 16 }, "authenticate", ["t2"]),
    depAnnotation("dep-2", "t1", "t2", false, { start: 0, end: 3 }, "may", ["t1", "t2"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t2");
  assert.equal(head.label, "authenticate");
});

test("stage10 allows MD fallback as VP head when no lexical verb exists", async function () {
  const text = "may";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "may", pos: { tag: "MD" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1"], { start: 0, end: 3 }, "may")
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t1");
  assert.equal(head.label, "may");
  assert.ok(head.head_decision);
  assert.equal(head.head_decision.chosen, "t1");
  assert.ok(["positional_fallback", "allow_any_fallback"].indexOf(head.head_decision.rule) !== -1);
});

test("stage10 prefers matrix lexical verb over demoted VP root in may be used", async function () {
  const text = "may be used";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "may", pos: { tag: "MD" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 6 }, surface: "be", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 7, end: 11 }, surface: "used", pos: { tag: "VBN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3"], { start: 0, end: 11 }, "may be used"),
    depAnnotation("dep-1", "t2", null, true, { start: 4, end: 6 }, "be", ["t2"]),
    depAnnotation("dep-2", "t1", "t2", false, { start: 0, end: 3 }, "may", ["t1", "t2"]),
    depAnnotation("dep-3", "t3", "t2", false, { start: 7, end: 11 }, "used", ["t3", "t2"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t3");
  assert.equal(head.label, "used");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
  assert.ok(head.head_decision);
  assert.equal(head.head_decision.rule, "matrix_lexical_preference");
  assert.equal(head.head_decision.chosen, "t3");
  assert.equal(typeof head.head_decision.tie_break.degree, "number");
  assert.equal(head.head_decision.tie_break.index, 2);
});

test("stage10 prefers matrix lexical participle over copula root in are considered", async function () {
  const text = "are considered";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "are", pos: { tag: "VBP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 14 }, surface: "considered", pos: { tag: "VBN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2"], { start: 0, end: 14 }, "are considered"),
    depAnnotation("dep-1", "t1", null, true, { start: 0, end: 3 }, "are", ["t1"]),
    depAnnotation("dep-2", "t2", "t1", false, { start: 4, end: 14 }, "considered", ["t2", "t1"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t2");
  assert.equal(head.label, "considered");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
});

test("stage10 matrix lexical preference uses degree then index tie-break deterministically", async function () {
  const text = "using plan execute";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "using", pos: { tag: "VBG" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "plan", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 18 }, surface: "execute", pos: { tag: "VB" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3"], { start: 0, end: 18 }, "using plan execute"),
    depAnnotation("dep-1", "t1", null, true, { start: 0, end: 5 }, "using", ["t1"]),
    depAnnotation("dep-2", "t2", "t1", false, { start: 6, end: 10 }, "plan", ["t2", "t1"]),
    depAnnotation("dep-3", "t3", "t1", false, { start: 11, end: 18 }, "execute", ["t3", "t1"]),
    depAnnotation("dep-4", "t1", "t3", false, { start: 0, end: 5 }, "using", ["t1", "t3"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t3");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
});

test("stage10 matrix lexical preference uses earliest index when lexical degrees tie", async function () {
  const text = "using plan execute";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "using", pos: { tag: "VBG" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "plan", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 18 }, surface: "execute", pos: { tag: "VB" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3"], { start: 0, end: 18 }, "using plan execute"),
    depAnnotation("dep-1", "t1", null, true, { start: 0, end: 5 }, "using", ["t1"]),
    depAnnotation("dep-2", "t2", "t1", false, { start: 6, end: 10 }, "plan", ["t2", "t1"]),
    depAnnotation("dep-3", "t3", "t1", false, { start: 11, end: 18 }, "execute", ["t3", "t1"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t2");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
});

test("stage10 demotes given-pattern participle root inside VP and selects lexical matrix verb", async function () {
  const text = "starts at a given minimum value";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 6 }, surface: "starts", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 7, end: 9 }, surface: "at", pos: { tag: "IN" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 10, end: 11 }, surface: "a", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 12, end: 17 }, surface: "given", pos: { tag: "VBN" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 18, end: 25 }, surface: "minimum", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t6", i: 5, segment_id: "s1", span: { start: 26, end: 31 }, surface: "value", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3", "t4", "t5", "t6"], { start: 0, end: 31 }, "starts at a given minimum value"),
    depAnnotation("dep-1", "t4", null, true, { start: 12, end: 17 }, "given", ["t4"]),
    depAnnotation("dep-2", "t1", "t4", false, { start: 0, end: 6 }, "starts", ["t1", "t4"]),
    depAnnotation("dep-3", "t2", "t1", false, { start: 7, end: 9 }, "at", ["t2", "t1"]),
    depAnnotation("dep-4", "t3", "t6", false, { start: 10, end: 11 }, "a", ["t3", "t6"]),
    depAnnotation("dep-5", "t5", "t6", false, { start: 18, end: 25 }, "minimum", ["t5", "t6"]),
    depAnnotation("dep-6", "t6", "t4", false, { start: 26, end: 31 }, "value", ["t6", "t4"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t1");
  assert.equal(head.label, "starts");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
});

test("stage10 demotes given-pattern root in tests a given value and keeps lexical verb head", async function () {
  const text = "tests a given value";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "tests", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 7 }, surface: "a", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 8, end: 13 }, surface: "given", pos: { tag: "VBN" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 14, end: 19 }, surface: "value", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3", "t4"], { start: 0, end: 19 }, "tests a given value"),
    depAnnotation("dep-1", "t3", null, true, { start: 8, end: 13 }, "given", ["t3"]),
    depAnnotation("dep-2", "t1", "t3", false, { start: 0, end: 5 }, "tests", ["t1", "t3"]),
    depAnnotation("dep-3", "t2", "t4", false, { start: 6, end: 7 }, "a", ["t2", "t4"]),
    depAnnotation("dep-4", "t4", "t3", false, { start: 14, end: 19 }, "value", ["t4", "t3"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t1");
  assert.equal(head.label, "tests");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
});

test("stage10 demotes DT+VBN+NP modifier root and keeps lexical matrix verb head", async function () {
  const text = "computes the assigned value";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 8 }, surface: "computes", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 9, end: 12 }, surface: "the", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 13, end: 21 }, surface: "assigned", pos: { tag: "VBN" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 22, end: 27 }, surface: "value", pos: { tag: "NN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2", "t3", "t4"], { start: 0, end: 27 }, "computes the assigned value"),
    depAnnotation("dep-1", "t3", null, true, { start: 13, end: 21 }, "assigned", ["t3"]),
    depAnnotation("dep-2", "t1", "t3", false, { start: 0, end: 8 }, "computes", ["t1", "t3"]),
    depAnnotation("dep-3", "t2", "t4", false, { start: 9, end: 12 }, "the", ["t2", "t4"]),
    depAnnotation("dep-4", "t4", "t3", false, { start: 22, end: 27 }, "value", ["t4", "t3"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t1");
  assert.equal(head.label, "computes");
  assert.equal(head.notes, "vp_matrix_lexical_preference=true");
});

test("stage10 keeps VBN head when no non-demoted lexical alternative exists", async function () {
  const text = "is assigned";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 2 }, surface: "is", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 3, end: 11 }, surface: "assigned", pos: { tag: "VBN" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2"], { start: 0, end: 11 }, "is assigned"),
    depAnnotation("dep-1", "t2", null, true, { start: 3, end: 11 }, "assigned", ["t2"]),
    depAnnotation("dep-2", "t1", "t2", false, { start: 0, end: 2 }, "is", ["t1", "t2"])
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t2");
  assert.equal(head.label, "assigned");
});

test("stage10 records positional fallback decision metadata when no dependency root is available", async function () {
  const text = "run quickly";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 3 }, surface: "run", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 4, end: 11 }, surface: "quickly", pos: { tag: "RB" }, flags: { is_punct: false } }
  ];
  const annotations = [
    chunkAnnotation("chunk-vp", "VP", ["t1", "t2"], { start: 0, end: 11 }, "run quickly")
  ];

  const out = await stage10.runStage(buildSeed(text, tokens, annotations));
  const head = out.annotations.find(function (a) { return a.kind === "chunk_head" && a.chunk_id === "chunk-vp"; });
  assert.ok(head);
  assert.equal(head.head.id, "t1");
  assert.ok(head.head_decision);
  assert.equal(head.head_decision.rule, "positional_fallback");
  assert.equal(head.head_decision.tie_break.index, 0);
});
