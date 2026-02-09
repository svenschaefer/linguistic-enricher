"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline heads_identified emits chunk_head annotations with deterministic output", async function () {
  const text = "The online store in New York sells carts.";
  const outA = await api.runPipeline(text, { target: "heads_identified" });
  const outB = await api.runPipeline(text, { target: "heads_identified" });

  assert.equal(outA.stage, "heads_identified");
  assert.deepEqual(outA, outB);

  const chunks = outA.annotations.filter(function (a) { return a.kind === "chunk"; });
  const heads = outA.annotations.filter(function (a) { return a.kind === "chunk_head"; });
  assert.equal(chunks.length > 0, true);
  assert.equal(heads.length > 0, true);
  assert.equal(heads.length, chunks.length);

  for (let i = 0; i < heads.length; i += 1) {
    const head = heads[i];
    const tokenSelector = head.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; });
    const textPos = head.anchor.selectors.find(function (s) { return s.type === "TextPositionSelector"; });
    const textQuote = head.anchor.selectors.find(function (s) { return s.type === "TextQuoteSelector"; });

    assert.ok(tokenSelector);
    assert.ok(textPos);
    assert.ok(textQuote);
    assert.equal(tokenSelector.token_ids.length, 1);
    assert.equal(textQuote.exact, outA.canonical_text.slice(textPos.span.start, textPos.span.end));
    assert.equal(chunks.some(function (c) { return c.id === head.chunk_id; }), true);
  }
});
