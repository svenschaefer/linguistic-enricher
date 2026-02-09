"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");

/**
 * Stage 08: linguistic analysis (dependency observation).
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const id = createDeterministicId("dep", { token: token.id, head: i === 0 ? null : tokens[i - 1].id });
    const selector = {
      type: "TokenSelector",
      token_ids: [token.id]
    };
    const dependencyAnnotation = {
      id: id,
      kind: "dependency",
      status: "observation",
      label: i === 0 ? "root" : "dep",
      is_root: i === 0,
      dep: { id: token.id },
      anchor: { selectors: [selector] },
      sources: [{ name: "linguistic-analysis", kind: "model" }]
    };

    if (i !== 0) {
      dependencyAnnotation.head = { id: tokens[i - 1].id };
    }

    annotations.push(dependencyAnnotation);
  }

  out.annotations = annotations;
  out.stage = "parsed";
  return out;
}

module.exports = {
  runStage
};
