"use strict";

const { deepClone } = require("../../util/deep-clone");
const errors = require("../../util/errors");

function spanTextFromCanonical(canonicalText, span, unit) {
  const text = String(canonicalText || "");
  if (unit === "utf16_code_units") {
    return text.slice(span.start, span.end);
  }
  if (unit === "unicode_codepoints") {
    return Array.from(text).slice(span.start, span.end).join("");
  }
  if (unit === "bytes_utf8") {
    const bytes = Buffer.from(text, "utf8");
    return bytes.slice(span.start, span.end).toString("utf8");
  }
  throw errors.createError(
    errors.ERROR_CODES.E_INVARIANT_VIOLATION,
    "Stage 07 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function getSelector(annotation, type) {
  if (!annotation || !annotation.anchor || !Array.isArray(annotation.anchor.selectors)) {
    return null;
  }
  return annotation.anchor.selectors.find(function (s) { return s && s.type === type; }) || null;
}

function upsertSelector(annotation, selector) {
  annotation.anchor = annotation.anchor && Array.isArray(annotation.anchor.selectors)
    ? annotation.anchor
    : { selectors: [] };
  const idx = annotation.anchor.selectors.findIndex(function (s) { return s && s.type === selector.type; });
  if (idx >= 0) {
    annotation.anchor.selectors[idx] = selector;
  } else {
    annotation.anchor.selectors.push(selector);
  }
}

function upsertMaterializationSource(annotation, headTokenId) {
  const next = Array.isArray(annotation.sources) ? annotation.sources.slice() : [];
  const payload = {
    name: "mwe-materialization",
    kind: "rule",
    evidence: {
      rule: "candidate_merge",
      head_token_id: headTokenId || null
    }
  };

  const idx = next.findIndex(function (s) {
    return s && s.name === "mwe-materialization" && s.kind === "rule";
  });
  if (idx >= 0) {
    next[idx] = payload;
  } else {
    next.push(payload);
  }
  annotation.sources = next;
}

/**
 * Stage 07: mwe materialization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const tokenById = new Map((Array.isArray(out.tokens) ? out.tokens : []).map(function (t) { return [t.id, t]; }));
  const unit = out.index_basis && out.index_basis.unit ? out.index_basis.unit : "utf16_code_units";
  const seenTokenKeys = new Set();

  for (let i = 0; i < annotations.length; i += 1) {
    const ann = annotations[i];
    if (ann.kind !== "mwe" || ann.status !== "candidate") {
      continue;
    }

    const tokenSelector = getSelector(ann, "TokenSelector");

    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 07 candidate missing TokenSelector.",
        { annotation_id: ann.id || null }
      );
    }

    const tokens = tokenSelector.token_ids.map(function (id) { return tokenById.get(id); }).filter(Boolean);
    if (tokens.length !== tokenSelector.token_ids.length) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 07 candidate references unknown token id.",
        { annotation_id: ann.id || null }
      );
    }

    tokens.sort(function (a, b) { return a.i - b.i; });
    for (let j = 1; j < tokens.length; j += 1) {
      if (tokens[j].segment_id !== tokens[0].segment_id || tokens[j].i !== tokens[j - 1].i + 1) {
        throw errors.createError(
          errors.ERROR_CODES.E_INVARIANT_VIOLATION,
          "Stage 07 candidate tokens must be contiguous within one segment.",
          { annotation_id: ann.id || null }
        );
      }
    }

    const key = tokens.map(function (t) { return t.id; }).join("|");
    if (seenTokenKeys.has(key)) {
      ann.status = "observation";
      continue;
    }
    seenTokenKeys.add(key);

    const start = tokens[0].span.start;
    const end = tokens[tokens.length - 1].span.end;
    const span = { start: start, end: end };
    const exact = spanTextFromCanonical(out.canonical_text, span, unit);
    const headTokenId = tokens[tokens.length - 1].id;
    ann.status = "accepted";

    upsertSelector(ann, { type: "TextPositionSelector", span: span });
    upsertSelector(ann, { type: "TextQuoteSelector", exact: exact });
    upsertMaterializationSource(ann, headTokenId);
  }

  out.annotations = annotations;
  out.stage = "mwe_materialized";
  return out;
}

module.exports = {
  runStage
};
