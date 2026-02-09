"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const runPipelineModule = require("../../src/pipeline/run-pipeline");
const stageRegistry = require("../../src/pipeline/stage-registry");
const schemaValidator = require("../../src/validation/schema-validator");
const invariantsValidator = require("../../src/validation/runtime-invariants");
const errors = require("../../src/util/errors");

function makeSeed() {
  return {
    schema_version: "1.0.0",
    seed_id: "seed-1",
    stage: "canonical",
    canonical_text: "Hello world",
    index_basis: {
      unit: "utf16_code_units"
    }
  };
}

test("runPipelineInternal calls validation hooks at entry, before, after, and final", async function () {
  const originalResolve = stageRegistry.resolveStagesUpToTarget;
  const originalSchema = schemaValidator.validateSchema;
  const originalInvariants = invariantsValidator.validateRuntimeInvariants;

  const calls = [];
  stageRegistry.resolveStagesUpToTarget = function () {
    return [
      {
        index: 0,
        prototypeStage: "00",
        target: "__internal_precanonical__",
        modulePath: "./fake/stage0",
        runStage: async function (seed) {
          const next = Object.assign({}, seed);
          next.stage = "canonical";
          return next;
        }
      }
    ];
  };

  schemaValidator.validateSchema = function () {
    calls.push("schema");
    return { ok: true };
  };
  invariantsValidator.validateRuntimeInvariants = function () {
    calls.push("invariants");
    return { ok: true };
  };

  try {
    const result = await runPipelineModule.runPipelineInternal(makeSeed(), { target: "canonical" });
    assert.equal(result.stage, "canonical");
    assert.equal(calls.length, 8);
  } finally {
    stageRegistry.resolveStagesUpToTarget = originalResolve;
    schemaValidator.validateSchema = originalSchema;
    invariantsValidator.validateRuntimeInvariants = originalInvariants;
  }
});

test("runPipelineInternal surfaces validator failures with phase context", async function () {
  const originalResolve = stageRegistry.resolveStagesUpToTarget;
  const originalSchema = schemaValidator.validateSchema;
  const originalInvariants = invariantsValidator.validateRuntimeInvariants;

  stageRegistry.resolveStagesUpToTarget = function () {
    return [
      {
        index: 0,
        prototypeStage: "00",
        target: "__internal_precanonical__",
        modulePath: "./fake/stage0",
        runStage: async function (seed) {
          return seed;
        }
      }
    ];
  };

  schemaValidator.validateSchema = function () {
    return { ok: true };
  };
  invariantsValidator.validateRuntimeInvariants = function () {
    throw errors.createError(errors.ERROR_CODES.E_INVARIANT_VIOLATION, "Invariant failed");
  };

  try {
    await assert.rejects(
      runPipelineModule.runPipelineInternal(makeSeed(), { target: "canonical" }),
      function (error) {
        assert.equal(error.code, errors.ERROR_CODES.E_INVARIANT_VIOLATION);
        assert.equal(error.message.indexOf("Validation failed at entry:invariants") !== -1, true);
        return true;
      }
    );
  } finally {
    stageRegistry.resolveStagesUpToTarget = originalResolve;
    schemaValidator.validateSchema = originalSchema;
    invariantsValidator.validateRuntimeInvariants = originalInvariants;
  }
});

