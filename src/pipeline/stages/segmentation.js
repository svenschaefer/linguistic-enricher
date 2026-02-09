"use strict";

const { deepClone } = require("../../util/deep-clone");
const { normalizeSpan } = require("../../util/spans");

function splitSentences(text) {
  const regex = /[^.!?\n]+(?:[.!?]+|$)/g;
  const segments = [];
  let match = regex.exec(text);

  while (match) {
    const chunk = match[0].trim();
    if (chunk) {
      const leadingOffset = match[0].indexOf(chunk);
      const start = match.index + leadingOffset;
      const end = start + chunk.length;
      segments.push({ text: chunk, start: start, end: end });
    }
    match = regex.exec(text);
  }

  if (segments.length === 0 && text.length > 0) {
    segments.push({ text: text, start: 0, end: text.length });
  }

  return segments;
}

/**
 * Stage 02: segmentation.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const text = String(out.canonical_text || "");
  const split = splitSentences(text);

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
