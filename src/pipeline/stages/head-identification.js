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

function isNoun(tag) {
  return tag === "NN" || tag === "NNS" || tag === "NNP" || tag === "NNPS";
}

function isVerb(tag) {
  return /^(VB|VBD|VBG|VBN|VBP|VBZ|MD)$/.test(String(tag || ""));
}

function isPrep(tag) {
  return tag === "IN" || tag === "TO";
}

function isDemotedVerbish(token) {
  const tag = getTag(token);
  const surface = String(token && token.surface ? token.surface : "").toLowerCase();
  if (["be", "am", "is", "are", "was", "were", "been", "being", "do", "does", "did", "have", "has", "had"].indexOf(surface) !== -1) {
    return true;
  }
  if (tag === "MD") {
    return true;
  }
  if (tag === "VBG" && ["using", "doing", "being", "having"].indexOf(surface) !== -1) {
    return true;
  }
  if (tag === "VBN" && ["used", "assigned", "recorded", "submitted", "accepted", "authenticated", "present", "considered"].indexOf(surface) !== -1) {
    return true;
  }
  return false;
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
    "Stage 10 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function getSelector(annotation, type) {
  if (!annotation || !annotation.anchor || !Array.isArray(annotation.anchor.selectors)) {
    return null;
  }
  return annotation.anchor.selectors.find(function (s) { return s && s.type === type; }) || null;
}

function dependencyMap(annotations) {
  const map = new Map();
  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (!annotation || annotation.kind !== "dependency" || !annotation.dep || typeof annotation.dep.id !== "string") {
      continue;
    }
    if (!map.has(annotation.dep.id)) {
      map.set(annotation.dep.id, {
        isRoot: annotation.is_root === true,
        headId: annotation.head && typeof annotation.head.id === "string" ? annotation.head.id : null
      });
    }
  }
  return map;
}

function chooseByPosition(tokens, rightmost) {
  const sorted = tokens.slice().sort(function (a, b) {
    if (a.i !== b.i) {
      return rightmost ? b.i - a.i : a.i - b.i;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  return sorted[0];
}

function chooseDependencyRoot(tokens, depMap, candidateIds, allowAny) {
  const inChunk = new Set(tokens.map(function (t) { return t.id; }));
  const roots = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const dep = depMap.get(token.id);
    if (!dep || (!dep.isRoot && !dep.headId)) {
      return null;
    }
    if (dep.isRoot || !inChunk.has(dep.headId)) {
      roots.push(token);
    }
  }
  if (roots.length !== 1) {
    return null;
  }
  if (!allowAny && !candidateIds.has(roots[0].id)) {
    return null;
  }
  return roots[0];
}

function selectHeadToken(chunkType, tokens, depMap) {
  let candidates;
  if (chunkType === "NP") {
    candidates = tokens.filter(function (t) { return isNoun(getTag(t)); });
  } else if (chunkType === "VP") {
    const verbTokens = tokens.filter(function (t) { return isVerb(getTag(t)); });
    const lexicalVerbTokens = verbTokens.filter(function (t) { return getTag(t) !== "MD"; });
    candidates = lexicalVerbTokens.length > 0 ? lexicalVerbTokens : verbTokens;
  } else if (chunkType === "PP") {
    candidates = tokens.filter(function (t) { return isPrep(getTag(t)); });
  } else {
    candidates = tokens.slice();
  }

  let allowAny = false;
  if (candidates.length === 0) {
    candidates = tokens.slice();
    allowAny = true;
  }

  const depChoice = chooseDependencyRoot(
    tokens,
    depMap,
    new Set(candidates.map(function (t) { return t.id; })),
    allowAny
  );
  if (depChoice) {
    return depChoice;
  }
  return chunkType === "NP" ? chooseByPosition(candidates, true) : chooseByPosition(candidates, false);
}

function maybeApplyVpLexicalOverride(chunkType, selectedHead, tokens) {
  if (chunkType !== "VP") {
    return { head: selectedHead, fired: false };
  }
  if (!isVerb(getTag(selectedHead)) || !isDemotedVerbish(selectedHead)) {
    return { head: selectedHead, fired: false };
  }
  const lexicalCandidates = tokens.filter(function (t) { return isVerb(getTag(t)) && !isDemotedVerbish(t); });
  if (lexicalCandidates.length === 0) {
    return { head: selectedHead, fired: false };
  }
  return { head: chooseByPosition(lexicalCandidates, false), fired: true };
}

/**
 * Stage 10: chunk head identification.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const tokenById = new Map((Array.isArray(out.tokens) ? out.tokens : []).map(function (t) { return [t.id, t]; }));
  const depMap = dependencyMap(annotations);
  const unit = out.index_basis && out.index_basis.unit ? out.index_basis.unit : "utf16_code_units";

  for (let i = 0; i < annotations.length; i += 1) {
    if (annotations[i] && annotations[i].kind === "chunk_head") {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 10 rejects partially head-identified documents with existing chunk_head annotations."
      );
    }
  }

  const chunkHeads = [];
  for (let i = 0; i < annotations.length; i += 1) {
    const ann = annotations[i];
    if (ann.kind !== "chunk" || ann.status !== "accepted") {
      continue;
    }

    const tokenSelector = getSelector(ann, "TokenSelector");

    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 10 chunk missing TokenSelector token ids.",
        { chunk_id: ann.id || null }
      );
    }

    const chunkTokens = tokenSelector.token_ids.map(function (id) { return tokenById.get(id); }).filter(Boolean);
    if (chunkTokens.length !== tokenSelector.token_ids.length) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 10 chunk references unknown token id.",
        { chunk_id: ann.id || null }
      );
    }
    chunkTokens.sort(function (a, b) { return a.i - b.i; });

    const selected = selectHeadToken(ann.chunk_type || "O", chunkTokens, depMap);
    const maybeOverridden = maybeApplyVpLexicalOverride(ann.chunk_type || "O", selected, chunkTokens);
    const headTokenId = maybeOverridden.head.id;
    const headSpan = maybeOverridden.head.span;
    const headLabel = spanTextFromCanonical(out.canonical_text, headSpan, unit);
    const chunkTextPos = getSelector(ann, "TextPositionSelector");
    const chunkSurface = chunkTextPos && chunkTextPos.span
      ? spanTextFromCanonical(out.canonical_text, chunkTextPos.span, unit)
      : null;

    const newAnnotation = {
      id: createDeterministicId("chunk-head", { chunk: ann.id, head: headTokenId, override: maybeOverridden.fired }),
      kind: "chunk_head",
      status: "accepted",
      chunk_id: ann.id,
      head: { id: headTokenId },
      label: headLabel,
      anchor: {
        selectors: [
          {
            type: "TextQuoteSelector",
            exact: headLabel
          },
          {
            type: "TextPositionSelector",
            span: {
              start: headSpan.start,
              end: headSpan.end
            }
          },
          {
            type: "TokenSelector",
            token_ids: [headTokenId]
          }
        ]
      },
      sources: [{ name: "head-identification", kind: "rule" }]
    };

    if (chunkSurface) {
      newAnnotation.surface = chunkSurface;
    }
    if (maybeOverridden.fired) {
      newAnnotation.notes = "vp_lexical_head_override=true";
    }

    chunkHeads.push(newAnnotation);
  }

  out.annotations = annotations.concat(chunkHeads);
  out.stage = "heads_identified";
  return out;
}

module.exports = {
  runStage
};
