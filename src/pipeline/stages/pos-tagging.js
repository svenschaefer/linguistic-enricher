"use strict";

const { deepClone } = require("../../util/deep-clone");
const posTagger = require("wink-pos-tagger");
const errors = require("../../util/errors");
const { createWikipediaTitleIndexClient } = require("../../services/wikipedia-title-index-client");

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

function mapQueryEvidence(response) {
  const rows = response && Array.isArray(response.rows)
    ? response.rows
    : response && Array.isArray(response.result)
      ? response.result
      : [];

  const rowTexts = rows
    .map(function toText(row) {
      if (typeof row === "string") {
        return row;
      }
      if (Array.isArray(row) && row.length > 0 && typeof row[0] === "string") {
        return row[0];
      }
      if (row && typeof row.t === "string") {
        return row.t;
      }
      return "";
    })
    .filter(Boolean);

  return {
    wiki_exact_match: rowTexts.length > 0,
    wiki_prefix_count: rowTexts.length,
    wiki_parenthetical_variant_count: rowTexts.filter(function (x) { return x.indexOf("(") !== -1; }).length,
    wiki_hyphen_space_variant_match: false,
    wiki_apostrophe_variant_match: false,
    wiki_singular_plural_variant_match: false,
    wiki_any_signal: rowTexts.length > 0
  };
}

function shouldEnrichToken(token) {
  if (!token || typeof token.surface !== "string" || token.surface.length === 0) {
    return false;
  }
  if (token.flags && token.flags.is_punct === true) {
    return false;
  }
  return /\p{L}/u.test(token.surface);
}

/**
 * Stage 04: part-of-speech tagging (observation).
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed, context) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const client = createWikipediaTitleIndexClient((context && context.options) || {});
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

    if (client.enabled && shouldEnrichToken(token)) {
      try {
        const response = await client.queryTitle(token.surface, 10);
        const evidence = mapQueryEvidence(response);
        if (evidence.wiki_any_signal) {
          token.lexicon = token.lexicon && typeof token.lexicon === "object" ? token.lexicon : {};
          token.lexicon.wikipedia_title_index = evidence;
        }
      } catch (error) {
        void error;
      }
    }
  }

  out.stage = "pos_tagged";
  return out;
}

module.exports = {
  runStage
};
