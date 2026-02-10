# AGENT

## Project Constraints

- Language: JavaScript only.
- Module system: CommonJS only.
- Do not use TypeScript.
- Do not use ES Modules (`import`/`export`, no `"type": "module"`).
- Use only `require(...)` and `module.exports`.
- Keep `README.md` and `schema.json` unchanged unless explicitly requested.
- Even during later hardening/release phases, `README.md` and `schema.json` MUST NOT be modified without explicit user request.

## Current Phase

- Baseline implementation is in place (pipeline shell + stage modules + CLI + validation + Python bridge + tests).
- Active focus is prototype-parity hardening:
  - align stage behavior with the legacy linguistics prototype corpus (00..11 scope),
  - increase deterministic fidelity of stage outputs,
  - close remaining functional gaps while preserving CommonJS-only constraints.

## Scope

- Pipeline coverage: prototype stages `00..11`.
- Use only the selected prototype outcomes:
  - Stage 02 segmentation: `sbd`.
  - Stage 03 tokenization: `wink-tokenizer`.
  - Stage 04 POS tagging: `wink-pos-tagger`.
  - Stage 05 MWE candidate extraction: spaCy variant (`05-mwe-candidate-extraction-spacy`).
  - Stage 08 linguistic analysis: spaCy (Python) observational analysis.
  - Stage 09 chunking: POS-FSM variant (`09-chunking-pos-fsm`).
- Exclude:
  - Stage 12.
  - Any `xx-*` prototype scope.
- Prototype corpus is a semantic/domain reference only.
- That prototype is NOT an implementation template and NOT a technical port target.
- File/YAML artifact mechanics and step-script execution from prototypes are NOT ALLOWED in this package core.
- Core implementation MUST remain API-first and in-memory via `runPipeline(...)`, with CLI as thin wrapper.

## Prototype Selection Outcomes (Mandatory)

- Prototype selections are binding input for library/variant choices unless explicitly changed by a new decision.
- Current mandatory selections from the legacy prototype evaluations:
  - `02-segmentation`: use `sbd`.
  - `03-tokenization`: use `wink-tokenizer`.
  - `04-pos-tagging`: use `wink-pos-tagger`.
  - `05-mwe-candidate-extraction`: use spaCy variant only.
  - `09-chunking`: use POS-FSM variant only.
- Non-selected alternatives from prototype comparisons are documentation/benchmark artifacts only and are NOT ALLOWED as default implementation paths.

### Stage Library Matrix (00..11)

- `00-surface-normalization`: no external linguistic library.
- `01-canonicalization`: no external linguistic library.
- `02-segmentation`: `sbd` (selected).
- `03-tokenization`: `wink-tokenizer` (selected).
- `04-pos-tagging`: `wink-pos-tagger` (selected).
- `05-mwe-candidate-extraction`: multiple prototype variants evaluated; core selected variant is `spaCy` (`05-mwe-candidate-extraction-spacy`).
- `06-mwe-candidate-construction`: no external linguistic library (deterministic pattern/rule logic; optional external lexicon service signals).
- `07-mwe-materialization`: no external linguistic library (deterministic materialization logic).
- `08-linguistic-analysis`: `spaCy` (Python) for observational linguistic analysis.
- `09-chunking`: multiple prototype variants evaluated; core selected variant is `POS-FSM` (`09-chunking-pos-fsm`).
- `10-head-identification`: no external linguistic library (deterministic rule logic).
- `11-relation-extraction`: no external linguistic library (deterministic ruleset logic).

### Prototype Test-Case References (Mandatory)

- For each stage hardening block, realistic semantic test cases MUST be derived from:
  - prototype `seed.*.yaml` artifacts, and
  - prototype `*.test.js` files
  from the legacy prototype corpus.
- These references are mandatory for behavior coverage, edge-case coverage, and regression test design.
- They are semantic test references only:
  - DO NOT port prototype script orchestration,
  - DO NOT port file/YAML artifact execution mechanics,
  - DO NOT port prototype directory execution model.
- Implementers MUST translate reference cases into API-first, in-memory tests for `runPipeline(...)` and stage modules.

## Implementation Contract

- Core modules are implemented and callable; do not regress them to scaffold stubs.
- Any unfinished behavior MUST be represented as explicit, typed runtime errors (not silent fallbacks).
- New modules introduced during future phases MUST include tests in the same phase.

## External Services and Runtime

