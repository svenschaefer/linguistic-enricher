"use strict";

/**
 * Typed error used across linguistic-enricher runtime boundaries.
 * @extends Error
 */
class EnricherError extends Error {
  /**
   * @param {string} code Stable machine-readable error code.
   * @param {string} message Human-readable message.
   * @param {object} [details] Optional structured error details.
   */
  constructor(code, message, details) {
    super(message);
    this.name = "EnricherError";
    this.code = code;
    if (typeof details !== "undefined") {
      this.details = details;
    }
  }
}

/**
 * Known runtime error codes used in phase-3 infrastructure.
 */
const ERROR_CODES = Object.freeze({
  E_PYTHON_NOT_FOUND: "E_PYTHON_NOT_FOUND",
  E_PYTHON_DEPENDENCY_MISSING: "E_PYTHON_DEPENDENCY_MISSING",
  E_PYTHON_MODEL_MISSING: "E_PYTHON_MODEL_MISSING",
  E_PYTHON_TIMEOUT: "E_PYTHON_TIMEOUT",
  E_PYTHON_SUBPROCESS_FAILED: "E_PYTHON_SUBPROCESS_FAILED",
  E_PYTHON_PROTOCOL_INVALID_JSON: "E_PYTHON_PROTOCOL_INVALID_JSON"
});

/**
 * Construct a typed runtime error.
 * @param {string} code Stable error code.
 * @param {string} message Human-readable message.
 * @param {object} [details] Optional details.
 * @returns {EnricherError} Typed error instance.
 */
function createError(code, message, details) {
  return new EnricherError(code, message, details);
}

module.exports = {
  EnricherError,
  ERROR_CODES,
  createError
};
