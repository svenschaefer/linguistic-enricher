"use strict";

const { deepClone } = require("../../util/deep-clone");

/**
 * Stage 01: canonicalization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const source = out.inputs && typeof out.inputs.surface_normalized_text === "string"
    ? out.inputs.surface_normalized_text
    : String(out.canonical_text || "");

  out.canonical_text = source.normalize("NFC");
  if (!out.index_basis) {
    out.index_basis = { unit: "utf16_code_units" };
  }
  out.stage = "canonical";

  return out;
}

module.exports = {
  runStage
};
