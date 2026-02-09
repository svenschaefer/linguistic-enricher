#!/usr/bin/env node
"use strict";

const api = require("../src/index");

/**
 * CLI command stub for `run`.
 * Intended behavior: execute pipeline and print/write result.
 */
function run() {
  console.log("TODO: run command is not implemented yet");
}

/**
 * CLI command stub for `doctor`.
 * Intended behavior: execute runtime checks and return status.
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

/**
 * CLI command stub for `validate`.
 * Intended behavior: validate a seed document against schema and invariants.
 */
function validate() {
  console.log("TODO: validate command is not implemented yet");
}

async function main(argv) {
  const command = argv[2] || "run";

  if (command === "run") {
    run();
    return;
  }

  if (command === "doctor") {
    await doctor();
    return;
  }

  if (command === "validate") {
    validate();
    return;
  }

  console.log("TODO: unknown command. Supported commands: run, doctor, validate");
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
