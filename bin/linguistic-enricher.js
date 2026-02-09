#!/usr/bin/env node
"use strict";

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
function doctor() {
  console.log("TODO: doctor command is not implemented yet");
}

/**
 * CLI command stub for `validate`.
 * Intended behavior: validate a seed document against schema and invariants.
 */
function validate() {
  console.log("TODO: validate command is not implemented yet");
}

function main(argv) {
  const command = argv[2] || "run";

  if (command === "run") {
    run();
    return;
  }

  if (command === "doctor") {
    doctor();
    return;
  }

  if (command === "validate") {
    validate();
    return;
  }

  console.log("TODO: unknown command. Supported commands: run, doctor, validate");
}

if (require.main === module) {
  main(process.argv);
}

module.exports = {
  run,
  doctor,
  validate,
  main
};