"use strict";

const { deepClone } = require("../../util/deep-clone");

/**
 * Stage 07: mwe materialization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const tokenById = new Map((Array.isArray(out.tokens) ? out.tokens : []).map(function (t) { return [t.id, t]; }));

  for (let i = 0; i < annotations.length; i += 1) {
    const ann = annotations[i];
    if (ann.kind !== "mwe") {
      continue;
    }

    const tokenSelector = ann.anchor && Array.isArray(ann.anchor.selectors)
      ? ann.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; })
      : null;

    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) {
      continue;
    }

    const tokens = tokenSelector.token_ids.map(function (id) { return tokenById.get(id); }).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }

    const start = tokens[0].span.start;
    const end = tokens[tokens.length - 1].span.end;
    ann.status = "accepted";

    if (!ann.anchor.selectors.some(function (s) { return s.type === "TextPositionSelector"; })) {
      ann.anchor.selectors.push({
        type: "TextPositionSelector",
        span: { start: start, end: end }
      });
    }
  }

  out.annotations = annotations;
  out.stage = "mwe_materialized";
  return out;
}

module.exports = {
  runStage
};
