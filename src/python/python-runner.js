"use strict";

const childProcess = require("child_process");
const protocol = require("./protocol");
const errors = require("../util/errors");

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Resolve python executable from options.
 * @param {object} [options] Runner options.
 * @returns {string} Python executable.
 */
function resolvePythonExecutable(options) {
  if (options && typeof options.pythonExecutable === "string" && options.pythonExecutable.trim()) {
    return options.pythonExecutable.trim();
  }
  return "python";
}

/**
 * Resolve python subprocess args from options.
 * @param {object} [options] Runner options.
 * @returns {string[]} Python args.
 */
function resolvePythonArgs(options) {
  if (options && Array.isArray(options.pythonArgs)) {
    return options.pythonArgs.slice();
  }
  return [];
}

/**
 * Execute a python stage through JSON stdin/stdout protocol.
 *
 * Intended behavior: spawn Python, pass JSON request, parse JSON response, map typed runtime errors.
 * @param {string} stageName Stage name.
 * @param {object} payload Stage payload.
 * @param {object} [options] Runner options.
 * @returns {Promise<object>} Stage result payload.
 */
async function runPythonStage(stageName, payload, options) {
  const normalizedOptions = options && typeof options === "object" ? options : {};
  const timeoutMs = Number(normalizedOptions.timeoutMs) > 0
    ? Number(normalizedOptions.timeoutMs)
    : DEFAULT_TIMEOUT_MS;
  const executable = resolvePythonExecutable(normalizedOptions);
  const args = resolvePythonArgs(normalizedOptions);
  const requestJson = protocol.serializeRequest(stageName, payload, normalizedOptions.requestOptions);

  return new Promise(function promiseExecutor(resolve, reject) {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer = null;

    const child = childProcess.spawn(executable, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });

    timer = setTimeout(function onTimeout() {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", function onStdout(chunk) {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", function onStderr(chunk) {
      stderr += chunk.toString("utf8");
    });

    child.on("error", function onError(spawnError) {
      clearTimeout(timer);
      reject(
        errors.createError(
          errors.ERROR_CODES.E_PYTHON_SUBPROCESS_FAILED,
          "Python subprocess failed to start.",
          { executable: executable, error: spawnError.message }
        )
      );
    });

    child.on("close", function onClose(code, signal) {
      clearTimeout(timer);

      if (timedOut) {
        reject(
          errors.createError(
            errors.ERROR_CODES.E_PYTHON_TIMEOUT,
            "Python subprocess timed out.",
            { timeoutMs: timeoutMs, executable: executable, args: args }
          )
        );
        return;
      }

      if (code !== 0) {
        reject(
          errors.createError(
            errors.ERROR_CODES.E_PYTHON_SUBPROCESS_FAILED,
            "Python subprocess exited with non-zero status.",
            { executable: executable, args: args, exitCode: code, signal: signal, stderr: stderr.trim() }
          )
        );
        return;
      }

      let response;
      try {
        response = protocol.parseResponse(stdout);
      } catch (protocolError) {
        reject(protocolError);
        return;
      }

      if (!response.ok) {
        reject(
          errors.createError(
            errors.ERROR_CODES.E_PYTHON_SUBPROCESS_FAILED,
            response.error.message,
            { code: response.error.code, details: response.error.details }
          )
        );
        return;
      }

      resolve(response.result);
    });

    child.stdin.write(requestJson);
    child.stdin.end();
  });
}

module.exports = {
  runPythonStage
};
