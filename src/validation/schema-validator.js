"use strict";

const Ajv2020 = require("ajv/dist/2020");
const errors = require("../util/errors");
const schema = require("../../schema.json");

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false
});
const validate = ajv.compile(schema);

/**
 * Validate document structure against schema.json.
 *
 * Intended behavior: synchronous AJV validation at API entry, stage boundaries, and final output.
 * @param {object} doc Seed document.
 * @returns {object} Validation result.
 */
function validateSchema(doc) {
  const ok = validate(doc);

  if (!ok) {
    throw errors.createError(
      errors.ERROR_CODES.E_SCHEMA_INVALID,
      "Document failed schema validation.",
      { errors: validate.errors || [] }
    );
  }

  return { ok: true };
}

module.exports = {
  validateSchema
};
