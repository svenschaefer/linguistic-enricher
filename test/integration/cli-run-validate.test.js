"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cli = require("../../bin/linguistic-enricher");
const api = require("../../src/index");

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
