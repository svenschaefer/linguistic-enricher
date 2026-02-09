"use strict";

/**
 * Execute Python subprocess command using JSON stdin/stdout protocol.
 *
 * Intended behavior: spawn Python, pass JSON request, parse JSON response, map typed runtime errors.
 * @param {object} request Protocol request payload.
 * @param {object} [options] Runner options (timeouts, executable path).
 * @returns {Promise<object>} Parsed protocol response.
 */
async function runPython(request, options) {
  void request;
  void options;
  throw new Error("Not implemented");
}

module.exports = {
  runPython
};