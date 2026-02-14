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
  return tag === "NN" || tag === "NNS" || tag === "NNP" || tag === "NNPS" || tag === "PRP" || tag === "PRP$";
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

function isCardinalTag(tag) {
  return tag === "CD";
}

function isClauseBoundaryToken(token) {
  if (!token) {
    return false;
  }
  if (isPunct(token)) {
    return true;
  }
  return coordinationTypeFromSurface(token.surface) !== null;
}

function coordinationTypeFromSurface(surface) {
  const lower = String(surface || "").toLowerCase();
  if (lower === "and" || lower === "or") {
    return lower;
  }
  return null;
}

function isComparativeHeadTag(tag) {
  return tag === "JJR" || tag === "RBR";
}

function comparativeLabelFromSurface(surface) {
  const lower = String(surface || "").toLowerCase();
  if (lower === "greater" || lower === "more") {
    return "compare_gt";
  }
  if (lower === "less" || lower === "fewer") {
    return "compare_lt";
  }
  return "compare";
}

function isComparativeHeadToken(token) {
  const tag = getTag(token);
  if (isComparativeHeadTag(tag)) {
    return true;
  }
  const lower = String(token && token.surface ? token.surface : "").toLowerCase();
  return lower === "greater" || lower === "more" || lower === "less" || lower === "fewer";
}

const BE_SURFACES = new Set(["be", "am", "is", "are", "was", "were", "been", "being"]);

function detectPassiveHeadIndex(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const tag = getTag(token);
    const lower = String(token && token.surface ? token.surface : "").toLowerCase();
    if (!/^VB/.test(tag) || !BE_SURFACES.has(lower)) {
      continue;
    }

    const participleIndex = nearestIndex(tokens, i + 1, 1, function (t) {
      const tTag = getTag(t);
      return /^VB/.test(tTag) && tTag === "VBN";
    });
    if (participleIndex < 0) {
      continue;
    }

    let blocked = false;
    for (let j = i + 1; j < participleIndex; j += 1) {
      const between = tokens[j];
      if (isPunct(between) || coordinationTypeFromSurface(between.surface)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      return participleIndex;
    }
  }
  return -1;
}

function detectRootIndex(tokens) {
  const passiveHeadIndex = detectPassiveHeadIndex(tokens);
  if (passiveHeadIndex >= 0) {
    return passiveHeadIndex;
  }
  for (let i = 0; i < tokens.length; i += 1) {
    if (isVerbLikeTag(getTag(tokens[i])) && String(tokens[i].surface || "").toLowerCase() !== "to") {
      return i;
    }
  }
  return 0;
}

function nearestIndex(tokens, from, step, predicate) {
  for (let i = from; i >= 0 && i < tokens.length; i += step) {
    if (predicate(tokens[i], i)) {
      return i;
    }
  }
  return -1;
}

function nearestCopulaIndexLeft(tokens, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (isClauseBoundaryToken(token)) {
      break;
    }
    const tag = getTag(token);
    if (!isVerbLikeTag(tag)) {
      continue;
    }
    const lower = String(token.surface || "").toLowerCase();
    if (BE_SURFACES.has(lower)) {
      return i;
    }
    break;
  }
  return -1;
}

function nearestPassiveParticipleRight(tokens, index) {
  for (let i = index + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (isClauseBoundaryToken(token)) {
      break;
    }
    const tag = getTag(token);
    if (tag === "VBN") {
      return i;
    }
    if (isVerbLikeTag(tag) && tag !== "VBN") {
      break;
    }
  }
  return -1;
}

function isNounLikeForAttachment(tokens, index) {
  if (index < 0 || index >= tokens.length) {
    return false;
  }
  const token = tokens[index];
  const tag = getTag(token);
  if (isNounLikeTag(tag)) {
    return true;
  }
  if (tag !== "VBG") {
    return false;
  }
  const prev = index > 0 ? tokens[index - 1] : null;
  if (!prev || !isAdpLikeTag(getTag(prev))) {
    return false;
  }
  return String(prev.surface || "").toLowerCase() === "for";
}

