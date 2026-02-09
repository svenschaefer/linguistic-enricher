"use strict";

const { deepClone } = require("../../util/deep-clone");

function normalizeSurface(text) {
  const withoutBom = text.replace(/^\uFEFF/, "");
  return withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Stage 00: surface normalization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const original = typeof out.canonical_text === "string" ? out.canonical_text : "";
  const normalized = normalizeSurface(original);

  if (!out.inputs || typeof out.inputs !== "object" || Array.isArray(out.inputs)) {
    out.inputs = {};
  }
  out.inputs.original_text = original;
  out.inputs.surface_normalized_text = normalized;
  out.canonical_text = normalized;
  out.stage = "canonical";

  return out;
}

module.exports = {
  runStage
};
