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

function isAdpositionTag(tag) {
  return tag === "IN" || tag === "TO";
}

function isVerbLikeTag(tag) {
  return tag === "VB" || tag === "VBD" || tag === "VBG" || tag === "VBN" || tag === "VBP" || tag === "VBZ" || tag === "MD";
}

function isLexicalVerbTag(tag) {
  return tag === "VB" || tag === "VBD" || tag === "VBG" || tag === "VBN" || tag === "VBP" || tag === "VBZ";
}

function lowerSurface(token) {
  return String(token && token.surface ? token.surface : "").toLowerCase();
}

function isDemotedVerbish(token) {
  const tag = getTag(token);
  if (tag === "MD") {
    return true;
  }
  return [
    "be", "am", "is", "are", "was", "were", "been", "being",
    "do", "does", "did",
    "have", "has", "had"
  ].indexOf(lowerSurface(token)) !== -1;
}

function coordTypeFromSurface(surfaceLower) {
  const value = String(surfaceLower || "").toLowerCase();
  if (value === "and") {
    return "and";
  }
  if (value === "or") {
    return "or";
  }
  return "unknown";
}

function coordGroupIdFromMembers(memberTokenIds) {
  const sorted = (Array.isArray(memberTokenIds) ? memberTokenIds.slice() : [])
    .filter(function (id) { return id !== null && id !== undefined; })
    .map(function (id) { return String(id); })
    .sort(function (a, b) { return a.localeCompare(b); });
  return createDeterministicId("coord", { members: sorted });
}

function findCcTokenIdForConj(conjTokenId, depByHead, tokenById) {
  if (!conjTokenId) {
    return null;
  }
  const candidates = (depByHead.get(conjTokenId) || [])
    .filter(function (d) {
      return d && d.dep && d.dep.id && baseDepLabel(d.label) === "cc" && tokenById.has(d.dep.id);
    })
    .map(function (d) { return tokenById.get(d.dep.id); })
    .sort(function (a, b) {
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
  return candidates.length > 0 ? candidates[0].id : null;
}

function isBoundaryToken(token) {
  const surface = lowerSurface(token);
  if (surface === "and" || surface === "or") {
    return true;
  }
  return surface === "." || surface === "," || surface === ";" || surface === ":" || surface === "!" || surface === "?";
}

function getClauseWindowTokens(sentenceTokens, mdIndex) {
  let left = mdIndex;
  let right = mdIndex;
  while (left - 1 >= 0 && !isBoundaryToken(sentenceTokens[left - 1])) {
    left -= 1;
  }
  while (right + 1 < sentenceTokens.length && !isBoundaryToken(sentenceTokens[right + 1])) {
    right += 1;
  }
  return sentenceTokens.slice(left, right + 1);
}

function chooseModalityPredicate(mdToken, windowTokens) {
  const lexicalCandidates = windowTokens.filter(function (t) {
    return isLexicalVerbTag(getTag(t)) && !isDemotedVerbish(t) && t.id !== mdToken.id;
  });
  if (lexicalCandidates.length === 0) {
    return null;
  }
  const rightward = lexicalCandidates.filter(function (t) { return t.i > mdToken.i; });
  const pool = rightward.length > 0
    ? rightward
    : lexicalCandidates.filter(function (t) { return t.i < mdToken.i; });
  if (pool.length === 0) {
    return null;
  }
  const sorted = pool.slice().sort(function (a, b) {
    const distA = Math.abs(a.i - mdToken.i);
    const distB = Math.abs(b.i - mdToken.i);
    if (distA !== distB) {
      return distA - distB;
    }
    const aRight = a.i > mdToken.i ? 1 : 0;
    const bRight = b.i > mdToken.i ? 1 : 0;
    if (aRight !== bRight) {
      return bRight - aRight;
    }
    if (a.i !== b.i) {
      return a.i - b.i;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  return sorted[0];
}

function isNominalLikeTag(tag) {
  return (
    tag === "NN" ||
    tag === "NNS" ||
    tag === "NNP" ||
    tag === "NNPS" ||
    tag === "PRP" ||
    tag === "PRP$" ||
    tag === "CD"
  );
}

function isComparativeHeadToken(token) {
  if (!token) {
    return false;
  }
  const tag = getTag(token);
  const surface = lowerSurface(token);
  const comparativeSurface = new Set(["greater", "less", "more", "fewer"]);
  const adjOrAdv = tag === "JJ" || tag === "JJR" || tag === "RB" || tag === "RBR";
  if (!adjOrAdv) {
    return false;
  }
  return tag === "JJR" || tag === "RBR" || comparativeSurface.has(surface);
}

function isComplementNominalLike(tag) {
  const value = String(tag || "");
  return /^NN/.test(value) || value === "PRP" || value === "PRP$" || value === "CD";
}

function isComplementAdjectivalLike(tag) {
  const value = String(tag || "");
  return /^JJ/.test(value) || /^RB/.test(value);
}

function compareRelationLabelFromSurface(surfaceLower) {
  const value = String(surfaceLower || "").toLowerCase();
  if (value === "greater" || value === "more") {
    return "compare_gt";
  }
  if (value === "less" || value === "fewer") {
    return "compare_lt";
  }
  return "compare";
}

function normalizeCompareLabel(label, headToken) {
  const value = String(label || "").toLowerCase();
  if (value === "compare_gt" || value === "compare_lt" || value === "compare") {
    return value;
  }
  return compareRelationLabelFromSurface(lowerSurface(headToken));
}

function quantifierRoleFromObservation(annotation) {
  const category = String(annotation && annotation.category ? annotation.category : "").toLowerCase();
  const label = String(annotation && annotation.label ? annotation.label : "").toLowerCase();
  if (category === "scope" || label.startsWith("scope_")) {
    return "scope_quantifier";
  }
  return "quantifier";
}

function baseDepLabel(label) {
  const value = String(label || "").toLowerCase();
  const idx = value.indexOf(":");
  return idx === -1 ? value : value.slice(0, idx);
}

function getSelector(annotation, type) {
  if (!annotation || !annotation.anchor || !Array.isArray(annotation.anchor.selectors)) {
    return null;
  }
  return annotation.anchor.selectors.find(function (s) { return s && s.type === type; }) || null;
}

function isSupportedIndexUnit(unit) {
  return unit === "utf16_code_units" || unit === "unicode_codepoints" || unit === "bytes_utf8";
}

function validateAcceptedChunkHeadCardinality(annotations) {
  const acceptedChunkIds = new Set();
  const acceptedChunkHeadCounts = new Map();

  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (annotation && annotation.kind === "chunk" && annotation.status === "accepted" && annotation.id) {
      acceptedChunkIds.add(annotation.id);
    }
  }

  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (
      annotation &&
      annotation.kind === "chunk_head" &&
      annotation.status === "accepted" &&
      annotation.chunk_id &&
      annotation.head &&
      annotation.head.id
    ) {
      acceptedChunkHeadCounts.set(annotation.chunk_id, (acceptedChunkHeadCounts.get(annotation.chunk_id) || 0) + 1);
    }
  }

  for (const chunkId of acceptedChunkIds.values()) {
    const count = acceptedChunkHeadCounts.get(chunkId) || 0;
    if (count === 0) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 11 requires exactly one accepted chunk_head per accepted chunk: missing chunk_head.",
        { chunk_id: chunkId }
      );
    }
    if (count > 1) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 11 requires exactly one accepted chunk_head per accepted chunk: duplicate chunk_head.",
        { chunk_id: chunkId, count: count }
      );
    }
  }
}

