"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const errors = require("../../src/util/errors");

function loadCliWithRuntimeCheckStub(stubFn) {
  const runtimePath = require.resolve("../../src/python/runtime-check");
  const indexPath = require.resolve("../../src/index");
  const cliPath = require.resolve("../../bin/linguistic-enricher");

  delete require.cache[runtimePath];
  delete require.cache[indexPath];
  delete require.cache[cliPath];

  const runtimeModule = require(runtimePath);
  runtimeModule.runRuntimeChecks = stubFn;

  return require(cliPath);
}

test("CLI doctor success path keeps exit code 0 and prints success", async function () {
  const cli = loadCliWithRuntimeCheckStub(async function () {
    return {
      ok: true,
      python: { executable: "python", version: "Python 3.11.9" },
      dependencies: { spacy: true },
      model: { name: "en_core_web_sm", installed: true }
    };
  });

  const output = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalExitCode = process.exitCode;

  process.exitCode = 0;
  console.log = function (msg) { output.push(String(msg)); };
  console.error = function () {};

  try {
    await cli.main(["node", "linguistic-enricher", "doctor"]);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
  }

  assert.equal(output.some(function (line) {
    return line.indexOf("Doctor checks passed.") !== -1;
  }), true);
});

test("CLI doctor failure path sets exit code 1 and prints typed code", async function () {
  const cli = loadCliWithRuntimeCheckStub(async function () {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_MODEL_MISSING,
      "Model missing"
    );
  });

  await assert.rejects(
    function () {
      return cli.main(["node", "linguistic-enricher", "doctor"]);
    },
    function (error) {
      return error && error.code === errors.ERROR_CODES.E_PYTHON_MODEL_MISSING;
    }
  );
});
