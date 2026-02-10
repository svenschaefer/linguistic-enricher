"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

test("npm pack contains required runtime files and excludes dev artifacts", async function () {
  const npmCli = process.env.npm_execpath;
  assert.equal(typeof npmCli, "string");
  assert.equal(npmCli.length > 0, true);

  const result = childProcess.spawnSync(
    process.execPath,
    [npmCli, "pack", "--json"],
    {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf8"
    }
  );

  assert.equal(result.error, undefined, String(result.error || ""));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const json = JSON.parse(result.stdout);
  assert.equal(Array.isArray(json), true);
  assert.equal(json.length > 0, true);

  const packInfo = json[0];
  const filePaths = new Set(packInfo.files.map(function (entry) {
    return entry.path;
  }));

  const required = [
    "README.md",
    "schema.json",
    "bin/linguistic-enricher.js",
    "src/index.js"
  ];
  required.forEach(function (requiredPath) {
    assert.equal(
      filePaths.has(requiredPath),
      true,
      "Missing required packed file: " + requiredPath
    );
  });

  const forbiddenPatterns = [
    /^test\//,
    /^docs\//,
    /^AGENT\.md$/,
    /^TODO\.md$/,
    /live-output/i,
    /^tmp-/i
  ];

  filePaths.forEach(function (packedPath) {
    forbiddenPatterns.forEach(function (pattern) {
      assert.equal(
        pattern.test(packedPath),
        false,
        "Forbidden packed file: " + packedPath
      );
    });
  });

  const tarballPath = path.resolve(path.dirname(__dirname), "..", packInfo.filename);
  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }
});