function buildChunkIndex(annotations) {
  const chunkById = new Map();
  const chunkHeadByChunkId = new Map();
  const tokenToChunkHead = new Map();

  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (annotation && annotation.kind === "chunk" && annotation.status === "accepted") {
      const tokenSelector = getSelector(annotation, "TokenSelector");
      if (tokenSelector && Array.isArray(tokenSelector.token_ids) && tokenSelector.token_ids.length > 0) {
        chunkById.set(annotation.id, tokenSelector.token_ids.slice());
      }
    }
  }

  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (annotation && annotation.kind === "chunk_head" && annotation.status === "accepted" && annotation.chunk_id && annotation.head && annotation.head.id) {
      chunkHeadByChunkId.set(annotation.chunk_id, annotation.head.id);
    }
  }

  for (const pair of chunkById.entries()) {
    const chunkId = pair[0];
    const tokenIds = pair[1];
    const headId = chunkHeadByChunkId.get(chunkId);
    if (!headId) {
      continue;
    }
    for (let i = 0; i < tokenIds.length; i += 1) {
      tokenToChunkHead.set(tokenIds[i], headId);
    }
  }

  return {
    tokenToChunkHead: tokenToChunkHead
  };
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
    "Stage 11 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function roleFromDepLabel(depLabel, depTokenTag, headTokenTag) {
  const base = baseDepLabel(depLabel);
  if (base === "nsubj" && isVerbLikeTag(headTokenTag) && isNominalLikeTag(depTokenTag)) {
    return "actor";
  }
  if (base === "nsubjpass" && isVerbLikeTag(headTokenTag) && isNominalLikeTag(depTokenTag)) {
    return "patient";
  }
  if ((base === "dobj" || base === "obj") && isVerbLikeTag(headTokenTag) && isNominalLikeTag(depTokenTag)) {
    return "theme";
  }
  if ((base === "attr" || base === "acomp" || base === "appos") && isVerbLikeTag(headTokenTag)) {
    return "attribute";
  }
  if (base === "iobj" && isVerbLikeTag(headTokenTag)) {
    return "recipient";
  }
  if (base === "advmod" || base === "npadvmod") {
    return "modifier";
  }
  if (base === "amod" || base === "compound" || base === "nummod") {
    return "modifier";
  }
  return null;
}

function isSubjectLikeDepLabel(label) {
  const base = baseDepLabel(label);
  return base === "nsubj" || base === "nsubjpass" || base === "csubj" || base === "csubjpass" || base === "expl";
}

function isCarrierRoleMappedFromDep(mappedRole, depLabelBase) {
  if (mappedRole === "attribute" && (depLabelBase === "attr" || depLabelBase === "acomp")) {
    return true;
  }
  if (mappedRole === "modifier" && (depLabelBase === "advmod" || depLabelBase === "npadvmod")) {
    return true;
  }
  return false;
}

function isSuchAsConnectorAmod(depBase, depTok, headTok, depByDep, tokenById) {
  if (depBase !== "amod") {
    return false;
  }
  if (!depTok || !headTok) {
    return false;
  }
  if (lowerSurface(depTok) !== "such") {
    return false;
  }
  const incomingToHead = depByDep.get(headTok.id) || [];
  for (let i = 0; i < incomingToHead.length; i += 1) {
    const edge = incomingToHead[i];
    if (!edge || !edge.head || !edge.head.id) {
      continue;
    }
    if (baseDepLabel(edge.label) !== "pobj") {
      continue;
    }
    const maybeAs = tokenById.get(edge.head.id);
    if (maybeAs && lowerSurface(maybeAs) === "as") {
      return true;
    }
  }
  return false;
}

function roleFromPrepSurface(surface) {
  const prep = String(surface || "").toLowerCase();
  if (prep === "in" || prep === "on" || prep === "at" || prep === "into" || prep === "inside") {
    return "location";
  }
  if (prep === "of") {
    return "topic";
  }
  if (prep === "for") {
    return "beneficiary";
  }
  if (prep === "to") {
    return "purpose";
  }
  if (prep === "with") {
    return "instrument";
  }
  if (prep === "by") {
    return "agent";
  }
  return null;
}

