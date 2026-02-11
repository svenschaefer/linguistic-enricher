"use strict";

const { deepClone } = require("../../util/deep-clone");
const { createDeterministicId } = require("../../util/ids");
const errors = require("../../util/errors");

const VP_PP_ABSORB_DENY = new Set(["for", "at", "in", "than"]);
const NP_MWE_ALLOW_LIST = new Set([
  "online store",
  "new york",
  "united states"
]);
const NP_INTERNAL_MWE_POS = new Set([
  "DT",
  "PDT",
  "PRP$",
  "JJ",
  "JJR",
  "JJS",
  "NN",
  "NNS",
  "NNP",
  "NNPS"
]);

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

function isDet(tag) {
  return tag === "DT" || tag === "PRP$" || tag === "WDT" || tag === "PDT";
}

function isAdj(tag) {
  return tag === "JJ" || tag === "JJR" || tag === "JJS";
}

function isNpModifier(tag) {
  return isAdj(tag) || tag === "VBN" || tag === "VBG";
}

function isNoun(tag) {
  return tag === "NN" || tag === "NNS" || tag === "NNP" || tag === "NNPS";
}

function isVerb(tag) {
  return /^VB/.test(tag);
}

function isPrep(tag) {
  return tag === "IN" || tag === "TO";
}

const AUX_SURFACES = new Set([
  "be",
  "am",
  "is",
  "are",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did"
]);

function ppKindFromMarkerSurface(markerSurfaceLower) {
  const mapping = {
    "than": "comparative",
    "of": "genitive",
    "with": "instrumental",
    "without": "privative",
    "about": "topic",
    "concerning": "topic",
    "regarding": "topic",
    "as": "role",
    "like": "similarity",
    "to": "goal",
    "toward": "goal",
    "towards": "goal",
    "into": "goal",
    "onto": "goal",
    "from": "source",
    "out of": "source",
    "through": "path",
    "across": "path",
    "along": "path",
    "via": "path",
    "in": "locative",
    "on": "locative",
    "at": "locative",
    "under": "locative",
    "over": "locative",
    "above": "locative",
    "below": "locative",
    "beneath": "locative",
    "behind": "locative",
    "between": "locative",
    "among": "locative",
    "around": "locative",
    "near": "locative",
    "beside": "locative",
    "within": "locative",
    "inside": "locative",
    "outside": "locative",
    "before": "temporal",
    "after": "temporal",
    "during": "temporal",
    "until": "temporal",
    "since": "temporal",
    "by": "agentive",
    "for": "benefactive",
    "because of": "cause",
    "due to": "cause",
    "despite": "concessive"
  };

  if (Object.prototype.hasOwnProperty.call(mapping, markerSurfaceLower)) {
    return mapping[markerSurfaceLower];
  }
  return "generic";
}

function isCoordinatorUnit(unit) {
  if (!unit || unit.kind !== "token") {
    return false;
  }
  const surface = String(unit.text || "").toLowerCase();
  const pos = String(unit.pos || "");
  return pos === "CC" || surface === "and" || surface === "or";
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
    "Stage 09 received unsupported index_basis.unit.",
    { unit: unit }
  );
}

function groupTokensBySentence(tokens) {
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
  return bySentence;
}

