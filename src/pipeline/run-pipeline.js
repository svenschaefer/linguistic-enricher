"use strict";

const stageRegistry = require("./stage-registry");
const schemaValidator = require("../validation/schema-validator");
const invariantsValidator = require("../validation/runtime-invariants");

/**
 * Clone plain JSON-compatible values deterministically.
 * @param {any} value Input value.
 * @returns {any} Cloned value.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Normalize run options and defaults.
 * @param {object} [options] User options.
 * @returns {object} Normalized options.
 */
function normalizeOptions(options) {
  const normalized = options && typeof options === "object" ? Object.assign({}, options) : {};
  normalized.target = normalized.target || "relations_extracted";

  if (!stageRegistry.isValidTarget(normalized.target)) {
    throw new Error("Invalid pipeline target: " + String(normalized.target));
  }

  return normalized;
}

/**
 * Initialize or validate seed shape from input.
 * @param {string|object} input Raw text or partial seed document.
 * @param {object} options Normalized options.
 * @returns {object} Seed object.
 */
function initializeSeed(input, options) {
  if (typeof input === "string") {
    return {
      schema_version: "1.0.0",
      seed_id: options.seedId || "seed",
      stage: "canonical",
      canonical_text: input,
      index_basis: {
        unit: "utf16_code_units"
      }
    };
  }

  if (input && typeof input === "object") {
    return clone(input);
  }

  throw new Error("Input must be a string or an object seed document");
}

/**
 * Invoke a validation hook.
 *
 * Validators are currently scaffolded and may throw "Not implemented".
 * In that case this shell continues while preserving hook call placement.
 * @param {Function} validator Validator function.
 * @param {object} seed Seed document.
 * @param {string} phase Validation phase label.
 * @returns {void}
 */
function runValidationHook(validator, seed, phase) {
  try {
    validator(seed);
  } catch (error) {
    const phaseError = new Error("Validation failed at " + phase + ": " + error.message);
    if (error && error.code) {
      phaseError.code = error.code;
    }
    if (error && error.details) {
      phaseError.details = error.details;
    }
    throw phaseError;
  }
}

/**
 * Execute pipeline stages in deterministic order up to a target.
 *
 * Intended behavior: orchestrate stages 00..11 internally while exposing semantic targets.
 * @param {string|object} input Raw text or partial seed document.
 * @param {object} [options] Run options.
 * @returns {Promise<object>} Updated seed document.
 */
async function runPipelineInternal(input, options) {
  const normalizedOptions = normalizeOptions(options);
  let seed = initializeSeed(input, normalizedOptions);
  const stages = stageRegistry.resolveStagesUpToTarget(normalizedOptions.target);

  runValidationHook(schemaValidator.validateSchema, seed, "entry:schema");
  runValidationHook(invariantsValidator.validateRuntimeInvariants, seed, "entry:invariants");

  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    const context = {
      stageIndex: stage.index,
      prototypeStage: stage.prototypeStage,
      semanticTarget: stage.target,
      modulePath: stage.modulePath,
      options: normalizedOptions
    };

    runValidationHook(schemaValidator.validateSchema, seed, "before:" + stage.prototypeStage + ":schema");
    runValidationHook(
      invariantsValidator.validateRuntimeInvariants,
      seed,
      "before:" + stage.prototypeStage + ":invariants"
    );

    seed = await stage.runStage(seed, context);

    runValidationHook(schemaValidator.validateSchema, seed, "after:" + stage.prototypeStage + ":schema");
    runValidationHook(
      invariantsValidator.validateRuntimeInvariants,
      seed,
      "after:" + stage.prototypeStage + ":invariants"
    );
  }

  runValidationHook(schemaValidator.validateSchema, seed, "final:schema");
  runValidationHook(invariantsValidator.validateRuntimeInvariants, seed, "final:invariants");

  return seed;
}

module.exports = {
  runPipelineInternal,
  normalizeOptions,
  initializeSeed
};
