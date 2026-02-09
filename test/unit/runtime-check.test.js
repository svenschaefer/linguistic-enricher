"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");
const runtimeCheck = require("../../src/python/runtime-check");
const errors = require("../../src/util/errors");

let originalSpawnSync;

test.beforeEach(function () {
  originalSpawnSync = childProcess.spawnSync;
});

test.afterEach(function () {
  childProcess.spawnSync = originalSpawnSync;
});

function okResult(stdout, stderr) {
  return { status: 0, stdout: stdout || "", stderr: stderr || "", error: undefined };
}

function failResult(status, stderr) {
  return { status: status, stdout: "", stderr: stderr || "", error: undefined };
}

test("runRuntimeChecks returns structured success result", async function () {
  childProcess.spawnSync = function mockSpawnSync(exe, args) {
    void exe;
    const key = args.join(" ");
    if (key === "--version") {
      return okResult("Python 3.11.9\n", "");
    }
    if (key === "-c import spacy") {
      return okResult("", "");
    }
    if (key.indexOf("spacy.load") !== -1) {
      return okResult("", "");
    }
    return failResult(1, "unexpected command");
  };

  const result = await runtimeCheck.runRuntimeChecks({ modelName: "en_core_web_sm" });
  assert.equal(result.ok, true);
  assert.equal(result.dependencies.spacy, true);
  assert.equal(result.model.installed, true);
  assert.equal(result.model.name, "en_core_web_sm");
});

test("runRuntimeChecks throws E_PYTHON_NOT_FOUND when python is unavailable", async function () {
  childProcess.spawnSync = function mockSpawnSync() {
    return { status: null, stdout: "", stderr: "", error: new Error("ENOENT") };
  };

  await assert.rejects(
    runtimeCheck.runRuntimeChecks({}),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_NOT_FOUND);
      return true;
    }
  );
});

test("runRuntimeChecks throws E_PYTHON_DEPENDENCY_MISSING when spacy import fails", async function () {
  childProcess.spawnSync = function mockSpawnSync(exe, args) {
    void exe;
    const key = args.join(" ");
    if (key === "--version") {
      return okResult("Python 3.11.9\n", "");
    }
    if (key === "-c import spacy") {
      return failResult(1, "ModuleNotFoundError: No module named 'spacy'");
    }
    return failResult(1, "unexpected command");
  };

  await assert.rejects(
    runtimeCheck.runRuntimeChecks({}),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_DEPENDENCY_MISSING);
      return true;
    }
  );
});

test("runRuntimeChecks throws E_PYTHON_MODEL_MISSING when spaCy model is unavailable", async function () {
  childProcess.spawnSync = function mockSpawnSync(exe, args) {
    void exe;
    const key = args.join(" ");
    if (key === "--version") {
      return okResult("Python 3.11.9\n", "");
    }
    if (key === "-c import spacy") {
      return okResult("", "");
    }
    if (key.indexOf("spacy.load") !== -1) {
      return failResult(1, "OSError: [E050] Can't find model 'en_core_web_sm'");
    }
    return failResult(1, "unexpected command");
  };

  await assert.rejects(
    runtimeCheck.runRuntimeChecks({ modelName: "en_core_web_sm" }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_MODEL_MISSING);
      return true;
    }
  );
});
