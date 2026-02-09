"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { deepClone } = require("../../src/util/deep-clone");
const { byKeys, stableSort, stableStringify } = require("../../src/util/determinism");
const { createDeterministicId } = require("../../src/util/ids");
const { normalizeSpan, findAllMatches } = require("../../src/util/spans");
const errors = require("../../src/util/errors");

test("deepClone returns detached object copy", function () {
  const input = { a: 1, b: { c: 2 } };
  const out = deepClone(input);
  out.b.c = 9;
  assert.equal(input.b.c, 2);
});

test("stableSort maintains deterministic tie order", function () {
  const input = [{ k: "b" }, { k: "a" }, { k: "a" }];
  const sorted = stableSort(input, byKeys(["k"]));
  assert.deepEqual(sorted.map(function (x) { return x.k; }), ["a", "a", "b"]);
  assert.equal(sorted[0], input[1]);
  assert.equal(sorted[1], input[2]);
});

test("createDeterministicId is stable for same payload", function () {
  const id1 = createDeterministicId("tok", { i: 1, s: "hello" });
  const id2 = createDeterministicId("tok", { i: 1, s: "hello" });
  assert.equal(id1, id2);
});

test("createDeterministicId ignores object key insertion order", function () {
  const id1 = createDeterministicId("tok", { b: 2, a: 1 });
  const id2 = createDeterministicId("tok", { a: 1, b: 2 });
  assert.equal(id1, id2);
});

test("stableStringify sorts object keys recursively", function () {
  const a = stableStringify({ z: 1, a: { d: 2, c: 1 } });
  const b = stableStringify({ a: { c: 1, d: 2 }, z: 1 });
  assert.equal(a, b);
});

test("normalizeSpan validates ordering", function () {
  assert.deepEqual(normalizeSpan(2, 5), { start: 2, end: 5 });
  assert.throws(
    function () { normalizeSpan(5, 1); },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
      return true;
    }
  );
});

test("findAllMatches returns match spans", function () {
  const matches = findAllMatches("A B C", /\w/g);
  assert.equal(matches.length, 3);
  assert.deepEqual(matches[0], { match: "A", start: 0, end: 1 });
});
