"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const registry = require("../../src/pipeline/stage-registry");

test("PIPELINE_TARGETS include mwe_materialized and parsed", function () {
  assert.equal(registry.PIPELINE_TARGETS.includes("mwe_materialized"), true);
  assert.equal(registry.PIPELINE_TARGETS.includes("parsed"), true);
});

test("resolveStagesUpToTarget respects canonical order", function () {
  const parsedStages = registry.resolveStagesUpToTarget("parsed");
  const names = parsedStages.map(function (s) { return s.prototypeStage; });
  assert.deepEqual(names, ["00", "01", "02", "03", "04", "05", "06", "07", "08"]);
});
