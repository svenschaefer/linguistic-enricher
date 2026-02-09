"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const errors = require("../../src/util/errors");

function loadApiWithRuntimeCheckStub(stubFn) {
  const runtimePath = require.resolve("../../src/python/runtime-check");
  const indexPath = require.resolve("../../src/index");

  delete require.cache[runtimePath];
  delete require.cache[indexPath];

  const runtimeModule = require(runtimePath);
  runtimeModule.runRuntimeChecks = stubFn;

  return require(indexPath);
}

test("runDoctor returns structured success through public API", async function () {
  const expected = {
    ok: true,
    python: { executable: "python", version: "Python 3.11.9" },
    dependencies: { spacy: true },
    model: { name: "en_core_web_sm", installed: true }
  };

  const api = loadApiWithRuntimeCheckStub(async function () {
    return expected;
  });

  const result = await api.runDoctor({});
  assert.deepEqual(result, expected);
});

test("runDoctor propagates typed failure through public API", async function () {
  const api = loadApiWithRuntimeCheckStub(async function () {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_NOT_FOUND,
      "Python executable not found."
    );
  });

  await assert.rejects(
    api.runDoctor({}),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_NOT_FOUND);
      return true;
    }
  );
});

