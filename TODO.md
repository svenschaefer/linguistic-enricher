# TODO: Harden `linguistic-enricher` to Prototype-Semantic Parity (CommonJS)

## Current Status (Baseline Complete)

- Independent CommonJS package scaffold is complete.
- Public API (`runPipeline`, `runDoctor`, `validateDocument`) is implemented.
- CLI wrapper (`run`, `doctor`, `validate`) is implemented.
- Validation hooks and baseline invariant checks are integrated.
- Deterministic utility baseline exists.
- Unit + integration test suites and lint gates are in place.

## Next Execution Mode (Fidelity Hardening)

- Remaining work is fidelity hardening, not scaffolding.
- Prototype source corpus is semantic reference only.
- Do NOT port legacy file/YAML artifact mechanics or script-driven execution.
- Preserve API-first in-memory architecture.
- Execute stage hardening sequentially: 00 -> 11.
- Every stage hardening step is test-gated and lint-gated before moving on.

## 0) Guardrails and Scope Lock

- Enforce project constraints from day one:
  - JavaScript only.
  - CommonJS only (`require`, `module.exports`).
  - No TypeScript.
  - No ES Modules (`import`, `export`, no `"type": "module"`).
  - No PowerShell-driven runtime behavior in the package itself.
- Lock functional scope to baseline stages 00..11 only.
- Exclude from implementation scope:
  - Stage 12 (elementary assertions).
  - All `xx-*` legacy directories.
- Preserve output boundary:
  - Authoritative output target stage = `relations_extracted`.
- Keep `schema.json` unchanged unless explicitly requested.

## 1) Repository and Folder Structure (CommonJS Layout)

- Create and maintain a package-first layout in `C:\code\linguistic-enricher`:
  - `package.json`
  - `README.md` (already present; do not modify in this step)
  - `schema.json` (already present; do not modify in this step)
  - `TODO.md`
  - `src/`
    - `index.js` (public CommonJS library entry)
    - `pipeline/`
      - `run-pipeline.js`
      - `stages/`
        - `surface-normalization.js`
        - `canonicalization.js`
        - `segmentation.js`
        - `tokenization.js`
        - `pos-tagging.js`
        - `mwe-candidate-extraction.js`
        - `mwe-candidate-construction.js`
        - `mwe-materialization.js`
        - `linguistic-analysis.js`
        - `chunking.js`
        - `head-identification.js`
        - `relation-extraction.js`
      - `stage-registry.js`
    - `python/`
      - `python-runner.js`
      - `protocol.js`
      - `runtime-check.js`
    - `services/`
      - `wikipedia-title-index-client.js`
    - `validation/`
      - `schema-validator.js`
      - `runtime-invariants.js`
    - `util/`
      - `deep-clone.js`
      - `ids.js`
      - `spans.js`
      - `determinism.js`
      - `errors.js`
  - `bin/`
    - `linguistic-enricher.js` (CLI wrapper; CommonJS)
  - `test/`
    - `unit/`
    - `integration/`
    - `fixtures/`

## 2) `package.json` Design (CommonJS, No ESM)

- Initialize npm package metadata for independent publishing.
- Set package name to `linguistic-enricher`.
- Ensure CommonJS behavior:
  - Do not set `"type": "module"`.
- Define library entry:
  - `"main": "src/index.js"`.
- Define CLI entry:
  - `"bin": { "linguistic-enricher": "bin/linguistic-enricher.js" }`.
- Add scripts for portable development/test:
  - `test`, `test:unit`, `test:integration`, `lint`, `doctor`.
- Add `engines.node` for supported Node runtime.
- Keep dependencies minimal and cross-platform.
- Avoid any dependency that forces ESM-only usage in runtime entry paths.

## 3) Public JavaScript API (CommonJS Exports)

- Implement a library-first API via `src/index.js` using `module.exports`.
- Define stable exported surface (initial target):
  - `runPipeline(input, options)`
  - `runDoctor(options)`
  - `validateDocument(doc, options)`
  - `PIPELINE_TARGETS` (constants)
