"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");
const errors = require("../../src/util/errors");

test("runPipeline to canonical returns stage00-normalized surface text", async function () {
  const input = "A\t\tB   C   \r\n\r\n  indented   line\t \rX\u0301";
  const out = await api.runPipeline(input, { target: "canonical" });
  assert.equal(out.stage, "canonical");
  assert.equal(out.canonical_text, "A B C\n\n  indented line\nX\u0301".normalize("NFC"));
  assert.equal(out.inputs.original_text, input);
  assert.equal(out.inputs.surface_normalized_text, out.canonical_text);
});

test("runPipeline rejects partial docs with existing spans during stage00", async function () {
  const partial = {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "tokenized",
    canonical_text: "Hello world",
    index_basis: { unit: "utf16_code_units" },
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
    annotations: []
  };

  await assert.rejects(
    api.runPipeline(partial, { target: "canonical" }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});
