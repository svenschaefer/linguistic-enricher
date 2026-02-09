"use strict";

/**
 * Build JSON protocol request payload for Python subprocess.
 * @param {string} operation Operation key.
 * @param {object} payload Operation payload.
 * @returns {object} Protocol request object.
 */
function buildRequest(operation, payload) {
  void operation;
  void payload;
  throw new Error("Not implemented");
}

/**
 * Parse and validate JSON protocol response from Python subprocess.
 * @param {string} raw Raw stdout payload.
 * @returns {object} Parsed protocol response.
 */
function parseResponse(raw) {
  void raw;
  throw new Error("Not implemented");
}

module.exports = {
  buildRequest,
  parseResponse
};