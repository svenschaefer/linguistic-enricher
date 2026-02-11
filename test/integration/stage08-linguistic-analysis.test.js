"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline parsed emits dependency, lemma, noun_phrase, and named_entity observations", async function () {
  const out = await api.runPipeline("The online store in New York sells carts.", { target: "parsed" });
  assert.equal(out.stage, "parsed");

  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });
  const lemmas = out.annotations.filter(function (a) { return a.kind === "lemma"; });
  const nps = out.annotations.filter(function (a) { return a.kind === "noun_phrase"; });
  const nes = out.annotations.filter(function (a) { return a.kind === "named_entity"; });

  assert.equal(deps.length > 0, true);
  assert.equal(lemmas.length > 0, true);
  assert.equal(nps.length > 0, true);
  assert.equal(nes.length > 0, true);

  const roots = deps.filter(function (a) { return a.is_root === true; });
  assert.equal(roots.length, 1);
});

test("runPipeline parsed carries or-coordination evidence for educational purpose alternatives", async function () {
  const text = "Generated primes may be used for educational purposes or basic numerical experiments.";
  const out = await api.runPipeline(text, { target: "parsed" });

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });

  const ccOr = deps.find(function (a) {
    if (a.label !== "cc" || !a.dep || !a.dep.id) {
      return false;
    }
    const token = tokenById.get(a.dep.id);
    return token && String(token.surface).toLowerCase() === "or";
  });

  assert.ok(ccOr);
  const evidence = ccOr.sources[0].evidence;
  assert.equal(evidence.coordination_type, "or");
  assert.equal(evidence.coordinator_token_id, ccOr.dep.id);
});

test("runPipeline parsed carries and-coordination evidence on cc and conj in verbal coordination", async function () {
  const text = "It starts at a given minimum value and tests each successive integer for primality.";
  const out = await api.runPipeline(text, { target: "parsed" });

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });

  const ccAnd = deps.find(function (a) {
    if (a.label !== "cc" || !a.dep || !a.dep.id) {
      return false;
    }
    const token = tokenById.get(a.dep.id);
    return token && String(token.surface).toLowerCase() === "and";
  });
  assert.ok(ccAnd);
  assert.equal(ccAnd.sources[0].evidence.coordination_type, "and");
  assert.equal(ccAnd.sources[0].evidence.coordinator_token_id, ccAnd.dep.id);

  const conj = deps.find(function (a) {
    if (a.label !== "conj" || !a.dep || !a.dep.id) {
      return false;
    }
    const token = tokenById.get(a.dep.id);
    if (!token || String(token.surface).toLowerCase() !== "tests") {
      return false;
    }
    return (
      a.sources &&
      Array.isArray(a.sources) &&
      a.sources[0] &&
      a.sources[0].evidence &&
      a.sources[0].evidence.coordination_type === "and"
    );
  });
  assert.ok(conj);
  assert.equal(conj.sources[0].evidence.coordinator_token_id, ccAnd.dep.id);
});

test("runPipeline parsed carries or-coordination evidence on cc and conj in verbal coordination", async function () {
  const text = "Generated primes may be used for educational purposes or support experiments.";
  const out = await api.runPipeline(text, { target: "parsed" });

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const deps = out.annotations.filter(function (a) { return a.kind === "dependency"; });

  const ccOr = deps.find(function (a) {
    if (a.label !== "cc" || !a.dep || !a.dep.id) {
      return false;
    }
    const token = tokenById.get(a.dep.id);
    return token && String(token.surface).toLowerCase() === "or";
  });
  assert.ok(ccOr);
  assert.equal(ccOr.sources[0].evidence.coordination_type, "or");
  assert.equal(ccOr.sources[0].evidence.coordinator_token_id, ccOr.dep.id);

  const conjVerb = deps.find(function (a) {
    if (a.label !== "conj" || !a.dep || !a.dep.id) {
      return false;
    }
    const token = tokenById.get(a.dep.id);
    if (!token || String(token.surface).toLowerCase() !== "support") {
      return false;
    }
    return (
      a.sources &&
      Array.isArray(a.sources) &&
      a.sources[0] &&
      a.sources[0].evidence &&
      a.sources[0].evidence.coordination_type === "or"
    );
  });
  assert.ok(conjVerb);
  assert.equal(conjVerb.sources[0].evidence.coordinator_token_id, ccOr.dep.id);
});