- Do not export `createPipeline(...)` in v1 unless explicitly added to `README.md`.
- Accept raw text or a partial seed document input.
- Return a fully enriched seed object up to requested target stage, defaulting to `relations_extracted`.
- Ensure API is deterministic and side-effect controlled.
- Explicitly publish allowed `target` literals for this package:
  - `canonical`
  - `segmented`
  - `tokenized`
  - `pos_tagged`
  - `mwe_candidates`
  - `mwe_pattern_candidates`
  - `mwe_materialized`
  - `parsed`
  - `chunked`
  - `heads_identified`
  - `relations_extracted`

## 4) Internal Pipeline Architecture (Single Coherent Pipeline)

- Present one unified pipeline externally, while internally keeping stage modules.
- Build a stage registry with ordered execution and target cutoffs.
- Implement a canonical stage chain corresponding exactly to baseline stages `00..11`:
  - `00` surface normalization
  - `01` canonicalization
  - `02` segmentation
  - `03` tokenization
  - `04` POS tagging
  - `05` MWE candidate extraction (spaCy-backed path only)
  - `06` MWE candidate construction
  - `07` MWE materialization
  - `08` linguistic analysis
  - `09` chunking (POS-FSM only)
  - `10` head identification
  - `11` relation extraction
- Do not expose numeric stage names in user-facing API/CLI.
- Keep stage naming semantic (e.g., `relations_extracted`) in options and outputs.

## 5) Python Runtime Integration via `child_process`

- Encapsulate all Python interactions in `src/python/*`.
- Use `child_process.spawn` for Python subprocess execution.
- Implement strict JSON protocol over stdin/stdout:
  - Node sends request payload JSON.
  - Python returns result JSON only.
  - Non-JSON stderr treated as diagnostic error path.
- Add robust timeout, exit-code handling, and parse-error handling.
- Create a `doctor` flow to validate:
  - Python availability.
  - Required Python packages.
  - spaCy model availability.
- Ensure consumers never need to call Python directly.
- Define explicit runtime failure behavior:
  - Missing Python executable: throw typed error `E_PYTHON_NOT_FOUND` with remediation hint.
  - Missing Python dependency/module: throw typed error `E_PYTHON_DEPENDENCY_MISSING`.
  - Missing spaCy model: throw typed error `E_PYTHON_MODEL_MISSING`.
  - Subprocess non-zero exit: throw typed error `E_PYTHON_SUBPROCESS_FAILED` and include stderr excerpt.
  - Subprocess timeout: throw typed error `E_PYTHON_TIMEOUT`.
  - Invalid JSON on stdout: throw typed error `E_PYTHON_PROTOCOL_INVALID_JSON`.

## 6) Optional `wikipedia-title-index` Service Integration

- Implement optional HTTP client in `src/services/wikipedia-title-index-client.js`.
- Configuration shape in pipeline options:
  - Canonical key (must match README): `services[\"wikipedia-title-index\"].endpoint`.
  - Optional accepted alias for compatibility: `services.wikipediaTitleIndex.endpoint`.
  - Normalize alias -> canonical key internally before first request.
- HTTP contract expected from service:
  - `GET /health` for readiness checks.
  - `POST /v1/titles/query` for deterministic query operations.
  - Request/response shape must follow `wikipedia-title-index` service OpenAPI contract.
- If endpoint exists:
  - Query service deterministically for lexical signals.
  - Integrate signals into enrichment evidence paths.
- If endpoint is absent/unreachable:
  - Continue pipeline deterministically without lexical title signals.
  - Do not hard-fail solely due to missing optional service.
- Do not bundle or embed title index data.

## 7) Schema Enforcement and Validation Strategy

- Treat `schema.json` as authoritative shape contract.
- Use synchronous in-process schema validation (AJV in Node process) at:
  - API entry (if caller passes partial seed document).
  - Before each stage (precondition check).
  - After each stage (postcondition check).
  - Final output before returning to caller.
- Add runtime invariant checks not expressible in JSON Schema:
  - span ordering and bounds.
  - token/segment reference integrity.
  - deterministic ID/reference consistency.
  - accepted-annotation selector constraints.
- Validation failure behavior:
  - fail fast with precise diagnostics.
  - include stage context and invariant IDs.

