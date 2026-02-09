"use strict";

const { deepClone } = require("../../util/deep-clone");
const { normalizeSpan } = require("../../util/spans");
const errors = require("../../util/errors");
const winkTokenizer = require("wink-tokenizer");

const TOKENIZER = winkTokenizer();

function mergePieces(pieces, start, end, value, tag) {
  return {
    value: value,
    start: pieces[start].start,
    end: pieces[end].end,
    tag: tag || pieces[start].tag
  };
}

function mergeEllipsis(pieces) {
  const merged = [];
  for (let i = 0; i < pieces.length; i += 1) {
    if (
      i + 2 < pieces.length &&
      pieces[i].value === "." &&
      pieces[i + 1].value === "." &&
      pieces[i + 2].value === "." &&
      pieces[i].end === pieces[i + 1].start &&
      pieces[i + 1].end === pieces[i + 2].start
    ) {
      merged.push(mergePieces(pieces, i, i + 2, "...", "punctuation"));
      i += 2;
      continue;
    }
    merged.push(pieces[i]);
  }
  return merged;
}

function mergeAbbreviations(pieces) {
  const merged = [];
  let i = 0;
  while (i < pieces.length) {
    if (/^[A-Za-z]$/.test(pieces[i].value) && i + 1 < pieces.length && pieces[i + 1].value === ".") {
      let j = i;
      const parts = [];
      while (
        j + 1 < pieces.length &&
        /^[A-Za-z]$/.test(pieces[j].value) &&
        pieces[j + 1].value === "." &&
        pieces[j].end === pieces[j + 1].start
      ) {
        parts.push(pieces[j].value + ".");
        j += 2;
      }
      if (parts.length >= 2) {
        merged.push(mergePieces(pieces, i, j - 1, parts.join(""), "word"));
        i = j;
        continue;
      }
    }
    merged.push(pieces[i]);
    i += 1;
  }
  return merged;
}

function mergeHyphenCompounds(pieces) {
  const merged = [];
  let i = 0;
  while (i < pieces.length) {
    if (
      /^[A-Za-z0-9]+$/.test(pieces[i].value) &&
      i + 2 < pieces.length &&
      pieces[i + 1].value === "-" &&
      /^[A-Za-z0-9]+$/.test(pieces[i + 2].value) &&
      pieces[i].end === pieces[i + 1].start &&
      pieces[i + 1].end === pieces[i + 2].start
    ) {
      let j = i + 2;
      let value = pieces[i].value + "-" + pieces[i + 2].value;
      while (
        j + 2 < pieces.length &&
        pieces[j + 1].value === "-" &&
        /^[A-Za-z0-9]+$/.test(pieces[j + 2].value) &&
        pieces[j].end === pieces[j + 1].start &&
        pieces[j + 1].end === pieces[j + 2].start
      ) {
        value += "-" + pieces[j + 2].value;
        j += 2;
      }
      merged.push(mergePieces(pieces, i, j, value, "word"));
      i = j + 1;
      continue;
    }
    merged.push(pieces[i]);
    i += 1;
  }
  return merged;
}

function mergeApostropheS(pieces) {
  const merged = [];
  for (let i = 0; i < pieces.length; i += 1) {
    if (
      i + 1 < pieces.length &&
      (pieces[i].value === "'" || pieces[i].value === "’" || pieces[i].value === "ʼ") &&
      pieces[i + 1].value === "s" &&
      pieces[i].end === pieces[i + 1].start
    ) {
      merged.push(mergePieces(pieces, i, i + 1, pieces[i].value + "s", "word"));
      i += 1;
      continue;
    }
    merged.push(pieces[i]);
  }
  return merged;
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
  const rawTokens = TOKENIZER.tokenize(segmentText);
  const pieces = [];
  let cursor = 0;

  for (let i = 0; i < rawTokens.length; i += 1) {
    const item = rawTokens[i];
    if (!item || typeof item.value !== "string" || item.value.length === 0) {
      continue;
    }
    if (item.tag === "space" || item.tag === "tab" || item.tag === "newline") {
      continue;
    }

    const localStart = segmentText.indexOf(item.value, cursor);
    if (localStart === -1) {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 03 could not align wink-tokenizer output to segment text.",
        { token: item.value, tag: item.tag }
      );
    }
    const localEnd = localStart + item.value.length;
    cursor = localEnd;
    pieces.push({
      value: item.value,
      start: localStart,
      end: localEnd,
      tag: item.tag
    });
  }

  const normalizedPieces = mergeApostropheS(
    mergeHyphenCompounds(
      mergeAbbreviations(
        mergeEllipsis(pieces)
      )
    )
  );

  for (let i = 0; i < normalizedPieces.length; i += 1) {
    const piece = normalizedPieces[i];
    const startUtf16 = segmentStartUtf16 + piece.start;
    const endUtf16 = segmentStartUtf16 + piece.end;
    tokens.push({
      surface: piece.value,
      span: normalizeSpan(
        fromUtf16(startUtf16, unit, maps),
        fromUtf16(endUtf16, unit, maps)
      )
    });
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
