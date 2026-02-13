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

Scope:
- Evaluation-only baseline for upstream structural capture with target output `relations_extracted`.
- This section is the consolidated source of truth (external standalone report retired after consolidation).

Re-baseline snapshot (post `v1.1.16`):
- `1.1` Simple Passive: Pass
- `1.2` Passive with Agent: Pass
- `2.1` Copula with Attribute: Pass
- `2.2` Copula + Event in Same Sentence: Pass
- `3.1` Sequential Verbs: Pass
- `4.1` such as Enumeration: Pass
- `4.2` as well as: Pass
- `5.1` Inline List: Pass
- `6.1` Purpose PP: Pass
- `6.2` Temporal Modifier: Pass

Overall assessment snapshot:
- Blockers: none
- Degrading: none in the original blocker/degrading classes
- Residual noise: none in the tracked baseline set
- Success criteria status: met for upstream structural capture baseline

Status update (post `v1.1.16` re-baseline):
- Resolved and released from original baseline set: `1.2`, `2.1`, `2.2`, `3.1`, `4.1`, `4.2`, `5.1`, `6.1`, `6.2`.
- `2.2` was resolved in `v1.1.13` (passive subject anchor now lands on `factorization` for the prime-factorization passive case).
- `1.1` residual fallback noise was reduced in `v1.1.14` (retain regression lock).
- `4.1` connector-local `such as` noise was reduced in `v1.1.15` (retain regression lock).
- `6.1` purpose-PP tail-shape noise was reduced in `v1.1.16` (retain regression lock).
- `1.1` residual descriptor-modifier shape (`modifier(purposes, educational)`) was re-baselined as acceptable nominal detail and is now closed as non-actionable noise.
- Residual degrading/noise to monitor: none in the current baseline set.
- Execution rule:
  - keep blocker set at zero while guarding resolved cases with regression locks.
  - run monitor mode and open new cycles only for reproducible regressions/new scope.

### Webshop subject-edge diagnostic (2026-02-13)

- Relevance of old report: **partially relevant**.
  - The missing subject-role symptom in embedded webshop clauses still appears for some predicate shapes.
  - The old parser-attribution is outdated for this repo: Stage 08 builds dependency observations heuristically (not direct spaCy dependency ingestion).
- Confirmed lifecycle finding:
  - In the webshop sentence, Stage 08 emits only one raw subject-like edge (`nsubj(is, WebShop)`), while embedded predicates (`pick`, `want`, `put`) do not carry raw `nsubj` edges.
  - Stage 11 maps available labels deterministically (`nsubj -> actor`, `nsubjpass -> patient`) and does not drop mapped subject edges; absent subject roles are primarily upstream-availability gaps.
- Ownership and guardrail:
  - Primary owner remains Stage 08 structural dependency formation for embedded/coordinated clause subjects.
  - Stage 11 remains a secondary consumer/normalizer and should not synthesize non-evidenced subject edges.
- Test gate update:
  - Add/extend a Stage 08 unit regression for webshop-like embedded-clause subject retention.
  - Add/extend an end-to-end Stage 11 integration lock at `relations_extracted` for expected subject-role coverage in that sentence family.

### Closed diagnostic note: oversized theme mention projection (2026-02-13)

- Status: **closed for current codebase as originally reported**.
- Confirmed:
  - Stage 11 emits token-to-token accepted dependency relations, not verb-extended mention-span theme objects.
  - The specific failure mode `theme = "produces prime numbers"` (instead of nominal head `numbers`) is not reproducible in current `relations_extracted` output.
- Keep open separately:
  - webshop-family structural fidelity issues that remain upstream (primarily Stage 08 dependency/subject attachment quality), because those can still degrade final role outputs without being this specific Step-11 boundary-selection defect.

### Step-12 Integration Watchlist (Validated, 2026-02-13)

- Connector-token unresolveds (`such`, `as`, `well`) are tracked as a contract/interface mismatch:
  - Stage 11 suppresses connector-local semantic edges by design while preserving structural exemplar/additive edges.
  - Downstream unresolved-token expectations may still flag connector tokens.
  - Confidence: reproducible now as an integration-contract issue, not a standalone upstream defect.

- Clause/PP attachment drift in complex sentence variants remains open:
  - Reproducible on longer coordinated/complement shapes (non-universal).
  - Owner focus: Stage 08 structural attachment quality, with Stage 11 normalization sensitivity.
  - Confidence: reproducible now in complex variants.

- Fallback-induced role noise in long passive/complement chains remains open:
  - Stage 11 chunk-fallback paths can amplify weak upstream structure in specific long-sentence cases.
  - Owner focus: Stage 11 fallback boundaries, with Stage 08 structural input quality.
  - Confidence: reproducible now.

- Low-quality carrier precursor note (`are`):
  - Treat as a partially reproducible precursor only (not guaranteed regression per seed/run).
  - Keep gated separately from passive/coordination hardening.

- Low-quality carrier note (`given`):
  - Keep as historical/variant-dependent artifact-track signal.
  - Not consistently reproducible in current upstream-only checks.

- Attribution rule for release history:
  - Version-by-version causality is intentionally unproven unless historical tags are replayed.
  - Use "first observed in validation track" wording in regression tracking.