function remapPrepContainerIfPronoun(containerId, depByDep, tokenById) {
  if (!containerId || !tokenById.has(containerId)) {
    return containerId;
  }
  const containerTok = tokenById.get(containerId);
  const tag = getTag(containerTok);
  if (tag !== "PRP" && tag !== "PRP$") {
    return containerId;
  }
  const incoming = depByDep.get(containerId) || [];
  const candidates = incoming
    .filter(function (d) {
      if (!d || !d.head || !d.head.id || !tokenById.has(d.head.id)) {
        return false;
      }
      const base = baseDepLabel(d.label);
      if (base !== "obj" && base !== "dobj" && base !== "iobj") {
        return false;
      }
      return isVerbLikeTag(getTag(tokenById.get(d.head.id)));
    })
    .map(function (d) { return tokenById.get(d.head.id); })
    .sort(function (a, b) {
      const distA = Math.abs(a.i - containerTok.i);
      const distB = Math.abs(b.i - containerTok.i);
      if (distA !== distB) {
        return distA - distB;
      }
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
  return candidates.length > 0 ? candidates[0].id : containerId;
}

function remapWeakAreCarrierHead(headId, depByDep, tokenById) {
  const incoming = depByDep.get(headId) || [];
  const candidates = incoming
    .filter(function (d) {
      if (!d || !d.head || !d.head.id || !tokenById.has(d.head.id)) {
        return false;
      }
      const base = baseDepLabel(d.label);
      if (
        base !== "dep" &&
        base !== "conj" &&
        base !== "xcomp" &&
        base !== "ccomp" &&
        base !== "advcl" &&
        base !== "relcl"
      ) {
        return false;
      }
      const incomingHeadTok = tokenById.get(d.head.id);
      const headTag = getTag(incomingHeadTok);
      if (!isLexicalVerbTag(headTag)) {
        return false;
      }
      // Keep remap bounded to non-gerund lexical hosts.
      if (headTag === "VBG" || headTag === "VBN") {
        return false;
      }
      return true;
    })
    .map(function (d) { return tokenById.get(d.head.id); })
    .sort(function (a, b) {
      const aDemoted = isDemotedVerbish(a) ? 1 : 0;
      const bDemoted = isDemotedVerbish(b) ? 1 : 0;
      if (aDemoted !== bDemoted) {
        return aDemoted - bDemoted;
      }
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
  return candidates.length > 0 ? candidates[0].id : null;
}

function isExemplarCandidateToken(token) {
  const tag = getTag(token);
  return isLexicalVerbTag(tag) || isNominalLikeTag(tag) || /^JJ/.test(tag);
}

function resolveNominalTailId(tokenId, depByHead, tokenById) {
  if (!tokenId || !tokenById.has(tokenId)) {
    return tokenId;
  }
  let currentId = tokenId;
  const visited = new Set();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const candidates = (depByHead.get(currentId) || [])
      .filter(function (d) {
        return d &&
          d.dep &&
          d.dep.id &&
          tokenById.has(d.dep.id) &&
          baseDepLabel(d.label) === "compound" &&
          isNominalLikeTag(getTag(tokenById.get(d.dep.id)));
      })
      .map(function (d) { return tokenById.get(d.dep.id); })
      .sort(function (a, b) {
        if (a.i !== b.i) {
          return b.i - a.i;
        }
        return String(a.id).localeCompare(String(b.id));
      });
    if (candidates.length === 0) {
      break;
    }
    const next = candidates[0];
    if (next.id === currentId) {
      break;
    }
    currentId = next.id;
  }
  return currentId;
}

function isPobjGerundToken(tokenId, depByDep, tokenById) {
  if (!tokenId || !tokenById.has(tokenId)) {
    return false;
  }
  const token = tokenById.get(tokenId);
  if (getTag(token) !== "VBG") {
    return false;
  }
  const incoming = depByDep.get(tokenId) || [];
  return incoming.some(function (d) {
    if (!d || !d.head || !d.head.id || baseDepLabel(d.label) !== "pobj" || !tokenById.has(d.head.id)) {
      return false;
    }
    return isAdpositionTag(getTag(tokenById.get(d.head.id)));
  });
}

function isNominalishToken(tokenId, depByDep, tokenById) {
  if (!tokenId || !tokenById.has(tokenId)) {
    return false;
  }
  return isNominalLikeTag(getTag(tokenById.get(tokenId))) || isPobjGerundToken(tokenId, depByDep, tokenById);
}

function isConjDependentToken(tokenId, depByDep, tokenById) {
  if (!tokenId || !tokenById.has(tokenId)) {
    return false;
  }
  const incoming = depByDep.get(tokenId) || [];
  return incoming.some(function (d) {
    if (!d || !d.head || !d.head.id || baseDepLabel(d.label) !== "conj" || !tokenById.has(d.head.id)) {
      return false;
    }
    return isNominalishToken(d.head.id, depByDep, tokenById) && isNominalishToken(tokenId, depByDep, tokenById);
  });
}

function buildOrderedChunks(annotations) {
  const chunks = [];
  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (!annotation || annotation.kind !== "chunk" || annotation.status !== "accepted") {
      continue;
    }
    const pos = getSelector(annotation, "TextPositionSelector");
    const tok = getSelector(annotation, "TokenSelector");
    if (!pos || !pos.span || !tok || !Array.isArray(tok.token_ids) || tok.token_ids.length === 0) {
      continue;
    }
    chunks.push({
      id: annotation.id,
      chunkType: annotation.chunk_type || "O",
      label: annotation.label || "",
      span: { start: pos.span.start, end: pos.span.end },
      tokenIds: tok.token_ids.slice()
    });
  }
  chunks.sort(function (a, b) {
    if (a.span.start !== b.span.start) {
      return a.span.start - b.span.start;
    }
    if (a.span.end !== b.span.end) {
      return a.span.end - b.span.end;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  return chunks;
}

function containsBoundary(chunk) {
  const text = String(chunk && chunk.label ? chunk.label : "").trim().toLowerCase();
  return text === "." || text === "," || text === ";" || text === ":" || text === "!" || text === "?";
}

function isCoordToken(chunk) {
  const text = String(chunk && chunk.label ? chunk.label : "").trim().toLowerCase();
  return text === "and" || text === "or";
}

function maybeAddChunkFallbackRelations(relations, addRelation, chunks, chunkHeadByChunkId, tokenById, depByHead, depByDep) {
  const ARGUMENT_LIKE_DEP_LABELS = new Set(["nsubj", "nsubjpass", "obj", "dobj", "iobj", "pobj"]);
  const CLAUSAL_DEP_LABELS = new Set(["xcomp", "ccomp", "advcl", "relcl"]);

  function nearestPrevNP(idx) {
    for (let i = idx - 1; i >= 0; i -= 1) {
      const c = chunks[i];
      if (containsBoundary(c)) {
        break;
      }
      if (c.chunkType === "NP") {
        return c;
      }
    }
    return null;
  }

  function nearestNextNP(idx) {
    for (let i = idx + 1; i < chunks.length; i += 1) {
      const c = chunks[i];
      if (containsBoundary(c)) {
        break;
      }
      if (c.chunkType === "NP") {
        return c;
      }
    }
    return null;
  }

  function nearestNextVP(idx) {
    for (let i = idx + 1; i < chunks.length; i += 1) {
      const c = chunks[i];
      if (containsBoundary(c)) {
        break;
      }
      if (c.chunkType === "VP") {
        return c;
      }
    }
    return null;
  }

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (chunk.chunkType !== "VP") {
      continue;
    }
    const predicateId = chunkHeadByChunkId.get(chunk.id);
    if (!predicateId || !tokenById.has(predicateId)) {
      continue;
    }
    const predTok = tokenById.get(predicateId);
    const predDeps = depByHead.get(predicateId) || [];
    const incomingDeps = depByDep.get(predicateId) || [];
    const isPrepObjectLike = incomingDeps.some(function (d) {
      return d && baseDepLabel(d.label) === "pobj";
    });
    if (isPrepObjectLike) {
      continue;
    }
    const hasCoreSubject = predDeps.some(function (d) { return d && baseDepLabel(d.label) === "nsubj"; });
    const hasPassiveSubject = predDeps.some(function (d) { return d && baseDepLabel(d.label) === "nsubjpass"; });
    const hasExplicitClausalComplement = predDeps.some(function (d) {
      return d && CLAUSAL_DEP_LABELS.has(baseDepLabel(d.label));
    });
    const hasIncomingClausalVerbLink = incomingDeps.some(function (d) {
      if (!d || !d.head || !d.head.id || !tokenById.has(d.head.id)) {
        return false;
      }
      const base = baseDepLabel(d.label);
      if (!CLAUSAL_DEP_LABELS.has(base)) {
        return false;
      }
      return isVerbLikeTag(getTag(tokenById.get(d.head.id)));
    });
    const hasCoreObject = predDeps.some(function (d) {
      const label = d ? baseDepLabel(d.label) : "";
      return label === "obj" || label === "dobj" || label === "iobj";
    });
    const hasByPrepObject = predDeps.some(function (d) {
      if (!d || baseDepLabel(d.label) !== "prep" || !d.dep || !d.dep.id || !tokenById.has(d.dep.id)) {
        return false;
      }
      const prepTok = tokenById.get(d.dep.id);
      if (lowerSurface(prepTok) !== "by") {
        return false;
      }
      const prepChildren = depByHead.get(d.dep.id) || [];
      return prepChildren.some(function (child) {
        return child && baseDepLabel(child.label) === "pobj" && child.dep && child.dep.id && tokenById.has(child.dep.id);
      });
    });
    const chunkTokenSet = new Set(Array.isArray(chunk.tokenIds) ? chunk.tokenIds : []);
    const isArgumentLikeVpChunk = Array.from(chunkTokenSet).some(function (tokenId) {
      const incoming = depByDep.get(tokenId) || [];
      return incoming.some(function (d) {
        if (!d || !d.head || !d.head.id) {
          return false;
        }
        if (chunkTokenSet.has(d.head.id)) {
          return false;
        }
        return ARGUMENT_LIKE_DEP_LABELS.has(baseDepLabel(d.label));
      });
    });
    if (isArgumentLikeVpChunk) {
      continue;
    }
    const sentenceId = predTok.segment_id;

    const prevNP = nearestPrevNP(i);
    if (prevNP && !hasCoreSubject && !hasPassiveSubject && !hasIncomingClausalVerbLink) {
      const arg = chunkHeadByChunkId.get(prevNP.id);
      addRelation(predicateId, arg, "actor", {
        pattern: "chunk_fallback",
        dependency_label: null,
        sentence_id: sentenceId
      });
    }

    const nextNP = nearestNextNP(i);
    if (nextNP && !hasCoreObject && !hasPassiveSubject && !hasByPrepObject) {
      const arg = chunkHeadByChunkId.get(nextNP.id);
      addRelation(predicateId, arg, "theme", {
        pattern: "chunk_fallback",
        dependency_label: null,
        sentence_id: sentenceId
      });
    }

    // Internal VP argument fallback: prefer noun token inside VP chunk.
    const internalThemeToken = chunk.tokenIds
      .map(function (id) { return tokenById.get(id); })
      .filter(Boolean)
      .filter(function (t) { return t.id !== predicateId && isNoun(getTag(t)); })
      .sort(function (a, b) { return a.i - b.i; })[0];
    if (internalThemeToken && !hasCoreObject && !nextNP && !hasPassiveSubject && !hasByPrepObject) {
      addRelation(predicateId, internalThemeToken.id, "theme", {
        pattern: "chunk_fallback",
        dependency_label: "obj",
        sentence_id: sentenceId
      });
    }

    const chunkLower = String(chunk.label || "").toLowerCase();
    if (chunkLower.indexOf(" in ") !== -1 || chunkLower.startsWith("in ")) {
      const arg = nextNP ? chunkHeadByChunkId.get(nextNP.id) : null;
      addRelation(predicateId, arg, "location", {
        pattern: "chunk_fallback",
        dependency_label: "prep",
        prep_surface: "in",
        sentence_id: sentenceId
      });
    }
    if (chunkLower.indexOf(" of ") !== -1 || chunkLower.startsWith("of ")) {
      const arg = nextNP ? chunkHeadByChunkId.get(nextNP.id) : null;
      addRelation(predicateId, arg, "topic", {
        pattern: "chunk_fallback",
        dependency_label: "prep",
        prep_surface: "of",
        sentence_id: sentenceId
      });
    }
    if (chunkLower.indexOf(" with ") !== -1 || chunkLower.startsWith("with ")) {
      const arg = nextNP ? chunkHeadByChunkId.get(nextNP.id) : null;
      addRelation(predicateId, arg, "instrument", {
        pattern: "chunk_fallback",
        dependency_label: "prep",
        prep_surface: "with",
        sentence_id: sentenceId
      });
    }
    if (chunkLower.indexOf(" for ") !== -1 || chunkLower.startsWith("for ")) {
      const arg = nextNP ? chunkHeadByChunkId.get(nextNP.id) : null;
      addRelation(predicateId, arg, "beneficiary", {
        pattern: "chunk_fallback",
        dependency_label: "prep",
        prep_surface: "for",
        sentence_id: sentenceId
      });
    }
    if (chunkLower.indexOf(" by ") !== -1 || chunkLower.startsWith("by ")) {
      const arg = nextNP ? chunkHeadByChunkId.get(nextNP.id) : null;
      addRelation(predicateId, arg, "agent", {
        pattern: "chunk_fallback",
        dependency_label: "prep",
        prep_surface: "by",
        sentence_id: sentenceId
      });
    }

    if ((chunkLower.indexOf(" to ") !== -1 || chunkLower.startsWith("to ")) && !hasExplicitClausalComplement) {
      const nextVP = nearestNextVP(i);
      if (nextVP) {
        addRelation(predicateId, chunkHeadByChunkId.get(nextVP.id), "complement_clause", {
          pattern: "chunk_fallback",
          dependency_label: "xcomp",
          sentence_id: sentenceId
        });
        addRelation(predicateId, chunkHeadByChunkId.get(nextVP.id), "purpose", {
          pattern: "chunk_fallback",
          dependency_label: "xcomp",
          sentence_id: sentenceId
        });
      }
    }

  }

  for (let i = 1; i + 1 < chunks.length; i += 1) {
    const mid = chunks[i];
    if (!isCoordToken(mid)) {
      continue;
    }
    const left = chunks[i - 1];
    const right = chunks[i + 1];
    if (left.chunkType !== "VP" || right.chunkType !== "VP") {
      continue;
    }
    const leftPred = chunkHeadByChunkId.get(left.id);
    const rightPred = chunkHeadByChunkId.get(right.id);
    if (!leftPred || !rightPred || !tokenById.has(leftPred)) {
      continue;
    }
    const coordToken = (mid.tokenIds || [])
      .map(function (id) { return tokenById.get(id); })
      .filter(Boolean)
      .sort(function (a, b) {
        if (a.i !== b.i) {
          return a.i - b.i;
        }
        return String(a.id).localeCompare(String(b.id));
      })[0] || null;
    const coordTokenId = coordToken ? coordToken.id : null;
    const coordType = coordTypeFromSurface(coordToken ? lowerSurface(coordToken) : "");
    const coordGroupId = coordGroupIdFromMembers([leftPred, rightPred]);
    addRelation(leftPred, rightPred, "coordination", {
      pattern: "chunk_fallback",
      dependency_label: "conj",
      sentence_id: tokenById.get(leftPred).segment_id,
      coord_type: coordType,
      coord_token_id: coordTokenId,
      coord_group_id: coordGroupId
    });
  }

  void relations;
}

function maybeAddTokenHeuristicRelations(addRelation, tokens) {
  const bySentence = new Map();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!bySentence.has(token.segment_id)) {
      bySentence.set(token.segment_id, []);
    }
    bySentence.get(token.segment_id).push(token);
  }
  for (const list of bySentence.values()) {
    list.sort(function (a, b) { return a.i - b.i; });
  }

  for (const sentenceTokens of bySentence.values()) {
    for (let i = 1; i + 1 < sentenceTokens.length; i += 1) {
      const current = sentenceTokens[i];
      if (String(current.surface || "").toLowerCase() !== "to") {
        continue;
      }
      const next = sentenceTokens[i + 1];
      if (!next || !/^VB/.test(getTag(next))) {
        continue;
      }
      let prevVerb = null;
      for (let j = i - 1; j >= 0; j -= 1) {
        if (/^VB/.test(getTag(sentenceTokens[j]))) {
          prevVerb = sentenceTokens[j];
          break;
        }
      }
      if (!prevVerb) {
        continue;
      }
      addRelation(prevVerb.id, next.id, "complement_clause", {
        pattern: "token_heuristic",
        dependency_label: "xcomp",
        sentence_id: current.segment_id
      });
      addRelation(prevVerb.id, next.id, "purpose", {
        pattern: "token_heuristic",
        dependency_label: "xcomp",
        sentence_id: current.segment_id
      });
    }
  }

}

function maybeAddCoordinationRolePropagation(addRelation, relations, dependencyObs, tokenById, resolvePredicateForRelation) {
  if (!Array.isArray(dependencyObs) || dependencyObs.length === 0) {
    return;
  }

  function propagateRoleAcrossConj(fromPredicateId, toPredicateId, dep, role) {
    for (let i = 0; i < relations.length; i += 1) {
      const rel = relations[i];
      if (!rel || rel.predicateId !== fromPredicateId || rel.role !== role) {
        continue;
      }
      const coordEvidence = depCoordinationEvidence(dep);
      addRelation(
        toPredicateId,
        rel.argumentId,
        role,
        {
          pattern: "coordination_role_propagation",
          dependency_label: "conj",
          propagated_role: role,
          sentence_id: rel.sentenceId,
          source_predicate_token_id: dep.head.id,
          target_predicate_token_id: dep.dep.id,
          coord_type: coordEvidence ? coordEvidence.coordinationType : null,
          coord_token_id: coordEvidence ? coordEvidence.coordinatorTokenId : null
        }
      );
    }
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (!dep || dep.is_root || baseDepLabel(dep.label) !== "conj" || !dep.head || !dep.dep) {
      continue;
    }
    const headTok = tokenById.get(dep.head.id);
    const depTok = tokenById.get(dep.dep.id);
    if (!headTok || !depTok) {
      continue;
    }
    if (!isVerbLikeTag(getTag(headTok)) || !isVerbLikeTag(getTag(depTok))) {
      continue;
    }

    const fromHead = resolvePredicateForRelation(dep.head.id);
    const fromDep = resolvePredicateForRelation(dep.dep.id);
    if (!fromHead || !fromDep || fromHead === fromDep) {
      continue;
    }

    propagateRoleAcrossConj(fromHead, fromDep, dep, "actor");
    propagateRoleAcrossConj(fromDep, fromHead, dep, "actor");
  }
}

function isExistingStage11Relation(annotation) {
  return Boolean(
    annotation &&
    annotation.kind === "dependency" &&
    annotation.status === "accepted" &&
    Array.isArray(annotation.sources) &&
    annotation.sources.some(function (s) { return s && s.name === "relation-extraction"; })
  );
}

function depCoordinationEvidence(dep) {
  if (!dep || !Array.isArray(dep.sources)) {
    return null;
  }
  for (let i = 0; i < dep.sources.length; i += 1) {
    const src = dep.sources[i];
    if (!src || !src.evidence) {
      continue;
    }
    const evidence = src.evidence;
    if (!evidence.coordination_type && !evidence.coordinator_token_id) {
      continue;
    }
    return {
      coordinationType: evidence.coordination_type || null,
      coordinatorTokenId: evidence.coordinator_token_id || null
    };
  }
  return null;
}

function makeRelationAnnotation(out, rel, tokenById, unit) {
  const predTok = tokenById.get(rel.predicateId);
  const argTok = tokenById.get(rel.argumentId);
  const argText = spanTextFromCanonical(out.canonical_text, argTok.span, unit);
  return {
    id: createDeterministicId("rel", {
      predicate: rel.predicateId,
      argument: rel.argumentId,
      role: rel.role,
      sentence: rel.sentenceId
    }),
    kind: "dependency",
    status: "accepted",
    dep: { id: rel.argumentId },
    head: { id: rel.predicateId },
    is_root: false,
    label: rel.role,
    anchor: {
      selectors: [
        { type: "TokenSelector", token_ids: [rel.predicateId, rel.argumentId] },
        { type: "TextQuoteSelector", exact: argText },
        { type: "TextPositionSelector", span: { start: argTok.span.start, end: argTok.span.end } }
      ]
    },
    sources: [{
      name: "relation-extraction",
      kind: "rule",
      evidence: rel.evidence
    }],
    surface: predTok.surface + " -> " + argTok.surface
  };
}

/**
 * Stage 11: relation extraction.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const tokenById = new Map(tokens.map(function (t) { return [t.id, t]; }));
  const unit = out.index_basis && out.index_basis.unit ? out.index_basis.unit : "utf16_code_units";

  if (out.stage !== "heads_identified") {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 11 requires stage='heads_identified' input."
    );
  }
  if (!isSupportedIndexUnit(unit)) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 11 received unsupported index_basis.unit.",
      { unit: unit }
    );
  }

  for (let i = 0; i < annotations.length; i += 1) {
    if (isExistingStage11Relation(annotations[i])) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 11 rejects partially relation-extracted documents with existing accepted relation-extraction annotations."
      );
    }
  }
  validateAcceptedChunkHeadCardinality(annotations);

  const dependencyObs = annotations.filter(function (a) {
    return a && a.kind === "dependency" && a.status === "observation";
  });
  const comparativeObs = annotations.filter(function (a) {
    return a && a.kind === "comparative" && a.status === "observation";
  });
  const quantifierScopeObs = annotations.filter(function (a) {
    return a && a.kind === "quantifier_scope" && a.status === "observation";
  });

  const depByHead = new Map();
  const depByDep = new Map();
  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (!dep.dep || !dep.dep.id || !tokenById.has(dep.dep.id)) {
      continue;
    }
    const depTok = tokenById.get(dep.dep.id);
    if (dep.head && dep.head.id && tokenById.has(dep.head.id)) {
      if (!depByHead.has(dep.head.id)) {
        depByHead.set(dep.head.id, []);
      }
      depByHead.get(dep.head.id).push(dep);
    }
    if (!depByDep.has(dep.dep.id)) {
      depByDep.set(dep.dep.id, []);
    }
    depByDep.get(dep.dep.id).push(dep);
    void depTok;
  }

  const chunkIndex = buildChunkIndex(annotations);
  const chunks = buildOrderedChunks(annotations);
  const chunkHeadByChunkId = new Map();
  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (annotation && annotation.kind === "chunk_head" && annotation.status === "accepted" && annotation.chunk_id && annotation.head && annotation.head.id) {
      chunkHeadByChunkId.set(annotation.chunk_id, annotation.head.id);
    }
  }
  function resolvePredicate(tokenId) {
    if (!tokenId || !tokenById.has(tokenId)) {
      return null;
    }
    if (chunkIndex.tokenToChunkHead.has(tokenId)) {
      return chunkIndex.tokenToChunkHead.get(tokenId);
    }
    return tokenId;
  }

  function resolvePredicateForRelation(headTokenId) {
    if (!headTokenId || !tokenById.has(headTokenId)) {
      return null;
    }
    const projected = chunkIndex.tokenToChunkHead.has(headTokenId)
      ? chunkIndex.tokenToChunkHead.get(headTokenId)
      : headTokenId;
    if (projected === headTokenId) {
      return headTokenId;
    }
    const headTok = tokenById.get(headTokenId);
    const projectedTok = tokenById.get(projected);
    if (!headTok || !projectedTok) {
      return projected;
    }
    if (isLexicalVerbTag(getTag(headTok)) && isDemotedVerbish(projectedTok)) {
      return headTokenId;
    }
    return projected;
  }

  const relations = [];
  const relationIndexByKey = new Map();

  function mergeDuplicateEvidence(existingEvidence, incomingEvidence) {
    const existing = existingEvidence && typeof existingEvidence === "object" ? existingEvidence : {};
    const incoming = incomingEvidence && typeof incomingEvidence === "object" ? incomingEvidence : {};
    if (
      (incoming.pattern === "comparative_observation" || incoming.pattern === "quantifier_scope_observation") &&
      typeof incoming.source_annotation_id === "string" &&
      incoming.source_annotation_id.length > 0 &&
      typeof existing.source_annotation_id !== "string"
    ) {
      existing.source_annotation_id = incoming.source_annotation_id;
    }
    return existing;
  }

  function addRelation(predicateId, argumentId, role, evidence) {
    if (!predicateId || !argumentId || !role || predicateId === argumentId) {
      return;
    }
    const p = tokenById.get(predicateId);
    const a = tokenById.get(argumentId);
    if (!p || !a || p.segment_id !== a.segment_id) {
      return;
    }
    const key = [p.segment_id, predicateId, argumentId, role].join("|");
    if (relationIndexByKey.has(key)) {
      const existingIndex = relationIndexByKey.get(key);
      const current = relations[existingIndex];
      current.evidence = mergeDuplicateEvidence(current.evidence, evidence);
      return;
    }
    const rel = {
      sentenceId: p.segment_id,
      predicateId: predicateId,
      argumentId: argumentId,
      role: role,
      evidence: evidence
    };
    relationIndexByKey.set(key, relations.length);
    relations.push(rel);
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const vTok = tokens[i];
    if (!isVerbLikeTag(getTag(vTok))) {
      continue;
    }
    const vId = vTok.id;
    const outgoing = depByHead.get(vId) || [];
    const subjects = outgoing.filter(function (d) {
      const base = baseDepLabel(d.label);
      return (base === "nsubj" || base === "nsubjpass") && d.dep && d.dep.id && tokenById.has(d.dep.id);
    }).map(function (d) { return tokenById.get(d.dep.id); });
    const complements = outgoing.filter(function (d) {
      const base = baseDepLabel(d.label);
      return (base === "attr" || base === "acomp") && d.dep && d.dep.id && tokenById.has(d.dep.id);
    }).map(function (d) { return tokenById.get(d.dep.id); });
    if (subjects.length === 0 || complements.length === 0) {
      continue;
    }
    subjects.sort(function (a, b) {
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    complements.sort(function (a, b) {
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    const subject = subjects[0];
    const complement = complements[0];

    const copCandidates = [];
    const depSide = (depByDep.get(vId) || []).filter(function (d) { return baseDepLabel(d.label) === "cop"; });
    for (let j = 0; j < depSide.length; j += 1) {
      const d = depSide[j];
      if (d.head && d.head.id && tokenById.has(d.head.id)) {
        copCandidates.push(tokenById.get(d.head.id));
      }
    }
    const headAtVerb = (depByHead.get(vId) || []).filter(function (d) { return baseDepLabel(d.label) === "cop"; });
    for (let j = 0; j < headAtVerb.length; j += 1) {
      const d = headAtVerb[j];
      if (d.dep && d.dep.id && tokenById.has(d.dep.id)) {
        copCandidates.push(tokenById.get(d.dep.id));
      }
    }
    const headSide = (depByHead.get(complement.id) || []).filter(function (d) { return baseDepLabel(d.label) === "cop"; });
    for (let j = 0; j < headSide.length; j += 1) {
      const d = headSide[j];
      if (d.dep && d.dep.id && tokenById.has(d.dep.id)) {
        copCandidates.push(tokenById.get(d.dep.id));
      }
    }
    copCandidates.sort(function (a, b) {
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    const copTok = copCandidates.length > 0 ? copCandidates[0] : null;

    let complementKind = "other";
    const compTag = getTag(complement);
    if (isComplementNominalLike(compTag)) {
      complementKind = "nominal";
    } else if (isComplementAdjectivalLike(compTag)) {
      complementKind = "adjectival";
    }

    const predId = isVerbLikeTag(getTag(vTok))
      ? resolvePredicateForRelation(vId)
      : resolvePredicate(vId);
    const compId = resolvePredicate(complement.id);
    addRelation(
      predId,
      compId,
      "copula",
      {
        pattern: "copula_frame",
        verb_token_id: vId,
        subject_token_id: subject.id,
        complement_token_id: complement.id,
        copula_token_id: copTok ? copTok.id : null,
        complement_kind: complementKind,
        sentence_id: vTok.segment_id
      }
    );
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (dep.is_root || !dep.head || !dep.head.id || !dep.dep || !dep.dep.id) {
      continue;
    }
    const depTok = tokenById.get(dep.dep.id);
    const headTok = tokenById.get(dep.head.id);
    const depBase = baseDepLabel(dep.label);
    if (isSuchAsConnectorAmod(depBase, depTok, headTok, depByDep, tokenById)) {
      continue;
    }
    const mappedRole = roleFromDepLabel(dep.label, getTag(depTok), getTag(headTok));
    if (mappedRole) {
      const headSurfaceLower = lowerSurface(headTok);
      const outgoingFromHead = depByHead.get(dep.head.id) || [];
      const hasCopulaComplementShape = outgoingFromHead.some(function (d) {
        if (!d || !d.dep || !d.dep.id || !tokenById.has(d.dep.id)) {
          return false;
        }
        const base = baseDepLabel(d.label);
        return base === "attr" || base === "acomp";
      });
      const hasPassiveSubject = outgoingFromHead.some(function (d) {
        return d && baseDepLabel(d.label) === "nsubjpass" && d.dep && d.dep.id && tokenById.has(d.dep.id);
      });
      const byPrepEdges = outgoingFromHead.filter(function (d) {
        if (!d || !d.dep || !d.dep.id || !tokenById.has(d.dep.id)) {
          return false;
        }
        if (baseDepLabel(d.label) !== "prep") {
          return false;
        }
        return lowerSurface(tokenById.get(d.dep.id)) === "by";
      });
      const hasByAgentPobj = byPrepEdges.some(function (prepEdge) {
        return (depByHead.get(prepEdge.dep.id) || []).some(function (child) {
          return child &&
            baseDepLabel(child.label) === "pobj" &&
            child.dep &&
            child.dep.id &&
            tokenById.has(child.dep.id);
        });
      });
      const xcompVerbEdges = outgoingFromHead.filter(function (d) {
        if (!d || !d.dep || !d.dep.id || !tokenById.has(d.dep.id)) {
          return false;
        }
        return baseDepLabel(d.label) === "xcomp" && isVerbLikeTag(getTag(tokenById.get(d.dep.id)));
      });
      const hasXcompWithObject = xcompVerbEdges.some(function (x) {
        return (depByHead.get(x.dep.id) || []).some(function (child) {
          const base = baseDepLabel(child.label);
          return (base === "obj" || base === "dobj") &&
            child.dep &&
            child.dep.id &&
            tokenById.has(child.dep.id);
        });
      });
      const hasCarrierModifierShape = outgoingFromHead.some(function (d) {
        if (!d || !d.dep || !d.dep.id || !tokenById.has(d.dep.id)) {
          return false;
        }
        const base = baseDepLabel(d.label);
        return base === "advmod" || base === "npadvmod";
      });
      const hasSubjectLikeOutgoing = (depByHead.get(dep.head.id) || []).some(function (d) {
        return d && isSubjectLikeDepLabel(d.label) && d.dep && d.dep.id && tokenById.has(d.dep.id);
      });
      const hasIncomingVerbLink = (depByDep.get(dep.head.id) || []).some(function (d) {
        if (!d || !d.head || !d.head.id || !tokenById.has(d.head.id)) {
          return false;
        }
        const base = baseDepLabel(d.label);
        return (base === "dep" || base === "conj" || base === "xcomp" || base === "ccomp" || base === "advcl" || base === "relcl") &&
          isVerbLikeTag(getTag(tokenById.get(d.head.id)));
      });
      if (
        isCarrierRoleMappedFromDep(mappedRole, depBase) &&
        isDemotedVerbish(headTok) &&
        headSurfaceLower !== "is" &&
        headSurfaceLower !== "are" &&
        !hasSubjectLikeOutgoing &&
        hasIncomingVerbLink
      ) {
        continue;
      }
      if (
        mappedRole === "theme" &&
        (depBase === "obj" || depBase === "dobj") &&
        isDemotedVerbish(headTok) &&
        hasCopulaComplementShape
      ) {
        continue;
      }
      if (
        mappedRole === "theme" &&
        (depBase === "obj" || depBase === "dobj") &&
        getTag(headTok) === "VBN" &&
        hasPassiveSubject &&
        hasByAgentPobj &&
        hasXcompWithObject
      ) {
        continue;
      }

      let normalizedHead = isVerbLikeTag(getTag(headTok))
        ? resolvePredicateForRelation(dep.head.id)
        : resolvePredicate(dep.head.id);
      if (
        headSurfaceLower === "are" &&
        isCarrierRoleMappedFromDep(mappedRole, depBase) &&
        !hasSubjectLikeOutgoing &&
        hasIncomingVerbLink &&
        hasCopulaComplementShape &&
        hasCarrierModifierShape
      ) {
        const remappedCarrierHeadId = remapWeakAreCarrierHead(dep.head.id, depByDep, tokenById);
        if (remappedCarrierHeadId && tokenById.has(remappedCarrierHeadId)) {
          const remappedCarrierHeadTok = tokenById.get(remappedCarrierHeadId);
          normalizedHead = isVerbLikeTag(getTag(remappedCarrierHeadTok))
            ? resolvePredicateForRelation(remappedCarrierHeadId)
            : resolvePredicate(remappedCarrierHeadId);
        }
      }
      let argumentId = dep.dep.id;
      if (
        depBase === "compound" &&
        isConjDependentToken(dep.head.id, depByDep, tokenById) &&
        isNominalishToken(dep.head.id, depByDep, tokenById) &&
        isNominalishToken(dep.dep.id, depByDep, tokenById)
      ) {
        normalizedHead = dep.dep.id;
        argumentId = dep.head.id;
      }
      if (mappedRole === "modifier" && (depBase === "amod" || depBase === "compound" || depBase === "nummod")) {
        const normalizedHeadTok = tokenById.get(normalizedHead);
        if (
          normalizedHeadTok &&
          isAdpositionTag(getTag(normalizedHeadTok)) &&
          isNominalLikeTag(getTag(headTok))
        ) {
          normalizedHead = dep.head.id;
        }
      }
      addRelation(
        normalizedHead,
        argumentId,
        mappedRole,
        {
          pattern: "dep_label",
          dependency_label: dep.label,
          sentence_id: depTok.segment_id
        }
      );
    }
  }

  maybeAddCoordinationRolePropagation(addRelation, relations, dependencyObs, tokenById, resolvePredicateForRelation);
  maybeAddChunkFallbackRelations(relations, addRelation, chunks, chunkHeadByChunkId, tokenById, depByHead, depByDep);
  maybeAddTokenHeuristicRelations(addRelation, tokens);

  const bySentence = new Map();
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (!bySentence.has(tok.segment_id)) {
      bySentence.set(tok.segment_id, []);
    }
    bySentence.get(tok.segment_id).push(tok);
  }
  for (const list of bySentence.values()) {
    list.sort(function (a, b) {
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
  }
  const mdSeen = new Set();
  for (const entry of bySentence.entries()) {
    const sentenceId = entry[0];
    const sentenceTokens = entry[1];
    for (let i = 0; i < sentenceTokens.length; i += 1) {
      const mdTok = sentenceTokens[i];
      if (getTag(mdTok) !== "MD") {
        continue;
      }
      const mdKey = sentenceId + "|" + mdTok.id;
      if (mdSeen.has(mdKey)) {
        continue;
      }
      const windowTokens = getClauseWindowTokens(sentenceTokens, i);
      const chosen = chooseModalityPredicate(mdTok, windowTokens);
      if (!chosen) {
        continue;
      }
      const normalizedHead = isVerbLikeTag(getTag(chosen))
        ? resolvePredicateForRelation(chosen.id)
        : resolvePredicate(chosen.id);
      addRelation(
        normalizedHead,
        mdTok.id,
        "modality",
        {
          pattern: "modality_unified",
          md_token_id: mdTok.id,
          sentence_id: sentenceId,
          md_surface: lowerSurface(mdTok),
          chosen_predicate_token_id: chosen.id
        }
      );
      mdSeen.add(mdKey);
    }
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (dep.is_root || dep.label !== "prep" || !dep.dep || !dep.dep.id || !dep.head || !dep.head.id) {
      continue;
    }
    const prepTok = tokenById.get(dep.dep.id);
    if (!prepTok) {
      continue;
    }
    const pobjEdges = (depByHead.get(dep.dep.id) || []).filter(function (d) { return d && d.label === "pobj"; });
    const role = roleFromPrepSurface(prepTok.surface);
    if (!role) {
      continue;
    }
    for (let j = 0; j < pobjEdges.length; j += 1) {
      const pobj = pobjEdges[j];
      if (!pobj.dep || !pobj.dep.id) {
        continue;
      }
      const remappedHeadId = remapPrepContainerIfPronoun(dep.head.id, depByDep, tokenById);
      const remappedHeadTok = tokenById.get(remappedHeadId);
      addRelation(
        isVerbLikeTag(getTag(remappedHeadTok))
          ? resolvePredicateForRelation(remappedHeadId)
          : resolvePredicate(remappedHeadId),
        pobj.dep.id,
        role,
        {
          pattern: "prep+pobj",
          dependency_label: dep.label,
          prep_surface: String(prepTok.surface || "").toLowerCase(),
          prep_token_id: dep.dep.id,
          pobj_token_id: pobj.dep.id,
          sentence_id: prepTok.segment_id
        }
      );
    }
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (dep.is_root || dep.label !== "prep" || !dep.dep || !dep.dep.id || !dep.head || !dep.head.id) {
      continue;
    }
    const prepTok = tokenById.get(dep.dep.id);
    const containerTok = tokenById.get(dep.head.id);
    if (!prepTok || !containerTok) {
      continue;
    }
    if (lowerSurface(prepTok) !== "as") {
      continue;
    }
    const prevByIndex = bySentence.get(prepTok.segment_id) || [];
    const prevTok = prevByIndex.find(function (t) { return t.i === prepTok.i - 1; }) || null;
    if (!prevTok || lowerSurface(prevTok) !== "such") {
      continue;
    }

    const exemplarMembers = [];
    const seenMember = new Set();
    const pobjEdges = (depByHead.get(dep.dep.id) || []).filter(function (d) { return d && d.label === "pobj" && d.dep && d.dep.id; });
    for (let j = 0; j < pobjEdges.length; j += 1) {
      const memberTok = tokenById.get(pobjEdges[j].dep.id);
      if (!memberTok || seenMember.has(memberTok.id)) {
        continue;
      }
      seenMember.add(memberTok.id);
      exemplarMembers.push(memberTok);
    }
    if (exemplarMembers.length === 0) {
      continue;
    }

    const sentenceTokens = bySentence.get(prepTok.segment_id) || [];
    const first = exemplarMembers[0];
    for (let j = 0; j < sentenceTokens.length; j += 1) {
      const tok = sentenceTokens[j];
      if (tok.i <= first.i) {
        continue;
      }
      const tokSurface = String(tok && tok.surface ? tok.surface : "");
      if (tokSurface === "." || tokSurface === ";" || tokSurface === ":" || tokSurface === "!" || tokSurface === "?") {
        break;
      }
      const lower = lowerSurface(tok);
      if (lower === "and" || lower === "or" || lower === "as" || lower === "such" || lower === "well") {
        continue;
      }
      if (!isExemplarCandidateToken(tok)) {
        continue;
      }
      if (seenMember.has(tok.id)) {
        continue;
      }
      seenMember.add(tok.id);
      exemplarMembers.push(tok);
    }

    exemplarMembers.sort(function (a, b) {
      if (a.i !== b.i) {
        return a.i - b.i;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    const containerId = isVerbLikeTag(getTag(containerTok))
      ? resolvePredicateForRelation(dep.head.id)
      : dep.head.id;
    for (let j = 0; j < exemplarMembers.length; j += 1) {
      addRelation(
        containerId,
        exemplarMembers[j].id,
        "exemplifies",
        {
          pattern: "such_as_enumeration",
          dependency_label: dep.label,
          prep_surface: "as",
          prep_token_id: dep.dep.id,
          sentence_id: prepTok.segment_id
        }
      );
    }
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (dep.is_root || !dep.head || !dep.dep) {
      continue;
    }
    const depBase = baseDepLabel(dep.label);
    if (depBase === "xcomp" || depBase === "ccomp" || depBase === "advcl" || depBase === "relcl") {
      const headTok = tokenById.get(dep.head.id);
      const pred = isVerbLikeTag(getTag(headTok))
        ? resolvePredicateForRelation(dep.head.id)
        : resolvePredicate(dep.head.id);
      const argPred = resolvePredicate(dep.dep.id);
      const predTok = tokenById.get(pred);
      const argTok = tokenById.get(argPred);
      if (predTok && argTok) {
        addRelation(
          pred,
          argPred,
          "complement_clause",
          {
            pattern: "dep_label",
            dependency_label: dep.label,
            sentence_id: predTok.segment_id
          }
        );
        if (depBase === "xcomp") {
          addRelation(
            pred,
            argPred,
            "purpose",
            {
              pattern: "dep_label",
              dependency_label: dep.label,
              sentence_id: predTok.segment_id
            }
          );
        }
      }
    }
    if (depBase === "conj") {
      const headTok = tokenById.get(dep.head.id);
      const depTok = tokenById.get(dep.dep.id);
      const depCoord = depCoordinationEvidence(dep);
      const preserveNominalConjRawIds = Boolean(
        depCoord &&
        headTok &&
        depTok &&
        isNominalishToken(dep.head.id, depByDep, tokenById) &&
        isNominalishToken(dep.dep.id, depByDep, tokenById)
      );
      const nominalHeadId = preserveNominalConjRawIds
        ? resolveNominalTailId(dep.head.id, depByHead, tokenById)
        : null;
      const nominalDepId = preserveNominalConjRawIds
        ? resolveNominalTailId(dep.dep.id, depByHead, tokenById)
        : null;
      const pred = preserveNominalConjRawIds
        ? nominalHeadId
        : (isVerbLikeTag(getTag(headTok)) ? resolvePredicateForRelation(dep.head.id) : resolvePredicate(dep.head.id));
      const argPred = preserveNominalConjRawIds
        ? nominalDepId
        : resolvePredicate(dep.dep.id);
      const predTok = tokenById.get(pred);
      const argTok = tokenById.get(argPred);
      if (predTok && argTok) {
        let coordTokenId = depCoord && depCoord.coordinatorTokenId
          ? depCoord.coordinatorTokenId
          : findCcTokenIdForConj(dep.dep.id, depByHead, tokenById);
        if (!coordTokenId) {
          coordTokenId = findCcTokenIdForConj(dep.head.id, depByHead, tokenById);
        }
        const coordTok = coordTokenId && tokenById.has(coordTokenId) ? tokenById.get(coordTokenId) : null;
        const coordType = depCoord && depCoord.coordinationType
          ? depCoord.coordinationType
          : coordTypeFromSurface(coordTok ? lowerSurface(coordTok) : "");
        const coordGroupId = coordGroupIdFromMembers([pred, argPred]);
        addRelation(
          pred,
          argPred,
          "coordination",
          {
            pattern: "dep_label",
            dependency_label: dep.label,
            sentence_id: predTok.segment_id,
            coord_type: coordType,
            coord_token_id: coordTokenId,
            coord_group_id: coordGroupId
          }
        );
      }
    }
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (dep.is_root || !dep.dep || !dep.dep.id || !dep.head || !dep.head.id) {
      continue;
    }
    if (baseDepLabel(dep.label) !== "prep") {
      continue;
    }
    const compHeadTok = tokenById.get(dep.head.id);
    const prepTok = tokenById.get(dep.dep.id);
    if (!compHeadTok || !prepTok) {
      continue;
    }
    if (lowerSurface(prepTok) !== "than") {
      continue;
    }
    if (!isComparativeHeadToken(compHeadTok)) {
      continue;
    }
    const rhsEdges = (depByHead.get(dep.dep.id) || []).filter(function (d) {
      return d && baseDepLabel(d.label) === "pobj" && d.dep && d.dep.id && tokenById.has(d.dep.id);
    });
    for (let j = 0; j < rhsEdges.length; j += 1) {
      const rhs = rhsEdges[j];
      const lhsId = isVerbLikeTag(getTag(compHeadTok))
        ? resolvePredicateForRelation(dep.head.id)
        : resolvePredicate(dep.head.id);
      addRelation(
        lhsId,
        rhs.dep.id,
        compareRelationLabelFromSurface(lowerSurface(compHeadTok)),
        {
          pattern: "comparative",
          compare_surface: lowerSurface(compHeadTok),
          compare_token_id: compHeadTok.id,
          prep_surface: "than",
          prep_token_id: prepTok.id,
          rhs_token_id: rhs.dep.id,
          sentence_id: compHeadTok.segment_id
        }
      );
    }
  }

  for (let i = 0; i < comparativeObs.length; i += 1) {
    const cmp = comparativeObs[i];
    const headId = cmp && cmp.head && cmp.head.id ? cmp.head.id : null;
    const rhsId = cmp && cmp.rhs && cmp.rhs.id ? cmp.rhs.id : null;
    const markerId = cmp && cmp.marker && cmp.marker.id ? cmp.marker.id : null;
    if (!headId || !rhsId || !tokenById.has(headId) || !tokenById.has(rhsId)) {
      continue;
    }
    const headTok = tokenById.get(headId);
    const lhsId = isVerbLikeTag(getTag(headTok))
      ? resolvePredicateForRelation(headId)
      : resolvePredicate(headId);
    addRelation(
      lhsId,
      rhsId,
      normalizeCompareLabel(cmp.label, headTok),
      {
        pattern: "comparative_observation",
        source_annotation_id: cmp.id,
        compare_surface: lowerSurface(headTok),
        compare_token_id: headId,
        prep_surface: markerId && tokenById.has(markerId) ? lowerSurface(tokenById.get(markerId)) : null,
        prep_token_id: markerId,
        rhs_token_id: rhsId,
        sentence_id: headTok.segment_id
      }
    );
  }

  for (let i = 0; i < quantifierScopeObs.length; i += 1) {
    const q = quantifierScopeObs[i];
    const markerId = q && q.marker && q.marker.id ? q.marker.id : null;
    const targetId = q && q.target && q.target.id ? q.target.id : null;
    if (!markerId || !targetId || !tokenById.has(markerId) || !tokenById.has(targetId)) {
      continue;
    }
    const targetTok = tokenById.get(targetId);
    const targetPred = isVerbLikeTag(getTag(targetTok))
      ? resolvePredicateForRelation(targetId)
      : resolvePredicate(targetId);
    const markerTok = tokenById.get(markerId);
    addRelation(
      targetPred,
      markerId,
      quantifierRoleFromObservation(q),
      {
        pattern: "quantifier_scope_observation",
        source_annotation_id: q.id,
        category: q.category || null,
        label: q.label || null,
        marker_surface: lowerSurface(markerTok),
        marker_token_id: markerId,
        target_token_id: targetId,
        sentence_id: targetTok.segment_id
      }
    );
  }

  relations.sort(function (a, b) {
    if (a.sentenceId !== b.sentenceId) {
      return a.sentenceId.localeCompare(b.sentenceId);
    }
    const ap = tokenById.get(a.predicateId);
    const bp = tokenById.get(b.predicateId);
    const aa = tokenById.get(a.argumentId);
    const ba = tokenById.get(b.argumentId);
    if (ap.span.start !== bp.span.start) {
      return ap.span.start - bp.span.start;
    }
    if (aa.span.start !== ba.span.start) {
      return aa.span.start - ba.span.start;
    }
    if (a.role !== b.role) {
      return a.role.localeCompare(b.role);
    }
    return a.predicateId.localeCompare(b.predicateId) || a.argumentId.localeCompare(b.argumentId);
  });

  const relationAnnotations = relations.map(function (rel) {
    return makeRelationAnnotation(out, rel, tokenById, unit);
  });

  out.annotations = annotations.concat(relationAnnotations);
  out.stage = "relations_extracted";
  return out;
}

module.exports = {
  runStage
};