function buildMweCandidates(seed, tokenById) {
  const annotations = Array.isArray(seed.annotations) ? seed.annotations : [];
  const out = [];

  for (let i = 0; i < annotations.length; i += 1) {
    const annotation = annotations[i];
    if (!annotation || annotation.kind !== "mwe" || annotation.status !== "accepted") {
      continue;
    }
    if (!annotation.anchor || !Array.isArray(annotation.anchor.selectors)) {
      continue;
    }
    const tokenSelector = annotation.anchor.selectors.find(function (s) { return s && s.type === "TokenSelector"; });
    if (!tokenSelector || !Array.isArray(tokenSelector.token_ids) || tokenSelector.token_ids.length === 0) {
      continue;
    }

    const tokenObjs = tokenSelector.token_ids.map(function (id) { return tokenById.get(id); }).filter(Boolean);
    if (tokenObjs.length !== tokenSelector.token_ids.length) {
      continue;
    }
    tokenObjs.sort(function (a, b) { return a.i - b.i; });

    const sentenceId = tokenObjs[0].segment_id;
    if (tokenObjs.some(function (t) { return t.segment_id !== sentenceId; })) {
      continue;
    }

    const startIdx = tokenObjs[0].i;
    const endIdx = tokenObjs[tokenObjs.length - 1].i;
    const span = {
      start: tokenObjs[0].span.start,
      end: tokenObjs[tokenObjs.length - 1].span.end
    };
    const text = annotation.label || annotation.surface || tokenObjs.map(function (t) { return t.surface; }).join(" ");

    // Stage 09 only materializes explicitly allowed nominal MWEs.
    const surfaceLower = String(text).toLowerCase();
    if (!NP_MWE_ALLOW_LIST.has(surfaceLower)) {
      continue;
    }

    // Skip MWE spans that are not NP-internal so VP/PP boundaries stay untouched.
    const npInternal = tokenObjs.every(function (t) {
      return NP_INTERNAL_MWE_POS.has(getTag(t));
    });
    if (!npInternal) {
      continue;
    }

    out.push({
      id: annotation.id,
      sentenceId: sentenceId,
      tokenIds: tokenObjs.map(function (t) { return t.id; }),
      startIdx: startIdx,
      endIdx: endIdx,
      span: span,
      text: text
    });
  }

  return out;
}

function selectWinningMwesBySentence(candidates) {
  const grouped = new Map();
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (!grouped.has(c.sentenceId)) {
      grouped.set(c.sentenceId, []);
    }
    grouped.get(c.sentenceId).push(c);
  }

  const winners = new Map();
  for (const entry of grouped.entries()) {
    const sentenceId = entry[0];
    const list = entry[1].slice().sort(function (a, b) {
      const lenA = a.endIdx - a.startIdx + 1;
      const lenB = b.endIdx - b.startIdx + 1;
      if (lenA !== lenB) {
        return lenB - lenA;
      }
      if (a.startIdx !== b.startIdx) {
        return a.startIdx - b.startIdx;
      }
      return String(a.id).localeCompare(String(b.id));
    });

    const selected = [];
    for (let i = 0; i < list.length; i += 1) {
      const candidate = list[i];
      const overlaps = selected.some(function (picked) {
        return candidate.startIdx <= picked.endIdx && candidate.endIdx >= picked.startIdx;
      });
      if (!overlaps) {
        selected.push(candidate);
      }
    }

    selected.sort(function (a, b) { return a.startIdx - b.startIdx; });
    winners.set(sentenceId, selected);
  }
  return winners;
}

function buildUnits(tokensBySentence, winningMwes) {
  const unitsBySentence = new Map();

  for (const entry of tokensBySentence.entries()) {
    const sentenceId = entry[0];
    const sentenceTokens = entry[1];
    const mwes = winningMwes.get(sentenceId) || [];
    const units = [];

    let tokenCursor = 0;
    let mweCursor = 0;
    while (tokenCursor < sentenceTokens.length) {
      const nextMwe = mwes[mweCursor];
      const token = sentenceTokens[tokenCursor];
      if (nextMwe && nextMwe.startIdx === token.i) {
        units.push({
          kind: "mwe",
          id: nextMwe.id,
          tokenIds: nextMwe.tokenIds.slice(),
          span: nextMwe.span,
          text: nextMwe.text
        });
        tokenCursor += nextMwe.endIdx - nextMwe.startIdx + 1;
        mweCursor += 1;
        continue;
      }

      units.push({
        kind: isPunct(token) ? "punctuation" : "token",
        id: token.id,
        tokenIds: [token.id],
        span: token.span,
        text: token.surface,
        pos: getTag(token)
      });
      tokenCursor += 1;
    }

    unitsBySentence.set(sentenceId, units);
  }

  return unitsBySentence;
}