### Blockers

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve copula/passive core argument structure so copula complements and passive subjects remain explicit and lossless in upstream relations (no collapse of attribute/complement signals, no subject-anchor drift in passive clauses).  
  Re-baseline status: resolved in `1.1.13` (retain regression lock).
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 04 (contributing), Stage 08 (dominant), Stage 11 (secondary)]` Preserve enumeration/list semantics for `such as` constructions so governing predicate/object relations and exemplar membership are emitted without promoting exemplars to unrelated root events.  
  Re-baseline status: resolved in `1.1.5` (retain regression lock).
  - Test gate: add/extend a regression unit test at the originating stage.
  - Test gate: add/extend an end-to-end integration test that locks `relations_extracted` behavior.

- `[Owner: Stage 08 (dominant), Stage 11 (secondary)]` Preserve purpose-PP and coordinated nominal purpose structure (`for ... and ...`) as attached purpose/complement relations, without reclassifying gerund-like complements as standalone event predicates.  
  Re-baseline status: resolved in `1.1.7` (retain regression lock).
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

## 12.2) Consolidated Stage TODO Status (Stages 08-11)

This section replaces the former per-stage files:
- Stage 08 linguistic-analysis TODO (removed after consolidation)
- Stage 09 chunking TODO (removed after consolidation)
- Stage 10 head-identification TODO (removed after consolidation)
- Stage 11 relation-extraction TODO (removed after consolidation)

### Stage 08 - linguistic-analysis

Status:
- Completed (Cycles 1-8)
- Runtime behavior stable
- Unit/integration tests green

Completed cycles:
- Cycle 1: coordination evidence on `cc/conj` with `coordination_type` and `coordinator_token_id`.
- Cycle 2: noun coordination linking for `and/or`.
- Cycle 3: verb coordination coverage for `and/or`.
- Cycle 4: comparative observations for `than` with `compare_gt|compare_lt|compare` labels and marker evidence.
- Cycle 5: quantifier/scope observations for `each/every/all/some/no/only` with deterministic attachment.
- Cycle 6: copula-frame observations (`subject/copula/complement`) with complement typing evidence.
- Cycle 7: PP attachment observations (`head/marker/object`) with deterministic evidence.
- Cycle 8: modality/negation scope observations with frozen policy:
  - negation surfaces: `not`, `n't`, `never`
  - `no` is quantifier-only (`quantifier_no`), not negation.

Frozen policy summary:
- Deterministic structural observation layer only.
- Partial-parse guard rejects pre-existing Stage 08-owned annotation kinds.

Deliverable status:
- Stage 08 is functionally complete.

### Stage 09 - chunking-pos-fsm (`chunking`)

Status:
- Completed (Cycles 1-8)
- Runtime behavior stable
- Unit/integration tests green

Completed cycles:
- Cycle 1: coordinator hard boundaries (`and/or`, `CC`) with coordinator emitted as `O`.
- Cycle 2: VP refinement (aux/MD chain, lexical nucleus, optional NP/infinitival/adjacent PP complements).
- Cycle 3: bounded VP PP-absorption deny-list (`for/at/in/than` remain separate PP).
- Cycle 4: `pp_kind` metadata on PP chunks (surface-only mapping, fallback `generic`).
- Cycle 5: MWE hardening to NP-only allow-list behavior (non-NP MWEs ignored for VP/PP shaping).
- Cycle 6: NP modifier support extended to `JJ/JJR/JJS/VBN/VBG`.

Frozen policy summary:
- Deterministic greedy FSM.
- Stable tie-break precedence: `VP > PP > NP`.
- Surface-only PP subtype metadata (no semantic inference).

Deliverable status:
- Stage 09 is functionally complete.

### Stage 10 - head-identification

Status:
- Completed (Cycles 0-5)
- Runtime behavior stable
- Unit/integration tests green

Completed cycles:
- Cycle 1: exclude `MD` from primary VP head candidates when lexical verb exists.
- Cycle 2: matrix lexical verb preference with deterministic tie-break:
  - incident degree (desc), token index (asc), token id (asc).
- Cycle 3: deterministic VP participle demotion for:
  - `given` + NP-like context
  - conservative `DT + VBN + NP-like` context.
- Cycle 4: `head_decision` audit payload on every `chunk_head`.
- Cycle 5: finalization/documentation closure.

Frozen policy summary:
- Deterministic VP hardening against auxiliary/copula/participle drift.
- Auditable head selection path emitted on all chunk heads.

Deliverable status:
- Stage 10 is functionally complete.

### Stage 11 - relation-extraction

Status:
- Completed (Cycles 1-8)
- Runtime behavior stable
- Unit/integration tests green

Completed cycles:
- Cycle 1: baseline harness + hard invariants (`heads_identified` gate, index basis, chunk/chunk_head cardinality).
- Cycle 2: VP predicate preservation against demoted chunk-head projection.
- Cycle 3: modifier coverage (`amod`, optional `compound/nummod`).
- Cycle 4: coordination metadata evidence (`coord_type`, `coord_token_id`, `coord_group_id`).
- Cycle 5: PP evidence hardening + explicit `compare_*` relation support.
- Cycle 6: unified modality binding (exactly one modality relation per `MD`, clause-window deterministic rule).
- Cycle 7: copula-frame relation mapping with complement typing evidence.
- Cycle 8: finalization/documentation closure.

Supported mapping set (deterministic):
- `actor`, `theme`, `patient`, `attribute`, `recipient`, `modifier`, `location`, `topic`, `agent`, `instrument`, `beneficiary`, `purpose`, `complement_clause`, `coordination`, `modality`, `negation`, `compare_*`, `copula`.

Evidence coverage (deterministic):
- coordination, PP (`prep_surface/prep_token_id/pobj_token_id`), modality, comparative, copula.

Deliverable status:
- Stage 11 is functionally complete.

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
