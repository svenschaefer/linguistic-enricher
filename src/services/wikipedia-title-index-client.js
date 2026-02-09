"use strict";

function normalizeConfig(config) {
  const input = config && typeof config === "object" ? config : {};
  const services = input.services && typeof input.services === "object" ? input.services : {};
  const canonical = services["wikipedia-title-index"];
  const alias = services.wikipediaTitleIndex;
  const selected = canonical || alias || {};
  return {
    endpoint: typeof selected.endpoint === "string" ? selected.endpoint : "",
    timeoutMs: Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : 3000
  };
}

async function requestJson(url, method, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function onTimeout() {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create optional wikipedia-title-index HTTP client.
 *
 * Intended behavior: call GET /health and POST /v1/titles/query when endpoint is configured.
 * @param {object} config Service client config.
 * @returns {object} Client facade.
 */
function createWikipediaTitleIndexClient(config) {
  const normalized = normalizeConfig(config);
  const enabled = Boolean(normalized.endpoint);

  async function health() {
    if (!enabled) {
      return { enabled: false, ok: false };
    }
    const json = await requestJson(normalized.endpoint.replace(/\/$/, "") + "/health", "GET", null, normalized.timeoutMs);
    return { enabled: true, ok: true, response: json };
  }

  async function queryTitle(surface, limit) {
    if (!enabled) {
      return null;
    }
    const payload = {
      sql: "SELECT t FROM titles WHERE t = ? OR t LIKE ? ORDER BY t LIMIT ?",
      params: [surface, surface + "%", Number(limit) > 0 ? Number(limit) : 10]
    };
    return requestJson(
      normalized.endpoint.replace(/\/$/, "") + "/v1/titles/query",
      "POST",
      payload,
      normalized.timeoutMs
    );
  }

  return {
    enabled: enabled,
    health: health,
    queryTitle: queryTitle
  };
}

module.exports = {
  createWikipediaTitleIndexClient
};
