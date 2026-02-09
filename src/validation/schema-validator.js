"use strict";

/**
 * Validate document structure against schema.json.
 *
 * Intended behavior: synchronous AJV validation at API entry, stage boundaries, and final output.
 * @param {object} doc Seed document.
 * @returns {object} Validation result.
 */
function validateSchema(doc) {
  void doc;
  throw new Error("Not implemented");
}

module.exports = {
  validateSchema
};