"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline chunked emits deterministic POS-FSM chunk annotations", async function () {
  const text = "The online store in New York sells carts.";
  const outA = await api.runPipeline(text, { target: "chunked" });
  const outB = await api.runPipeline(text, { target: "chunked" });

  assert.equal(outA.stage, "chunked");
  assert.equal(outB.stage, "chunked");
  assert.deepEqual(outA, outB);

  const chunks = outA.annotations.filter(function (a) { return a.kind === "chunk"; });
  assert.equal(chunks.length > 0, true);
  assert.equal(chunks.some(function (a) { return a.chunk_type === "NP"; }), true);
  assert.equal(chunks.some(function (a) { return a.chunk_type === "O"; }), true);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const tokenSelector = chunk.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; });
    const textPos = chunk.anchor.selectors.find(function (s) { return s.type === "TextPositionSelector"; });
    const textQuote = chunk.anchor.selectors.find(function (s) { return s.type === "TextQuoteSelector"; });

    assert.ok(tokenSelector);
    assert.ok(textPos);
    assert.ok(textQuote);
    assert.equal(Array.isArray(tokenSelector.token_ids) && tokenSelector.token_ids.length > 0, true);
    assert.equal(textQuote.exact, outA.canonical_text.slice(textPos.span.start, textPos.span.end));
  }
});
