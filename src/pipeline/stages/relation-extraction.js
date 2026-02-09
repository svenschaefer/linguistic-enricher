"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");

/**
 * Stage 11: relation extraction.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];

  const chunkHeadAnnotations = annotations.filter(function (a) { return a.kind === "chunk_head"; });
  const relations = [];

  for (let i = 0; i < chunkHeadAnnotations.length - 1; i += 1) {
    const left = chunkHeadAnnotations[i];
    const right = chunkHeadAnnotations[i + 1];
    const leftId = left.head && left.head.id;
    const rightId = right.head && right.head.id;
    if (!leftId || !rightId) {
      continue;
    }

    relations.push({
      id: createDeterministicId("rel", { left: leftId, right: rightId, relation: "adjacent" }),
      kind: "dependency_surface",
      status: "accepted",
      relation: "adjacent",
      head_text: leftId,
      dep_text: rightId,
      anchor: {
        selectors: [
          {
            type: "TokenSelector",
            token_ids: [leftId, rightId]
          }
        ]
      },
      sources: [{ name: "relation-extraction", kind: "rule" }]
    });
  }

  out.annotations = annotations.concat(relations);
  out.stage = "relations_extracted";
  return out;
}

module.exports = {
  runStage
};
