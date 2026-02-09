"use strict";

/**
 * Clone JSON-compatible values deterministically.
 * @param {any} value Input value.
 * @returns {any} Cloned value.
 */
function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  deepClone
};
