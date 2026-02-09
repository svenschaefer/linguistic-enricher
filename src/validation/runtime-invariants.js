"use strict";

const errors = require("../util/errors");

function failInvariant(message, details) {
  throw errors.createError(
    errors.ERROR_CODES.E_INVARIANT_VIOLATION,
    message,
    details
  );
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSpan(span, maxEnd, path) {
  if (!isObject(span)) {
    failInvariant("Span must be an object.", { path: path });
  }

  if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) {
    failInvariant("Span start/end must be integers.", { path: path, span: span });
  }

  if (span.start < 0 || span.end < 0) {
    failInvariant("Span start/end must be >= 0.", { path: path, span: span });
  }

  if (span.end < span.start) {
    failInvariant("Span end must be >= span start.", { path: path, span: span });
  }

  if (typeof maxEnd === "number" && span.end > maxEnd) {
    failInvariant("Span end exceeds canonical_text length.", { path: path, span: span, maxEnd: maxEnd });
  }
}

function resolveTokenRef(ref, tokensById, tokenCount) {
  if (!isObject(ref)) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(ref, "id")) {
    return tokensById.has(ref.id);
  }

  if (Object.prototype.hasOwnProperty.call(ref, "i")) {
    return Number.isInteger(ref.i) && ref.i >= 0 && ref.i < tokenCount;
  }

  return false;
}

/**
 * Validate runtime invariants not expressible in JSON Schema.
 *
 * Intended behavior: enforce span bounds, referential integrity, and deterministic ordering constraints.
 * @param {object} doc Seed document.
 * @returns {object} Invariant check result.
 */
function validateRuntimeInvariants(doc) {
  if (!isObject(doc)) {
    failInvariant("Document must be an object.", { path: "$" });
  }

  const canonicalText = typeof doc.canonical_text === "string" ? doc.canonical_text : "";
  const maxEnd = canonicalText.length;

  const segments = Array.isArray(doc.segments) ? doc.segments : [];
  const tokens = Array.isArray(doc.tokens) ? doc.tokens : [];
  const annotations = Array.isArray(doc.annotations) ? doc.annotations : [];

  const segmentIds = new Set();
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const path = "segments[" + i + "]";
    if (!isObject(segment)) {
      failInvariant("Segment must be an object.", { path: path });
    }

    if (segmentIds.has(segment.id)) {
      failInvariant("Duplicate segment id.", { path: path, id: segment.id });
    }
    segmentIds.add(segment.id);

    validateSpan(segment.span, maxEnd, path + ".span");
  }

  const tokensById = new Map();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const path = "tokens[" + i + "]";
    if (!isObject(token)) {
      failInvariant("Token must be an object.", { path: path });
    }

    if (token.i !== i) {
      failInvariant("Token index field `i` must match array position.", { path: path, expected: i, actual: token.i });
    }

    if (tokensById.has(token.id)) {
      failInvariant("Duplicate token id.", { path: path, id: token.id });
    }
    tokensById.set(token.id, i);

    if (!segmentIds.has(token.segment_id)) {
      failInvariant("Token references unknown segment_id.", { path: path, segment_id: token.segment_id });
    }

    validateSpan(token.span, maxEnd, path + ".span");
  }

  const annotationIds = new Set();
  const chunkIds = new Set();

  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    const path = "annotations[" + i + "]";
    if (!isObject(annotation)) {
      failInvariant("Annotation must be an object.", { path: path });
    }

    if (annotationIds.has(annotation.id)) {
      failInvariant("Duplicate annotation id.", { path: path, id: annotation.id });
    }
    annotationIds.add(annotation.id);
    if (annotation.kind === "chunk") {
      chunkIds.add(annotation.id);
    }

    if (!isObject(annotation.anchor) || !Array.isArray(annotation.anchor.selectors)) {
      continue;
    }

    const selectors = annotation.anchor.selectors;
    for (let j = 0; j < selectors.length; j += 1) {
      const selector = selectors[j];
      const selectorPath = path + ".anchor.selectors[" + j + "]";
      if (!isObject(selector)) {
        failInvariant("Selector must be an object.", { path: selectorPath });
      }

      if (selector.type === "TextPositionSelector") {
        validateSpan(selector.span, maxEnd, selectorPath + ".span");
      } else if (selector.type === "TokenSelector") {
        const tokenIds = Array.isArray(selector.token_ids) ? selector.token_ids : [];
        for (let k = 0; k < tokenIds.length; k += 1) {
          if (!tokensById.has(tokenIds[k])) {
            failInvariant("TokenSelector references unknown token id.", {
              path: selectorPath,
              token_id: tokenIds[k]
            });
          }
        }
      } else if (selector.type === "SegmentSelector") {
        if (!segmentIds.has(selector.segment_id)) {
          failInvariant("SegmentSelector references unknown segment id.", {
            path: selectorPath,
            segment_id: selector.segment_id
          });
        }
      }
    }

    if (annotation.kind === "dependency") {
      if (!resolveTokenRef(annotation.dep, tokensById, tokens.length)) {
        failInvariant("Dependency annotation has invalid dep token reference.", { path: path + ".dep" });
      }
      if (annotation.is_root !== true && !resolveTokenRef(annotation.head, tokensById, tokens.length)) {
        failInvariant("Dependency annotation has invalid head token reference.", { path: path + ".head" });
      }
    }

    if (annotation.kind === "chunk_head" && !chunkIds.has(annotation.chunk_id)) {
      failInvariant("chunk_head annotation references unknown chunk_id.", { path: path + ".chunk_id" });
    }
  }

  return { ok: true };
}

module.exports = {
  validateRuntimeInvariants
};
