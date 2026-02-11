"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage11 = require("../../src/pipeline/stages/relation-extraction");
const errors = require("../../src/util/errors");
const { createDeterministicId } = require("../../src/util/ids");

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

function stage11Rels(doc) {
  return doc.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });
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
  const locationRel = rels.find(function (r) { return r.head.id === "t4" && r.label === "location" && r.dep.id === "t7"; });
  assert.ok(locationRel);
  const locationEvidence = locationRel.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(locationEvidence.prep_surface, "in");
  assert.equal(locationEvidence.prep_token_id, "t6");
  assert.equal(locationEvidence.pobj_token_id, "t7");
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
    chunkHead("h4", "c4", "t5"),
    chunkHead("h5", "c5", "t6"),
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
  const modalityForCan = rels.filter(function (r) { return r.label === "modality" && r.dep.id === "t2"; });
  assert.equal(modalityForCan.length, 1);
  const modEvidence = modalityForCan[0].sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(modEvidence.pattern, "modality_unified");
  assert.equal(modEvidence.md_token_id, "t2");
  assert.equal(modEvidence.chosen_predicate_token_id, "t3");
  const coord = rels.find(function (r) { return r.head.id === "t3" && r.label === "coordination" && r.dep.id === "t6"; });
  assert.ok(coord);
  const evidence = coord.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.coord_type, "and");
  assert.equal(evidence.coord_token_id, "t5");
  assert.equal(
    evidence.coord_group_id,
    createDeterministicId("coord", { members: ["t3", "t6"].sort(function (a, b) { return a.localeCompare(b); }) })
  );
});

test("stage11 baseline fixture: webshop copula sentence is deterministic", async function () {
  const text = "A webshop is an online store.";
  const tokens = [
    token("t1", 0, "A", "DT", 0, 1),
    token("t2", 1, "webshop", "NN", 2, 9),
    token("t3", 2, "is", "VBZ", 10, 12),
    token("t4", 3, "an", "DT", 13, 15),
    token("t5", 4, "online", "JJ", 16, 22),
    token("t6", 5, "store", "NN", 23, 28),
    token("t7", 6, ".", ".", 28, 29)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "A webshop", "NP", { start: 0, end: 9 }),
    chunk("c2", ["t3"], "is", "VP", { start: 10, end: 12 }),
    chunk("c3", ["t4", "t5", "t6"], "an online store", "NP", { start: 13, end: 28 }),
    chunkHead("h1", "c1", "t2"),
    chunkHead("h2", "c2", "t3"),
    chunkHead("h3", "c3", "t6"),
    depObs("d1", "t2", "t3", "nsubj", false),
    depObs("d2", "t6", "t3", "attr", false),
    depObs("d3", "t3", null, "root", true),
    depObs("d4", "t3", "t6", "cop", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  assert.equal(out.stage, "relations_extracted");
  const rels = stage11Rels(out);
  const ids = rels.map(function (r) { return r.id; }).sort();
  assert.deepEqual(ids, [
    "rel-5f399bb777eb",
    "rel-9e2becd51d1f",
    "rel-cf728745529f",
    "rel-fbcee64e8e78"
  ]);
  assert.equal(rels.some(function (r) { return r.head.id === "t3" && r.label === "actor" && r.dep.id === "t2"; }), true);
  assert.equal(rels.some(function (r) { return r.head.id === "t3" && r.label === "attribute" && r.dep.id === "t6"; }), true);
  const copula = rels.find(function (r) { return r.head.id === "t3" && r.label === "copula" && r.dep.id === "t6"; });
  assert.ok(copula);
  const evidence = copula.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.pattern, "copula_frame");
  assert.equal(evidence.subject_token_id, "t2");
  assert.equal(evidence.complement_token_id, "t6");
  assert.equal(evidence.copula_token_id, "t3");
  assert.equal(evidence.complement_kind, "nominal");
});

