"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");

/**
 * Stage 06: deterministic mwe candidate construction.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];

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
    ann.sources.push({ name: "candidate-construction", kind: "rule" });
  }

  out.annotations = annotations;
  out.stage = "mwe_pattern_candidates";
  return out;
}

module.exports = {
  runStage
};
