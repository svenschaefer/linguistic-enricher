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

