"use strict";

const childProcess = require("child_process");
const errors = require("../util/errors");

const DEFAULT_MODEL = "en_core_web_sm";
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Execute a Python command and collect stdout/stderr.
 * @param {string} executable Python executable.
 * @param {string[]} args Python arguments.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {{ok:boolean,status:number|null,stdout:string,stderr:string,error:Error|undefined}}
 */
function runPythonCommand(executable, args, timeoutMs) {
  const result = childProcess.spawnSync(executable, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    shell: false
  });

  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error
  };
}

/**
 * Resolve a usable Python executable.
 * @param {object} [options] Runtime check options.
 * @returns {{executable:string,version:string}}
 */
function resolvePythonExecutable(options) {
  const timeoutMs = Number(options && options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : DEFAULT_TIMEOUT_MS;

  const configured = options && typeof options.pythonExecutable === "string"
    ? options.pythonExecutable.trim()
    : "";

  const candidates = configured ? [configured] : ["python", "python3"];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const res = runPythonCommand(candidate, ["--version"], timeoutMs);

    if (res.ok) {
      const version = (res.stdout || res.stderr).trim();
      return { executable: candidate, version: version };
    }
  }

  throw errors.createError(
    errors.ERROR_CODES.E_PYTHON_NOT_FOUND,
    "Python executable not found. Install Python 3 and ensure `python` or `python3` is on PATH, or provide `pythonExecutable`.",
    { candidates: candidates }
  );
}

/**
 * Ensure spaCy can be imported in Python runtime.
 * @param {string} executable Python executable.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {void}
 */
function checkSpacyImport(executable, timeoutMs) {
  const res = runPythonCommand(executable, ["-c", "import spacy"], timeoutMs);
  if (!res.ok) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_DEPENDENCY_MISSING,
      "Required Python dependency `spacy` is missing. Install it in the Python environment used by this package.",
      { executable: executable, stderr: res.stderr.trim(), status: res.status }
    );
  }
}

/**
 * Ensure required spaCy model is installed (no auto-install).
 * @param {string} executable Python executable.
 * @param {string} modelName spaCy model name.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {void}
 */
function checkSpacyModel(executable, modelName, timeoutMs) {
  const script = [
    "import spacy",
    "import sys",
    "spacy.load(sys.argv[1])"
  ].join("; ");
  const res = runPythonCommand(executable, ["-c", script, modelName], timeoutMs);

  if (!res.ok) {
    throw errors.createError(
      errors.ERROR_CODES.E_PYTHON_MODEL_MISSING,
      "Required spaCy model `" + modelName + "` is missing. Install the model in the active Python environment.",
      { executable: executable, model: modelName, stderr: res.stderr.trim(), status: res.status }
    );
  }
}

/**
 * Validate Python runtime prerequisites for this package.
 *
 * Intended behavior: verify Python executable, dependencies, and spaCy model availability.
 * @param {object} [options] Runtime check options.
 * @returns {Promise<object>} Runtime check report.
 */
async function runRuntimeChecks(options) {
  const normalizedOptions = options && typeof options === "object" ? options : {};
  const timeoutMs = Number(normalizedOptions.timeoutMs) > 0
    ? Number(normalizedOptions.timeoutMs)
    : DEFAULT_TIMEOUT_MS;
  const modelName = typeof normalizedOptions.modelName === "string" && normalizedOptions.modelName.trim()
    ? normalizedOptions.modelName.trim()
    : DEFAULT_MODEL;

  const python = resolvePythonExecutable(normalizedOptions);
  checkSpacyImport(python.executable, timeoutMs);
  checkSpacyModel(python.executable, modelName, timeoutMs);

  return {
    ok: true,
    python: {
      executable: python.executable,
      version: python.version
    },
    dependencies: {
      spacy: true
    },
    model: {
      name: modelName,
      installed: true
    }
  };
}

module.exports = {
  runRuntimeChecks
};
