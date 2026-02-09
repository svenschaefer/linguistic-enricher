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

function isVerbish(tag) {
  return /^(VB|VBD|VBG|VBN|VBP|VBZ|MD)$/.test(String(tag || ""));
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

function roleFromDepLabel(depLabel, depTokenTag) {
  if (depLabel === "nsubj") {
    return "actor";
  }
  if (depLabel === "nsubjpass") {
    return "patient";
  }
  if (depLabel === "dobj" || depLabel === "obj" || depLabel === "attr" || depLabel === "acomp") {
    return "theme";
  }
  if (depLabel === "iobj") {
    return "recipient";
  }
  if (depLabel === "aux" && depTokenTag === "MD") {
    return "modality";
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
  if (prep === "with") {
    return "instrument";
  }
  if (prep === "by") {
    return "agent";
  }
  return null;
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
    const mappedRole = roleFromDepLabel(dep.label, getTag(depTok));
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
    if (dep.label === "xcomp" || dep.label === "ccomp" || dep.label === "advcl" || dep.label === "relcl") {
      const pred = resolvePredicate(dep.head.id);
      const argPred = resolvePredicate(dep.dep.id);
      const predTok = tokenById.get(pred);
      const argTok = tokenById.get(argPred);
      if (predTok && argTok && isVerbish(getTag(predTok)) && isVerbish(getTag(argTok))) {
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
      }
    }
    if (dep.label === "conj") {
      const pred = resolvePredicate(dep.head.id);
      const argPred = resolvePredicate(dep.dep.id);
      const predTok = tokenById.get(pred);
      const argTok = tokenById.get(argPred);
      if (predTok && argTok && isVerbish(getTag(predTok)) && isVerbish(getTag(argTok))) {
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
