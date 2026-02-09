"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline canonical includes stage01 canonical metadata and text", async function () {
  const input = "Cafe\u0301\r\nA\rB";
  const out = await api.runPipeline(input, { target: "canonical" });

  assert.equal(out.stage, "canonical");
  assert.equal(out.canonical_text, "Café\nA\nB");
  assert.deepEqual(out.index_basis, { unit: "utf16_code_units" });
  assert.equal(out.provenance.normalization.unicode, "NFC");
  assert.equal(out.provenance.normalization.line_endings, "LF");
});