test("stage11 baseline fixture: generated primes sentence has stable relation ids", async function () {
  const text = "Generated primes may be used for educational purposes.";
  const tokens = [
    token("t1", 0, "Generated", "JJ", 0, 9),
    token("t2", 1, "primes", "NNS", 10, 16),
    token("t3", 2, "may", "MD", 17, 20),
    token("t4", 3, "be", "VB", 21, 23),
    token("t5", 4, "used", "VBN", 24, 28),
    token("t6", 5, "for", "IN", 29, 32),
    token("t7", 6, "educational", "JJ", 33, 44),
    token("t8", 7, "purposes", "NNS", 45, 53),
    token("t9", 8, ".", ".", 53, 54)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "Generated primes", "NP", { start: 0, end: 16 }),
    chunk("c2", ["t3", "t4", "t5"], "may be used", "VP", { start: 17, end: 28 }),
    chunk("c3", ["t6", "t7", "t8"], "for educational purposes", "PP", { start: 29, end: 53 }),
    chunkHead("h1", "c1", "t2"),
    chunkHead("h2", "c2", "t5"),
    chunkHead("h3", "c3", "t6"),
    depObs("d1", "t5", null, "root", true),
    depObs("d2", "t3", "t5", "aux", false),
    depObs("d3", "t2", "t5", "nsubjpass", false),
    depObs("d4", "t6", "t5", "prep", false),
    depObs("d5", "t8", "t6", "pobj", false),
    depObs("d6", "t1", "t2", "amod", false),
    depObs("d7", "t7", "t8", "amod", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  assert.equal(out.stage, "relations_extracted");
  const rels = stage11Rels(out);
  const ids = rels.map(function (r) { return r.id; }).sort();
  assert.deepEqual(ids, [
    "rel-08d21b21c09c",
    "rel-0b7175799c82",
    "rel-3158448a5294",
    "rel-a14a8d95cc70",
    "rel-a7a441ad585e",
    "rel-c6e1aa6149b4"
  ]);
  assert.equal(rels.some(function (r) { return r.head.id === "t2" && r.label === "modifier" && r.dep.id === "t1"; }), true);
  assert.equal(rels.some(function (r) { return r.head.id === "t6" && r.label === "modifier" && r.dep.id === "t7"; }), true);
  const modality = rels.filter(function (r) { return r.label === "modality"; });
  assert.equal(modality.length, 1);
  assert.equal(modality[0].head.id, "t5");
  assert.equal(modality[0].dep.id, "t3");
  const modEvidence = modality[0].sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(modEvidence.pattern, "modality_unified");
  assert.equal(modEvidence.md_token_id, "t3");
  assert.equal(modEvidence.md_surface, "may");
  assert.equal(modEvidence.chosen_predicate_token_id, "t5");
});

test("stage11 invariant: rejects missing chunk_head for accepted chunk", async function () {
  const text = "A webshop is an online store.";
  const tokens = [
    token("t1", 0, "A", "DT", 0, 1),
    token("t2", 1, "webshop", "NN", 2, 9),
    token("t3", 2, "is", "VBZ", 10, 12),
    token("t4", 3, "an", "DT", 13, 15),
    token("t5", 4, "online", "JJ", 16, 22),
    token("t6", 5, "store", "NN", 23, 28),
    token("t7", 6, ".", ".", 28, 29)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "A webshop", "NP", { start: 0, end: 9 }),
    chunk("c2", ["t3"], "is", "VP", { start: 10, end: 12 }),
    chunk("c3", ["t4", "t5", "t6"], "an online store", "NP", { start: 13, end: 28 }),
    chunkHead("h1", "c1", "t2"),
    chunkHead("h2", "c2", "t3"),
    depObs("d1", "t2", "t3", "nsubj", false),
    depObs("d2", "t6", "t3", "attr", false),
    depObs("d3", "t3", null, "root", true)
  ];

  await assert.rejects(
    stage11.runStage(seed(text, tokens, annotations)),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      assert.equal(String(error.message || "").indexOf("missing chunk_head") !== -1, true);
      return true;
    }
  );
});

test("stage11 invariant: rejects duplicate chunk_head for same chunk", async function () {
  const text = "A webshop is an online store.";
  const tokens = [
    token("t1", 0, "A", "DT", 0, 1),
    token("t2", 1, "webshop", "NN", 2, 9),
    token("t3", 2, "is", "VBZ", 10, 12),
    token("t4", 3, "an", "DT", 13, 15),
    token("t5", 4, "online", "JJ", 16, 22),
    token("t6", 5, "store", "NN", 23, 28),
    token("t7", 6, ".", ".", 28, 29)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "A webshop", "NP", { start: 0, end: 9 }),
    chunk("c2", ["t3"], "is", "VP", { start: 10, end: 12 }),
    chunk("c3", ["t4", "t5", "t6"], "an online store", "NP", { start: 13, end: 28 }),
    chunkHead("h1", "c1", "t2"),
    chunkHead("h2", "c2", "t3"),
    chunkHead("h3", "c3", "t6"),
    chunkHead("h4", "c3", "t5"),
    depObs("d1", "t2", "t3", "nsubj", false),
    depObs("d2", "t6", "t3", "attr", false),
    depObs("d3", "t3", null, "root", true)
  ];

  await assert.rejects(
    stage11.runStage(seed(text, tokens, annotations)),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      assert.equal(String(error.message || "").indexOf("duplicate chunk_head") !== -1, true);
      return true;
    }
  );
});