function isModifierLikeVbn(tokens, index) {
  if (index < 0 || index >= tokens.length) {
    return false;
  }
  const token = tokens[index];
  if (getTag(token) !== "VBN") {
    return false;
  }
  const prev = index > 0 ? tokens[index - 1] : null;
  const prevTag = getTag(prev);
  return isDetLikeTag(prevTag) || isAdjLikeTag(prevTag) || isAdpLikeTag(prevTag);
}

function isTemporalForPattern(tokens, prepIndex) {
  const next = prepIndex + 1 < tokens.length ? tokens[prepIndex + 1] : null;
  const nextNext = prepIndex + 2 < tokens.length ? tokens[prepIndex + 2] : null;
  if (!next || !nextNext) {
    return false;
  }
  if (!isCardinalTag(getTag(next))) {
    return false;
  }
  return isNounLikeTag(getTag(nextNext));
}

function nearestPrepInNominalSpanLeft(tokens, nounIndex) {
  for (let i = nounIndex - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    const tag = getTag(token);
    if (isClauseBoundaryToken(token)) {
      break;
    }
    if (isVerbLikeTag(tag)) {
      if (isModifierLikeVbn(tokens, i)) {
        continue;
      }
      break;
    }
    if (isAdpLikeTag(tag)) {
      return i;
    }
  }
  return -1;
}

function nearestVerbForObjectAttachmentLeft(tokens, nounIndex) {
  for (let i = nounIndex - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    const tag = getTag(token);
    if (isClauseBoundaryToken(token)) {
      break;
    }
    if (isAdpLikeTag(tag)) {
      return -1;
    }
    if (isVerbLikeTag(tag)) {
      if (isModifierLikeVbn(tokens, i)) {
        continue;
      }
      return i;
    }
  }
  return -1;
}

function subjectModalVerbAttachmentRight(tokens, nounIndex) {
  const modalIndex = nounIndex + 1;
  if (modalIndex >= tokens.length) {
    return null;
  }
  const modalTok = tokens[modalIndex];
  if (isClauseBoundaryToken(modalTok) || getTag(modalTok) !== "MD") {
    return null;
  }
  const verbIndex = nearestIndex(tokens, modalIndex + 1, 1, function (t) {
    if (isClauseBoundaryToken(t)) {
      return false;
    }
    return isVerbLikeTag(getTag(t));
  });
  if (verbIndex < 0) {
    return null;
  }
  const verbTok = tokens[verbIndex];
  const verbLower = String(verbTok.surface || "").toLowerCase();
  if (BE_SURFACES.has(verbLower)) {
    const passiveParticipleIndex = nearestPassiveParticipleRight(tokens, verbIndex);
    if (passiveParticipleIndex >= 0) {
      return { headIndex: passiveParticipleIndex, label: "nsubjpass" };
    }
  }
  return { headIndex: verbIndex, label: "nsubj" };
}

function nearestVerbForCommaConjLeft(tokens, fromIndex) {
  let fallbackVerbIndex = -1;
  for (let i = fromIndex - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (isPunct(token)) {
      if (String(token.surface || "") === ",") {
        continue;
      }
      break;
    }
    if (coordinationTypeFromSurface(token.surface)) {
      break;
    }
    const tag = getTag(token);
    if (!isVerbLikeTag(tag)) {
      continue;
    }
    if (fallbackVerbIndex < 0) {
      fallbackVerbIndex = i;
    }
    if (tag !== "VBN") {
      return i;
    }
  }
  return fallbackVerbIndex;
}

function findCoordinatorTokenIdToRight(tokens, fromIndex) {
  for (let i = fromIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (isPunct(token)) {
      continue;
    }
    const coordType = coordinationTypeFromSurface(token.surface);
    if (coordType) {
      return token.id;
    }
    const tag = getTag(token);
    if (isVerbLikeTag(tag)) {
      break;
    }
  }
  return null;
}

function nearestNounRightBeforeIndex(tokens, fromIndex, stopExclusive) {
  for (let i = fromIndex + 1; i < tokens.length && i < stopExclusive; i += 1) {
    const token = tokens[i];
    if (isClauseBoundaryToken(token)) {
      break;
    }
    if (isNounLikeTag(getTag(token))) {
      return i;
    }
  }
  return -1;
}

