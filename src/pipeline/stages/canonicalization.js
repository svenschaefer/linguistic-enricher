"use strict";

const { deepClone } = require("../../util/deep-clone");
const errors = require("../../util/errors");

function canonicalize(text) {
  return String(text || "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function hasExistingAnchors(seed) {
  const segments = Array.isArray(seed.segments) ? seed.segments : [];
  const tokens = Array.isArray(seed.tokens) ? seed.tokens : [];
  const annotations = Array.isArray(seed.annotations) ? seed.annotations : [];
  return segments.length > 0 || tokens.length > 0 || annotations.length > 0;
}

/**
 * Stage 01: canonicalization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  if (hasExistingAnchors(seed)) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 01 rejects partially enriched documents with existing anchors/spans.",
      {
        segments: Array.isArray(seed.segments) ? seed.segments.length : 0,
        tokens: Array.isArray(seed.tokens) ? seed.tokens.length : 0,
        annotations: Array.isArray(seed.annotations) ? seed.annotations.length : 0
      }
    );
  }

  const out = deepClone(seed);
  const source = out.inputs && typeof out.inputs.surface_normalized_text === "string"
    ? out.inputs.surface_normalized_text
    : String(out.canonical_text || "");

  out.canonical_text = canonicalize(source);
  out.index_basis = { unit: "utf16_code_units" };

  if (!out.provenance || typeof out.provenance !== "object" || Array.isArray(out.provenance)) {
    out.provenance = {};
  }
  if (!out.provenance.normalization ||
      typeof out.provenance.normalization !== "object" ||
      Array.isArray(out.provenance.normalization)) {
    out.provenance.normalization = {};
  }
  out.provenance.normalization.unicode = "NFC";
  out.provenance.normalization.line_endings = "LF";
  out.stage = "canonical";

  return out;
}

module.exports = {
  runStage
};
