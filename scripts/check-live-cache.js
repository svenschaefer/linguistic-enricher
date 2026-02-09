"use strict";

const fs = require("node:fs");
const path = require("node:path");
const api = require("../src");

function walkCache(rootDir) {
  let fileCount = 0;
  let dirCount = 0;

  function walk(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        dirCount += 1;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        fileCount += 1;
      }
    }
  }

  walk(rootDir);
  return { fileCount: fileCount, dirCount: dirCount };
}

async function run() {
  const endpoint = process.env.WIKI_INDEX_ENDPOINT || "http://127.0.0.1:32123";
  const cacheDir = path.resolve(process.cwd(), "data/cache");

  const before = walkCache(cacheDir);
  console.log("[cache-check] endpoint:", endpoint);
  console.log("[cache-check] before:", JSON.stringify(before));

  const options = {
    target: "mwe_candidates",
    services: {
      "wikipedia-title-index": {
        endpoint: endpoint
      }
    }
  };

  await api.runPipeline("An online store has a shopping cart.", options);
  await api.runPipeline("An online store has a shopping cart.", options);

  const after = walkCache(cacheDir);
  console.log("[cache-check] after:", JSON.stringify(after));

  if (after.fileCount <= before.fileCount) {
    console.log("[cache-check] warning: no new cache json files observed. Verify endpoint and service cache config.");
  } else {
    console.log("[cache-check] ok: cache json files increased.");
  }
}

run().catch(function onError(error) {
  console.error("[cache-check] failed:", error && error.message ? error.message : String(error));
  process.exit(1);
});