function isSuchAsExemplarContext(tokens, index) {
  for (let i = index - 1; i >= 1; i -= 1) {
    const token = tokens[i];
    if (isPunct(token)) {
      continue;
    }
    if (coordinationTypeFromSurface(token.surface)) {
      break;
    }
    if (String(token.surface || "").toLowerCase() !== "as") {
      continue;
    }
    const prev = tokens[i - 1];
      if (prev && String(prev.surface || "").toLowerCase() === "such") {
        return true;
      }
  }
  return false;
}

function buildAsWellAsHints(tokens) {
  const fixedByIndex = new Map();
  const conjByRightIndex = new Map();
  for (let i = 0; i + 2 < tokens.length; i += 1) {
    const first = String(tokens[i].surface || "").toLowerCase();
    const middle = String(tokens[i + 1].surface || "").toLowerCase();
    const second = String(tokens[i + 2].surface || "").toLowerCase();
    if (first !== "as" || middle !== "well" || second !== "as") {
      continue;
    }
    const leftNounIndex = nearestIndex(tokens, i - 1, -1, function (t) {
      return isNounLikeTag(getTag(t));
    });
    const rightNounIndex = nearestIndex(tokens, i + 3, 1, function (t) {
      if (isClauseBoundaryToken(t)) {
        return false;
      }
      return isNounLikeTag(getTag(t));
    });
    if (leftNounIndex < 0 || rightNounIndex < 0) {
      continue;
    }
    const rightHeadId = tokens[rightNounIndex].id;
    fixedByIndex.set(i, { headId: rightHeadId });
    fixedByIndex.set(i + 1, { headId: tokens[i + 2].id });
    fixedByIndex.set(i + 2, { headId: rightHeadId });
    conjByRightIndex.set(rightNounIndex, {
      headId: tokens[leftNounIndex].id,
      coordinatorTokenId: tokens[i + 2].id,
      coordinationType: "and"
    });
  }
  return {
    fixedByIndex: fixedByIndex,
    conjByRightIndex: conjByRightIndex
  };
}

