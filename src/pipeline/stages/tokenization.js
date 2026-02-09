"use strict";

const { deepClone } = require("../../util/deep-clone");
const { normalizeSpan } = require("../../util/spans");
const errors = require("../../util/errors");

const TOKEN_REGEX =
  /(?:\p{L}\.){2,}|\.{3}|\p{L}[\p{L}\p{N}'’ʼ]*(?:-\p{L}[\p{L}\p{N}'’ʼ]*)+|\p{L}[\p{L}\p{N}'’ʼ]*|\p{N}+|[^\s]/gu;

function splitContractions(surface, startUtf16) {
  const apostropheSuffix = /^(.*?)(['’ʼ]s)$/u.exec(surface);
  if (apostropheSuffix && apostropheSuffix[1].length > 0) {
    const base = apostropheSuffix[1];
    const suffix = apostropheSuffix[2];
    return [
      { surface: base, startUtf16: startUtf16, endUtf16: startUtf16 + base.length },
      {
        surface: suffix,
        startUtf16: startUtf16 + base.length,
        endUtf16: startUtf16 + base.length + suffix.length
      }
    ];
  }

  const ntSuffix = /^(.*?)(n't)$/u.exec(surface);
  if (ntSuffix && ntSuffix[1].length > 0) {
    const base = ntSuffix[1];
    const suffix = ntSuffix[2];
    return [
      { surface: base, startUtf16: startUtf16, endUtf16: startUtf16 + base.length },
      {
        surface: suffix,
        startUtf16: startUtf16 + base.length,
        endUtf16: startUtf16 + base.length + suffix.length
      }
    ];
  }

  return [
    {
      surface: surface,
      startUtf16: startUtf16,
      endUtf16: startUtf16 + surface.length
    }
  ];
}

function buildIndexMaps(text) {
  const cpToUtf16 = [0];
  const cpToUtf8 = [0];
  const utf16ToCp = new Map([[0, 0]]);
  const utf16ToUtf8 = new Map([[0, 0]]);
  const utf8ToUtf16 = new Map([[0, 0]]);

  let cpIndex = 0;
  let utf16Index = 0;
  let utf8Index = 0;
  for (const ch of text) {
    cpIndex += 1;
    utf16Index += ch.length;
    utf8Index += Buffer.byteLength(ch, "utf8");

    cpToUtf16.push(utf16Index);
    cpToUtf8.push(utf8Index);
    utf16ToCp.set(utf16Index, cpIndex);
    utf16ToUtf8.set(utf16Index, utf8Index);
    utf8ToUtf16.set(utf8Index, utf16Index);
  }

  return {
    cpToUtf16: cpToUtf16,
    cpToUtf8: cpToUtf8,
    utf16ToCp: utf16ToCp,
    utf16ToUtf8: utf16ToUtf8,
    utf8ToUtf16: utf8ToUtf16,
    utf16Length: utf16Index,
    cpLength: cpIndex,
    utf8Length: utf8Index
  };
}

function toUtf16(index, unit, maps) {
  if (!Number.isInteger(index) || index < 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 03 received invalid span index.",
      { unit: unit, index: index }
    );
  }

  if (unit === "utf16_code_units") {
    if (index > maps.utf16Length) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 03 span exceeds canonical_text length in utf16_code_units.",
        { index: index, max: maps.utf16Length }
      );
    }
    return index;
  }

  if (unit === "unicode_codepoints") {
    if (index > maps.cpLength) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 03 span exceeds canonical_text length in unicode_codepoints.",
        { index: index, max: maps.cpLength }
      );
    }
    return maps.cpToUtf16[index];
  }

  if (unit === "bytes_utf8") {
    const asUtf16 = maps.utf8ToUtf16.get(index);
    if (typeof asUtf16 !== "number") {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 03 byte span does not align to UTF-8 boundaries.",
        { index: index }
      );
    }
    return asUtf16;
  }

  throw errors.createError(
    errors.ERROR_CODES.E_INVARIANT_VIOLATION,
    "Stage 03 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function fromUtf16(index, unit, maps) {
  if (unit === "utf16_code_units") {
    return index;
  }

  if (unit === "unicode_codepoints") {
    const asCp = maps.utf16ToCp.get(index);
    if (typeof asCp !== "number") {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 03 utf16 index does not align to unicode code point boundary.",
        { index: index }
      );
    }
    return asCp;
  }

  if (unit === "bytes_utf8") {
    const asBytes = maps.utf16ToUtf8.get(index);
    if (typeof asBytes !== "number") {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 03 utf16 index does not align to UTF-8 byte boundary.",
        { index: index }
      );
    }
    return asBytes;
  }

  throw errors.createError(
    errors.ERROR_CODES.E_INVARIANT_VIOLATION,
    "Stage 03 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function tokenizeSegment(segmentText, segmentStartUtf16, unit, maps) {
  const tokens = [];
  TOKEN_REGEX.lastIndex = 0;
  let match = TOKEN_REGEX.exec(segmentText);

  while (match) {
    const startUtf16 = segmentStartUtf16 + match.index;
    const split = splitContractions(match[0], startUtf16);
    for (let i = 0; i < split.length; i += 1) {
      tokens.push({
        surface: split[i].surface,
        span: normalizeSpan(
          fromUtf16(split[i].startUtf16, unit, maps),
          fromUtf16(split[i].endUtf16, unit, maps)
        )
      });
    }
    match = TOKEN_REGEX.exec(segmentText);
  }

  return tokens;
}

function rejectIfPartialDownstream(seed) {
  const existingTokens = Array.isArray(seed.tokens) ? seed.tokens.length : 0;
  const existingAnnotations = Array.isArray(seed.annotations) ? seed.annotations.length : 0;
  if (existingTokens > 0 || existingAnnotations > 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 03 rejects partially enriched documents with existing token/annotation anchors.",
      {
        tokens: existingTokens,
        annotations: existingAnnotations
      }
    );
  }
}

/**
 * Stage 03: tokenization.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  rejectIfPartialDownstream(seed);

  const out = deepClone(seed);
  const text = String(out.canonical_text || "");
  const segments = Array.isArray(out.segments) ? out.segments : [];
  if (segments.length === 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 03 requires non-empty segments."
    );
  }

  const unit =
    out.index_basis && typeof out.index_basis.unit === "string"
      ? out.index_basis.unit
      : "utf16_code_units";
  const maps = buildIndexMaps(text);
  const tokens = [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const segmentStartUtf16 = toUtf16(segment.span.start, unit, maps);
    const segmentEndUtf16 = toUtf16(segment.span.end, unit, maps);
    const segText = text.slice(segmentStartUtf16, segmentEndUtf16);
    const segTokens = tokenizeSegment(segText, segmentStartUtf16, unit, maps);
    const startIndex = tokens.length;

    for (let j = 0; j < segTokens.length; j += 1) {
      const token = segTokens[j];
      const isPunct = /^\p{P}+$/u.test(token.surface);
      tokens.push({
        id: "t" + (tokens.length + 1),
        i: tokens.length,
        segment_id: segment.id,
        span: token.span,
        surface: token.surface,
        normalized: token.surface.toLowerCase(),
        flags: {
          is_punct: isPunct,
          is_space: false,
          is_stop: false
        },
        joiner: {
          pre: "",
          post: ""
        }
      });
    }

    segment.token_range = {
      start: startIndex,
      end: tokens.length
    };
  }

  out.tokens = tokens;
  out.stage = "tokenized";

  return out;
}

module.exports = {
  runStage
};
