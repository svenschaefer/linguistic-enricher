"use strict";

const { deepClone } = require("../../util/deep-clone");
const { normalizeSpan } = require("../../util/spans");

const TOKEN_REGEX = /\p{L}[\p{L}\p{N}'-]*|\p{N}+|[^\s]/gu;

function tokenizeSegment(text, baseStart) {
  const tokens = [];
  let match = TOKEN_REGEX.exec(text);

  while (match) {
    const start = baseStart + match.index;
    const end = start + match[0].length;
    tokens.push({
      surface: match[0],
      span: normalizeSpan(start, end)
    });
    match = TOKEN_REGEX.exec(text);
  }

  return tokens;
}

/**
 * Stage 03: tokenization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const text = String(out.canonical_text || "");
  const segments = Array.isArray(out.segments) ? out.segments : [];
  const tokens = [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const segText = text.slice(segment.span.start, segment.span.end);
    const segTokens = tokenizeSegment(segText, segment.span.start);
    const startIndex = tokens.length;

    for (let j = 0; j < segTokens.length; j += 1) {
      const token = segTokens[j];
      tokens.push({
        id: "t" + (tokens.length + 1),
        i: tokens.length,
        segment_id: segment.id,
        span: token.span,
        surface: token.surface,
        normalized: token.surface.toLowerCase()
      });
    }

    segment.token_range = {
      start: startIndex,
      end: tokens.length
    };
  }

  out.tokens = tokens;
  out.stage = "tokenized";

  return out;
}

module.exports = {
  runStage
};
