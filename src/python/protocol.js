"use strict";

const errors = require("../util/errors");

/**
 * Build JSON protocol request payload for Python subprocess.
 * @param {string} stage Stage key.
 * @param {object} payload Operation payload.
 * @param {object} [options] Operation options.
 * @returns {string} Serialized protocol request JSON.
 */
function serializeRequest(stage, payload, options) {
  if (typeof stage !== "string" || !stage.trim()) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol request must include a non-empty `stage` string."
    );
  }

  const envelope = {
    stage: stage,
    payload: typeof payload === "undefined" ? {} : payload,
    options: options && typeof options === "object" ? options : {}
  };

  return JSON.stringify(envelope);
}

/**
 * Validate parsed protocol response envelope.
 * @param {object} envelope Parsed response object.
 * @returns {object} Validated response object.
 */
function validateResponseEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol response must be a JSON object envelope."
    );
  }

  if (typeof envelope.ok !== "boolean") {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol response must include boolean `ok`."
    );
  }

  if (envelope.ok) {
    if (!Object.prototype.hasOwnProperty.call(envelope, "result")) {
      throw errors.createError(
        errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
        "Protocol response with `ok=true` must include `result`."
      );
    }
    return envelope;
  }

  if (!envelope.error || typeof envelope.error !== "object") {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol response with `ok=false` must include `error` object."
    );
  }

  if (typeof envelope.error.code !== "string" || !envelope.error.code) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol error must include string `error.code`."
    );
  }

  if (typeof envelope.error.message !== "string" || !envelope.error.message) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol error must include string `error.message`."
    );
  }

  return envelope;
}

/**
 * Parse and validate JSON protocol response from Python subprocess.
 * @param {string} raw Raw stdout payload.
 * @returns {object} Parsed protocol response.
 */
function parseResponse(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol response stdout is empty or not a string."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON,
      "Protocol response is not valid JSON.",
      { parseError: error.message }
    );
  }

  return validateResponseEnvelope(parsed);
}

module.exports = {
  serializeRequest,
  parseResponse,
  validateResponseEnvelope
};
