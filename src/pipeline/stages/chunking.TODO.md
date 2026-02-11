# Chunking - TODO

Status: Completed (Cycles 1-8)
Runtime behavior stable.
All unit/integration tests green.

## Progress (small optimization cycles)

- 2026-02-11 (Cycle 1, completed): coordination boundary policy landed.
  - Coordinator tokens (`and`/`or` or POS `CC`) are hard boundaries in `buildChunks()`.
  - Behavior: `flushRun()` and emit coordinator as `O` chunk (same as punctuation boundary handling).
  - Validation added:
    - NP coordination boundary test (`educational purposes or basic numerical experiments`)
    - VP coordination boundary test (`buys or sells`) asserting no fused VP across coordinator.

- 2026-02-11 (Cycle 2, completed): refined deterministic VP pattern.
  - `matchVP()` now models:
    - optional AUX/MD chain (`be/have/do` family + `MD`)
    - required lexical verb nucleus (non-aux, non-`MD` `VB*`)
    - optional NP object
    - optional infinitival complement (`to` + verb complex + optional NP)
    - optional adjacent PP complement.
  - Validation added/updated:
    - `Ships to Berlin` -> `VP("Ships to Berlin")`
    - `may be used for educational purposes` covered by refined VP test.

- 2026-02-11 (Cycle 3, completed): bounded PP marker policy for VP absorption.
  - VP absorbs adjacent PP complements except deny-list markers:
    - `{ "for", "at", "in", "than" }` -> keep PP as separate `PP` chunk.
  - Non-deny markers (e.g. `to`) keep prior absorb behavior.
  - Validation added/updated:
    - `may be used for educational purposes` -> `VP("may be used")` + `PP("for educational purposes")`
    - `It starts at a minimum value.` -> `VP("starts")` + `PP("at a minimum value")`
    - `Ships to Berlin` remains `VP("Ships to Berlin")`.

- 2026-02-11 (Cycle 4, completed): PP subtype metadata (`pp_kind`) landed.
  - PP chunks now carry deterministic surface-only `pp_kind` metadata.
  - Unknown marker surfaces default to `pp_kind="generic"`.
  - VP absorption policy is unchanged (e.g., `Ships to Berlin` remains absorbed as `VP`).

- 2026-02-11 (Cycle 5, completed): MWE integration hardening landed.
  - MWE atomicity is constrained to an explicit NP-only allow-list.
  - NP-internal POS guard is enforced for accepted MWE materialization.
  - Non-allowed/non-NP MWEs are ignored to keep VP/PP chunk structure stable.

- 2026-02-11 (Cycle 6, completed): NP participle-modifier hardening landed.
  - NP modifier support was extended to `JJ/JJR/JJS/VBN/VBG`.
  - This enables PP object matching for patterns like `at a given minimum value`.

This stage produces deterministic shallow phrase chunks (NP/PP/VP) using a POS-driven finite state machine (FSM).
It is intentionally conservative and library-independent, and it must remain fully replayable.

Downstream stages depend on chunking in two critical ways:
- Stage 10 selects `chunk_head` per chunk and will prefer dependency roots *inside the chunk*.
- Stage 11’s `resolvePredicate()` normalizes token-level predicates onto `chunk_head` values.
  This means **chunk boundaries and chunk types directly influence which tokens become predicates later**.

Several observed gaps and distortions (e.g., “given” becoming a predicate head, PP roles disappearing, coordination not being represented, clause/verb complex fragmentation) correlate with overly coarse chunk definitions - especially for VP and PP.

This TODO enumerates what should be improved and why, while preserving determinism.

---

## High-level objectives

1. Preserve strict determinism and byte-stable outputs.
2. Improve structural fidelity of chunks so Stage 10/11 do not amplify brittle structures:
   - better VP coverage (verb complexes + complements)
   - better PP attachment surfaces (prep chains, comparative markers)
   - explicit handling of coordination boundaries
   - improved interaction with accepted MWEs
3. Reduce predicate distortion caused by:
   - overly large VP spans
   - VP spans that include participles (“given”) but not the true matrix verb
4. Improve chunk evidence so downstream mapping can use chunk types more reliably.

---

## Current chunking model (summary)

The current FSM produces:
- NP: adjective/noun/pronoun/determiner sequences (with limited patterns)
- PP: tokens starting at IN/TO (prepositions) followed by NP-like material
- VP: one or more verb tokens, optionally followed by an NP

