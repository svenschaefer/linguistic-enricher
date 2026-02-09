"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline reaches relations_extracted with deterministic output", async function () {
  const input = "Alice sees Bob in Berlin.";
  const first = await api.runPipeline(input, { target: "relations_extracted" });
  const second = await api.runPipeline(input, { target: "relations_extracted" });

  assert.equal(first.stage, "relations_extracted");
  assert.equal(Array.isArray(first.segments), true);
  assert.equal(Array.isArray(first.tokens), true);
  assert.equal(Array.isArray(first.annotations), true);

  assert.equal(first.annotations.some(function (a) { return a.kind === "dependency"; }), true);
  assert.equal(first.annotations.some(function (a) { return a.kind === "chunk"; }), true);
  assert.equal(first.annotations.some(function (a) { return a.kind === "chunk_head"; }), true);

  assert.deepEqual(first, second);
});
