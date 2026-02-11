# Chunking - TODO

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

### A) VP is too coarse and misses common verb-complex patterns
Current VP roughly matches:
- (AUX/MD)* + VERB+ + (NP)?

It does *not* represent:
- VP + PP complements (“starts at X”, “used for Y”, “tests ... for Z”)
- VP coordination (“starts ... and tests ...”)
- VP + clausal complements (“needs to ensure ...”, “want to buy ...”)
- participle attachments that should be subordinate (“given minimum value”)

Why this matters:
- If a VP chunk includes a participle-like verb (VBN/VBG) alongside the true matrix verb,
  Stage 10 may pick the participle as `chunk_head` in some cases.
- Stage 11 then normalizes predicates onto that head, yielding distortions like `given` becoming the predicate.

Required optimization:
- Refine VP to model verb complexes more accurately without becoming a full parser:
  - explicitly model AUX/MD chains separately from lexical verbs
  - keep participles from becoming “structural heads” by chunk shape (not by semantic guessing)
  - allow optional PP complements as part of VP chunk when they are syntactically adjacent
  - allow simple infinitival complements (“to” + VB) as part of a VP complex

Acceptance criteria:
- In “starts at a given minimum value”, the lexical verb “starts” remains the VP head candidate
  and the PP complement is represented consistently (either inside VP or as a stable attached PP chunk).
- In “may be used for X or Y”, the “used” predicate remains the VP center, not “be”.

---

### B) PP is too simplistic for role-bearing phrases and comparatives
PP currently triggers on IN/TO and then consumes NP-like content.

This fails structurally for:
- comparative markers (“than 1”, “as ... as ...”)
- multiword prepositions (“in front of”, “because of”) unless handled as MWEs
- nested PPs or chained prepositions
- cases where the PP object is not a simple NP sequence

Why this matters:
- Stage 11 expects prep/object relations and uses them for slot roles later.
- Comparatives and numeric constraints often flow through “than” and related markers,
  which are preposition-like but semantically distinct and require explicit structure.

Required optimization:
- Introduce PP subtypes or markers for:
  - comparative PP (“than”)
  - purpose PP (“for”)
  - location PP (“at/in/on”)
- Ensure PP boundaries consistently include the object head
- Preserve the preposition surface token as evidence

Acceptance criteria:
- “greater than 1” yields a stable PP-like chunk for “than 1” and does not get absorbed incorrectly into NP/VP.
- “used for educational purposes” yields a PP chunk that can be attached downstream without guesswork.

---

### C) Coordination is not represented as a chunk boundary
Currently, coordinators (“and/or”) are treated as ordinary tokens for chunk matching,
and the greedy matcher may either:
- include parts on both sides into one larger chunk, or
- split chunks in ways that are not aligned with coordination structure.

Why this matters:
- Downstream coordination group detection becomes brittle if chunking masks conjunct boundaries.
- OR-lists in particular need stable boundaries so later stages can model disjunction.

Required optimization:
- Treat coordinators (`CC`, plus surfaces “and”, “or”) as explicit chunk boundary markers:
  - end the current chunk before the coordinator
  - do not consume across the coordinator in a single chunk match
  - optionally emit a “COORD” pseudo-chunk or metadata marker that later stages can use

Acceptance criteria:
- Lists like “educational purposes or basic numerical experiments” yield two parallel NP chunks
  separated by a coordinator marker, rather than a single fused NP chunk.

---

### D) Interaction with accepted MWEs can amplify errors
Accepted MWEs are turned into token-like units for chunking.
This is valuable, but can also:
- make chunks overconfidently large,
- hide internal structure needed for later relation mapping,
- force heads to the last token of the MWE (Stage 07 rule), which might not be ideal for chunk-level roles.

Why this matters:
- Chunk-level head selection relies on token sets; if MWEs are too coarse,
  the head candidates available to Stage 10 may be reduced or skewed.

Required optimization:
- Ensure chunking retains the ability to express:
  - MWE as a span mention, but not necessarily as the only structural unit inside the chunk
- Consider “MWE-as-atom” only for NP chunks and not for VP/PP patterns unless explicitly beneficial.

Acceptance criteria:
- MWEs do not cause VP chunk heads to drift away from lexical verbs.
- NP chunking still benefits from noun MWEs (“prime number generator”, “numerical experiments”).

---

## Design constraints

- Deterministic: no probabilistic scoring, no external models.
- No domain-specific semantics.
- Clear tie-break rules must be documented and stable.
- Must not expand chunking into a full syntactic parser.

---

## Proposed implementation plan (deterministic increments)

### 1) Coordination-aware chunk boundaries
- Add a pre-scan that marks coordinator positions.
- Ensure the FSM never matches across coordinators.
- Optionally emit coordinator markers for downstream use.

### 2) VP pattern refinement
- Split VP matching into:
  - AUX/MD chain (optional)
  - lexical verb group (required)
  - optional infinitival complement (“to” + VB)
  - optional adjacent PP complement (IN/TO + NP) for a bounded set of prepositions (role-bearing)
- Keep the greedy behavior but within the refined grammar.

### 3) PP subtype markers (minimal)
- Keep PP as a chunk type but attach a `pp_kind` metadata field based on surface preposition:
  - comparative (“than”)
  - purpose (“for”)
  - location/time (“at”, “in”, “on”, “during”, etc.)
- This is structural metadata, not semantics; it improves downstream role mapping deterministically.

### 4) MWE integration hardening
- Restrict MWE atomicity to NP contexts by default.
- Provide explicit allow-list for VP/PP MWE atomicity if needed, but keep it small and deterministic.
- Ensure internal token boundaries remain available for Stage 10/11 when required.

---

## Tests (golden and invariants)

Add golden fixtures focused on structural expectations:
- VP does not select participles as the only plausible head when a lexical verb exists.
- VP+PP complements yield stable chunk boundaries.
- Coordinated lists yield parallel chunks separated by coordinator markers.
- Comparative constructs yield stable PP/NP chunk boundaries.
- MWE atomicity does not collapse predicate structure.

All tests must operate on deterministic artifacts and assert byte-stable outputs.

---

## Deliverables

1) Updated Stage 09 chunker with coordination-aware boundaries and refined VP/PP patterns.
2) Documentation of:
   - FSM patterns
   - tie-break rules
   - coordinator boundary policy
   - PP kind metadata
3) New golden fixtures and invariants for the upgraded chunker.
4) Notes for Stage 10/11 consumers if chunk metadata changes (e.g., `pp_kind`).
