# AGENT

## Project Constraints

- Language: JavaScript only.
- Module system: CommonJS only.
- Do not use TypeScript.
- Do not use ES Modules (`import`/`export`, no `"type": "module"`).
- Use only `require(...)` and `module.exports`.
- Keep `README.md` and `schema.json` unchanged unless explicitly requested.

## Current Phase

- Execution phase: scaffold only.
- Create package structure and CommonJS metadata.
- Provide stub implementations only.
- Do not implement pipeline/business logic yet.

## Scope

- Pipeline coverage: prototype stages `00..11`.
- Use only:
  - Step 05 spaCy-based implementation.
  - Step 09 POS-FSM implementation.
- Exclude:
  - Stage 12.
  - Any `xx-*` prototype scope.

## Stub Contract

- Every scaffolded module function must throw:
  - `new Error("Not implemented")`
- Exception:
  - CLI command stubs (`run`, `doctor`) print TODO notices.

## External Services and Runtime

- Python integration is subprocess-based only (JSON stdin/stdout) and scaffolded only.
- `wikipedia-title-index` integration is optional HTTP service and scaffolded only.

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
- Polish error messages and documentation.
- Add end-to-end integration tests for CLI.
- Prepare independent versioning and publish configuration.

Each phase MUST include corresponding tests before the next phase begins.
Phases without passing tests and lint are considered incomplete and MUST be resolved before advancing.

## Phase Completion Commit Rule (Mandatory)

- At the end of every completed phase, changes MUST be committed and pushed.
- A phase is NOT ALLOWED to be reported as complete until commit and push are done.
- Commit/push is part of the phase gate and completion criteria.
