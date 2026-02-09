# TODO: Build `linguistic-enricher` as an Independent CommonJS npm Package

## 0) Guardrails and Scope Lock

- Enforce project constraints from day one:
  - JavaScript only.
  - CommonJS only (`require`, `module.exports`).
  - No TypeScript.
  - No ES Modules (`import`, `export`, no `"type": "module"`).
  - No PowerShell-driven runtime behavior in the package itself.
- Lock functional scope to prototype stages 00..11 only.
- Exclude from implementation scope:
  - Stage 12 (elementary assertions).
  - All `xx-*` prototype directories.
- Preserve output boundary:
  - Authoritative output target stage = `relations_extracted`.
- Keep `README.md` and `schema.json` unchanged for now.

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
  - `createPipeline(options)`
  - `runDoctor(options)`
  - `validateDocument(doc, options)`
  - `PIPELINE_TARGETS` (constants)
- Accept raw text or a partial seed document input.
- Return a fully enriched seed object up to requested target stage, defaulting to `relations_extracted`.
- Ensure API is deterministic and side-effect controlled.

## 4) Internal Pipeline Architecture (Single Coherent Pipeline)

- Present one unified pipeline externally, while internally keeping stage modules.
- Build a stage registry with ordered execution and target cutoffs.
- Implement a canonical stage chain corresponding to 00..11:
  1. surface normalization
  2. canonicalization
  3. segmentation
  4. tokenization
  5. POS tagging
  6. MWE candidate extraction (spaCy-backed path only)
  7. MWE candidate construction
  8. MWE materialization
  9. linguistic analysis
  10. chunking (POS-FSM only)
  11. head identification
  12. relation extraction
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

## 6) Optional `wikipedia-title-index` Service Integration

- Implement optional HTTP client in `src/services/wikipedia-title-index-client.js`.
- Configuration shape in pipeline options:
  - `services.wikipediaTitleIndex.endpoint` (or equivalent normalized key).
- If endpoint exists:
  - Query service deterministically for lexical signals.
  - Integrate signals into enrichment evidence paths.
- If endpoint is absent/unreachable:
  - Continue pipeline deterministically without lexical title signals.
  - Do not hard-fail solely due to missing optional service.
- Do not bundle or embed title index data.

## 7) Schema Enforcement and Validation Strategy

- Treat `schema.json` as authoritative shape contract.
- Add structural schema validation after each stage transition and final output.
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

## 9) CLI Design (Thin Wrapper Around Library)

- Implement CLI in `bin/linguistic-enricher.js` as a thin adapter.
- CLI commands (initial):
  - `run` (text/file input -> JSON output)
  - `doctor` (runtime checks)
  - `validate` (validate provided seed JSON against schema + invariants)
- CLI flags (initial):
  - `--in`, `--text`, `--out`, `--target`, `--pretty`
  - `--services.wikipediaTitleIndex.endpoint` (or normalized alias)
  - `--timeout-ms`
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
- Cross-platform expectations:
  - tests must pass on Windows/Linux/macOS with Node CommonJS runtime.

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

## 12) Migration Sequence (Execution Plan)

1. Scaffold package structure and CommonJS package metadata.
2. Implement public API shell and stage registry.
3. Migrate core text stages (normalization -> tokenization).
4. Migrate POS stage and wire Python runtime bridge.
5. Migrate spaCy-only MWE candidate extraction.
6. Migrate MWE construction and materialization.
7. Migrate linguistic analysis stage.
8. Migrate POS-FSM chunking stage.
9. Migrate head identification and relation extraction.
10. Integrate optional wikipedia-title-index client.
11. Wire schema validation + runtime invariants at stage boundaries.
12. Implement CLI wrapper and doctor command.
13. Add unit + integration test suites.
14. Run full deterministic regression checks.
15. Prepare package for independent versioning and publish workflow.

## 13) Acceptance Criteria

- Package is installable and runnable independently of Secos.
- Public API is CommonJS-only and library-first.
- CLI is optional and thin, backed by same API.
- Pipeline executes deterministically through `relations_extracted`.
- No stage 12/`xx-*` functionality included.
- Optional wikipedia-title-index endpoint works when configured and is safely optional when absent.
- Output conforms to `schema.json` and runtime invariants.
- Tests pass for unit and integration suites.
