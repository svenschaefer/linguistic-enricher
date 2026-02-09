"use strict";

const { deepClone } = require("../../util/deep-clone");
const errors = require("../../util/errors");

function normalizeSurface(text) {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const normalizedNewlines = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const normalizedLines = normalizedNewlines.split("\n").map(function normalizeLine(line) {
    const tabsAsSpaces = line.replace(/\t/g, " ");
    const noTrailingSpaces = tabsAsSpaces.replace(/ +$/g, "");
    const leadingMatch = /^ +/.exec(noTrailingSpaces);
    const leadingSpaces = leadingMatch ? leadingMatch[0] : "";
    const rest = noTrailingSpaces.slice(leadingSpaces.length).replace(/ {2,}/g, " ");
    return leadingSpaces + rest;
  });

  return normalizedLines.join("\n").normalize("NFC");
}

function hasExistingAnchors(seed) {
  const segments = Array.isArray(seed.segments) ? seed.segments : [];
  const tokens = Array.isArray(seed.tokens) ? seed.tokens : [];
  const annotations = Array.isArray(seed.annotations) ? seed.annotations : [];
  return segments.length > 0 || tokens.length > 0 || annotations.length > 0;
}

/**
 * Stage 00: surface normalization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  if (hasExistingAnchors(seed)) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 00 rejects partially enriched documents with existing anchors/spans.",
      {
        segments: Array.isArray(seed.segments) ? seed.segments.length : 0,
        tokens: Array.isArray(seed.tokens) ? seed.tokens.length : 0,
        annotations: Array.isArray(seed.annotations) ? seed.annotations.length : 0
      }
    );
  }

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
