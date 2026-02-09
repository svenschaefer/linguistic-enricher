"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline mwe_candidates emits prototype-style labels", async function () {
  const text = "A prime number generator tests each successive integer for primality.";
  const out = await api.runPipeline(text, { target: "mwe_candidates" });

  assert.equal(out.stage, "mwe_candidates");
  assert.equal(Array.isArray(out.annotations), true);

  const labels = out.annotations
    .filter(function (a) { return a.kind === "mwe"; })
    .map(function (a) { return a.label; });

  assert.equal(labels.includes("prime number generator"), true);
  assert.equal(labels.includes("prime number"), true);
});

test("runPipeline mwe_candidates keeps matcher and lexicon sources on candidates", async function () {
  const out = await api.runPipeline("An online store has a shopping cart.", { target: "mwe_candidates" });
  const candidates = out.annotations.filter(function (a) { return a.kind === "mwe"; });

  assert.equal(candidates.length > 0, true);

  const hasOnlineStore = candidates.some(function (c) { return c.label === "online store"; });
  const hasShoppingCart = candidates.some(function (c) { return c.label === "shopping cart"; });
  assert.equal(hasOnlineStore, true);
  assert.equal(hasShoppingCart, true);

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const hasMatcher = candidate.sources.some(function (s) {
      return typeof s.name === "string" && s.name.startsWith("spacy:matcher/");
    });
    const lexicon = candidate.sources.find(function (s) { return s.name === "wikipedia-title-index"; });

    assert.equal(hasMatcher, true);
    assert.equal(typeof lexicon, "object");
    assert.equal(typeof lexicon.evidence, "object");
  }
});

test(
  "runPipeline mwe_candidates uses live wikipedia-title-index endpoint when configured",
  {
    skip: !process.env.WIKI_INDEX_ENDPOINT
      ? "Set WIKI_INDEX_ENDPOINT to run live lexicon integration check"
      : false
  },
  async function () {
    const out = await api.runPipeline("An online store has a shopping cart.", {
      target: "mwe_candidates",
      services: {
        "wikipedia-title-index": {
          endpoint: process.env.WIKI_INDEX_ENDPOINT
        }
      }
    });

    const candidates = out.annotations.filter(function (a) { return a.kind === "mwe"; });
    assert.equal(candidates.length > 0, true);

    const hasSignal = candidates.some(function (candidate) {
      const lexicon = candidate.sources.find(function (s) { return s.name === "wikipedia-title-index"; });
      return Boolean(lexicon && lexicon.evidence && lexicon.evidence.wiki_any_signal === true);
    });

    assert.equal(hasSignal, true);
  }
);
