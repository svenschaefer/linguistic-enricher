"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const invariants = require("../../src/validation/runtime-invariants");
const errors = require("../../src/util/errors");

function makeValidDoc() {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "tokenized",
    canonical_text: "Hello world",
    index_basis: {
      unit: "utf16_code_units"
    },
    segments: [
      {
        id: "s1",
        index: 0,
        span: { start: 0, end: 11 },
        token_range: { start: 0, end: 2 }
      }
    ],
    tokens: [
      {
        id: "t1",
        i: 0,
        segment_id: "s1",
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
    ],
    annotations: [
      {
        id: "a1",
        kind: "mwe",
        status: "candidate",
        label: "hello world",
        anchor: {
          selectors: [
            { type: "TokenSelector", token_ids: ["t1", "t2"] },
            { type: "TextPositionSelector", span: { start: 0, end: 11 } }
          ]
        },
        sources: [{ name: "rule", kind: "rule" }]
      }
    ]
  };
}

test("validateRuntimeInvariants accepts valid references and spans", function () {
  const result = invariants.validateRuntimeInvariants(makeValidDoc());
  assert.deepEqual(result, { ok: true });
});

test("validateRuntimeInvariants fails on invalid token segment references", function () {
  const bad = makeValidDoc();
  bad.tokens[1].segment_id = "missing-segment";

  assert.throws(
    function () {
      invariants.validateRuntimeInvariants(bad);
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("validateRuntimeInvariants fails on invalid span ordering", function () {
  const bad = makeValidDoc();
  bad.tokens[0].span = { start: 5, end: 2 };

  assert.throws(
    function () {
      invariants.validateRuntimeInvariants(bad);
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("validateRuntimeInvariants fails when segment index order is unstable", function () {
  const bad = makeValidDoc();
  bad.segments[0].index = 3;

  assert.throws(
    function () {
      invariants.validateRuntimeInvariants(bad);
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("validateRuntimeInvariants fails when segment token_range exceeds token count", function () {
  const bad = makeValidDoc();
  bad.segments[0].token_range = { start: 0, end: 3 };

  assert.throws(
    function () {
      invariants.validateRuntimeInvariants(bad);
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
