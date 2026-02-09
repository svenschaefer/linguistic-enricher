"use strict";

const runPipelineModule = require("./pipeline/run-pipeline");
const stageRegistry = require("./pipeline/stage-registry");

/**
 * Allowed pipeline targets for this package.
 * This list is authoritative and aligned with stage-registry.
 * @type {readonly string[]}
 */
const PIPELINE_TARGETS = stageRegistry.PIPELINE_TARGETS;

/**
 * Run the linguistic enrichment pipeline through a target stage.
 *
 * Intended behavior (phase target): execute deterministic stages up to `relations_extracted`.
 * @param {string|object} input Raw text or a partial seed document.
 * @param {object} [options] Pipeline options.
 * @returns {Promise<object>} Enriched seed document.
 */
async function runPipeline(input, options) {
  return runPipelineModule.runPipelineInternal(input, options);
}

/**
 * Perform runtime diagnostics for Node/Python/service prerequisites.
 *
 * Intended behavior (phase target): verify Python runtime, required packages, and optional service reachability.
 * @param {object} [options] Diagnostic options.
 * @returns {Promise<object>} Doctor report.
 */
async function runDoctor(options) {
  void options;
  throw new Error("Not implemented");
}

/**
 * Validate a seed document against schema and runtime invariants.
 *
 * Intended behavior (phase target): apply schema and invariant validation in-process.
 * @param {object} doc Seed document.
 * @param {object} [options] Validation options.
 * @returns {object} Validation result.
 */
function validateDocument(doc, options) {
  void doc;
  void options;
  throw new Error("Not implemented");
}

module.exports = {
  runPipeline,
  runDoctor,
  validateDocument,
  PIPELINE_TARGETS
};