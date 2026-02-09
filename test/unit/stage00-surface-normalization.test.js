"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const stage00 = require("../../src/pipeline/stages/surface-normalization");
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

test("stage00 normalizes CRLF and CR to LF", async function () {
  const out = await stage00.runStage(makeSeed("a\r\nb\rc"));
  assert.equal(out.canonical_text, "a\nb\nc");
});

test("stage00 converts tabs, trims trailing spaces, and collapses in-line spaces", async function () {
  const out = await stage00.runStage(makeSeed("A\t\tB   C   \nD\t E   "));
  assert.equal(out.canonical_text, "A B C\nD E");
});

test("stage00 preserves empty lines and leading indentation after newline", async function () {
  const out = await stage00.runStage(makeSeed("X\n\n  indented   line\t \nY"));
  assert.equal(out.canonical_text, "X\n\n  indented line\nY");
});

test("stage00 applies NFC unicode normalization", async function () {
  const out = await stage00.runStage(makeSeed("Cafe\u0301"));
  assert.equal(out.canonical_text, "Café");
});

test("stage00 rejects partial docs with existing anchors/spans", async function () {
  const seed = makeSeed("Hello world");
  seed.segments = [
    {
      id: "s1",
      index: 0,
      span: { start: 0, end: 11 },
      token_range: { start: 0, end: 2 }
    }
  ];

  await assert.rejects(
    stage00.runStage(seed),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