## 8) Determinism Guarantees

- Standardize deterministic behavior across all stages:
  - stable ordering of tokens, annotations, and relations.
  - stable ID generation algorithm.
  - no random UUID defaults.
  - explicit sorting before output materialization where needed.
- Ensure optional service inputs are incorporated deterministically.
- Preserve additive enrichment contract:
  - no destructive rewriting of authoritative earlier structures.
- Enforce annotation status semantics explicitly:
  - `candidate`: proposal, non-authoritative.
  - `observation`: external/model-derived signal, non-authoritative.
  - `accepted`: authoritative pipeline output.
- Rule: probabilistic/model outputs must never be marked `accepted` without deterministic materialization rules.

## 9) CLI Design (Thin Wrapper Around Library)

- Implement CLI in `bin/linguistic-enricher.js` as a thin adapter.
- CLI commands (initial):
  - `run` (text/file input -> JSON output)
  - `doctor` (runtime checks)
  - `validate` (validate provided seed JSON against schema + invariants)
- CLI flags (initial):
  - `--in <path>`: read text or seed JSON input from file.
  - `--text \"...\"`: inline text input (mutually exclusive with `--in`).
  - `--out <path>`: write output JSON file (stdout if omitted).
  - `--target <literal>`: one of `PIPELINE_TARGETS`.
  - `--pretty`: pretty-print JSON output.
  - `--service-wti-endpoint <url>`: canonical mapping to `services[\"wikipedia-title-index\"].endpoint`.
  - `--timeout-ms <int>`: per-subprocess/per-service timeout override.
  - `--strict`: fail on missing optional services instead of fallback mode.
- CLI behavior rules:
  - `run`: executes pipeline and returns enriched document.
  - `doctor`: exits non-zero on missing Python/runtime requirements.
  - `validate`: validates input document and prints invariant/schema results.
- Ensure CLI delegates core logic to `src/index.js` exports.
- Keep CLI behavior cross-platform and shell-agnostic.

## 10) Testing Strategy (Unit + Integration)

- Unit tests:
  - one test module per stage and per utility.
  - schema validator and invariant validator tests.
  - wikipedia service client behavior tests (with mock HTTP).
  - python protocol parser/runner tests (mock subprocess IO).
- Integration tests:
  - full pipeline run from raw text to `relations_extracted`.
  - deterministic snapshot tests with stable fixtures.
  - test with optional service enabled (mock server).
  - test without optional service (must still pass).
  - explicit Python/runtime quality gates:
    - Python present.
    - Python missing.
    - spaCy model present.
    - spaCy model missing.
  - explicit service quality gates:
    - wikipedia-title-index service present/responding.
    - wikipedia-title-index service absent/unreachable.
  - explicit determinism vs observation gates:
    - observational annotations remain `observation`/`candidate`.
    - accepted outputs are produced only by deterministic rules.
- Cross-platform expectations:
  - tests must pass on Windows/Linux/macOS with Node CommonJS runtime.

## 10.1) Logging and Instrumentation Contract

- Provide structured logs in JSON lines format by default.
- Required fields per log event:
  - `ts` (ISO timestamp)
  - `level` (`error|warn|info|debug`)
  - `component` (e.g., `pipeline`, `python`, `service:wti`)
  - `event` (stable event key)
  - `seed_id` (when available)
  - `target` (when available)
- Log levels:
  - default: `info`
  - configurable via option/env (`LOG_LEVEL`)
- Logging must never change deterministic data outputs.

## 11) Explicit Mapping: Prototype Directories -> New Modules

- `00-surface-normalization` -> `src/pipeline/stages/surface-normalization.js`
- `01-canonicalization` -> `src/pipeline/stages/canonicalization.js`
- `02-segmentation` -> `src/pipeline/stages/segmentation.js`
- `03-tokenization` -> `src/pipeline/stages/tokenization.js`
- `04-pos-tagging` -> `src/pipeline/stages/pos-tagging.js`
- `05-mwe-candidate-extraction-spacy` -> `src/pipeline/stages/mwe-candidate-extraction.js`
  - Only spaCy-based implementation is migrated.
  - Other step-05 alternatives are not migrated.
