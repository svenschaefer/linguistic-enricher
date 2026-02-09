"use strict";

/**
 * Stage stub: tokenization.
 *
 * Intended behavior: perform deterministic enrichment for this stage and return updated seed.
 * @param {object} seed Seed document.
 * @param {object} context Stage execution context.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed, context) {
  void seed;
  void context;
  throw new Error("Not implemented");
}

module.exports = {
  runStage
};