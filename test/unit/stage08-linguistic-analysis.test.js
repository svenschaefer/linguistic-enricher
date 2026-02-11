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

test("stage08 emits coordination evidence for cc and conj dependencies", async function () {
  const text = "Alice buys and sells.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alice", pos: { tag: "NNP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "buys", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 14 }, surface: "and", pos: { tag: "CC" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 15, end: 20 }, surface: "sells", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 20, end: 21 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });

  const cc = deps.find(function (a) { return a.label === "cc" && a.dep && a.dep.id === "t3"; });
  const conj = deps.find(function (a) { return a.label === "conj" && a.dep && a.dep.id === "t4"; });
  assert.ok(cc);
  assert.ok(conj);

  const ccEvidence = cc.sources[0].evidence;
  const conjEvidence = conj.sources[0].evidence;
  assert.equal(ccEvidence.coordination_type, "and");
  assert.equal(ccEvidence.coordinator_token_id, "t3");
  assert.equal(conjEvidence.coordination_type, "and");
  assert.equal(conjEvidence.coordinator_token_id, "t3");
});

test("stage08 emits noun conj with or-coordination evidence", async function () {
  const text = "cats or dogs";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 4 }, surface: "cats", pos: { tag: "NNS" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 5, end: 7 }, surface: "or", pos: { tag: "CC" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 8, end: 12 }, surface: "dogs", pos: { tag: "NNS" }, flags: { is_punct: false } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });

  const cc = deps.find(function (a) { return a.label === "cc" && a.dep && a.dep.id === "t2"; });
  const conj = deps.find(function (a) { return a.label === "conj" && a.dep && a.dep.id === "t3"; });
  assert.ok(cc);
  assert.ok(conj);
  assert.equal(conj.head && conj.head.id, "t1");

  const ccEvidence = cc.sources[0].evidence;
  const conjEvidence = conj.sources[0].evidence;
  assert.equal(ccEvidence.coordination_type, "or");
  assert.equal(ccEvidence.coordinator_token_id, "t2");
  assert.equal(conjEvidence.coordination_type, "or");
  assert.equal(conjEvidence.coordinator_token_id, "t2");
});

test("stage08 emits verb conj with or-coordination evidence", async function () {
  const text = "Alice buys or sells.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "Alice", pos: { tag: "NNP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 10 }, surface: "buys", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 11, end: 13 }, surface: "or", pos: { tag: "CC" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 14, end: 19 }, surface: "sells", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 19, end: 20 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });

  const cc = deps.find(function (a) { return a.label === "cc" && a.dep && a.dep.id === "t3"; });
  const conj = deps.find(function (a) { return a.label === "conj" && a.dep && a.dep.id === "t4"; });
  assert.ok(cc);
  assert.ok(conj);
  assert.equal(conj.head && conj.head.id, "t2");

  const ccEvidence = cc.sources[0].evidence;
  const conjEvidence = conj.sources[0].evidence;
  assert.equal(ccEvidence.coordination_type, "or");
  assert.equal(ccEvidence.coordinator_token_id, "t3");
  assert.equal(conjEvidence.coordination_type, "or");
  assert.equal(conjEvidence.coordinator_token_id, "t3");
});

test("stage08 emits comparative observation for greater-than numeric threshold", async function () {
  const text = "value greater than 1";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 5 }, surface: "value", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 6, end: 13 }, surface: "greater", pos: { tag: "JJR" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 14, end: 18 }, surface: "than", pos: { tag: "IN" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 19, end: 20 }, surface: "1", pos: { tag: "CD" }, flags: { is_punct: false } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const comparatives = out.annotations.filter(function (a) { return a.kind === "comparative"; });
  assert.equal(comparatives.length, 1);

  const cmp = comparatives[0];
  assert.equal(cmp.label, "compare_gt");
  assert.equal(cmp.head && cmp.head.id, "t2");
  assert.equal(cmp.marker && cmp.marker.id, "t3");
  assert.equal(cmp.rhs && cmp.rhs.id, "t4");
  assert.equal(cmp.sources[0].evidence.marker_surface, "than");
  assert.equal(cmp.sources[0].evidence.marker_token_id, "t3");
});

test("stage08 emits quantifier/scope observations with deterministic noun attachment", async function () {
  const text = "It tests each integer and only primes.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 2 }, surface: "It", pos: { tag: "PRP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 3, end: 8 }, surface: "tests", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 9, end: 13 }, surface: "each", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 14, end: 21 }, surface: "integer", pos: { tag: "NN" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 22, end: 25 }, surface: "and", pos: { tag: "CC" }, flags: { is_punct: false } },
    { id: "t6", i: 5, segment_id: "s1", span: { start: 26, end: 30 }, surface: "only", pos: { tag: "RB" }, flags: { is_punct: false } },
    { id: "t7", i: 6, segment_id: "s1", span: { start: 31, end: 37 }, surface: "primes", pos: { tag: "NNS" }, flags: { is_punct: false } },
    { id: "t8", i: 7, segment_id: "s1", span: { start: 37, end: 38 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const qs = out.annotations.filter(function (a) { return a.kind === "quantifier_scope"; });
  assert.equal(qs.length, 2);

  const eachObs = qs.find(function (a) { return a.label === "quantifier_each"; });
  const onlyObs = qs.find(function (a) { return a.label === "scope_only"; });
  assert.ok(eachObs);
  assert.ok(onlyObs);

  assert.equal(eachObs.category, "quantifier");
  assert.equal(eachObs.marker && eachObs.marker.id, "t3");
  assert.equal(eachObs.target && eachObs.target.id, "t4");
  assert.equal(eachObs.sources[0].evidence.marker_token_id, "t3");
  assert.equal(eachObs.sources[0].evidence.attachment_rule, "nearest_noun_right_else_left");

  assert.equal(onlyObs.category, "scope");
  assert.equal(onlyObs.marker && onlyObs.marker.id, "t6");
  assert.equal(onlyObs.target && onlyObs.target.id, "t7");
  assert.equal(onlyObs.sources[0].evidence.marker_token_id, "t6");
  assert.equal(onlyObs.sources[0].evidence.attachment_rule, "nearest_noun_right_else_left");
});

