"use strict";

const { deepClone } = require("../../util/deep-clone");

const DETERMINERS = new Set(["the", "a", "an", "this", "that", "these", "those"]);
const CONJ = new Set(["and", "or", "but", "nor"]);
const ADP = new Set(["in", "on", "at", "to", "for", "from", "with", "by", "of"]);
const PRON = new Set(["i", "you", "he", "she", "it", "we", "they"]);

function guessPos(surface) {
  const token = String(surface || "");
  const lower = token.toLowerCase();

  if (/^\p{P}+$/u.test(token)) {
    return { tag: "PUNCT", coarse: "PUNCT" };
  }
  if (/^\p{N}+$/u.test(token)) {
    return { tag: "NUM", coarse: "NUM" };
  }
  if (DETERMINERS.has(lower)) {
    return { tag: "DET", coarse: "DET" };
  }
  if (CONJ.has(lower)) {
    return { tag: "CCONJ", coarse: "CONJ" };
  }
  if (ADP.has(lower)) {
    return { tag: "ADP", coarse: "ADP" };
  }
  if (PRON.has(lower)) {
    return { tag: "PRON", coarse: "PRON" };
  }
  if (/[a-z]+ing$/i.test(lower)) {
    return { tag: "VERB", coarse: "VERB" };
  }
  if (/^[A-Z]/.test(token)) {
    return { tag: "PROPN", coarse: "NOUN" };
  }

  return { tag: "NOUN", coarse: "NOUN" };
}

/**
 * Stage 04: part-of-speech tagging (observation).
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    token.pos = guessPos(token.surface);
  }

  out.stage = "pos_tagged";
  return out;
}

module.exports = {
  runStage
};
