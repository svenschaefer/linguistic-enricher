"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cli = require("../../bin/linguistic-enricher");
const api = require("../../src/index");

const CLI_PATH = path.resolve(__dirname, "../../bin/linguistic-enricher.js");

function runCli(args, options) {
  return childProcess.spawnSync(
    process.execPath,
    [CLI_PATH].concat(args),
    Object.assign({ encoding: "utf8" }, options || {})
  );
}

test("CLI run writes output and validate succeeds", async function () {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ling-enricher-"));
  const inputFile = path.join(tmpDir, "input.txt");
  const outputFile = path.join(tmpDir, "out.json");

  fs.writeFileSync(inputFile, "Alice sees Bob in Berlin.", "utf8");

  await cli.main([
    "node",
    "linguistic-enricher",
    "run",
    "--in",
    inputFile,
    "--out",
    outputFile,
    "--target",
    "relations_extracted"
  ]);

  const output = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  assert.equal(output.stage, "relations_extracted");
  assert.equal(Object.prototype.hasOwnProperty.call(output, "seed"), false);

  const fromApi = await api.runPipeline("Alice sees Bob in Berlin.", {
    target: "relations_extracted"
  });
  assert.deepEqual(output, fromApi);

  const logs = [];
  const originalLog = console.log;
  console.log = function (msg) { logs.push(String(msg)); };
  try {
    await cli.main([
      "node",
      "linguistic-enricher",
      "validate",
      "--in",
      outputFile
    ]);
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.length > 0, true);
  const validation = JSON.parse(logs[0]);
  assert.equal(validation.ok, true);
});

test("CLI run --help and global --help exit 0 and print usage", async function () {
  const globalHelp = runCli(["--help"]);
  assert.equal(globalHelp.status, 0);
  assert.match(globalHelp.stdout, /Usage: linguistic-enricher/);

  const runHelp = runCli(["run", "--help"]);
  assert.equal(runHelp.status, 0);
  assert.match(runHelp.stdout, /Usage: linguistic-enricher run/);
});

test("CLI run with unknown flag fails non-zero and prints usage", async function () {
  const result = runCli(["run", "--text", "hello", "--unknown-flag"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /E_CLI_USAGE/);
  assert.match(result.stderr, /Unknown flag/);
  assert.match(result.stdout, /Usage: linguistic-enricher run/);
});

test("CLI validate failure prints typed E_* code and exits non-zero", async function () {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ling-enricher-"));
  const invalidPath = path.join(tmpDir, "invalid.json");
  fs.writeFileSync(invalidPath, JSON.stringify({ bad: true }), "utf8");

  const result = runCli(["validate", "--in", invalidPath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CLI failed \[E_/);
});

test("CLI run with --out writes file and does not print JSON to stdout", async function () {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ling-enricher-"));
  const inputFile = path.join(tmpDir, "input.txt");
  const outputFile = path.join(tmpDir, "out.json");

  fs.writeFileSync(inputFile, "A test", "utf8");
  const result = runCli(["run", "--in", inputFile, "--target", "canonical", "--out", outputFile]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "");
  assert.equal(fs.existsSync(outputFile), true);
  const parsed = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  assert.equal(parsed.stage, "canonical");
});
