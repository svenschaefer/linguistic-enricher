"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");
const { createWikipediaTitleIndexClient } = require("../../services/wikipedia-title-index-client");

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of"]);

function isLexicalToken(token) {
  const value = String(token || "");
  return /\p{L}/u.test(value) && !STOPWORDS.has(value.toLowerCase());
}

function buildCandidates(tokens) {
  const candidates = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const left = tokens[i];
    const right = tokens[i + 1];
    if (!isLexicalToken(left.surface) || !isLexicalToken(right.surface)) {
      continue;
    }

    candidates.push({
      tokenIds: [left.id, right.id],
      label: left.surface + " " + right.surface
    });
  }
  return candidates;
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

/**
 * Stage 05: mwe candidate extraction.
 * @param {object} seed Seed document.
 * @param {object} context Stage context/options.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed, context) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const candidates = buildCandidates(tokens);
  const existing = Array.isArray(out.annotations) ? out.annotations : [];
  const client = createWikipediaTitleIndexClient((context && context.options) || {});

  const annotations = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    let evidence = {
      wiki_exact_match: false,
      wiki_prefix_count: 0,
      wiki_parenthetical_variant_count: 0,
      wiki_hyphen_space_variant_match: false,
      wiki_apostrophe_variant_match: false,
      wiki_singular_plural_variant_match: false,
      wiki_any_signal: false
    };

    if (client.enabled) {
      try {
        const response = await client.queryTitle(candidate.label, 10);
        evidence = mapQueryEvidence(response);
      } catch (error) {
        void error;
      }
    }

    annotations.push({
      id: createDeterministicId("mwe", { tokens: candidate.tokenIds, label: candidate.label }),
      kind: "mwe",
      status: "candidate",
      label: candidate.label,
      anchor: {
        selectors: [
          {
            type: "TokenSelector",
            token_ids: candidate.tokenIds
          }
        ]
      },
      sources: [
        { name: "adjacency-bigram", kind: "pattern" },
        { name: "wikipedia-title-index", kind: "lexicon", evidence: evidence }
      ]
    });
  }

  out.annotations = existing.concat(annotations);
  out.stage = "mwe_candidates";
  return out;
}

module.exports = {
  runStage
};
