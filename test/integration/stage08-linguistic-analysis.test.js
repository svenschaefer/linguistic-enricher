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

