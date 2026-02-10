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
    if (isVerbLikeTag(getTag(tokens[i])) && String(tokens[i].surface || "").toLowerCase() !== "to") {
      return i;
    }
  }
  return 0;
}

function nearestIndex(tokens, from, step, predicate) {
  for (let i = from; i >= 0 && i < tokens.length; i += step) {
    if (predicate(tokens[i])) {
      return i;
    }
  }
  return -1;
}

function buildSentenceDependencies(sentenceTokens) {
  const rootIndex = detectRootIndex(sentenceTokens);
  const rootToken = sentenceTokens[rootIndex];
  const edges = [];

  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const token = sentenceTokens[i];
    const tag = getTag(token);
    const lower = String(token.surface || "").toLowerCase();
    const prev = i > 0 ? sentenceTokens[i - 1] : null;

    if (i === rootIndex) {
      edges.push({ depId: token.id, headId: null, label: "root", isRoot: true });
      continue;
    }

    if (isPunct(token)) {
      const headIndex = nearestIndex(sentenceTokens, i - 1, -1, function (t) { return !isPunct(t); });
      edges.push({
        depId: token.id,
        headId: headIndex >= 0 ? sentenceTokens[headIndex].id : rootToken.id,
        label: "punct",
        isRoot: false
      });
      continue;
    }

    if (tag === "MD") {
      const nextVerb = nearestIndex(sentenceTokens, i + 1, 1, function (t) { return isVerbLikeTag(getTag(t)); });
      edges.push({
        depId: token.id,
        headId: nextVerb >= 0 ? sentenceTokens[nextVerb].id : rootToken.id,
        label: "aux",
        isRoot: false
      });
      continue;
    }

    if (isDetLikeTag(tag)) {
      const nextNoun = nearestIndex(sentenceTokens, i + 1, 1, function (t) { return isNounLikeTag(getTag(t)); });
      edges.push({
        depId: token.id,
        headId: nextNoun >= 0 ? sentenceTokens[nextNoun].id : rootToken.id,
        label: "det",
        isRoot: false
      });
      continue;
    }

    if (isAdjLikeTag(tag)) {
      const nextNoun = nearestIndex(sentenceTokens, i + 1, 1, function (t) { return isNounLikeTag(getTag(t)); });
      const prevNoun = nearestIndex(sentenceTokens, i - 1, -1, function (t) { return isNounLikeTag(getTag(t)); });
      const headIndex = nextNoun >= 0 ? nextNoun : prevNoun;
      edges.push({
        depId: token.id,
        headId: headIndex >= 0 ? sentenceTokens[headIndex].id : rootToken.id,
        label: "amod",
        isRoot: false
      });
      continue;
    }

    if (isAdverbLikeTag(tag)) {
      const prevVerb = nearestIndex(sentenceTokens, i - 1, -1, function (t) { return isVerbLikeTag(getTag(t)); });
      edges.push({
        depId: token.id,
        headId: prevVerb >= 0 ? sentenceTokens[prevVerb].id : rootToken.id,
        label: "advmod",
        isRoot: false
      });
      continue;
    }

    if (isAdpLikeTag(tag)) {
      const prevContent = nearestIndex(sentenceTokens, i - 1, -1, function (t) {
        const tTag = getTag(t);
        return isVerbLikeTag(tTag) || isNounLikeTag(tTag);
      });
      edges.push({
        depId: token.id,
        headId: prevContent >= 0 ? sentenceTokens[prevContent].id : rootToken.id,
        label: "prep",
        isRoot: false
      });
      continue;
    }

    if (isVerbLikeTag(tag)) {
      if (prev && getTag(prev) === "TO") {
        const prevVerb = nearestIndex(sentenceTokens, i - 2, -1, function (t) { return isVerbLikeTag(getTag(t)); });
        edges.push({
          depId: token.id,
          headId: prevVerb >= 0 ? sentenceTokens[prevVerb].id : rootToken.id,
          label: "xcomp",
          isRoot: false
        });
        continue;
      }
      if (prev && String(prev.surface || "").toLowerCase() === "and") {
        const prevVerb = nearestIndex(sentenceTokens, i - 1, -1, function (t) { return isVerbLikeTag(getTag(t)); });
        edges.push({
          depId: token.id,
          headId: prevVerb >= 0 ? sentenceTokens[prevVerb].id : rootToken.id,
          label: "conj",
          isRoot: false
        });
        continue;
      }
      edges.push({
        depId: token.id,
        headId: rootToken.id,
        label: "dep",
        isRoot: false
      });
      continue;
    }

    if (isNounLikeTag(tag)) {
      if (prev && isAdpLikeTag(getTag(prev))) {
        edges.push({
          depId: token.id,
          headId: prev.id,
          label: "pobj",
          isRoot: false
        });
        continue;
      }
      if (prev && isNounLikeTag(getTag(prev))) {
        edges.push({
          depId: token.id,
          headId: prev.id,
          label: "compound",
          isRoot: false
        });
        continue;
      }
      edges.push({
        depId: token.id,
        headId: rootToken.id,
        label: i < rootIndex ? "nsubj" : "obj",
        isRoot: false
      });
      continue;
    }

    if (lower === "and" || lower === "or") {
      const prevVerb = nearestIndex(sentenceTokens, i - 1, -1, function (t) { return isVerbLikeTag(getTag(t)); });
      edges.push({
        depId: token.id,
        headId: prevVerb >= 0 ? sentenceTokens[prevVerb].id : rootToken.id,
        label: "cc",
        isRoot: false
      });
      continue;
    }

    edges.push({
      depId: token.id,
      headId: rootToken.id,
      label: "dep",
      isRoot: false
    });
  }

  return edges;
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

  const tokensBySentence = new Map();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!tokensBySentence.has(token.segment_id)) {
      tokensBySentence.set(token.segment_id, []);
    }
    tokensBySentence.get(token.segment_id).push(token);
  }
  for (const list of tokensBySentence.values()) {
    list.sort(function (a, b) { return a.i - b.i; });
  }

  for (const sentenceTokens of tokensBySentence.values()) {
    const edges = buildSentenceDependencies(sentenceTokens);
    for (let i = 0; i < edges.length; i += 1) {
      const edge = edges[i];
      const token = sentenceTokens.find(function (t) { return t.id === edge.depId; });
      const id = createDeterministicId("dep", { token: edge.depId, head: edge.headId, root: edge.isRoot });
      const selector = {
        type: "TokenSelector",
        token_ids: [edge.depId]
      };
      const textPos = { type: "TextPositionSelector", span: token.span };
      const textQuote = { type: "TextQuoteSelector", exact: spanTextFromCanonical(out.canonical_text, token.span, unit) };
      const dependencyAnnotation = {
        id: id,
        kind: "dependency",
        status: "observation",
        label: edge.label,
        is_root: edge.isRoot,
        dep: { id: edge.depId },
        anchor: { selectors: [textQuote, textPos, selector] },
        sources: annotationSource()
      };

      if (!edge.isRoot && edge.headId) {
        dependencyAnnotation.head = { id: edge.headId };
      }

      annotations.push(dependencyAnnotation);
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (!isPunct(token) && /\p{L}/u.test(token.surface)) {
      const selector = {
        type: "TokenSelector",
        token_ids: [token.id]
      };
      const textPos = { type: "TextPositionSelector", span: token.span };
      const textQuote = {
        type: "TextQuoteSelector",
        exact: spanTextFromCanonical(out.canonical_text, token.span, unit)
      };
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
