"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");
const errors = require("../../src/util/errors");

function makeCanonicalDoc() {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "canonical",
    canonical_text: "Hello world",
    index_basis: {
      unit: "utf16_code_units"
    }
  };
}

test("validateDocument returns ok with schema and invariant checks", function () {
  const result = api.validateDocument(makeCanonicalDoc());
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks, ["schema", "invariants"]);
});

test("validateDocument throws typed schema error for invalid docs", function () {
  const bad = makeCanonicalDoc();
  delete bad.seed_id;

  assert.throws(
    function () {
      api.validateDocument(bad);
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_SCHEMA_INVALID);
      return true;
    }
  );
});

test("validateDocument throws typed invariant error for invariant violations", function () {
  const bad = makeCanonicalDoc();
  bad.stage = "tokenized";
  bad.segments = [
    {
      id: "s1",
      index: 0,
      span: { start: 0, end: 11 },
      token_range: { start: 0, end: 2 }
    }
  ];
  bad.tokens = [
    {
      id: "t1",
      i: 0,
      segment_id: "missing-segment",
      span: { start: 0, end: 5 },
      surface: "Hello"
    },
    {
      id: "t2",
      i: 1,
      segment_id: "s1",
      span: { start: 6, end: 11 },
      surface: "world"
    }
  ];

  assert.throws(
    function () {
      api.validateDocument(bad, { skipSchema: true });
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
