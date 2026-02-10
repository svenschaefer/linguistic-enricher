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

function isVerbLikeTag(tag) {
  return tag === "VB" || tag === "VBD" || tag === "VBG" || tag === "VBN" || tag === "VBP" || tag === "VBZ" || tag === "MD";
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
  if ((base === "aux" || base === "auxpass") && depTokenTag === "MD") {
    return "modality";
  }
  if (base === "advmod" || base === "npadvmod") {
    return "modifier";
  }
  return null;
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

function maybeAddChunkFallbackRelations(relations, addRelation, chunks, chunkHeadByChunkId, tokenById, depByHead) {
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
    const hasCoreSubject = predDeps.some(function (d) { return d && baseDepLabel(d.label) === "nsubj"; });
    const hasCoreObject = predDeps.some(function (d) {
      const label = d ? baseDepLabel(d.label) : "";
      return label === "obj" || label === "dobj" || label === "iobj";
    });
    const sentenceId = predTok.segment_id;

    const prevNP = nearestPrevNP(i);
    if (prevNP && !hasCoreSubject) {
      const arg = chunkHeadByChunkId.get(prevNP.id);
      addRelation(predicateId, arg, "actor", {
        pattern: "chunk_fallback",
        dependency_label: null,
        sentence_id: sentenceId
      });
    }

    const nextNP = nearestNextNP(i);
    if (nextNP && !hasCoreObject) {
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
    if (internalThemeToken && !hasCoreObject && !nextNP) {
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

    if (chunkLower.indexOf(" to ") !== -1 || chunkLower.startsWith("to ")) {
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

    if (getTag(predTok) === "MD") {
      const nextVP = nearestNextVP(i);
      if (nextVP) {
        const nextPred = chunkHeadByChunkId.get(nextVP.id);
        addRelation(nextPred, predicateId, "modality", {
          pattern: "chunk_fallback",
          dependency_label: "aux",
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
    addRelation(leftPred, rightPred, "coordination", {
      pattern: "chunk_fallback",
      dependency_label: "conj",
      sentence_id: tokenById.get(leftPred).segment_id
    });
  }

  void relations;
}

function maybeAddTokenHeuristicRelations(addRelation, tokens, depByHead, tokenById) {
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
    for (let i = 0; i < sentenceTokens.length; i += 1) {
      const token = sentenceTokens[i];
      const tag = getTag(token);
      if (tag === "MD") {
        const parent = (depByHead.get(token.id) || [])[0];
        if (parent && parent.head && parent.head.id) {
          addRelation(parent.head.id, token.id, "modality", {
            pattern: "token_heuristic",
            dependency_label: parent.label || "dep",
            sentence_id: token.segment_id
          });
        }
      }
    }

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

  void tokenById;
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

  for (let i = 0; i < annotations.length; i += 1) {
    if (isExistingStage11Relation(annotations[i])) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 11 rejects partially relation-extracted documents with existing accepted relation-extraction annotations."
      );
    }
  }

  const dependencyObs = annotations.filter(function (a) {
    return a && a.kind === "dependency" && a.status === "observation";
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

  const relations = [];
  const seen = new Set();

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
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    relations.push({
      sentenceId: p.segment_id,
      predicateId: predicateId,
      argumentId: argumentId,
      role: role,
      evidence: evidence
    });
  }

  for (let i = 0; i < dependencyObs.length; i += 1) {
    const dep = dependencyObs[i];
    if (dep.is_root || !dep.head || !dep.head.id || !dep.dep || !dep.dep.id) {
      continue;
    }
    const depTok = tokenById.get(dep.dep.id);
      const headTok = tokenById.get(dep.head.id);
      const mappedRole = roleFromDepLabel(dep.label, getTag(depTok), getTag(headTok));
    if (mappedRole) {
      addRelation(
        resolvePredicate(dep.head.id),
        dep.dep.id,
        mappedRole,
        {
          pattern: "dep_label",
          dependency_label: dep.label,
          sentence_id: depTok.segment_id
        }
      );
    }
  }

  maybeAddChunkFallbackRelations(relations, addRelation, chunks, chunkHeadByChunkId, tokenById, depByHead);
  maybeAddTokenHeuristicRelations(addRelation, tokens, depByHead, tokenById);

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
      addRelation(
        resolvePredicate(dep.head.id),
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
    if (dep.is_root || !dep.head || !dep.dep) {
      continue;
    }
    const depBase = baseDepLabel(dep.label);
    if (depBase === "xcomp" || depBase === "ccomp" || depBase === "advcl" || depBase === "relcl") {
      const pred = resolvePredicate(dep.head.id);
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
      const pred = resolvePredicate(dep.head.id);
      const argPred = resolvePredicate(dep.dep.id);
      const predTok = tokenById.get(pred);
      const argTok = tokenById.get(argPred);
      if (predTok && argTok) {
        addRelation(
          pred,
          argPred,
          "coordination",
          {
            pattern: "dep_label",
            dependency_label: dep.label,
            sentence_id: predTok.segment_id
          }
        );
      }
    }
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
