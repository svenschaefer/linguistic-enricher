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

function lowerSurface(token) {
  return String(token && token.surface ? token.surface : "").toLowerCase();
}

function isNpLikePos(tag) {
  return ["DT", "JJ", "JJR", "JJS", "VBN", "VBG", "NN", "NNS", "NNP", "NNPS", "PRP"].indexOf(String(tag || "")) !== -1;
}

function isDemotedVerbish(token) {
  const tag = getTag(token);
  const surface = lowerSurface(token);
  if (["be", "am", "is", "are", "was", "were", "been", "being", "do", "does", "did", "have", "has", "had"].indexOf(surface) !== -1) {
    return true;
  }
  if (tag === "MD") {
    return true;
  }
  if (tag === "VBG" && ["using", "doing", "being", "having"].indexOf(surface) !== -1) {
    return true;
  }
  if (tag === "VBN" && ["assigned", "recorded", "submitted", "accepted", "authenticated", "present"].indexOf(surface) !== -1) {
    return true;
  }
  return false;
}

function isVpParticipleDemotedByContext(token, tokens) {
  if (getTag(token) !== "VBN") {
    return false;
  }
  const idx = tokens.findIndex(function (t) { return t.id === token.id; });
  if (idx === -1) {
    return false;
  }
  const prev = idx > 0 ? tokens[idx - 1] : null;
  const next = idx + 1 < tokens.length ? tokens[idx + 1] : null;
  const nextNpLike = Boolean(next) && isNpLikePos(getTag(next));

  // Rule A: "given" immediately followed by NP-like run.
  if (lowerSurface(token) === "given" && nextNpLike) {
    return true;
  }
  // Rule B: DT + VBN + NP-like immediate context.
  if (prev && getTag(prev) === "DT" && nextNpLike) {
    return true;
  }
  return false;
}

function isVpDemotedToken(token, tokens) {
  return isDemotedVerbish(token) || isVpParticipleDemotedByContext(token, tokens);
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

function inChunkIdSet(tokens) {
  return new Set(tokens.map(function (t) { return t.id; }));
}

function buildIncidentDegreeMap(tokens, inChunkSet, annotations) {
  const degreeMap = new Map(tokens.map(function (t) { return [t.id, 0]; }));
  const deps = Array.isArray(annotations) ? annotations : [];

  for (let i = 0; i < deps.length; i += 1) {
    const ann = deps[i];
    if (!ann || ann.kind !== "dependency" || !ann.dep || typeof ann.dep.id !== "string") {
      continue;
    }
    const depId = ann.dep.id;
    const headId = ann.head && typeof ann.head.id === "string" ? ann.head.id : null;
    const depInChunk = inChunkSet.has(depId);
    const headInChunk = headId ? inChunkSet.has(headId) : false;

    if (depInChunk && (ann.is_root === true || headInChunk)) {
      degreeMap.set(depId, (degreeMap.get(depId) || 0) + 1);
    }
    if (depInChunk && headInChunk) {
      degreeMap.set(headId, (degreeMap.get(headId) || 0) + 1);
    }
  }

  return degreeMap;
}

function chooseMatrixLexVerb(tokens, inChunkSet, degreeMap) {
  const candidates = tokens.filter(function (t) {
    const tag = getTag(t);
    return isVerb(tag) && tag !== "MD" && !isVpDemotedToken(t, tokens) && inChunkSet.has(t.id);
  });
  if (candidates.length === 0) {
    return null;
  }
  const sorted = candidates.slice().sort(function (a, b) {
    const degreeA = degreeMap.get(a.id) || 0;
    const degreeB = degreeMap.get(b.id) || 0;
    if (degreeA !== degreeB) {
      return degreeB - degreeA;
    }
    if (a.i !== b.i) {
      return a.i - b.i;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  return {
    head: sorted[0],
    candidates: sorted
  };
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
    return {
      head: depChoice,
      candidates: candidates.slice(),
      rule: "dependency_root",
      allowAny: allowAny
    };
  }
  return {
    head: chunkType === "NP" ? chooseByPosition(candidates, true) : chooseByPosition(candidates, false),
    candidates: candidates.slice(),
    rule: allowAny ? "allow_any_fallback" : "positional_fallback",
    allowAny: allowAny
  };
}

function maybeApplyVpLexicalOverride(chunkType, selectedHead, tokens) {
  if (chunkType !== "VP") {
    return { head: selectedHead, fired: false, candidates: [] };
  }
  if (!isVerb(getTag(selectedHead)) || !isVpDemotedToken(selectedHead, tokens)) {
    return { head: selectedHead, fired: false, candidates: [] };
  }
  const lexicalCandidates = tokens.filter(function (t) { return isVerb(getTag(t)) && !isVpDemotedToken(t, tokens); });
  if (lexicalCandidates.length === 0) {
    return { head: selectedHead, fired: false, candidates: [] };
  }
  return { head: chooseByPosition(lexicalCandidates, false), fired: true, candidates: lexicalCandidates.slice() };
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

    const chunkType = ann.chunk_type || "O";
    const initialSelection = selectHeadToken(chunkType, chunkTokens, depMap);
    let selected = initialSelection.head;
    let decisionCandidates = initialSelection.candidates.slice();
    let decisionRule = initialSelection.rule;
    const decisionTieBreak = {};
    let matrixPreferenceFired = false;
    if (chunkType === "VP" && isVpDemotedToken(selected, chunkTokens)) {
      const chunkSet = inChunkIdSet(chunkTokens);
      const degreeMap = buildIncidentDegreeMap(chunkTokens, chunkSet, annotations);
      const matrixLex = chooseMatrixLexVerb(chunkTokens, chunkSet, degreeMap);
      if (matrixLex) {
        selected = matrixLex.head;
        matrixPreferenceFired = true;
        decisionCandidates = matrixLex.candidates.map(function (t) { return t; });
        decisionRule = "matrix_lexical_preference";
        decisionTieBreak.degree = degreeMap.get(selected.id) || 0;
        decisionTieBreak.index = selected.i;
      }
    }

    const maybeOverridden = maybeApplyVpLexicalOverride(chunkType, selected, chunkTokens);
    if (maybeOverridden.fired) {
      decisionCandidates = maybeOverridden.candidates.slice();
      decisionRule = "vp_lexical_override";
      decisionTieBreak.override = true;
    } else if (decisionRule === "positional_fallback") {
      decisionTieBreak.index = selected.i;
    }
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
    newAnnotation.head_decision = {
      candidates: decisionCandidates.map(function (t) { return t.id; }),
      chosen: headTokenId,
      rule: decisionRule,
      tie_break: decisionTieBreak
    };

    if (chunkSurface) {
      newAnnotation.surface = chunkSurface;
    }
    if (matrixPreferenceFired || maybeOverridden.fired) {
      const notes = [];
      if (matrixPreferenceFired) {
        notes.push("vp_matrix_lexical_preference=true");
      }
      if (maybeOverridden.fired) {
        notes.push("vp_lexical_head_override=true");
      }
      newAnnotation.notes = notes.join(",");
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
