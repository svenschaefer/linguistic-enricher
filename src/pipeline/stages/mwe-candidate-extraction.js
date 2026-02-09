"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");
const { createWikipediaTitleIndexClient } = require("../../services/wikipedia-title-index-client");
const errors = require("../../util/errors");

const NOUN_TAGS = new Set(["NN", "NNS", "NNP", "NNPS"]);
const ADJ_TAGS = new Set(["JJ", "JJR", "JJS"]);
const VERB_TAGS = new Set(["VB", "VBD", "VBG", "VBN", "VBP", "VBZ"]);
const WEAK_OBJECT_NOUNS = new Set(["customer", "customers", "people", "person", "user", "users"]);
const VERB_TO_VERB_ALLOW = new Set(["buy", "order", "pay", "ship", "place"]);

const PATTERNS = [
  {
    id: "adj_noun_noun",
    pattern: [
      { tagIn: ADJ_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "adj_noun",
    pattern: [
      { tagIn: ADJ_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "noun_noun",
    pattern: [
      { tagIn: NOUN_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "adj_adj_noun",
    pattern: [
      { tagIn: ADJ_TAGS, isPunct: false },
      { tagIn: ADJ_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "noun_poss_noun",
    pattern: [
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "POS", isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "noun_prep_of_np",
    pattern: [
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "IN", lower: "of", isPunct: false },
      { tag: "DT", isPunct: false, optional: true },
      { tagIn: ADJ_TAGS, isPunct: false, optional: true },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "noun_than_num",
    pattern: [
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "JJR", isPunct: false },
      { tag: "IN", lower: "than", isPunct: false },
      { tag: "CD", isPunct: false }
    ]
  },
  {
    id: "verb_obj_prep_noun",
    pattern: [
      { tagIn: VERB_TAGS, isPunct: false },
      { tag: "DT", isPunct: false, optional: true },
      { tagIn: ADJ_TAGS, isPunct: false, optional: true },
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "IN", lowerIn: new Set(["for", "of"]), isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "verb_det_noun",
    pattern: [
      { tagIn: VERB_TAGS, isPunct: false },
      { tag: "DT", isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "verb_noun",
    pattern: [
      { tagIn: VERB_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "verb_to_verb",
    pattern: [
      { tagIn: VERB_TAGS, isPunct: false },
      { tag: "TO", isPunct: false },
      { tagIn: VERB_TAGS, isPunct: false }
    ]
  },
  {
    id: "noun_prep_for_np",
    pattern: [
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "IN", lower: "for", isPunct: false },
      { tagIn: ADJ_TAGS, isPunct: false, optional: true },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "adj_noun_prep_np",
    pattern: [
      { tagIn: ADJ_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "IN", lowerIn: new Set(["of", "for"]), isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  },
  {
    id: "noun_noun_prep_np",
    pattern: [
      { tagIn: NOUN_TAGS, isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false },
      { tag: "IN", lowerIn: new Set(["of", "for"]), isPunct: false },
      { tagIn: NOUN_TAGS, isPunct: false }
    ]
  }
];

function getPosTag(token) {
  if (!token || !token.pos) {
    return "";
  }
  if (typeof token.pos.tag === "string" && token.pos.tag) {
    return token.pos.tag;
  }
  if (typeof token.pos.coarse === "string" && token.pos.coarse) {
    return token.pos.coarse;
  }
  return "";
}

function tokenLower(token) {
  return String(token && token.surface ? token.surface : "").toLowerCase();
}

function isPunct(token) {
  if (token && token.flags && token.flags.is_punct === true) {
    return true;
  }
  return /^\p{P}+$/u.test(String(token && token.surface ? token.surface : ""));
}

function matchesConstraint(token, constraint) {
  const tag = getPosTag(token);
  const lower = tokenLower(token);

  if (constraint.isPunct === false && isPunct(token)) {
    return false;
  }
  if (constraint.tag && tag !== constraint.tag) {
    return false;
  }
  if (constraint.tagIn && !constraint.tagIn.has(tag)) {
    return false;
  }
  if (constraint.lower && lower !== constraint.lower) {
    return false;
  }
  if (constraint.lowerIn && !constraint.lowerIn.has(lower)) {
    return false;
  }
  return true;
}

function matchPatternFrom(tokens, start, pattern, patternIndex, tokenIndex, consumed, results) {
  if (patternIndex >= pattern.length) {
    if (consumed.length > 0) {
      results.push(consumed);
    }
    return;
  }

  const constraint = pattern[patternIndex];

  if (constraint.optional) {
    matchPatternFrom(tokens, start, pattern, patternIndex + 1, tokenIndex, consumed.slice(), results);
  }

  if (tokenIndex >= tokens.length) {
    return;
  }

  const token = tokens[tokenIndex];
  if (!matchesConstraint(token, constraint)) {
    return;
  }

  const next = consumed.slice();
  next.push(tokenIndex);
  matchPatternFrom(tokens, start, pattern, patternIndex + 1, tokenIndex + 1, next, results);
}

function isSingleSegment(tokens, indexes) {
  const segmentId = tokens[indexes[0]].segment_id;
  for (let i = 1; i < indexes.length; i += 1) {
    if (tokens[indexes[i]].segment_id !== segmentId) {
      return false;
    }
  }
  return true;
}

function passesPatternFilters(patternId, tokens, indexes) {
  if (!patternId.startsWith("verb_")) {
    return true;
  }

  const matched = indexes.map(function toToken(i) { return tokens[i]; });
  const last = matched[matched.length - 1];
  const lastTag = getPosTag(last);
  const lastLower = tokenLower(last);

  if (patternId === "verb_to_verb") {
    return VERB_TO_VERB_ALLOW.has(lastLower);
  }

  if (!NOUN_TAGS.has(lastTag)) {
    return false;
  }
  if (WEAK_OBJECT_NOUNS.has(lastLower)) {
    return false;
  }

  for (let i = 0; i < matched.length; i += 1) {
    if (NOUN_TAGS.has(getPosTag(matched[i]))) {
      return true;
    }
  }
  return false;
}

function spanText(text, span, unit) {
  const source = String(text || "");
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.end < span.start) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 05 received invalid span for quote extraction.",
      { span: span }
    );
  }

  if (unit === "utf16_code_units") {
    return source.slice(span.start, span.end);
  }

  if (unit === "unicode_codepoints") {
    return Array.from(source).slice(span.start, span.end).join("");
  }

  if (unit === "bytes_utf8") {
    return Buffer.from(source, "utf8").slice(span.start, span.end).toString("utf8");
  }

  throw errors.createError(
    errors.ERROR_CODES.E_INVARIANT_VIOLATION,
    "Stage 05 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function matchCandidates(seed) {
  const tokens = Array.isArray(seed.tokens) ? seed.tokens : [];
  const candidates = [];

  for (let i = 0; i < tokens.length; i += 1) {
    for (let p = 0; p < PATTERNS.length; p += 1) {
      const patternSpec = PATTERNS[p];
      const rawMatches = [];
      matchPatternFrom(tokens, i, patternSpec.pattern, 0, i, [], rawMatches);

      for (let m = 0; m < rawMatches.length; m += 1) {
        const indexes = rawMatches[m];
        if (indexes.length < 2) {
          continue;
        }
        if (!isSingleSegment(tokens, indexes)) {
          continue;
        }
        if (!passesPatternFilters(patternSpec.id, tokens, indexes)) {
          continue;
        }

        const matchedTokens = indexes.map(function mapIndex(idx) { return tokens[idx]; });
        const tokenIds = matchedTokens.map(function toId(t) { return t.id; });
        const span = {
          start: matchedTokens[0].span.start,
          end: matchedTokens[matchedTokens.length - 1].span.end
        };

        candidates.push({
          patternId: patternSpec.id,
          tokenIds: tokenIds,
          span: span,
          surfaces: matchedTokens.map(function toSurface(t) { return t.surface; }),
          tags: matchedTokens.map(function toTag(t) { return getPosTag(t); })
        });
      }
    }
  }

  return candidates;
}

function mergeCandidates(seed, candidates) {
  const mergedByTokenIds = new Map();
  const unit = seed.index_basis && seed.index_basis.unit ? seed.index_basis.unit : "utf16_code_units";

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const key = candidate.tokenIds.join("|");

    if (!mergedByTokenIds.has(key)) {
      mergedByTokenIds.set(key, {
        tokenIds: candidate.tokenIds,
        span: candidate.span,
        exact: spanText(seed.canonical_text, candidate.span, unit),
        surfaces: candidate.surfaces,
        tags: candidate.tags,
        patternIds: new Set([candidate.patternId])
      });
      continue;
    }

    mergedByTokenIds.get(key).patternIds.add(candidate.patternId);
  }

  const merged = Array.from(mergedByTokenIds.values()).map(function toSerializable(item) {
    return {
      tokenIds: item.tokenIds,
      span: item.span,
      exact: item.exact,
      surfaces: item.surfaces,
      tags: item.tags,
      patternIds: Array.from(item.patternIds).sort()
    };
  });

  merged.sort(function compare(a, b) {
    if (a.span.start !== b.span.start) {
      return a.span.start - b.span.start;
    }
    const lenA = a.span.end - a.span.start;
    const lenB = b.span.end - b.span.start;
    if (lenA !== lenB) {
      return lenB - lenA;
    }
    const pA = a.patternIds[0] || "";
    const pB = b.patternIds[0] || "";
    if (pA !== pB) {
      return pA < pB ? -1 : 1;
    }
    const kA = a.tokenIds.join("|");
    const kB = b.tokenIds.join("|");
    return kA < kB ? -1 : kA > kB ? 1 : 0;
  });

  return merged;
}

function mapQueryEvidence(response) {
  const rows = response && Array.isArray(response.rows)
    ? response.rows
    : response && Array.isArray(response.result)
      ? response.result
      : [];

  const rowTexts = rows
    .map(function toText(row) {
      if (typeof row === "string") {
        return row;
      }
      if (Array.isArray(row) && row.length > 0 && typeof row[0] === "string") {
        return row[0];
      }
      if (row && typeof row.t === "string") {
        return row.t;
      }
      return "";
    })
    .filter(Boolean);

  return {
    wiki_exact_match: rowTexts.length > 0,
    wiki_prefix_count: rowTexts.length,
    wiki_parenthetical_variant_count: rowTexts.filter(function (x) { return x.indexOf("(") !== -1; }).length,
    wiki_hyphen_space_variant_match: false,
    wiki_apostrophe_variant_match: false,
    wiki_singular_plural_variant_match: false,
    wiki_any_signal: rowTexts.length > 0
  };
}

function buildLabel(candidate) {
  const parts = [];
  for (let i = 0; i < candidate.surfaces.length; i += 1) {
    if (candidate.tags[i] === "DT") {
      continue;
    }
    parts.push(candidate.surfaces[i]);
  }

  const label = parts.join(" ").trim();
  return label || candidate.exact;
}

/**
 * Stage 05: mwe candidate extraction (spaCy-selected semantics).
 * @param {object} seed Seed document.
 * @param {object} context Stage context/options.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed, context) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const existing = Array.isArray(out.annotations) ? out.annotations : [];
  const client = createWikipediaTitleIndexClient((context && context.options) || {});

  if (tokens.length === 0) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Stage 05 requires non-empty token stream."
    );
  }

  const raw = matchCandidates(out);
  const merged = mergeCandidates(out, raw);
  const annotations = [];

  for (let i = 0; i < merged.length; i += 1) {
    const candidate = merged[i];
    const label = buildLabel(candidate);
    let evidence = {
      wiki_exact_match: false,
      wiki_prefix_count: 0,
      wiki_parenthetical_variant_count: 0,
      wiki_hyphen_space_variant_match: false,
      wiki_apostrophe_variant_match: false,
      wiki_singular_plural_variant_match: false,
      wiki_any_signal: false
    };

    if (client.enabled) {
      try {
        const response = await client.queryTitle(label, 10);
        evidence = mapQueryEvidence(response);
      } catch (error) {
        void error;
      }
    }

    const patternSources = candidate.patternIds.map(function toSource(patternId) {
      return {
        name: "spacy:matcher/" + patternId,
        kind: "pattern"
      };
    });

    annotations.push({
      id: createDeterministicId("mwe-cand", {
        tokenIds: candidate.tokenIds,
        patternIds: candidate.patternIds,
        label: label
      }),
      kind: "mwe",
      status: "candidate",
      label: label,
      surface: label,
      anchor: {
        selectors: [
          {
            type: "TextQuoteSelector",
            exact: candidate.exact
          },
          {
            type: "TextPositionSelector",
            span: candidate.span
          },
          {
            type: "TokenSelector",
            token_ids: candidate.tokenIds
          }
        ]
      },
      sources: patternSources.concat([
        {
          name: "wikipedia-title-index",
          kind: "lexicon",
          evidence: evidence
        }
      ])
    });
  }

  out.annotations = existing.concat(annotations);
  out.stage = "mwe_candidates";
  return out;
}

module.exports = {
  runStage
};