function buildSentenceDependencies(sentenceTokens) {
  const rootIndex = detectRootIndex(sentenceTokens);
  const passiveHeadIndex = detectPassiveHeadIndex(sentenceTokens);
  const rootToken = sentenceTokens[rootIndex];
  const asWellAsHints = buildAsWellAsHints(sentenceTokens);
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

    const fixedHint = asWellAsHints.fixedByIndex.get(i);
    if (fixedHint) {
      edges.push({
        depId: token.id,
        headId: fixedHint.headId,
        label: "fixed",
        isRoot: false
      });
      continue;
    }

    const asWellAsConj = asWellAsHints.conjByRightIndex.get(i);
    if (asWellAsConj) {
      edges.push({
        depId: token.id,
        headId: asWellAsConj.headId,
        label: "conj",
        isRoot: false,
        coordinationType: asWellAsConj.coordinationType,
        coordinatorTokenId: asWellAsConj.coordinatorTokenId
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
      const copulaHeadIndex = nearestCopulaIndexLeft(sentenceTokens, i);
      if (copulaHeadIndex >= 0) {
        edges.push({
          depId: token.id,
          headId: sentenceTokens[copulaHeadIndex].id,
          label: "acomp",
          isRoot: false
        });
        continue;
      }
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
      let headId = prevVerb >= 0 ? sentenceTokens[prevVerb].id : rootToken.id;
      if (prevVerb >= 0) {
        const prevVerbLower = String(sentenceTokens[prevVerb].surface || "").toLowerCase();
        if (BE_SURFACES.has(prevVerbLower)) {
          const participleIndex = nearestPassiveParticipleRight(sentenceTokens, i);
          if (participleIndex >= 0) {
            headId = sentenceTokens[participleIndex].id;
          }
        }
      }
      edges.push({
        depId: token.id,
        headId: headId,
        label: "advmod",
        isRoot: false
      });
      continue;
    }

    if (isAdpLikeTag(tag)) {
      const temporalFor = lower === "for" && isTemporalForPattern(sentenceTokens, i);
      const prevContent = temporalFor
        ? nearestIndex(sentenceTokens, i - 1, -1, function (t) {
            return isVerbLikeTag(getTag(t));
          })
        : nearestIndex(sentenceTokens, i - 1, -1, function (t) {
            const tTag = getTag(t);
            return isVerbLikeTag(tTag) || isNounLikeTag(tTag);
          });
      const fallbackContent = nearestIndex(sentenceTokens, i - 1, -1, function (t) {
        const tTag = getTag(t);
        return isVerbLikeTag(tTag) || isNounLikeTag(tTag);
      });
      edges.push({
        depId: token.id,
        headId: prevContent >= 0
          ? sentenceTokens[prevContent].id
          : (fallbackContent >= 0 ? sentenceTokens[fallbackContent].id : rootToken.id),
        label: "prep",
        isRoot: false
      });
      continue;
    }

    if (isCardinalTag(tag)) {
      const nextNoun = nearestIndex(sentenceTokens, i + 1, 1, function (t) {
        return isNounLikeTag(getTag(t));
      });
      if (nextNoun >= 0) {
        edges.push({
          depId: token.id,
          headId: sentenceTokens[nextNoun].id,
          label: "nummod",
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

    if (isVerbLikeTag(tag)) {
      if (tag === "VBG" && prev && isAdpLikeTag(getTag(prev)) && String(prev.surface || "").toLowerCase() === "for") {
        edges.push({
          depId: token.id,
          headId: prev.id,
          label: "pobj",
          isRoot: false
        });
        continue;
      }
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
      const coordType = coordinationTypeFromSurface(prev ? prev.surface : "");
      if (prev && coordType) {
        const prevVerb = nearestIndex(sentenceTokens, i - 1, -1, function (t) { return isVerbLikeTag(getTag(t)); });
        edges.push({
          depId: token.id,
          headId: prevVerb >= 0 ? sentenceTokens[prevVerb].id : rootToken.id,
          label: "conj",
          isRoot: false,
          coordinationType: coordType,
          coordinatorTokenId: prev.id
        });
        continue;
      }
      if (prev && isPunct(prev) && String(prev.surface || "") === ",") {
        const prevVerbIndex = nearestVerbForCommaConjLeft(sentenceTokens, i);
        if (prevVerbIndex >= 0 && !isSuchAsExemplarContext(sentenceTokens, i)) {
          const coordinatorTokenId = findCoordinatorTokenIdToRight(sentenceTokens, i);
          const coordinatorToken = coordinatorTokenId
            ? sentenceTokens.find(function (t) { return t.id === coordinatorTokenId; })
            : null;
          edges.push({
            depId: token.id,
            headId: sentenceTokens[prevVerbIndex].id,
            label: "conj",
            isRoot: false,
            coordinationType: coordinatorToken ? coordinationTypeFromSurface(coordinatorToken.surface) : null,
            coordinatorTokenId: coordinatorTokenId
          });
          continue;
        }
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
      const coordType = coordinationTypeFromSurface(prev ? prev.surface : "");
      if (prev && coordType) {
        const prevNoun = nearestIndex(sentenceTokens, i - 1, -1, function (_, idx) {
          return isNounLikeForAttachment(sentenceTokens, idx);
        });
        edges.push({
          depId: token.id,
          headId: prevNoun >= 0 ? sentenceTokens[prevNoun].id : rootToken.id,
          label: "conj",
          isRoot: false,
          coordinationType: coordType,
          coordinatorTokenId: prev.id
        });
        continue;
      }
      if (prev && isAdpLikeTag(getTag(prev))) {
        edges.push({
          depId: token.id,
          headId: prev.id,
          label: "pobj",
          isRoot: false
        });
        continue;
      }
      const prevPrev = i > 1 ? sentenceTokens[i - 2] : null;
      if (prev && isCardinalTag(getTag(prev)) && prevPrev && isAdpLikeTag(getTag(prevPrev))) {
        edges.push({
          depId: token.id,
          headId: prevPrev.id,
          label: "pobj",
          isRoot: false
        });
        continue;
      }
      const modalVerbAttachment = subjectModalVerbAttachmentRight(sentenceTokens, i);
      if (modalVerbAttachment && modalVerbAttachment.headIndex >= 0) {
        edges.push({
          depId: token.id,
          headId: sentenceTokens[modalVerbAttachment.headIndex].id,
          label: modalVerbAttachment.label,
          isRoot: false
        });
        continue;
      }
      const prepSpanIndex = nearestPrepInNominalSpanLeft(sentenceTokens, i);
      if (prepSpanIndex >= 0) {
        edges.push({
          depId: token.id,
          headId: sentenceTokens[prepSpanIndex].id,
          label: "pobj",
          isRoot: false
        });
        continue;
      }
      if (passiveHeadIndex >= 0 && i < passiveHeadIndex) {
        const nextPassiveNoun = nearestNounRightBeforeIndex(sentenceTokens, i, passiveHeadIndex);
        if (nextPassiveNoun >= 0) {
          edges.push({
            depId: token.id,
            headId: sentenceTokens[nextPassiveNoun].id,
            label: "compound",
            isRoot: false
          });
          continue;
        }
      }
      if (prev && isNounLikeForAttachment(sentenceTokens, i - 1) && !(passiveHeadIndex >= 0 && i < passiveHeadIndex)) {
        edges.push({
          depId: token.id,
          headId: prev.id,
          label: "compound",
          isRoot: false
        });
        continue;
      }
      const copulaHeadIndex = nearestCopulaIndexLeft(sentenceTokens, i);
      if (copulaHeadIndex >= 0) {
        edges.push({
          depId: token.id,
          headId: sentenceTokens[copulaHeadIndex].id,
          label: "attr",
          isRoot: false
        });
        continue;
      }
      const objectVerbIndex = i > rootIndex
        ? nearestVerbForObjectAttachmentLeft(sentenceTokens, i)
        : -1;
      edges.push({
        depId: token.id,
        headId: objectVerbIndex >= 0
          ? sentenceTokens[objectVerbIndex].id
          : (passiveHeadIndex >= 0 && i < passiveHeadIndex
          ? sentenceTokens[passiveHeadIndex].id
          : rootToken.id),
        label: objectVerbIndex >= 0
          ? "obj"
          : (passiveHeadIndex >= 0 && i < passiveHeadIndex
          ? "nsubjpass"
          : (i < rootIndex ? "nsubj" : "obj")),
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
        isRoot: false,
        coordinationType: lower,
        coordinatorTokenId: token.id
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

function collectComparativeObservations(sentenceTokens, canonicalText, unit) {
  const observations = [];
  const seen = new Set();

  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const marker = sentenceTokens[i];
    if (String(marker.surface || "").toLowerCase() !== "than") {
      continue;
    }

    const headIndex = nearestIndex(sentenceTokens, i - 1, -1, function (t) {
      return isComparativeHeadToken(t);
    });
    if (headIndex < 0) {
      continue;
    }

    const rhsIndex = nearestIndex(sentenceTokens, i + 1, 1, function (t) {
      const tag = getTag(t);
      return tag === "CD" || isNounLikeTag(tag);
    });
    if (rhsIndex < 0) {
      continue;
    }

    const head = sentenceTokens[headIndex];
    const rhs = sentenceTokens[rhsIndex];
    const key = [head.id, marker.id, rhs.id].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const span = {
      start: head.span.start,
      end: rhs.span.end
    };
    const exact = spanTextFromCanonical(canonicalText, span, unit);
    const label = comparativeLabelFromSurface(head.surface);
    const source = annotationSource();
    source[0].evidence = {
      framework: "heuristic",
      pattern: "comparative_than",
      marker_surface: "than",
      marker_token_id: marker.id
    };

    observations.push({
      id: createDeterministicId("cmp", { head: head.id, marker: marker.id, rhs: rhs.id, label: label }),
      kind: "comparative",
      status: "observation",
      label: label,
      head: { id: head.id },
      rhs: { id: rhs.id },
      marker: { id: marker.id },
      anchor: {
        selectors: [
          { type: "TextQuoteSelector", exact: exact },
          { type: "TextPositionSelector", span: span },
          { type: "TokenSelector", token_ids: [head.id, marker.id, rhs.id] }
        ]
      },
      sources: source
    });
  }

  return observations;
}

const QUANTIFIER_SURFACES = new Set(["each", "every", "all", "some", "no"]);
const SCOPE_SURFACES = new Set(["only"]);

function quantifierScopeSpecForSurface(surface) {
  const lower = String(surface || "").toLowerCase();
  if (QUANTIFIER_SURFACES.has(lower)) {
    return {
      category: "quantifier",
      label: "quantifier_" + lower
    };
  }
  if (SCOPE_SURFACES.has(lower)) {
    return {
      category: "scope",
      label: "scope_" + lower
    };
  }
  return null;
}

function collectQuantifierScopeObservations(sentenceTokens, canonicalText, unit) {
  const observations = [];
  const seen = new Set();
  const attachmentRule = "nearest_noun_right_else_left";

  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const marker = sentenceTokens[i];
    const spec = quantifierScopeSpecForSurface(marker.surface);
    if (!spec) {
      continue;
    }

    const rightTargetIndex = nearestIndex(sentenceTokens, i + 1, 1, function (t) {
      return isNounLikeTag(getTag(t));
    });
    const leftTargetIndex = nearestIndex(sentenceTokens, i - 1, -1, function (t) {
      return isNounLikeTag(getTag(t));
    });
    const targetIndex = rightTargetIndex >= 0 ? rightTargetIndex : leftTargetIndex;
    if (targetIndex < 0) {
      continue;
    }

    const target = sentenceTokens[targetIndex];
    const key = [spec.category, marker.id, target.id].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const span = {
      start: marker.span.start < target.span.start ? marker.span.start : target.span.start,
      end: marker.span.end > target.span.end ? marker.span.end : target.span.end
    };
    const exact = spanTextFromCanonical(canonicalText, span, unit);
    const source = annotationSource();
    source[0].evidence = {
      framework: "heuristic",
      marker_surface: String(marker.surface || "").toLowerCase(),
      marker_token_id: marker.id,
      attachment_rule: attachmentRule
    };

    observations.push({
      id: createDeterministicId("qscope", {
        category: spec.category,
        marker: marker.id,
        target: target.id,
        label: spec.label
      }),
      kind: "quantifier_scope",
      status: "observation",
      category: spec.category,
      label: spec.label,
      marker: { id: marker.id },
      target: { id: target.id },
      anchor: {
        selectors: [
          { type: "TextQuoteSelector", exact: exact },
          { type: "TextPositionSelector", span: span },
          { type: "TokenSelector", token_ids: [marker.id, target.id] }
        ]
      },
      sources: source
    });
  }

  return observations;
}

const COPULA_SURFACES = new Set(["be", "am", "is", "are", "was", "were", "been", "being"]);

function copulaComplementKind(token) {
  const tag = getTag(token);
  if (isNounLikeTag(tag)) {
    return "nominal";
  }
  if (isAdjLikeTag(tag)) {
    return "adjectival";
  }
  if (isVerbLikeTag(tag)) {
    return "clausal";
  }
  return "other";
}

function collectCopulaFrames(sentenceTokens, canonicalText, unit) {
  const observations = [];
  const seen = new Set();
  const attachmentRule = "nearest_subject_left_nearest_complement_right";

  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const copula = sentenceTokens[i];
    const tag = getTag(copula);
    const lower = String(copula.surface || "").toLowerCase();
    if (!/^VB/.test(tag) || !COPULA_SURFACES.has(lower)) {
      continue;
    }

    const subjectIndex = nearestIndex(sentenceTokens, i - 1, -1, function (t) {
      const tTag = getTag(t);
      return isNounLikeTag(tTag) || tTag === "PRP";
    });
    if (subjectIndex < 0) {
      continue;
    }

    const complementIndex = nearestIndex(sentenceTokens, i + 1, 1, function (t) {
      const tTag = getTag(t);
      return isNounLikeTag(tTag) || isAdjLikeTag(tTag) || isVerbLikeTag(tTag);
    });
    if (complementIndex < 0) {
      continue;
    }

    const subject = sentenceTokens[subjectIndex];
    const complement = sentenceTokens[complementIndex];
    const key = [subject.id, copula.id, complement.id].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const span = {
      start: subject.span.start,
      end: complement.span.end
    };
    const exact = spanTextFromCanonical(canonicalText, span, unit);
    const complementKind = copulaComplementKind(complement);
    const source = annotationSource();
    source[0].evidence = {
      framework: "heuristic",
      pattern: "copula_subject_complement",
      copula_surface: lower,
      copula_token_id: copula.id,
      complement_kind: complementKind,
      attachment_rule: attachmentRule
    };

    observations.push({
      id: createDeterministicId("cop", {
        subject: subject.id,
        copula: copula.id,
        complement: complement.id
      }),
      kind: "copula_frame",
      status: "observation",
      label: "copula_" + complementKind,
      subject: { id: subject.id },
      copula: { id: copula.id },
      complement: { id: complement.id },
      anchor: {
        selectors: [
          { type: "TextQuoteSelector", exact: exact },
          { type: "TextPositionSelector", span: span },
          { type: "TokenSelector", token_ids: [subject.id, copula.id, complement.id] }
        ]
      },
      sources: source
    });
  }

  return observations;
}

const PP_MARKER_SURFACES = new Set([
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "of",
  "from",
  "into",
  "onto",
  "over",
  "under",
  "within",
  "without",
  "than"
]);

function isPpMarkerToken(token) {
  const tag = getTag(token);
  const lower = String(token && token.surface ? token.surface : "").toLowerCase();
  return tag === "IN" || tag === "TO" || PP_MARKER_SURFACES.has(lower);
}

function collectPpAttachments(sentenceTokens, canonicalText, unit) {
  const observations = [];
  const seen = new Set();
  const attachmentRule = "nearest_content_left_nearest_object_right";

  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const marker = sentenceTokens[i];
    if (!isPpMarkerToken(marker)) {
      continue;
    }

    const headIndex = nearestIndex(sentenceTokens, i - 1, -1, function (t) {
      const tag = getTag(t);
      return isVerbLikeTag(tag) || isNounLikeTag(tag) || isAdjLikeTag(tag) || isAdverbLikeTag(tag);
    });
    if (headIndex < 0) {
      continue;
    }

    const objectIndex = nearestIndex(sentenceTokens, i + 1, 1, function (t) {
      const tag = getTag(t);
      return isNounLikeTag(tag) || tag === "CD" || tag === "PRP";
    });
    if (objectIndex < 0) {
      continue;
    }

    const head = sentenceTokens[headIndex];
    const object = sentenceTokens[objectIndex];
    const prepSurface = String(marker.surface || "").toLowerCase();
    const key = [head.id, marker.id, object.id].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const span = {
      start: head.span.start < object.span.start ? head.span.start : object.span.start,
      end: head.span.end > object.span.end ? head.span.end : object.span.end
    };
    const exact = spanTextFromCanonical(canonicalText, span, unit);
    const source = annotationSource();
    source[0].evidence = {
      framework: "heuristic",
      pattern: "pp_head_object",
      prep_surface: prepSurface,
      marker_token_id: marker.id,
      attachment_rule: attachmentRule
    };

    observations.push({
      id: createDeterministicId("pp", { head: head.id, marker: marker.id, object: object.id, prep: prepSurface }),
      kind: "pp_attachment",
      status: "observation",
      label: "pp_" + prepSurface,
      prep_surface: prepSurface,
      head: { id: head.id },
      marker: { id: marker.id },
      object: { id: object.id },
      anchor: {
        selectors: [
          { type: "TextQuoteSelector", exact: exact },
          { type: "TextPositionSelector", span: span },
          { type: "TokenSelector", token_ids: [head.id, marker.id, object.id] }
        ]
      },
      sources: source
    });
  }

  return observations;
}

const NEGATION_SURFACES = new Set(["not", "n't", "never"]);

function isLexicalVerbToken(token) {
  const tag = getTag(token);
  return /^VB/.test(tag) && tag !== "MD";
}

function findOperatorTargetIndex(sentenceTokens, markerIndex) {
  const right = nearestIndex(sentenceTokens, markerIndex + 1, 1, function (t) {
    return isLexicalVerbToken(t);
  });
  if (right >= 0) {
    return right;
  }
  return nearestIndex(sentenceTokens, markerIndex - 1, -1, function (t) {
    return isLexicalVerbToken(t);
  });
}

function collectModalityAndNegationObservations(sentenceTokens, canonicalText, unit) {
  const observations = [];
  const seen = new Set();
  const attachmentRule = "nearest_lexical_verb_right_else_left";

  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const marker = sentenceTokens[i];
    const markerTag = getTag(marker);
    const markerSurface = String(marker.surface || "").toLowerCase();
    const isModality = markerTag === "MD";
    const isNegation = NEGATION_SURFACES.has(markerSurface);
    if (!isModality && !isNegation) {
      continue;
    }

    const targetIndex = findOperatorTargetIndex(sentenceTokens, i);
    if (targetIndex < 0) {
      continue;
    }
    const target = sentenceTokens[targetIndex];

    const kind = isModality ? "modality_scope" : "negation_scope";
    const label = isModality ? "modality_" + markerSurface : "negation_" + markerSurface;
    const pattern = isModality ? "modal_verb_scope" : "negation_scope";
    const key = [kind, marker.id, target.id].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const span = {
      start: marker.span.start < target.span.start ? marker.span.start : target.span.start,
      end: marker.span.end > target.span.end ? marker.span.end : target.span.end
    };
    const exact = spanTextFromCanonical(canonicalText, span, unit);
    const source = annotationSource();
    source[0].evidence = {
      framework: "heuristic",
      pattern: pattern,
      marker_surface: markerSurface,
      marker_token_id: marker.id,
      attachment_rule: attachmentRule
    };

    observations.push({
      id: createDeterministicId(isModality ? "mod" : "neg", {
        marker: marker.id,
        target: target.id,
        label: label
      }),
      kind: kind,
      status: "observation",
      label: label,
      marker: { id: marker.id },
      target: { id: target.id },
      anchor: {
        selectors: [
          { type: "TextQuoteSelector", exact: exact },
          { type: "TextPositionSelector", span: span },
          { type: "TokenSelector", token_ids: [marker.id, target.id] }
        ]
      },
      sources: source
    });
  }

  return observations;
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
    if (
      ann &&
      (
        ann.kind === "dependency" ||
        ann.kind === "lemma" ||
        ann.kind === "named_entity" ||
        ann.kind === "noun_phrase" ||
        ann.kind === "comparative" ||
        ann.kind === "quantifier_scope" ||
        ann.kind === "copula_frame" ||
        ann.kind === "pp_attachment" ||
        ann.kind === "modality_scope" ||
        ann.kind === "negation_scope"
      )
    ) {
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
      if (edge.coordinationType || edge.coordinatorTokenId) {
        dependencyAnnotation.sources[0].evidence = {
          framework: "heuristic",
          coordination_type: edge.coordinationType || null,
          coordinator_token_id: edge.coordinatorTokenId || null
        };
      }

      if (!edge.isRoot && edge.headId) {
        dependencyAnnotation.head = { id: edge.headId };
      }

      annotations.push(dependencyAnnotation);
    }
  }

  for (const sentenceTokens of tokensBySentence.values()) {
    const comparativeObservations = collectComparativeObservations(sentenceTokens, out.canonical_text, unit);
    for (let i = 0; i < comparativeObservations.length; i += 1) {
      annotations.push(comparativeObservations[i]);
    }
  }

  for (const sentenceTokens of tokensBySentence.values()) {
    const quantifierScopeObservations = collectQuantifierScopeObservations(sentenceTokens, out.canonical_text, unit);
    for (let i = 0; i < quantifierScopeObservations.length; i += 1) {
      annotations.push(quantifierScopeObservations[i]);
    }
  }

  for (const sentenceTokens of tokensBySentence.values()) {
    const copulaFrames = collectCopulaFrames(sentenceTokens, out.canonical_text, unit);
    for (let i = 0; i < copulaFrames.length; i += 1) {
      annotations.push(copulaFrames[i]);
    }
  }

  for (const sentenceTokens of tokensBySentence.values()) {
    const ppAttachments = collectPpAttachments(sentenceTokens, out.canonical_text, unit);
    for (let i = 0; i < ppAttachments.length; i += 1) {
      annotations.push(ppAttachments[i]);
    }
  }

  for (const sentenceTokens of tokensBySentence.values()) {
    const operatorScopeObservations = collectModalityAndNegationObservations(sentenceTokens, out.canonical_text, unit);
    for (let i = 0; i < operatorScopeObservations.length; i += 1) {
      annotations.push(operatorScopeObservations[i]);
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