- `06-mwe-candidate-construction` -> `src/pipeline/stages/mwe-candidate-construction.js`
- `07-mwe-materialization` -> `src/pipeline/stages/mwe-materialization.js`
- `08-linguistic-analysis` -> `src/pipeline/stages/linguistic-analysis.js`
- `09-chunking-pos-fsm` -> `src/pipeline/stages/chunking.js`
  - Only POS-FSM implementation is migrated.
  - Other step-09 alternatives are not migrated.
- `10-head-identification` -> `src/pipeline/stages/head-identification.js`
- `11-relation-extraction` -> `src/pipeline/stages/relation-extraction.js`
- Not migrated:
  - `12-elementary-assertions`
  - all `xx-*` directories

## 12) Fidelity Hardening Sequence (Execution Plan)

1. Baseline consistency checks (docs/API alignment, validation/determinism guardrails).
2. Harden stage 00 (surface normalization), add focused unit/integration tests.
3. Harden stage 01 (canonicalization), add focused tests.
4. Harden stage 02 (segmentation), add focused tests.
5. Harden stage 03 (tokenization), add focused tests.
6. Harden stage 04 (POS tagging), add focused tests.
7. Harden stage 05 (spaCy MWE candidate extraction path), add focused tests.
8. Harden stage 06 (MWE candidate construction), add focused tests.
9. Harden stage 07 (MWE materialization), add focused tests.
10. Harden stage 08 (linguistic analysis), add focused tests.
11. Harden stage 09 (POS-FSM chunking), add focused tests.
12. Harden stage 10 (head identification), add focused tests.
13. Harden stage 11 (relation extraction), add focused tests.
14. Run full deterministic regression suite.
15. Final release hardening and versioning.

## 12.1) Upstream Structural Coverage Evaluation (00-11) - Baseline Findings (2026-02-13)

Authoritative reference:
- `UPSTREAM_STRUCTURAL_COVERAGE_EVALUATION.md` (evaluation-only baseline; target output = `relations_extracted`).

### Blockers

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve copula/passive core argument structure so copula complements and passive subjects remain explicit and lossless in upstream relations (no collapse of attribute/complement signals, no subject-anchor drift in passive clauses).
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 04 (contributing), Stage 08 (dominant), Stage 11 (secondary)]` Preserve enumeration/list semantics for `such as` constructions so governing predicate/object relations and exemplar membership are emitted without promoting exemplars to unrelated root events.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve purpose-PP and coordinated nominal purpose structure (`for ... and ...`) as attached purpose/complement relations, without reclassifying gerund-like complements as standalone event predicates.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

### Degrading

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Stabilize passive-with-agent output so required passive roles remain explicit while removing contradictory fallback role noise on the same participants.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve sequential coordinated-verb clause structure so each verb keeps its own subject/object/attachment frame and PP roles are not flattened into generic theme relations.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve `as well as` additive coordination semantics so secondary members are represented as coordinated arguments, not modifier artifacts.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve inline multi-verb list structure (`request/update/assign`) so each coordinated predicate retains explicit subject/object coverage without object over-absorption into the first predicate.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve temporal PP attachment as explicit temporal/prepositional structure rather than object/theme flattening.
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

Tracking rule:
- Blockers in this section MUST be resolved before claiming upstream structural-capture success criteria, because the baseline evaluation marks success criteria as not met while blockers remain.

## 13) Acceptance Criteria

- Package is installable and runnable as an independent npm package.
- Public API is CommonJS-only and library-first.
- CLI is optional and thin, backed by same API.
- Pipeline executes deterministically through `relations_extracted`.
- Stage 11 semantic extraction contract is explicit and test-locked:
  - canonical accepted semantic edges are validated in `kind="dependency"` (current contract),
  - release smoke/integration gates assert accepted semantic labels, not `kind="relation"` counts.
- No stage 12/`xx-*` functionality included.
- Optional wikipedia-title-index endpoint works when configured and is safely optional when absent.
- Output conforms to `schema.json` and runtime invariants.
- Tests pass for unit and integration suites.
- CLI options and target literals are documented and validated consistently with runtime behavior.
