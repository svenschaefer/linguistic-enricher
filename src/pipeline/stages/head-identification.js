"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");

/**
 * Stage 10: chunk head identification.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];

  const chunkHeads = [];
  for (let i = 0; i < annotations.length; i += 1) {
    const ann = annotations[i];
    if (ann.kind !== "chunk") {
      continue;
    }

    const tokenSelector = ann.anchor && Array.isArray(ann.anchor.selectors)
      ? ann.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; })
      : null;

    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) {
      continue;
    }

    const headTokenId = tokenSelector.token_ids[tokenSelector.token_ids.length - 1];
    chunkHeads.push({
      id: createDeterministicId("chunk-head", { chunk: ann.id, head: headTokenId }),
      kind: "chunk_head",
      status: "accepted",
      chunk_id: ann.id,
      head: { id: headTokenId },
      anchor: {
        selectors: [
          {
            type: "TokenSelector",
            token_ids: [headTokenId]
          }
        ]
      },
      sources: [{ name: "head-identification", kind: "rule" }]
    });
  }

  out.annotations = annotations.concat(chunkHeads);
  out.stage = "heads_identified";
  return out;
}

module.exports = {
  runStage
};
