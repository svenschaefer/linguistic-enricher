"use strict";

const errors = require("./errors");

/**
 * Validate and normalize span object.
 * @param {number} start Inclusive start.
 * @param {number} end Exclusive end.
 * @returns {{start:number,end:number}} Normalized span.
 */
function normalizeSpan(start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    throw errors.createError(
      errors.ERROR_CODES.E_INVARIANT_VIOLATION,
      "Invalid span values.",
      { start: start, end: end }
    );
  }

  return { start: start, end: end };
}

/**
 * Find all matches for a regex in deterministic order.
 * @param {string} text Input text.
 * @param {RegExp} regex Global regex.
 * @returns {Array<{match:string,start:number,end:number}>} Match list.
 */
function findAllMatches(text, regex) {
  const matches = [];
  let result = regex.exec(text);

  while (result) {
    matches.push({
      match: result[0],
      start: result.index,
      end: result.index + result[0].length
    });
    result = regex.exec(text);
  }

  return matches;
}

module.exports = {
  normalizeSpan,
  findAllMatches
};
