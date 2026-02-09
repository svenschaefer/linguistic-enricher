"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const events = require("node:events");
const childProcess = require("child_process");
const runner = require("../../src/python/python-runner");
const errors = require("../../src/util/errors");

let originalSpawn;

test.beforeEach(function () {
  originalSpawn = childProcess.spawn;
});

test.afterEach(function () {
  childProcess.spawn = originalSpawn;
});

function createMockChild() {
  const child = new events.EventEmitter();
  child.stdout = new events.EventEmitter();
  child.stderr = new events.EventEmitter();
  child.stdin = {
    _buffer: "",
    write: function (chunk) {
      this._buffer += chunk.toString();
    },
    end: function () {}
  };
  child.kill = function () {
    process.nextTick(function () {
      child.emit("close", 0, "SIGKILL");
    });
  };
  return child;
}

test("runPythonStage returns result on successful protocol response", async function () {
  childProcess.spawn = function () {
    const child = createMockChild();
    process.nextTick(function () {
      child.stdout.emit("data", Buffer.from('{"ok":true,"result":{"value":42}}'));
      child.emit("close", 0, null);
    });
    return child;
  };

  const result = await runner.runPythonStage("pos_tagged", { tokenCount: 2 }, { timeoutMs: 500 });
  assert.deepEqual(result, { value: 42 });
});

test("runPythonStage throws E_PYTHON_SUBPROCESS_FAILED on non-zero exit", async function () {
  childProcess.spawn = function () {
    const child = createMockChild();
    process.nextTick(function () {
      child.stderr.emit("data", Buffer.from("boom"));
      child.emit("close", 2, null);
    });
    return child;
  };

  await assert.rejects(
    runner.runPythonStage("pos_tagged", {}, { timeoutMs: 500 }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_SUBPROCESS_FAILED);
      return true;
    }
  );
});

test("runPythonStage throws E_PYTHON_PROTOCOL_INVALID_JSON on bad stdout envelope", async function () {
  childProcess.spawn = function () {
    const child = createMockChild();
    process.nextTick(function () {
      child.stdout.emit("data", Buffer.from("not-json"));
      child.emit("close", 0, null);
    });
    return child;
  };

  await assert.rejects(
    runner.runPythonStage("pos_tagged", {}, { timeoutMs: 500 }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON);
      return true;
    }
  );
});

test("runPythonStage throws E_PYTHON_TIMEOUT on timeout", async function () {
  childProcess.spawn = function () {
    return createMockChild();
  };

  await assert.rejects(
    runner.runPythonStage("pos_tagged", {}, { timeoutMs: 10 }),
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_TIMEOUT);
      return true;
    }
  );
});
