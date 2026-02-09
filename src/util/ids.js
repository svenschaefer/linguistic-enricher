"use strict";

const crypto = require("node:crypto");

/**
 * Build deterministic ID from namespace and payload.
 * @param {string} namespace ID namespace/prefix.
 * @param {object|string} payload Deterministic payload basis.
 * @returns {string} Deterministic ID.
 */
function createDeterministicId(namespace, payload) {
  const normalizedNamespace = String(namespace || "id");
  const basis = typeof payload === "string" ? payload : JSON.stringify(payload);
  const digest = crypto.createHash("sha1").update(basis).digest("hex").slice(0, 12);
  return normalizedNamespace + "-" + digest;
}

module.exports = {
  createDeterministicId
};
