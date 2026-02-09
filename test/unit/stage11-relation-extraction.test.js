"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage11 = require("../../src/pipeline/stages/relation-extraction");
const errors = require("../../src/util/errors");

function token(id, i, surface, tag, start, end) {
  return {
    id: id,
    i: i,
    segment_id: "s1",
    span: { start: start, end: end },
    surface: surface,
    pos: { tag: tag },
    flags: { is_punct: false }
  };
}

function depObs(id, depId, headId, label, isRoot) {
  const out = {
    id: id,
    kind: "dependency",
    status: "observation",
    dep: { id: depId },
    label: label,
    is_root: isRoot === true,
    anchor: {
      selectors: [{ type: "TokenSelector", token_ids: isRoot ? [depId] : [headId, depId] }]
    },
    sources: [{ name: "linguistic-analysis", kind: "model" }]
  };
  if (!isRoot) {
    out.head = { id: headId };
  }
  return out;
}

function chunk(id, tokenIds, label, type, span) {
  return {
    id: id,
    kind: "chunk",
    status: "accepted",
    chunk_type: type,
    label: label,
    anchor: {
      selectors: [
        { type: "TextQuoteSelector", exact: label },
        { type: "TextPositionSelector", span: span },
        { type: "TokenSelector", token_ids: tokenIds }
      ]
    },
    sources: [{ name: "chunking-pos-fsm", kind: "rule" }]
  };
}

function chunkHead(id, chunkId, headId) {
  return {
    id: id,
    kind: "chunk_head",
    status: "accepted",
    chunk_id: chunkId,
    head: { id: headId },
    anchor: { selectors: [{ type: "TokenSelector", token_ids: [headId] }] },
    sources: [{ name: "head-identification", kind: "rule" }]
  };
}

function seed(text, tokens, annotations) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-rel-1",
    stage: "heads_identified",
    canonical_text: text,
    index_basis: { unit: "utf16_code_units" },
    segments: [{ id: "s1", index: 0, kind: "sentence", span: { start: 0, end: text.length }, token_range: { start: 0, end: tokens.length } }],
    tokens: tokens,
    annotations: annotations
  };
}

test("stage11 emits actor/theme/location and complement_clause/coordination relations", async function () {
  const text = "Alice tries to buy products in Berlin and sell services.";
  const tokens = [
    token("t1", 0, "Alice", "NNP", 0, 5),
    token("t2", 1, "tries", "VBZ", 6, 11),
    token("t3", 2, "to", "TO", 12, 14),
    token("t4", 3, "buy", "VB", 15, 18),
    token("t5", 4, "products", "NNS", 19, 27),
    token("t6", 5, "in", "IN", 28, 30),
    token("t7", 6, "Berlin", "NNP", 31, 37),
    token("t8", 7, "and", "CC", 38, 41),
    token("t9", 8, "sell", "VB", 42, 46),
    token("t10", 9, "services", "NNS", 47, 55),
    token("t11", 10, ".", ".", 55, 56)
  ];

  const annotations = [
    chunk("c1", ["t1"], "Alice", "NP", { start: 0, end: 5 }),
    chunk("c2", ["t2"], "tries", "VP", { start: 6, end: 11 }),
    chunk("c3", ["t4", "t5", "t6", "t7"], "buy products in Berlin", "VP", { start: 15, end: 37 }),
    chunk("c4", ["t9", "t10"], "sell services", "VP", { start: 42, end: 55 }),
    chunkHead("h1", "c1", "t1"),
    chunkHead("h2", "c2", "t2"),
    chunkHead("h3", "c3", "t4"),
    chunkHead("h4", "c4", "t9"),
    depObs("d1", "t1", "t2", "nsubj", false),
    depObs("d2", "t4", "t2", "xcomp", false),
    depObs("d3", "t5", "t4", "obj", false),
    depObs("d4", "t6", "t4", "prep", false),
    depObs("d5", "t7", "t6", "pobj", false),
    depObs("d6", "t9", "t4", "conj", false),
    depObs("d7", "t10", "t9", "obj", false),
    depObs("d8", "t2", null, "root", true)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  assert.equal(out.stage, "relations_extracted");

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  function has(head, label, dep) {
    return rels.some(function (r) { return r.head.id === head && r.label === label && r.dep.id === dep; });
  }

  assert.equal(has("t2", "actor", "t1"), true);
  assert.equal(has("t4", "theme", "t5"), true);
  assert.equal(has("t4", "location", "t7"), true);
  assert.equal(has("t2", "complement_clause", "t4"), true);
  assert.equal(has("t4", "coordination", "t9"), true);
});

test("stage11 rejects partially relation-extracted docs", async function () {
  const text = "A test.";
  const tokens = [
    token("t1", 0, "A", "DT", 0, 1),
    token("t2", 1, "test", "NN", 2, 6),
    token("t3", 2, ".", ".", 6, 7)
  ];
  const annotations = [
    depObs("d1", "t2", null, "root", true),
    {
      id: "r1",
      kind: "dependency",
      status: "accepted",
      dep: { id: "t2" },
      head: { id: "t2" },
      is_root: false,
      label: "theme",
      anchor: { selectors: [{ type: "TokenSelector", token_ids: ["t2"] }] },
      sources: [{ name: "relation-extraction", kind: "rule" }]
    }
  ];

  await assert.rejects(
    stage11.runStage(seed(text, tokens, annotations)),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("stage11 chunk fallback emits relations when dependency labels are weak", async function () {
  const text = "people can pick products and ship orders.";
  const tokens = [
    token("t1", 0, "people", "NNS", 0, 6),
    token("t2", 1, "can", "MD", 7, 10),
    token("t3", 2, "pick", "VB", 11, 15),
    token("t4", 3, "products", "NNS", 16, 24),
    token("t5", 4, "and", "CC", 25, 28),
    token("t6", 5, "ship", "VB", 29, 33),
    token("t7", 6, "orders", "NNS", 34, 40),
    token("t8", 7, ".", ".", 40, 41)
  ];
  const annotations = [
    chunk("c1", ["t1"], "people", "NP", { start: 0, end: 6 }),
    chunk("c2", ["t2"], "can", "VP", { start: 7, end: 10 }),
    chunk("c3", ["t3", "t4"], "pick products", "VP", { start: 11, end: 24 }),
    chunk("c4", ["t5"], "and", "O", { start: 25, end: 28 }),
    chunk("c5", ["t6", "t7"], "ship orders", "VP", { start: 29, end: 40 }),
    chunkHead("h1", "c1", "t1"),
    chunkHead("h2", "c2", "t2"),
    chunkHead("h3", "c3", "t3"),
    chunkHead("h4", "c5", "t6"),
    depObs("d1", "t1", "t3", "dep", false),
    depObs("d2", "t2", "t3", "dep", false),
    depObs("d3", "t3", null, "root", true),
    depObs("d4", "t4", "t3", "dep", false),
    depObs("d5", "t6", "t3", "dep", false),
    depObs("d6", "t7", "t6", "dep", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  function has(head, label, dep) {
    return rels.some(function (r) { return r.head.id === head && r.label === label && r.dep.id === dep; });
  }

  assert.equal(has("t3", "theme", "t4"), true);
  assert.equal(has("t6", "theme", "t7"), true);
  assert.equal(has("t3", "modality", "t2"), true);
  assert.equal(has("t3", "coordination", "t6"), true);
});