test("stage08 emits copula_frame with subject/copula/complement evidence", async function () {
  const text = "Numbers are prime.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 7 }, surface: "Numbers", pos: { tag: "NNS" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 8, end: 11 }, surface: "are", pos: { tag: "VBP" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 12, end: 17 }, surface: "prime", pos: { tag: "JJ" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 17, end: 18 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const frames = out.annotations.filter(function (a) { return a.kind === "copula_frame"; });
  assert.equal(frames.length, 1);

  const frame = frames[0];
  assert.equal(frame.label, "copula_adjectival");
  assert.equal(frame.subject && frame.subject.id, "t1");
  assert.equal(frame.copula && frame.copula.id, "t2");
  assert.equal(frame.complement && frame.complement.id, "t3");
  assert.equal(frame.sources[0].evidence.pattern, "copula_subject_complement");
  assert.equal(frame.sources[0].evidence.copula_surface, "are");
  assert.equal(frame.sources[0].evidence.attachment_rule, "nearest_subject_left_nearest_complement_right");
});

test("stage08 emits pp_attachment with deterministic head/marker/object evidence", async function () {
  const text = "It works in Berlin.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 2 }, surface: "It", pos: { tag: "PRP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 3, end: 8 }, surface: "works", pos: { tag: "VBZ" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 9, end: 11 }, surface: "in", pos: { tag: "IN" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 12, end: 18 }, surface: "Berlin", pos: { tag: "NNP" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 18, end: 19 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const pp = out.annotations.filter(function (a) { return a.kind === "pp_attachment"; });
  assert.equal(pp.length, 1);

  const obs = pp[0];
  assert.equal(obs.label, "pp_in");
  assert.equal(obs.prep_surface, "in");
  assert.equal(obs.head && obs.head.id, "t2");
  assert.equal(obs.marker && obs.marker.id, "t3");
  assert.equal(obs.object && obs.object.id, "t4");
  assert.equal(obs.sources[0].evidence.pattern, "pp_head_object");
  assert.equal(obs.sources[0].evidence.prep_surface, "in");
  assert.equal(obs.sources[0].evidence.attachment_rule, "nearest_content_left_nearest_object_right");
});

test("stage08 emits modality_scope and negation_scope observations", async function () {
  const text = "It may not work.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 2 }, surface: "It", pos: { tag: "PRP" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 3, end: 6 }, surface: "may", pos: { tag: "MD" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 7, end: 10 }, surface: "not", pos: { tag: "RB" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 11, end: 15 }, surface: "work", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t5", i: 4, segment_id: "s1", span: { start: 15, end: 16 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const mods = out.annotations.filter(function (a) { return a.kind === "modality_scope"; });
  const negs = out.annotations.filter(function (a) { return a.kind === "negation_scope"; });
  assert.equal(mods.length, 1);
  assert.equal(negs.length, 1);

  const mod = mods[0];
  const neg = negs[0];
  assert.equal(mod.label, "modality_may");
  assert.equal(mod.marker && mod.marker.id, "t2");
  assert.equal(mod.target && mod.target.id, "t4");
  assert.equal(mod.sources[0].evidence.pattern, "modal_verb_scope");
  assert.equal(mod.sources[0].evidence.attachment_rule, "nearest_lexical_verb_right_else_left");

  assert.equal(neg.label, "negation_not");
  assert.equal(neg.marker && neg.marker.id, "t3");
  assert.equal(neg.target && neg.target.id, "t4");
  assert.equal(neg.sources[0].evidence.pattern, "negation_scope");
  assert.equal(neg.sources[0].evidence.attachment_rule, "nearest_lexical_verb_right_else_left");
});

test("stage08 treats no as quantifier_scope only (no negation_scope double count)", async function () {
  const text = "No primes work.";
  const tokens = [
    { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 2 }, surface: "No", pos: { tag: "DT" }, flags: { is_punct: false } },
    { id: "t2", i: 1, segment_id: "s1", span: { start: 3, end: 9 }, surface: "primes", pos: { tag: "NNS" }, flags: { is_punct: false } },
    { id: "t3", i: 2, segment_id: "s1", span: { start: 10, end: 14 }, surface: "work", pos: { tag: "VB" }, flags: { is_punct: false } },
    { id: "t4", i: 3, segment_id: "s1", span: { start: 14, end: 15 }, surface: ".", pos: { tag: "." }, flags: { is_punct: true } }
  ];

  const out = await stage08.runStage(seed(text, tokens));
  const qs = out.annotations.filter(function (a) { return a.kind === "quantifier_scope"; });
  const negs = out.annotations.filter(function (a) { return a.kind === "negation_scope"; });

  assert.equal(qs.length >= 1, true);
  assert.equal(negs.length, 0);
  assert.equal(qs.some(function (a) { return a.label === "quantifier_no"; }), true);
});
