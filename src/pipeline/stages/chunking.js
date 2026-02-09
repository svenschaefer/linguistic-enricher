"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");

function isChunkPos(posTag) {
  return posTag === "NOUN" || posTag === "ADJ" || posTag === "PROPN";
}

/**
 * Stage 09: POS-FSM style chunking.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const tag = token.pos && token.pos.tag;
    if (!isChunkPos(tag)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < tokens.length && isChunkPos(tokens[j].pos && tokens[j].pos.tag)) {
      j += 1;
    }

    const group = tokens.slice(i, j);
    const chunkId = createDeterministicId("chunk", {
      from: group[0].id,
      to: group[group.length - 1].id
    });

    annotations.push({
      id: chunkId,
      kind: "chunk",
      status: "accepted",
      chunk_type: "NP",
      label: group.map(function (t) { return t.surface; }).join(" "),
      anchor: {
        selectors: [
          {
            type: "TokenSelector",
            token_ids: group.map(function (t) { return t.id; })
          },
          {
            type: "TextPositionSelector",
            span: {
              start: group[0].span.start,
              end: group[group.length - 1].span.end
            }
          }
        ]
      },
      sources: [{ name: "pos-fsm", kind: "rule" }]
    });

    i = j;
  }

  out.annotations = annotations;
  out.stage = "chunked";
  return out;
}

module.exports = {
  runStage
};