- Python integration is subprocess-based only (JSON stdin/stdout).
- `wikipedia-title-index` integration is optional HTTP service.
- Both integrations MUST remain optional where documented and deterministic in fallback behavior.

## Test Gate (Mandatory)

- Every implementation phase MUST be fully covered by tests before the next phase begins.
- All tests for the current phase MUST pass before any next-phase implementation work is started.
- Proceeding to a new phase without tests is NOT ALLOWED.
- A phase without passing tests is considered incomplete.

## Linting and Static Checks (Mandatory)

- A minimal linting setup MUST be defined and enforced.
- Linting is treated as a phase gate, equivalent to tests.

Rules:

- ESLint MUST be used in CommonJS mode.
- No ESM rules, no TypeScript rules.
- Linting MUST fail on:
  - undefined variables
  - unused variables (except unused parameters)
  - shadowed variables
  - non-strict equality
  - implicit globals
- Linting MUST explicitly allow:
  - require(...)
  - module.exports
  - console usage (CLI)

Process enforcement:

- `npm test` MUST run lint checks as part of the test workflow
  OR
- `npm run lint` MUST be executed and pass before a phase is complete.
- Starting the next phase without passing lint is NOT ALLOWED.
- A phase is NOT ALLOWED to be marked complete unless both lint and tests are passing.

Phases without passing lint are considered INCOMPLETE.

Linting MUST be introduced before implementing further semantic logic.

## Phase Roadmap (Mandatory Guidance for Codex/Implementers)

The following phases define the implementation roadmap for this project.
Each phase is a hard, gated step in the development lifecycle.
A phase is considered COMPLETE only when:

- all required functionality is implemented,
- all required tests (unit + integration) are present and passing,
- the linting rules defined in AGENT.md pass,
- and the project remains consistent with CommonJS-only, deterministic constraints.

Phases must be implemented sequentially in order.

### Phase 4 - Validation Layer (Structural Authority)

- Implement schema validation via AJV.
- Implement runtime invariant checks.
- Expose `validateDocument()` API.
- Wire validation into pipeline hooks (entry / pre / post / final).
- Add unit and integration tests verifying all validation behavior.
- Tests must fail on invalid structure/invariants.

### Phase 5 - Deterministic Core Utilities

- Finalize deterministic utility modules:
  - deterministic ID strategy,
  - span normalization and checks,
  - deep cloning utilities,
  - stable ordering utilities.
- Add unit tests for all utilities.
- Ensure utilities uphold determinism and invariant rules.

### Phase 6 - Stage 00-01 (Text Authority)

- Implement:
  - 00 surface normalization
  - 01 canonicalization
- Ensure stable canonical text and offsets.
- Add tests validating surface-to-canonical behavior.

### Phase 7 - Stage 02-04 (Token Substrate)

- Implement:
  - 02 segmentation
  - 03 tokenization
  - 04 part-of-speech tagging (POS as observation)
- Use Python subprocess only for POS tagging if required.
- Add unit and integration tests verifying token substrate correctness.

### Phase 8 - Stage 05-07 (MWE Pipeline)

- Implement:
  - 05 MWE candidate extraction (spaCy path)
  - 06 MWE candidate construction
  - 07 MWE materialization
- Optionally integrate wikipedia-title-index signals.
- Add tests covering candidate -> accepted promotion and optional service behavior.

### Phase 9 - Stage 08-11 (Structural Semantics)

- Implement:
  - 08 linguistic analysis
  - 09 chunking (POS-FSM)
  - 10 head identification
  - 11 relation extraction
- Add tests verifying linguistic structural semantics and deterministic relations.

### Phase 10 - Hardening and Release Readiness

- Finalize CLI commands:
  - `run` (end-to-end pipeline)
  - `validate`
  - existing `doctor`
- Polish error messages and documentation (excluding `README.md`/`schema.json` unless explicitly requested).
- Add end-to-end integration tests for CLI.
- Prepare independent versioning and publish configuration.

Each phase MUST include corresponding tests before the next phase begins.
Phases without passing tests and lint are considered incomplete and MUST be resolved before advancing.
Stage fidelity work MUST be executed sequentially (00 -> 11), one stage block at a time.
Each stage block is NOT ALLOWED to advance until lint and tests are green.

## Phase Completion Commit Rule (Mandatory)

- At the end of every completed phase, changes MUST be committed and pushed.
- A phase is NOT ALLOWED to be reported as complete until commit and push are done.
- Commit/push is part of the phase gate and completion criteria.
