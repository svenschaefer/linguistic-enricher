"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");
const errors = require("../../util/errors");

function getTag(token) {
  if (!token || !token.pos) {
    return "";
  }
  if (typeof token.pos.tag === "string" && token.pos.tag.length > 0) {
    return token.pos.tag;
  }
  if (typeof token.pos.coarse === "string" && token.pos.coarse.length > 0) {
    return token.pos.coarse;
  }
  return "";
}

function isPunct(token) {
  if (token && token.flags && token.flags.is_punct === true) {
    return true;
  }
  return /^\p{P}+$/u.test(String(token && token.surface ? token.surface : ""));
}

function isNounLikeTag(tag) {
  return tag === "NN" || tag === "NNS" || tag === "NNP" || tag === "NNPS";
}

function isAdjLikeTag(tag) {
  return tag === "JJ" || tag === "JJR" || tag === "JJS";
}

function isVerbLikeTag(tag) {
  return /^VB/.test(tag);
}

function isDetLikeTag(tag) {
  return tag === "DT" || tag === "PDT" || tag === "WDT";
}

function isAdpLikeTag(tag) {
  return tag === "IN" || tag === "TO";
}

function isAdverbLikeTag(tag) {
  return /^RB/.test(tag);
}

function detectRootIndex(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    if (isVerbLikeTag(getTag(tokens[i]))) {
      return i;
    }
  }
  return 0;
}

function deriveDepLabel(token, prevToken) {
  const tag = getTag(token);
  const prevTag = getTag(prevToken);
  if (isPunct(token)) {
    return "punct";
  }
  if (isDetLikeTag(tag)) {
    return "det";
  }
  if (isAdjLikeTag(tag)) {
    return "amod";
  }
  if (isAdpLikeTag(tag)) {
    return "prep";
  }
  if (isAdverbLikeTag(tag)) {
    return "advmod";
  }
  if (isNounLikeTag(tag) && isAdpLikeTag(prevTag)) {
    return "pobj";
  }
  if (isNounLikeTag(tag) && isVerbLikeTag(prevTag)) {
    return "obj";
  }
  if (isNounLikeTag(tag)) {
    return "nmod";
  }
  return "dep";
}

function spanTextFromCanonical(canonicalText, span, unit) {
  const text = String(canonicalText || "");
  if (unit === "utf16_code_units") {
    return text.slice(span.start, span.end);
  }
  if (unit === "unicode_codepoints") {
    return Array.from(text).slice(span.start, span.end).join("");
  }
  if (unit === "bytes_utf8") {
    return Buffer.from(text, "utf8").slice(span.start, span.end).toString("utf8");
  }
  throw errors.createError(
    errors.ERROR_CODES.E_INVARIANT_VIOLATION,
    "Stage 08 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function annotationSource() {
  return [
    {
      name: "linguistic-analysis",
      kind: "model",
      evidence: {
        framework: "heuristic"
      }
    }
  ];
}

/**
 * Stage 08: linguistic analysis (dependency observation).
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const unit = out.index_basis && out.index_basis.unit ? out.index_basis.unit : "utf16_code_units";

  if (tokens.length === 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 08 requires non-empty token stream."
    );
  }

  for (let i = 0; i < annotations.length; i += 1) {
    const ann = annotations[i];
    if (ann && (ann.kind === "dependency" || ann.kind === "lemma" || ann.kind === "named_entity" || ann.kind === "noun_phrase")) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 08 rejects partially parsed documents with existing linguistic observations.",
        { annotation_kind: ann.kind }
      );
    }
  }

  const rootIndex = detectRootIndex(tokens);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const isRoot = i === rootIndex;
    let headTokenId = null;
    if (!isRoot) {
      if (i > 0) {
        headTokenId = tokens[i - 1].id;
      } else {
        headTokenId = tokens[rootIndex].id;
      }
    }
    const id = createDeterministicId("dep", { token: token.id, head: headTokenId, root: isRoot });
    const selector = {
      type: "TokenSelector",
      token_ids: [token.id]
    };
    const textPos = { type: "TextPositionSelector", span: token.span };
    const textQuote = { type: "TextQuoteSelector", exact: spanTextFromCanonical(out.canonical_text, token.span, unit) };
    const dependencyAnnotation = {
      id: id,
      kind: "dependency",
      status: "observation",
      label: isRoot ? "root" : deriveDepLabel(token, tokens[i - 1] || null),
      is_root: isRoot,
      dep: { id: token.id },
      anchor: { selectors: [textQuote, textPos, selector] },
      sources: annotationSource()
    };

    if (!isRoot) {
      dependencyAnnotation.head = { id: headTokenId };
    }

    annotations.push(dependencyAnnotation);

    if (!isPunct(token) && /\p{L}/u.test(token.surface)) {
      annotations.push({
        id: createDeterministicId("lemma", { token: token.id }),
        kind: "lemma",
        status: "observation",
        lemma: String(token.surface).toLowerCase(),
        anchor: { selectors: [textQuote, textPos, selector] },
        sources: annotationSource()
      });
    }
  }

  for (let i = 0; i < tokens.length; ) {
    const tag = getTag(tokens[i]);
    if (!isNounLikeTag(tag) && !isAdjLikeTag(tag) && !isDetLikeTag(tag)) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < tokens.length) {
      const t = getTag(tokens[j]);
      if (!isNounLikeTag(t) && !isAdjLikeTag(t) && !isDetLikeTag(t)) {
        break;
      }
      j += 1;
    }
    const group = tokens.slice(i, j);
    const hasNoun = group.some(function (t) { return isNounLikeTag(getTag(t)); });
    if (group.length >= 2 && hasNoun) {
      const span = { start: group[0].span.start, end: group[group.length - 1].span.end };
      const exact = spanTextFromCanonical(out.canonical_text, span, unit);
      annotations.push({
        id: createDeterministicId("np", { from: group[0].id, to: group[group.length - 1].id }),
        kind: "noun_phrase",
        status: "observation",
        anchor: {
          selectors: [
            { type: "TextQuoteSelector", exact: exact },
            { type: "TextPositionSelector", span: span },
            { type: "TokenSelector", token_ids: group.map(function (t) { return t.id; }) }
          ]
        },
        sources: annotationSource()
      });
    }
    i = j;
  }

  for (let i = 0; i < tokens.length; ) {
    const tag = getTag(tokens[i]);
    if (tag !== "NNP" && tag !== "NNPS") {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < tokens.length) {
      const nextTag = getTag(tokens[j]);
      if (nextTag !== "NNP" && nextTag !== "NNPS") {
        break;
      }
      j += 1;
    }
    const group = tokens.slice(i, j);
    if (group.length >= 1) {
      const span = { start: group[0].span.start, end: group[group.length - 1].span.end };
      const exact = spanTextFromCanonical(out.canonical_text, span, unit);
      annotations.push({
        id: createDeterministicId("ne", { from: group[0].id, to: group[group.length - 1].id, label: "PROPN" }),
        kind: "named_entity",
        status: "observation",
        label: "PROPN",
        anchor: {
          selectors: [
            { type: "TextQuoteSelector", exact: exact },
            { type: "TextPositionSelector", span: span },
            { type: "TokenSelector", token_ids: group.map(function (t) { return t.id; }) }
          ]
        },
        sources: annotationSource()
      });
    }
    i = j;
  }

  out.annotations = annotations;
  out.stage = "parsed";
  return out;
}

module.exports = {
  runStage
};