test("runPipeline parsed emits comparative observation for greater than 1", async function () {
  const text = "A value greater than 1 is accepted.";
  const out = await api.runPipeline(text, { target: "parsed" });
  const comparatives = out.annotations.filter(function (a) { return a.kind === "comparative"; });
  assert.equal(comparatives.length >= 1, true);

  const cmp = comparatives[0];
  assert.equal(cmp.sources[0].evidence.pattern, "comparative_than");
  assert.equal(cmp.sources[0].evidence.marker_surface, "than");
  assert.ok(cmp.marker && cmp.marker.id);
  assert.ok(cmp.rhs && cmp.rhs.id);
});

test("runPipeline parsed emits quantifier/scope observations for each and only", async function () {
  const text = "It tests each successive integer and only accepts primes.";
  const out = await api.runPipeline(text, { target: "parsed" });
  const qs = out.annotations.filter(function (a) { return a.kind === "quantifier_scope"; });
  assert.equal(qs.length >= 2, true);

  const eachObs = qs.find(function (a) { return a.label === "quantifier_each"; });
  const onlyObs = qs.find(function (a) { return a.label === "scope_only"; });
  assert.ok(eachObs);
  assert.ok(onlyObs);

  assert.equal(eachObs.category, "quantifier");
  assert.equal(eachObs.sources[0].evidence.marker_surface, "each");
  assert.equal(eachObs.sources[0].evidence.attachment_rule, "nearest_noun_right_else_left");

  assert.equal(onlyObs.category, "scope");
  assert.equal(onlyObs.sources[0].evidence.marker_surface, "only");
  assert.equal(onlyObs.sources[0].evidence.attachment_rule, "nearest_noun_right_else_left");
});

test("runPipeline parsed emits copula_frame observation for copula clauses", async function () {
  const text = "Generated primes are useful.";
  const out = await api.runPipeline(text, { target: "parsed" });
  const frames = out.annotations.filter(function (a) { return a.kind === "copula_frame"; });
  assert.equal(frames.length >= 1, true);

  const frame = frames[0];
  assert.equal(frame.sources[0].evidence.pattern, "copula_subject_complement");
  assert.ok(frame.subject && frame.subject.id);
  assert.ok(frame.copula && frame.copula.id);
  assert.ok(frame.complement && frame.complement.id);
});

test("runPipeline parsed emits pp_attachment observations for at/for markers", async function () {
  const text = "It starts at a given minimum value and tests each successive integer for primality.";
  const out = await api.runPipeline(text, { target: "parsed" });
  const pp = out.annotations.filter(function (a) { return a.kind === "pp_attachment"; });
  assert.equal(pp.length >= 2, true);

  const surfaces = new Set(pp.map(function (x) { return x.prep_surface; }));
  assert.equal(surfaces.has("at"), true);
  assert.equal(surfaces.has("for"), true);

  const atObs = pp.find(function (x) { return x.prep_surface === "at"; });
  const forObs = pp.find(function (x) { return x.prep_surface === "for"; });
  assert.ok(atObs);
  assert.ok(forObs);
  assert.equal(atObs.sources[0].evidence.pattern, "pp_head_object");
  assert.equal(forObs.sources[0].evidence.pattern, "pp_head_object");
  assert.equal(atObs.sources[0].evidence.attachment_rule, "nearest_content_left_nearest_object_right");
  assert.equal(forObs.sources[0].evidence.attachment_rule, "nearest_content_left_nearest_object_right");
});

test("runPipeline parsed emits modality_scope and negation_scope observations", async function () {
  const text = "Generated primes may not be used for basic experiments.";
  const out = await api.runPipeline(text, { target: "parsed" });
  const mods = out.annotations.filter(function (a) { return a.kind === "modality_scope"; });
  const negs = out.annotations.filter(function (a) { return a.kind === "negation_scope"; });
  assert.equal(mods.length >= 1, true);
  assert.equal(negs.length >= 1, true);

  const mod = mods[0];
  const neg = negs[0];
  assert.equal(mod.sources[0].evidence.pattern, "modal_verb_scope");
  assert.equal(neg.sources[0].evidence.pattern, "negation_scope");
  assert.equal(mod.sources[0].evidence.attachment_rule, "nearest_lexical_verb_right_else_left");
  assert.equal(neg.sources[0].evidence.attachment_rule, "nearest_lexical_verb_right_else_left");
  assert.ok(mod.marker && mod.marker.id);
  assert.ok(neg.marker && neg.marker.id);
  assert.ok(mod.target && mod.target.id);
  assert.ok(neg.target && neg.target.id);
});
