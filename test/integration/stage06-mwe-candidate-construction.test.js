"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline mwe_pattern_candidates applies stage06 and candidate-construction source", async function () {
  const out = await api.runPipeline("An online store has a shopping cart.", { target: "mwe_pattern_candidates" });
  assert.equal(out.stage, "mwe_pattern_candidates");

  const candidates = out.annotations.filter(function (a) { return a.kind === "mwe"; });
  assert.equal(candidates.length > 0, true);

  for (let i = 0; i < candidates.length; i += 1) {
    assert.equal(
      candidates[i].sources.some(function (s) { return s.name === "candidate-construction"; }),
      true
    );
  }
});

test(
  "runPipeline mwe_pattern_candidates uses live wikipedia-title-index endpoint when configured",
  {
    skip: !process.env.WIKI_INDEX_ENDPOINT
      ? "Set WIKI_INDEX_ENDPOINT to run live lexicon integration check"
      : false
  },
  async function () {
    const out = await api.runPipeline("An online store has a shopping cart.", {
      target: "mwe_pattern_candidates",
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