test("stage11 invariant: rejects non-heads_identified stage and unsupported index unit", async function () {
  const text = "A webshop is an online store.";
  const tokens = [
    token("t1", 0, "A", "DT", 0, 1),
    token("t2", 1, "webshop", "NN", 2, 9),
    token("t3", 2, "is", "VBZ", 10, 12),
    token("t4", 3, "an", "DT", 13, 15),
    token("t5", 4, "online", "JJ", 16, 22),
    token("t6", 5, "store", "NN", 23, 28),
    token("t7", 6, ".", ".", 28, 29)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "A webshop", "NP", { start: 0, end: 9 }),
    chunkHead("h1", "c1", "t2"),
    depObs("d1", "t3", null, "root", true)
  ];

  const badStage = seed(text, tokens, annotations);
  badStage.stage = "chunked";
  await assert.rejects(
    stage11.runStage(badStage),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      assert.equal(String(error.message || "").indexOf("requires stage='heads_identified'") !== -1, true);
      return true;
    }
  );

  const badUnit = seed(text, tokens, annotations);
  badUnit.index_basis = { unit: "unknown_unit" };
  await assert.rejects(
    stage11.runStage(badUnit),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      assert.equal(String(error.message || "").indexOf("unsupported index_basis.unit") !== -1, true);
      return true;
    }
  );
});

