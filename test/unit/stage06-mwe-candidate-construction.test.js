"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage06 = require("../../src/pipeline/stages/mwe-candidate-construction");

function buildSeed() {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "mwe_candidates",
    canonical_text: "online store online store",
    index_basis: { unit: "utf16_code_units" },
    tokens: [
      { id: "t1", i: 0, segment_id: "s1", span: { start: 0, end: 6 }, surface: "online", flags: { is_punct: false } },
      { id: "t2", i: 1, segment_id: "s1", span: { start: 7, end: 12 }, surface: "store", flags: { is_punct: false } },
      { id: "t3", i: 2, segment_id: "s1", span: { start: 13, end: 19 }, surface: "online", flags: { is_punct: false } },
      { id: "t4", i: 3, segment_id: "s1", span: { start: 20, end: 25 }, surface: "store", flags: { is_punct: false } }
    ],
    annotations: [
      {
        id: "a1",
        kind: "mwe",
        status: "candidate",
        label: "online store",
        surface: "online store",
        anchor: {
          selectors: [
            { type: "TextQuoteSelector", exact: "online store" },
            { type: "TokenSelector", token_ids: ["t1", "t2"] }
          ]
        },
        sources: [
          { name: "spacy:matcher/adj_np", kind: "pattern" },
          {
            name: "wikipedia-title-index",
            kind: "lexicon",
            evidence: { wiki_any_signal: false }
          }
        ]
      },
      {
        id: "a2",
        kind: "mwe",
        status: "candidate",
        label: "online store",
        surface: "online store",
        anchor: {
          selectors: [
            { type: "TextQuoteSelector", exact: "online store" },
            { type: "TokenSelector", token_ids: ["t1", "t2"] }
          ]
        },
        sources: [{ name: "spacy:matcher/np_compound", kind: "pattern" }]
      }
    ]
  };
}

test("stage06 assigns deterministic IDs and marks duplicate token-selector candidates as observation", async function () {
  const out = await stage06.runStage(buildSeed(), { options: {} });
  assert.equal(out.stage, "mwe_pattern_candidates");
  assert.equal(Array.isArray(out.annotations), true);
  assert.equal(out.annotations.length, 2);

  const first = out.annotations[0];
  const second = out.annotations[1];

  assert.equal(first.id.startsWith("mwe-"), true);
  assert.equal(first.status, "candidate");
  assert.equal(first.sources.some(function (s) { return s.name === "candidate-construction"; }), true);
  assert.equal(second.status, "observation");
});

test("stage06 preserves wikipedia lexicon source when service endpoint is not configured", async function () {
  const out = await stage06.runStage(buildSeed(), { options: {} });
  const first = out.annotations[0];
  const lexicon = first.sources.find(function (s) { return s.name === "wikipedia-title-index"; });
  assert.equal(typeof lexicon, "object");
  assert.equal(typeof lexicon.evidence, "object");
  assert.equal(lexicon.evidence.wiki_any_signal, false);
});