function asRunUnit(unit) {
  const pos = unit.pos || "";
  const lower = String(unit.text || "").toLowerCase();
  const isToken = unit.kind === "token";
  const isVerbTag = /^VB/.test(pos);
  const isAux = isToken && (pos === "MD" || (isVerbTag && AUX_SURFACES.has(lower)));
  const isLexVerb = isToken && isVerbTag && pos !== "MD" && !AUX_SURFACES.has(lower);
  return {
    unit: unit,
    det: unit.kind === "token" && isDet(pos),
    adj: unit.kind === "token" && isAdj(pos),
    noun: unit.kind === "mwe" || (unit.kind === "token" && isNoun(pos)),
    verb: unit.kind === "token" && isVerb(pos),
    prep: unit.kind === "token" && isPrep(pos),
    aux: isAux,
    lexVerb: isLexVerb,
    to: isToken && pos === "TO" && lower === "to",
    surfaceLower: lower
  };
}

function matchNP(run, start) {
  let i = start;
  if (i < run.length && run[i].det) {
    i += 1;
  }
  while (i < run.length && run[i].unit.kind === "token" && isNpModifier(run[i].unit.pos)) {
    i += 1;
  }
  const nounStart = i;
  while (i < run.length && run[i].noun) {
    i += 1;
  }
  if (i > nounStart) {
    return { type: "NP", end: i - 1 };
  }
  return null;
}

function matchPP(run, start) {
  if (start >= run.length || !run[start].prep) {
    return null;
  }
  const np = matchNP(run, start + 1);
  if (!np) {
    return null;
  }
  const markerSurface = String(run[start].surfaceLower || "");
  return {
    type: "PP",
    end: np.end,
    marker_surface: markerSurface,
    pp_kind: ppKindFromMarkerSurface(markerSurface)
  };
}

function matchVP(run, start) {
  function consumeVerbComplex(from) {
    let i = from;
    while (i < run.length && run[i].aux) {
      i += 1;
    }
    const lexStart = i;
    while (i < run.length && run[i].lexVerb) {
      i += 1;
    }
    if (i === lexStart) {
      return null;
    }
    return { end: i - 1 };
  }

  const main = consumeVerbComplex(start);
  if (!main) {
    return null;
  }

  let end = main.end;
  let cursor = end + 1;

  const np = matchNP(run, cursor);
  if (np) {
    end = np.end;
    cursor = np.end + 1;
  }

  if (cursor < run.length && run[cursor].to) {
    const inf = consumeVerbComplex(cursor + 1);
    if (inf) {
      end = inf.end;
      cursor = inf.end + 1;

      const infNp = matchNP(run, cursor);
      if (infNp) {
        end = infNp.end;
        cursor = infNp.end + 1;
      }
    }
  }

  const pp = matchPP(run, cursor);
  if (pp && !VP_PP_ABSORB_DENY.has(pp.marker_surface)) {
    end = pp.end;
  }

  return { type: "VP", end: end };
}

function chooseMatch(run, start) {
  const candidates = [matchVP(run, start), matchPP(run, start), matchNP(run, start)].filter(Boolean);
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort(function (a, b) {
    const lenA = a.end - start;
    const lenB = b.end - start;
    if (lenA !== lenB) {
      return lenB - lenA;
    }
    const order = { VP: 0, PP: 1, NP: 2 };
    return order[a.type] - order[b.type];
  });
  return candidates[0];
}

