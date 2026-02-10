"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");
const { createWikipediaTitleIndexClient } = require("../../services/wikipedia-title-index-client");

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

function upsertWikipediaLexiconSource(sources, evidence) {
  const list = Array.isArray(sources) ? sources : [];
  const next = list.slice();
  const idx = next.findIndex(function (s) {
    return s && s.name === "wikipedia-title-index" && s.kind === "lexicon";
  });

  const payload = {
    name: "wikipedia-title-index",
    kind: "lexicon",
    evidence: evidence
  };

  if (idx >= 0) {
    next[idx] = payload;
  } else {
    next.push(payload);
  }
  return next;
}

/**
 * Stage 06: deterministic mwe candidate construction.
 * @param {object} seed Seed document.
 * @param {object} context Stage context/options.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed, context) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const client = createWikipediaTitleIndexClient((context && context.options) || {});

  const seen = new Set();
  for (let i = 0; i < annotations.length; i += 1) {
    const ann = annotations[i];
    if (ann.kind !== "mwe") {
      continue;
    }

    const tokenSelector = ann.anchor && Array.isArray(ann.anchor.selectors)
      ? ann.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; })
      : null;

    if (!tokenSelector) {
      continue;
    }

    const key = tokenSelector.token_ids.join("|");
    if (seen.has(key)) {
      ann.status = "observation";
      continue;
    }
    seen.add(key);

    ann.id = createDeterministicId("mwe", { key: key, label: ann.label || "" });
    ann.sources = ann.sources || [];
    if (!ann.sources.some(function (s) { return s && s.name === "candidate-construction"; })) {
      ann.sources.push({ name: "candidate-construction", kind: "rule" });
    }

    if (client.enabled && typeof ann.label === "string" && ann.label.trim().length > 0) {
      try {
        const response = await client.queryTitle(ann.label, 100);
        const evidence = mapQueryEvidence(response);
        ann.sources = upsertWikipediaLexiconSource(ann.sources, evidence);
      } catch (error) {
        void error;
      }
    }
  }

  out.annotations = annotations;
  out.stage = "mwe_pattern_candidates";
  return out;
}

module.exports = {
  runStage
};
