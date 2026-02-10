#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const api = require("../src/index");

function usageError(message) {
  const error = new Error(message);
  error.code = "E_CLI_USAGE";
  return error;
}

function printGlobalUsage() {
  console.log("Usage: linguistic-enricher <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  run       Run pipeline and print JSON");
  console.log("  validate  Validate JSON document");
  console.log("  doctor    Check runtime prerequisites");
  console.log("");
  console.log("Use \"linguistic-enricher <command> --help\" for command options.");
}

function printRunUsage() {
  console.log("Usage: linguistic-enricher run (--text <text> | --in <file>) [options]");
  console.log("Options:");
  console.log("  --out <file>                  Write JSON output to file");
  console.log("  --target <pipeline-target>    Pipeline cutoff target");
  console.log("  --pretty                      Pretty-print JSON");
  console.log("  --service-wti-endpoint <url>  wikipedia-title-index endpoint");
  console.log("  --timeout-ms <ms>             Service/runtime timeout");
  console.log("  --strict                      Strict mode for optional dependencies");
}

function printValidateUsage() {
  console.log("Usage: linguistic-enricher validate --in <file> [--pretty]");
}

function printDoctorUsage() {
  console.log("Usage: linguistic-enricher doctor [--python-executable <path>] [--timeout-ms <ms>]");
}

function parseArgs(argv, command) {
  const args = argv.slice(3);
  const out = {};
  const noValueFlags = new Set(["--pretty", "--strict", "--help", "-h"]);
  const needsValue = new Set(["--in", "--text", "--out", "--target", "--service-wti-endpoint", "--timeout-ms", "--python-executable"]);
  const allowedByCommand = {
    run: new Set(["--in", "--text", "--out", "--target", "--pretty", "--service-wti-endpoint", "--timeout-ms", "--strict", "--help", "-h"]),
    validate: new Set(["--in", "--pretty", "--help", "-h"]),
    doctor: new Set(["--python-executable", "--timeout-ms", "--help", "-h"])
  };
  const allowed = allowedByCommand[command] || new Set(["--help", "-h"]);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      throw usageError("Unexpected positional argument: " + arg);
    }
    if (!allowed.has(arg)) {
      throw usageError("Unknown flag for " + command + ": " + arg);
    }
    if (noValueFlags.has(arg)) {
      if (arg === "--help" || arg === "-h") {
        out.help = true;
      } else {
        out[arg.slice(2)] = true;
      }
      continue;
    }
    if (needsValue.has(arg)) {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        throw usageError("Missing value for flag: " + arg);
      }
      out[arg.slice(2)] = next;
      i += 1;
      continue;
    }
    throw usageError("Unknown flag: " + arg);
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
  const options = parseArgs(argv, "run");
  if (options.help) {
    printRunUsage();
    return;
  }
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
async function doctor(argv) {
  const options = parseArgs(argv, "doctor");
  if (options.help) {
    printDoctorUsage();
    return;
  }
  const result = await api.runDoctor({
    pythonExecutable: options["python-executable"] || process.env.PYTHON_EXECUTABLE,
    timeoutMs: options["timeout-ms"] ? Number(options["timeout-ms"]) : undefined
  });
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
}

function validate(argv) {
  const options = parseArgs(argv, "validate");
  if (options.help) {
    printValidateUsage();
    return;
  }
  if (!options.in) {
    throw usageError("validate requires --in <path>");
  }

  const raw = fs.readFileSync(options.in, "utf8");
  const doc = JSON.parse(raw);
  const result = api.validateDocument(doc);
  console.log(JSON.stringify(result, null, options.pretty ? 2 : 0));
}

async function main(argv) {
  const command = argv[2];

  if (!command || command === "--help" || command === "-h") {
    printGlobalUsage();
    return;
  }

  if (command === "run") {
    await run(argv);
    return;
  }

  if (command === "doctor") {
    await doctor(argv);
    return;
  }

  if (command === "validate") {
    validate(argv);
    return;
  }

  throw usageError("Unknown command. Supported commands: run, doctor, validate");
}

if (require.main === module) {
  main(process.argv).catch(function onMainError(error) {
    const code = error && error.code ? error.code : "E_CLI_FAILED";
    console.error("CLI failed [" + code + "]: " + error.message);
    if (code === "E_CLI_USAGE") {
      const cmd = process.argv[2];
      if (cmd === "run") {
        printRunUsage();
      } else if (cmd === "validate") {
        printValidateUsage();
      } else if (cmd === "doctor") {
        printDoctorUsage();
      } else {
        printGlobalUsage();
      }
    }
    process.exit(1);
  });
}

module.exports = {
  run,
  doctor,
  validate,
  main
};