function buildChunks(unitsBySentence, canonicalText, unit) {
  const chunks = [];

  for (const entry of unitsBySentence.entries()) {
    const sentenceId = entry[0];
    const units = entry[1];
    let run = [];

    function flushRun() {
      if (run.length === 0) {
        return;
      }
      let i = 0;
      while (i < run.length) {
        const chosen = chooseMatch(run, i);
        if (!chosen) {
          const fallback = run[i].unit;
          chunks.push({
            sentenceId: sentenceId,
            type: "O",
            span: fallback.span,
            tokenIds: fallback.tokenIds.slice(),
            text: spanTextFromCanonical(canonicalText, fallback.span, unit)
          });
          i += 1;
          continue;
        }
        const slice = run.slice(i, chosen.end + 1).map(function (x) { return x.unit; });
        const span = {
          start: slice[0].span.start,
          end: slice[slice.length - 1].span.end
        };
        const tokenIds = [];
        for (let k = 0; k < slice.length; k += 1) {
          tokenIds.push.apply(tokenIds, slice[k].tokenIds);
        }
        chunks.push({
          sentenceId: sentenceId,
          type: chosen.type,
          span: span,
          tokenIds: tokenIds,
          text: spanTextFromCanonical(canonicalText, span, unit),
          pp_kind: chosen.type === "PP" ? chosen.pp_kind : undefined
        });
        i = chosen.end + 1;
      }
      run = [];
    }

    for (let i = 0; i < units.length; i += 1) {
      const next = units[i];
      if (next.kind === "punctuation" || isCoordinatorUnit(next)) {
        flushRun();
        chunks.push({
          sentenceId: sentenceId,
          type: "O",
          span: next.span,
          tokenIds: next.tokenIds.slice(),
          text: spanTextFromCanonical(canonicalText, next.span, unit)
        });
      } else {
        run.push(asRunUnit(next));
      }
    }
    flushRun();
  }

  return chunks;
}

/**
 * Stage 09: POS-FSM style chunking.
 * @param {object} seed Seed document.
 * @returns {Promise<object>} Updated seed document.
 */
async function runStage(seed) {
  const out = deepClone(seed);
  const tokens = Array.isArray(out.tokens) ? out.tokens : [];
  const annotations = Array.isArray(out.annotations) ? out.annotations : [];
  const unit = out.index_basis && out.index_basis.unit ? out.index_basis.unit : "utf16_code_units";

  for (let i = 0; i < annotations.length; i += 1) {
    if (annotations[i] && annotations[i].kind === "chunk") {
      throw errors.createError(
        errors.ERROR_CODES.E_INVARIANT_VIOLATION,
        "Stage 09 rejects partially chunked documents with existing chunk annotations."
      );
    }
  }

  const tokenById = new Map(tokens.map(function (t) { return [t.id, t]; }));
  const tokensBySentence = groupTokensBySentence(tokens);
  const mweCandidates = buildMweCandidates(out, tokenById);
  const winningMwes = selectWinningMwesBySentence(mweCandidates);
  const unitsBySentence = buildUnits(tokensBySentence, winningMwes);
  const chunks = buildChunks(unitsBySentence, out.canonical_text, unit);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const chunkId = createDeterministicId("chunk", {
      sentence: chunk.sentenceId,
      type: chunk.type,
      token_ids: chunk.tokenIds
    });
    annotations.push({
      id: chunkId,
      kind: "chunk",
      status: "accepted",
      chunk_type: chunk.type,
      label: chunk.text,
      anchor: {
        selectors: [
          {
            type: "TextQuoteSelector",
            exact: chunk.text
          },
          {
            type: "TokenSelector",
            token_ids: chunk.tokenIds
          },
          {
            type: "TextPositionSelector",
            span: {
              start: chunk.span.start,
              end: chunk.span.end
            }
          }
        ]
      },
      sources: [{ name: "chunking-pos-fsm", kind: "rule" }]
    });
    if (chunk.type === "PP") {
      annotations[annotations.length - 1].pp_kind = chunk.pp_kind || "generic";
    }
  }

  out.annotations = annotations;
  out.stage = "chunked";
  return out;
}

module.exports = {
  runStage
};
