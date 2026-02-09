"use strict";

const { deepClone } = require("../../util/deep-clone");
const posTagger = require("wink-pos-tagger");
const errors = require("../../util/errors");

const TAGGER = posTagger();
const POSSESSIVE_SUFFIX_MARKERS = new Set(["'s", "’s", "ʼs", "＇s"]);
const POSSESSIVE_TERMINAL_MARKERS = new Set(["'", "’", "ʼ", "＇"]);
const POSSESSIVE_ALLOWED_PREV = new Set(["NN", "NNS", "NNP", "NNPS"]);
const POSSESSIVE_ALLOWED_NEXT = new Set(["NN", "NNS", "NNP", "NNPS", "JJ", "JJR", "JJS", "DT"]);

function toCoarsePennTag(tag) {
  if (tag === "NN" || tag === "NNS" || tag === "NNP" || tag === "NNPS") {
    return "NOUN";
  }
  if (tag === "JJ" || tag === "JJR" || tag === "JJS") {
    return "ADJ";
  }
  if (
    tag === "VB" || tag === "VBD" || tag === "VBG" || tag === "VBN" || tag === "VBP" || tag === "VBZ" ||
    tag === "MD"
  ) {
    return "VERB";
  }
  if (tag === "IN" || tag === "TO") {
    return "ADP";
  }
  if (tag === "RB" || tag === "RBR" || tag === "RBS") {
    return "ADV";
  }
  if (tag === "PRP" || tag === "PRP$" || tag === "WP" || tag === "WP$") {
    return "PRON";
  }
  if (tag === "DT" || tag === "PDT" || tag === "WDT") {
    return "DET";
  }
  if (tag === "CC") {
    return "CONJ";
  }
  if (tag === "CD") {
    return "NUM";
  }
  if (tag === "POS") {
    return "PART";
  }
  if (/^[,.:$#]|``|''$/.test(tag)) {
    return "PUNCT";
  }
  return "X";
}

function applyPossessiveOverride(tokens, tagged, index) {
  const surface = tokens[index] && tokens[index].surface ? tokens[index].surface : "";
  const pos = tagged[index] && tagged[index].pos ? tagged[index].pos : null;
  if (!pos) {
    return null;
  }

  if (!POSSESSIVE_SUFFIX_MARKERS.has(surface) && !POSSESSIVE_TERMINAL_MARKERS.has(surface)) {
    return pos;
  }

  const prevPos = index > 0 && tagged[index - 1] ? tagged[index - 1].pos : null;
  const nextPos = index + 1 < tagged.length && tagged[index + 1] ? tagged[index + 1].pos : null;
  const isPossessiveContext =
    POSSESSIVE_ALLOWED_PREV.has(prevPos) && POSSESSIVE_ALLOWED_NEXT.has(nextPos);

  if (isPossessiveContext) {
    return "POS";
  }
  if (pos === "POS") {
    return "VBZ";
  }
  return pos;
}

/**
 * Stage 04: part-of-speech tagging (observation).
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  if (tokens.length === 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 04 requires non-empty token stream."
    );
  }
  if (annotations.length > 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 04 rejects partially enriched documents with existing annotations.",
      { annotations: annotations.length }
    );
  }

  const tagged = TAGGER.tagRawTokens(tokens.map(function (t) { return t.surface; }));
  if (!Array.isArray(tagged) || tagged.length !== tokens.length) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 04 POS tagger output mismatch.",
      { expected: tokens.length, actual: Array.isArray(tagged) ? tagged.length : -1 }
    );
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const finalTag = applyPossessiveOverride(tokens, tagged, i);
    if (!finalTag || typeof finalTag !== "string") {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 04 produced invalid POS tag.",
        { token_id: token.id, index: i }
      );
    }
    token.pos = {
      tag: finalTag,
      coarse: toCoarsePennTag(finalTag)
    };
  }

  out.stage = "pos_tagged";
  return out;
}

module.exports = {
  runStage
};