test("stage11 preserves lexical VP predicate when chunk_head is demoted verbish", async function () {
  const text = "primes be used";
  const tokens = [
    token("t1", 0, "primes", "NNS", 0, 6),
    token("t2", 1, "be", "VB", 7, 9),
    token("t3", 2, "used", "VBN", 10, 14)
  ];
  const annotations = [
    chunk("c1", ["t1"], "primes", "NP", { start: 0, end: 6 }),
    chunk("c2", ["t2", "t3"], "be used", "VP", { start: 7, end: 14 }),
    chunkHead("h1", "c1", "t1"),
    // Intentional distortion setup: VP chunk head points to demoted aux-like token.
    chunkHead("h2", "c2", "t2"),
    depObs("d1", "t3", null, "root", true),
    depObs("d2", "t1", "t3", "nsubjpass", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  assert.equal(rels.some(function (r) { return r.head.id === "t3" && r.label === "patient" && r.dep.id === "t1"; }), true);
  assert.equal(rels.some(function (r) { return r.head.id === "t2" && r.label === "patient" && r.dep.id === "t1"; }), false);
});

test("stage11 emits modifier relation for nummod", async function () {
  const text = "two stores";
  const tokens = [
    token("t1", 0, "two", "CD", 0, 3),
    token("t2", 1, "stores", "NNS", 4, 10)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "two stores", "NP", { start: 0, end: 10 }),
    chunkHead("h1", "c1", "t2"),
    depObs("d1", "t2", null, "root", true),
    depObs("d2", "t1", "t2", "nummod", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  assert.equal(rels.some(function (r) { return r.head.id === "t2" && r.label === "modifier" && r.dep.id === "t1"; }), true);
});

test("stage11 coordination evidence carries OR metadata from dependency cc/conj", async function () {
  const text = "Generated primes may be used for educational purposes or research.";
  const tokens = [
    token("t1", 0, "Generated", "JJ", 0, 9),
    token("t2", 1, "primes", "NNS", 10, 16),
    token("t3", 2, "may", "MD", 17, 20),
    token("t4", 3, "be", "VB", 21, 23),
    token("t5", 4, "used", "VBN", 24, 28),
    token("t6", 5, "for", "IN", 29, 32),
    token("t7", 6, "educational", "JJ", 33, 44),
    token("t8", 7, "purposes", "NNS", 45, 53),
    token("t9", 8, "or", "CC", 54, 56),
    token("t10", 9, "research", "NN", 57, 65),
    token("t11", 10, ".", ".", 65, 66)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "Generated primes", "NP", { start: 0, end: 16 }),
    chunk("c2", ["t3", "t4", "t5"], "may be used", "VP", { start: 17, end: 28 }),
    chunk("c3", ["t6", "t7", "t8"], "for educational purposes", "PP", { start: 29, end: 53 }),
    chunk("c4", ["t10"], "research", "NP", { start: 57, end: 65 }),
    chunkHead("h1", "c1", "t2"),
    chunkHead("h2", "c2", "t5"),
    chunkHead("h3", "c3", "t6"),
    chunkHead("h4", "c4", "t10"),
    depObs("d1", "t5", null, "root", true),
    depObs("d2", "t3", "t5", "aux", false),
    depObs("d3", "t2", "t5", "nsubjpass", false),
    depObs("d4", "t6", "t5", "prep", false),
    depObs("d5", "t8", "t6", "pobj", false),
    depObs("d6", "t10", "t8", "conj", false),
    depObs("d7", "t9", "t10", "cc", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  const coord = rels.find(function (r) { return r.label === "coordination"; });
  assert.ok(coord);
  const evidence = coord.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.coord_type, "or");
  assert.equal(evidence.coord_token_id, "t9");
  assert.equal(
    evidence.coord_group_id,
    createDeterministicId("coord", { members: [coord.head.id, coord.dep.id].sort(function (a, b) { return a.localeCompare(b); }) })
  );
});

test("stage11 coordination evidence carries AND metadata from dependency cc/conj", async function () {
  const text = "A webshop sells books and tools.";
  const tokens = [
    token("t1", 0, "A", "DT", 0, 1),
    token("t2", 1, "webshop", "NN", 2, 9),
    token("t3", 2, "sells", "VBZ", 10, 15),
    token("t4", 3, "books", "NNS", 16, 21),
    token("t5", 4, "and", "CC", 22, 25),
    token("t6", 5, "tools", "NNS", 26, 31),
    token("t7", 6, ".", ".", 31, 32)
  ];
  const annotations = [
    chunk("c1", ["t1", "t2"], "A webshop", "NP", { start: 0, end: 9 }),
    chunk("c2", ["t3"], "sells", "VP", { start: 10, end: 15 }),
    chunk("c3", ["t4"], "books", "NP", { start: 16, end: 21 }),
    chunk("c4", ["t6"], "tools", "NP", { start: 26, end: 31 }),
    chunkHead("h1", "c1", "t2"),
    chunkHead("h2", "c2", "t3"),
    chunkHead("h3", "c3", "t4"),
    chunkHead("h4", "c4", "t6"),
    depObs("d1", "t3", null, "root", true),
    depObs("d2", "t2", "t3", "nsubj", false),
    depObs("d3", "t4", "t3", "obj", false),
    depObs("d4", "t6", "t4", "conj", false),
    depObs("d5", "t5", "t6", "cc", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  const coord = rels.find(function (r) { return r.label === "coordination" && r.head.id === "t4" && r.dep.id === "t6"; });
  assert.ok(coord);
  const evidence = coord.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.coord_type, "and");
  assert.equal(evidence.coord_token_id, "t5");
  assert.equal(
    evidence.coord_group_id,
    createDeterministicId("coord", { members: [coord.head.id, coord.dep.id].sort(function (a, b) { return a.localeCompare(b); }) })
  );
});

test("stage11 emits compare_gt relation for greater than RHS pattern", async function () {
  const text = "greater than 1";
  const tokens = [
    token("t1", 0, "greater", "JJR", 0, 7),
    token("t2", 1, "than", "IN", 8, 12),
    token("t3", 2, "1", "CD", 13, 14)
  ];
  const annotations = [
    chunk("c1", ["t1"], "greater", "NP", { start: 0, end: 7 }),
    chunk("c2", ["t2", "t3"], "than 1", "PP", { start: 8, end: 14 }),
    chunkHead("h1", "c1", "t1"),
    chunkHead("h2", "c2", "t2"),
    depObs("d1", "t1", null, "root", true),
    depObs("d2", "t2", "t1", "prep", false),
    depObs("d3", "t3", "t2", "pobj", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  const compare = rels.find(function (r) { return r.label === "compare_gt"; });
  assert.ok(compare);
  assert.equal(compare.head.id, "t1");
  assert.equal(compare.dep.id, "t3");
  const evidence = compare.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.pattern, "comparative");
  assert.equal(evidence.compare_surface, "greater");
  assert.equal(evidence.compare_token_id, "t1");
  assert.equal(evidence.prep_surface, "than");
  assert.equal(evidence.prep_token_id, "t2");
  assert.equal(evidence.rhs_token_id, "t3");
});

test("stage11 emits compare_lt relation for less than RHS pattern", async function () {
  const text = "less than 10";
  const tokens = [
    token("t1", 0, "less", "JJR", 0, 4),
    token("t2", 1, "than", "IN", 5, 9),
    token("t3", 2, "10", "CD", 10, 12)
  ];
  const annotations = [
    chunk("c1", ["t1"], "less", "NP", { start: 0, end: 4 }),
    chunk("c2", ["t2", "t3"], "than 10", "PP", { start: 5, end: 12 }),
    chunkHead("h1", "c1", "t1"),
    chunkHead("h2", "c2", "t2"),
    depObs("d1", "t1", null, "root", true),
    depObs("d2", "t2", "t1", "prep", false),
    depObs("d3", "t3", "t2", "pobj", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  const compare = rels.find(function (r) { return r.label === "compare_lt"; });
  assert.ok(compare);
  assert.equal(compare.head.id, "t1");
  assert.equal(compare.dep.id, "t3");
  const evidence = compare.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.prep_surface, "than");
  assert.equal(evidence.prep_token_id, "t2");
  assert.equal(evidence.rhs_token_id, "t3");
});

test("stage11 emits copula frame for passive-like considered clauses", async function () {
  const text = "Primes are considered numbers.";
  const tokens = [
    token("t1", 0, "Primes", "NNS", 0, 6),
    token("t2", 1, "are", "VBP", 7, 10),
    token("t3", 2, "considered", "VBN", 11, 21),
    token("t4", 3, "numbers", "NNS", 22, 29),
    token("t5", 4, ".", ".", 29, 30)
  ];
  const annotations = [
    chunk("c1", ["t1"], "Primes", "NP", { start: 0, end: 6 }),
    chunk("c2", ["t2", "t3"], "are considered", "VP", { start: 7, end: 21 }),
    chunk("c3", ["t4"], "numbers", "NP", { start: 22, end: 29 }),
    chunkHead("h1", "c1", "t1"),
    chunkHead("h2", "c2", "t3"),
    chunkHead("h3", "c3", "t4"),
    depObs("d1", "t3", null, "root", true),
    depObs("d2", "t1", "t3", "nsubjpass", false),
    depObs("d3", "t4", "t3", "attr", false),
    depObs("d4", "t2", "t3", "cop", false)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  const copula = rels.find(function (r) { return r.label === "copula" && r.head.id === "t3" && r.dep.id === "t4"; });
  assert.ok(copula);
  const evidence = copula.sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.pattern, "copula_frame");
  assert.equal(evidence.verb_token_id, "t3");
  assert.equal(evidence.subject_token_id, "t1");
  assert.equal(evidence.complement_token_id, "t4");
  assert.equal(evidence.copula_token_id, "t2");
  assert.equal(evidence.complement_kind, "nominal");
});

test("stage11 modality tie-break prefers rightward lexical verb at equal distance", async function () {
  const text = "run may use";
  const tokens = [
    token("t1", 0, "run", "VB", 0, 3),
    token("t2", 1, "may", "MD", 4, 7),
    token("t3", 2, "use", "VB", 8, 11)
  ];
  const annotations = [
    chunk("c1", ["t1"], "run", "VP", { start: 0, end: 3 }),
    chunk("c2", ["t2", "t3"], "may use", "VP", { start: 4, end: 11 }),
    chunkHead("h1", "c1", "t1"),
    chunkHead("h2", "c2", "t3"),
    depObs("d1", "t3", null, "root", true)
  ];

  const out = await stage11.runStage(seed(text, tokens, annotations));
  const rels = stage11Rels(out);
  const modality = rels.filter(function (r) { return r.label === "modality" && r.dep.id === "t2"; });
  assert.equal(modality.length, 1);
  assert.equal(modality[0].head.id, "t3");
  const evidence = modality[0].sources.find(function (s) { return s && s.name === "relation-extraction"; }).evidence;
  assert.equal(evidence.pattern, "modality_unified");
  assert.equal(evidence.chosen_predicate_token_id, "t3");
});
