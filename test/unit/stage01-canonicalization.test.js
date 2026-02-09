"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage01 = require("../../src/pipeline/stages/canonicalization");
const errors = require("../../src/util/errors");

function makeSeed(text) {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "canonical",
    canonical_text: text,
    index_basis: {
      unit: "utf16_code_units"
    }
  };
}

test("stage01 uses inputs.surface_normalized_text when provided", async function () {
  const seed = makeSeed("ignored");
  seed.inputs = {
    surface_normalized_text: "from-inputs"
  };

  const out = await stage01.runStage(seed);
  assert.equal(out.canonical_text, "from-inputs");
});

test("stage01 applies NFC and newline LF normalization", async function () {
  const out = await stage01.runStage(makeSeed("Cafe\u0301\r\nA\rB"));
  assert.equal(out.canonical_text, "Café\nA\nB");
});

test("stage01 enforces index basis and provenance normalization markers", async function () {
  const out = await stage01.runStage(makeSeed("Hello"));
  assert.deepEqual(out.index_basis, { unit: "utf16_code_units" });
  assert.equal(out.provenance.normalization.unicode, "NFC");
  assert.equal(out.provenance.normalization.line_endings, "LF");
  assert.equal(out.stage, "canonical");
});

test("stage01 rejects partial docs with existing anchors/spans", async function () {
  const seed = makeSeed("Hello");
  seed.annotations = [
    {
      id: "a1",
      kind: "mwe",
      status: "candidate",
      label: "hello",
      anchor: { selectors: [{ type: "TextQuoteSelector", exact: "Hello" }] },
      sources: [{ name: "rule", kind: "rule" }]
    }
  ];

  await assert.rejects(
    stage01.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

