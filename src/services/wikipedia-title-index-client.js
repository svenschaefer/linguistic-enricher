"use strict";

/**
 * Create optional wikipedia-title-index HTTP client.
 *
 * Intended behavior: call GET /health and POST /v1/titles/query when endpoint is configured.
 * @param {object} config Service client config.
 * @returns {object} Client facade.
 */
function createWikipediaTitleIndexClient(config) {
  void config;
  throw new Error("Not implemented");
}

module.exports = {
  createWikipediaTitleIndexClient
};