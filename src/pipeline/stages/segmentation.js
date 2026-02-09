"use strict";

const { deepClone } = require("../../util/deep-clone");
const { normalizeSpan } = require("../../util/spans");
const errors = require("../../util/errors");

const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "u.s."
]);

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

function isLowerAsciiLetter(ch) {
  return typeof ch === "string" && /^[a-z]$/.test(ch);
}

function isSentenceBoundary(text, i) {
  const ch = text[i];
  if (ch === "\n") {
    return true;
  }
  if (ch !== "." && ch !== "!" && ch !== "?") {
    return false;
  }

  if (ch === ".") {
    if (/[A-Za-z]/.test(text[i + 1] || "") && text[i + 2] === ".") {
      return false;
    }

    const before = text.slice(0, i + 1);
    const tokenMatch = /([A-Za-z]+(?:\.[A-Za-z]+)*\.)$/.exec(before);
    if (tokenMatch && ABBREVIATIONS.has(tokenMatch[1].toLowerCase())) {
      return false;
    }

    let j = i + 1;
    while (j < text.length && text[j] === " ") {
      j += 1;
    }
    if (j < text.length && isLowerAsciiLetter(text[j])) {
      return false;
    }
  }

  return true;
}

function splitSentences(text) {
  const src = String(text || "");
  const segments = [];
  let start = 0;

  for (let i = 0; i < src.length; i += 1) {
    if (!isSentenceBoundary(src, i)) {
      continue;
    }

    const end = i + 1;
    pushTrimmedChunk(segments, src.slice(start, end), start);
    start = end;
  }

  if (start < src.length) {
    pushTrimmedChunk(segments, src.slice(start), start);
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