Chunking is greedy:
- prefers the longest match
- breaks ties by fixed type precedence (VP > PP > NP)
- then continues from the next token

This is deterministic, but it is also **structurally coarse**.

---

## Gap patterns and why chunking contributes

### A) VP structural fidelity
Addressed in Cycles 2, 3, and 6.
- VP matching now uses an optional AUX/MD chain plus required lexical verb nucleus.
- Optional NP object and optional infinitival complement (`to` + verb complex) are supported.
- Adjacent PP handling is deterministic via absorb policy with deny-list boundaries.
- NP modifier support includes `VBN/VBG`, which stabilizes patterns like `a given minimum value`.

---

### B) PP structure and subtype metadata
Addressed in Cycles 3, 4, and 6.
- PP detection remains deterministic on preposition + NP-like object.
- VP absorption deny-list keeps `for/at/in/than` as separate PP chunks.
- Emitted PP chunks carry surface-only `pp_kind` metadata with deterministic fallback `generic`.
- Comparative and modifier-bearing PP objects are covered by deterministic NP matching rules.

---

### C) Coordination boundary handling
Addressed in Cycle 1.
- Coordinators (`CC`, `and`, `or`) are hard boundaries.
- The matcher does not consume across coordinators.
- Coordinators are emitted as `O` chunks, preserving deterministic token coverage and conjunct separation.

---

### D) MWE interaction policy
Addressed in Cycle 5.
- MWE atomicity is constrained to explicit NP-only allow-list entries.
- NP-internal POS guard is required for materialization.
- Non-allowed and non-NP MWEs are ignored so VP/PP boundaries and heads remain stable.

---

## Design constraints

- Deterministic: no probabilistic scoring, no external models.
- No domain-specific semantics.
- Clear tie-break rules must be documented and stable.
- Must not expand chunking into a full syntactic parser.

---

## Proposed implementation plan (deterministic increments)

### 1) Coordination-aware chunk boundaries (completed)
- Add a pre-scan that marks coordinator positions.
- Ensure the FSM never matches across coordinators.
- Optionally emit coordinator markers for downstream use.

### 2) VP pattern refinement (completed)
- Split VP matching into:
  - AUX/MD chain (optional)
  - lexical verb group (required)
  - optional infinitival complement (“to” + VB)
  - optional adjacent PP complement (IN/TO + NP) for a bounded set of prepositions (role-bearing)
- Keep the greedy behavior but within the refined grammar.

### 3) PP subtype markers (minimal, completed)
- Keep PP as a chunk type but attach a `pp_kind` metadata field based on surface preposition:
  - comparative (“than”)
  - benefactive (“for”)
  - location/time (“at”, “in”, “on”, “during”, etc.)
- This is structural metadata, not semantics; it improves downstream role mapping deterministically.

### 4) MWE integration hardening (completed)
- Restrict MWE atomicity to NP contexts by default.
- Provide explicit allow-list for VP/PP MWE atomicity if needed, but keep it small and deterministic.
- Ensure internal token boundaries remain available for Stage 10/11 when required.

Note: Cycle 6 added an additional deterministic hardening step beyond the original plan by extending NP modifier POS coverage to include `VBN/VBG`.

---

## Tests (golden and invariants)

Golden fixtures and regression locks added in Cycles 1-6:
- VP/PP tie-break behavior remains stable (`VP > PP > NP`).
- VP absorption deny-list behavior is locked (`for/at/in/than` remain separate PP).
- `pp_kind` mapping is deterministic with explicit fallback `generic`.
- NP-only MWE allow-list behavior is locked; non-NP MWEs do not alter VP/PP structure.
- NP modifier support includes `JJ/JJR/JJS/VBN/VBG` and is regression-covered.
- Coordinator boundary handling is locked (`and/or` emitted as `O`, no cross-coordinator chunking).

All checks run on deterministic artifacts with stable outputs.

---

## Deliverables

Completed deliverables:
1) Deterministic POS-based chunking FSM implemented with coordination-aware boundaries and refined VP/PP patterns.
2) Stable tie-break policy documented and preserved (`VP > PP > NP`).
3) Surface-only `pp_kind` metadata implemented for PP chunks.
4) NP-only MWE integration policy implemented with deterministic allow-list behavior.
5) Deterministic NP modifier support implemented (`JJ/JJR/JJS/VBN/VBG`).
6) Regression test coverage added and maintained across unit/integration suites.

Stage 09 (chunking-pos-fsm) is considered functionally complete.
