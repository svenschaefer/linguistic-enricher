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

