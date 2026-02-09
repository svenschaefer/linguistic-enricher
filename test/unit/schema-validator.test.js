"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const schemaValidator = require("../../src/validation/schema-validator");
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

test("validateSchema accepts a minimal canonical document", function () {
  const result = schemaValidator.validateSchema(makeCanonicalDoc());
  assert.deepEqual(result, { ok: true });
});

test("validateSchema throws E_SCHEMA_INVALID for invalid structure", function () {
  const bad = makeCanonicalDoc();
  delete bad.canonical_text;

  assert.throws(
    function () {
      schemaValidator.validateSchema(bad);
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_SCHEMA_INVALID);
      assert.equal(Array.isArray(error.details.errors), true);
      return true;
    }
  );
});

