#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const api = require("../src/index");

function parseArgs(argv) {
  const args = argv.slice(3);
  const out = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--pretty") {
      out.pretty = true;
      continue;
    }
    if (arg === "--strict") {
      out.strict = true;
      continue;
    }
    if (arg === "--in" || arg === "--text" || arg === "--out" || arg === "--target" || arg === "--service-wti-endpoint" || arg === "--timeout-ms") {
      out[arg.slice(2)] = args[i + 1];
      i += 1;
      continue;
    }
  }

  return out;
}

function readInput(options) {
  if (options.text && options.in) {
    throw new Error("Use either --text or --in, not both.");
  }

  if (options.text) {
    return options.text;
  }

  if (options.in) {
    return fs.readFileSync(options.in, "utf8");
  }

  throw new Error("Missing input. Use --text or --in.");
}

async function run(argv) {
  const options = parseArgs(argv);
  const input = readInput(options);

  const pipelineOptions = {
    target: options.target,
    timeoutMs: options["timeout-ms"] ? Number(options["timeout-ms"]) : undefined,
    services: options["service-wti-endpoint"]
      ? { "wikipedia-title-index": { endpoint: options["service-wti-endpoint"] } }
      : undefined,
    strict: options.strict === true
  };

  const result = await api.runPipeline(input, pipelineOptions);
  const serialized = JSON.stringify(result, null, options.pretty ? 2 : 0);

  if (options.out) {
    fs.writeFileSync(options.out, serialized + "\n", "utf8");
  } else {
    console.log(serialized);
  }
}

/**
 * CLI command for `doctor`.
 * @returns {Promise<void>}
 */
async function doctor() {
  try {
    const result = await api.runDoctor({});
    console.log("Doctor checks passed.");
    console.log(
      "Python executable: " +
        result.python.executable +
        " (" +
        result.python.version +
        ")"
    );
    console.log("spaCy: ok");
    console.log("spaCy model: " + result.model.name + " (installed)");
  } catch (error) {
    const code = error && error.code ? error.code : "E_DOCTOR_FAILED";
    console.error("Doctor checks failed [" + code + "]: " + error.message);
    process.exitCode = 1;
  }
}

function validate(argv) {
  const options = parseArgs(argv);
  if (!options.in) {
    throw new Error("validate requires --in <path>");
  }

  const raw = fs.readFileSync(options.in, "utf8");
  const doc = JSON.parse(raw);
  const result = api.validateDocument(doc);
  console.log(JSON.stringify(result, null, options.pretty ? 2 : 0));
}

async function main(argv) {
  const command = argv[2] || "run";

  if (command === "run") {
    await run(argv);
    return;
  }

  if (command === "doctor") {
    await doctor();
    return;
  }

  if (command === "validate") {
    validate(argv);
    return;
  }

  throw new Error("Unknown command. Supported commands: run, doctor, validate");
}

if (require.main === module) {
  main(process.argv).catch(function onMainError(error) {
    console.error("CLI failed: " + error.message);
    process.exit(1);
  });
}

module.exports = {
  run,
  doctor,
  validate,
  main
};
