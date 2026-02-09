"use strict";

const { deepClone } = require("../../util/deep-clone");
const { normalizeSpan } = require("../../util/spans");
const errors = require("../../util/errors");

const LINE_SENTENCE_REGEX = /[^.!?]+[.!?]+|[^.!?]+$/g;

function hasExistingDownstreamAnchors(seed) {
  const tokens = Array.isArray(seed.tokens) ? seed.tokens : [];
  const annotations = Array.isArray(seed.annotations) ? seed.annotations : [];
  return tokens.length > 0 || annotations.length > 0;
}

function pushTrimmedChunk(chunks, rawChunk, absoluteStart) {
  if (typeof rawChunk !== "string" || rawChunk.length === 0) {
    return;
  }

  const leadingMatch = /^\s*/.exec(rawChunk);
  const trailingMatch = /\s*$/.exec(rawChunk);
  const leading = leadingMatch ? leadingMatch[0].length : 0;
  const trailing = trailingMatch ? trailingMatch[0].length : 0;
  const coreLength = rawChunk.length - leading - trailing;
  if (coreLength <= 0) {
    return;
  }

  const start = absoluteStart + leading;
  const end = start + coreLength;
  chunks.push({ start: start, end: end });
}

function splitSentences(text) {
  const lines = String(text || "").split("\n");
  const segments = [];
  let offset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    LINE_SENTENCE_REGEX.lastIndex = 0;
    let match = LINE_SENTENCE_REGEX.exec(line);
    while (match) {
      pushTrimmedChunk(segments, match[0], offset + match.index);
      match = LINE_SENTENCE_REGEX.exec(line);
    }

    if (lineIndex < lines.length - 1) {
      offset += line.length + 1;
    }
  }

  return segments;
}

/**
 * Stage 02: segmentation.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  if (hasExistingDownstreamAnchors(seed)) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 02 rejects partially enriched documents with existing token/annotation anchors.",
      {
        tokens: Array.isArray(seed.tokens) ? seed.tokens.length : 0,
        annotations: Array.isArray(seed.annotations) ? seed.annotations.length : 0
      }
    );
  }

  const out = deepClone(seed);
  const text = String(out.canonical_text || "");
  const split = splitSentences(text);
  if (split.length === 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 02 could not derive any sentence segments from canonical_text."
    );
  }

  out.segments = split.map(function mapSegment(segment, index) {
    return {
      id: "s" + (index + 1),
      index: index,
      kind: "sentence",
      span: normalizeSpan(segment.start, segment.end),
      token_range: { start: 0, end: 0 }
    };
  });
  out.stage = "segmented";

  return out;
}

module.exports = {
  runStage
};
