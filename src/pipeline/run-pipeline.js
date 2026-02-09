"use strict";

/**
 * Execute pipeline stages in deterministic order up to a target.
 *
 * Intended behavior: orchestrate stages 00..11 internally while exposing semantic targets.
 * @param {object} seed Seed document.
 * @param {object} options Run options.
 * @returns {Promise<object>} Updated seed document.
 */
async function runPipelineInternal(seed, options) {
  void seed;
  void options;
  throw new Error("Not implemented");
}

module.exports = {
  runPipelineInternal
};