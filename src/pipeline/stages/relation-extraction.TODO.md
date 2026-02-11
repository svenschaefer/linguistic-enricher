# Relation Extraction - TODO

Status: Baseline + Modifier + Coordination + Comparative + Unified modality locked (Cycles 1-6)
Runtime behavior unchanged.
Stage 11 invariants, predicate preservation, modifier projection, coordination metadata, comparative extraction, and unified modality binding harness are in place.

This stage projects deterministic dependency observations (Stage 08) and chunk heads (Stage 10) into a labeled,
token/mention-level relation layer (`relations_extracted`).

Downstream impact:
- Stage 12 (elementary assertions) is intentionally conservative and will not “invent” missing structure.
  If relations are missing, mis-typed, or lose critical evidence, Step 12 will produce:
  - distorted predicates (due to predicate normalization)
  - missing slot fill (actor/theme/etc.)
  - missing coordination/disjunction
  - broken operator scope (modality/negation)
  - higher uncovered/unresolved counts

This TODO describes what must be optimized in Stage 11 and why, while preserving determinism.

---

## High-level objectives

1. Preserve strict determinism and byte-stable outputs for identical inputs.
2. Reduce predicate distortion introduced by chunk-head normalization.
3. Expand relation label coverage for structurally important dependency types (modifier, quantifier, comparative, etc.).
4. Preserve key evidence needed for later stages:
   - coordination type (AND vs OR)
   - preposition surface (“for”, “at”, “than”)
   - modality carrier (MD token) and its matrix predicate attachment
5. Keep Stage 11 as a structural projection layer:
   - no domain semantics
   - no probabilistic inference
   - no hidden rewriting of meaning

---

## Current model (summary)

Stage 11 currently:
- indexes dependency edges by head and by dependent
- chooses predicates and arguments from dependency patterns
- maps dependency labels into a small fixed set of relation roles
- emits relations like:
  - `actor`, `theme`, `attribute`, `topic`, `location`, `other`, ...
  - `coordination`
  - `modality`, `negation`
  - clausal roles (`purpose`, `complement_clause`, etc.)
- normalizes predicate ids using chunk heads:
  - `resolvePredicate(tokenId)` returns the chunk head when token is inside an accepted chunk

This is deterministic, but several systematic gaps and distortions follow from missing label coverage and from overly aggressive predicate normalization.

---

## Gap patterns and why Stage 11 contributes

### A) Predicate distortion via `resolvePredicate()` (chunk-head projection)
Problem:
- Token-level predicates are replaced by `chunk_head` when the predicate token is inside a chunk.
- If Stage 10 chose a suboptimal head (e.g., participle or copula), Stage 11 propagates that error everywhere.

Why this matters:
- Predicates such as `starts` can become `given`.
- Content verbs can fragment into multiple assertions (e.g., modality on `be`, content verb elsewhere).

Required optimization:
- Restrict predicate normalization to *safe cases*.
- Introduce a deterministic “predicate preservation” rule:
  - If the original predicate token is a lexical verb and the chunk head is demoted verbish, keep the original predicate.
  - If the original predicate is outside the chunk head’s clause window, do not normalize.
- Keep normalization for NP mention heads, but be far more conservative for VP predicates.

Acceptance criteria:
- The predicate surface/lemma chosen by dependency edges must remain stable even if chunk heads are conservative.
- Normalization must not turn lexical verbs into participles/copu las when a lexical verb is present.

---

### B) Coordination loses logical type (AND vs OR) and evidence
Problem:
- `conj` is collapsed into a generic `coordination` relation.
- Coordinator surface is not carried, so later stages cannot distinguish conjunction from disjunction.

Why this matters:
- Step 12 cannot represent OR-lists as disjunction.
- Modality scope across coordinated alternatives cannot be reconstructed.

Required optimization:
- Preserve coordinator type and token evidence:
  - include coordinator surface (“and” vs “or”) in relation metadata
  - include `cc` token id as evidence
- Ensure coordination is emitted for both verbal and nominal coordination patterns.

Acceptance criteria:
- Every coordination group has:
  - a stable group id (derived deterministically from token ids)
  - a coordination type field (`and` / `or`)
  - evidence token ids including the coordinator

---

### C) Missing modifier coverage: `amod` (and related) is not mapped
Problem:
- Adjective modifiers (typical dependency label `amod`) are produced upstream,
  but are not mapped into any relation role.

Why this matters:
- Important content is dropped (“basic”, “numerical”, “educational”, “successive”).
- Coverage/unresolved increases without any way for Step 12 to recover the logic.

Required optimization:
- Add deterministic mapping for:
  - `amod` -> a modifier relation (e.g., role `modifier` or slot `other` with `role=modifier`)
  - optionally `compound` and `nummod` similarly, if present upstream
- Carry evidence token ids for the modifier and the head.

Acceptance criteria:
- If `amod(head, mod)` is present, there must be a corresponding relation emitted.

---

### D) Preposition handling is too narrow (`prep` + `pobj` only)
Problem:
- Prepositional roles are extracted only when the dependency label is exactly `prep` and object is exactly `pobj`.
- This is brittle and cannot represent:
  - comparative “than” structures
  - richer attachment patterns
  - multiple objects or chained prepositions

Why this matters:
- Role-bearing phrases disappear (“at minimum value”, “for educational purposes”, “than 1”).
- Comparatives/threshold constraints cannot be represented.

Required optimization:
- Generalize PP processing:
  - allow recognized preposition-like markers by surface and POS
  - emit the preposition surface as evidence (`prep_surface`)
  - support comparative prepositions (`than`) as a distinct relation kind (see next section)

Acceptance criteria:
- For any upstream PP-like structure, Stage 11 emits at least one relation capturing:
  - attachment target
  - object
  - preposition surface token evidence

---

### E) Comparatives and thresholds need explicit relation forms
Problem:
- Even when upstream yields `amod(greater, numbers)` and `prep(greater, than)` + `pobj(than, 1)`,
  Stage 11 has no comparative relation type and therefore drops the constraint.

Why this matters:
- Constraints like “greater than 1” are core logic in requirements/spec texts.
- Step 12 cannot represent the numeric boundary without explicit upstream relation structure.

Required optimization:
- Add a deterministic comparative extractor in Stage 11 using only upstream dependency evidence:
  - detect comparative head token (JJ/RB comparative, or lexeme list: greater/less/more/fewer/at least/at most)
  - detect RHS numeric object via `prep_surface=than` and its object
  - emit one explicit relation label, e.g.:
    - `compare_gt(lhs, rhs)` / `compare_lt(lhs, rhs)`
  - include marker token id (`than`) as evidence

Acceptance criteria:
- Comparative constructs always yield a single comparative relation with RHS binding.

---

### F) Modality attachment and scope must be stable
Problem:
- There are multiple modality paths, including heuristics that attempt to find a “parent” via head-indexed maps.
- This can misattach `may/must/should` away from the matrix predicate, especially under coordination or chunk splits.

Why this matters:
- Step 12 operators are attached to the wrong assertion.
- Coordination/disjunction + modality cannot be represented correctly.

Required optimization:
- Use a single deterministic rule set for MD:
  1) attach MD to the nearest lexical verb in the same clause window (prefer rightward)
  2) tie-break by distance, then token index
- Always emit exactly one modality relation per MD token.
- Carry the MD token id as evidence.

Acceptance criteria:
- In “may be used ...”, modality must attach to `used` (matrix lexical verb), not `be`.

---

### G) Copula and complement frames need richer mapping
Problem:
- Copula patterns produce `cop` edges upstream, but Stage 11 does not produce a structured copula frame relation.
- Results can collapse onto `is/are` as predicate and lose the complement.

Why this matters:
- Step 12 yields empty or contentless predicates (“are”).
- The meaningful complement relation is lost.

Required optimization:
- Map copula structures into explicit relations:
  - `copula(subject, complement)` with the copula verb as evidence
  - keep complement type (nominal/adjectival) as metadata
- Ensure predicate selection favors the complement content rather than the copula verb for assertion projection.

Acceptance criteria:
- “X are considered Y” yields relations that allow Step 12 to build a meaningful assertion without collapsing to `are`.

---

## Design constraints

- Deterministic: no probabilistic ranking.
- No domain semantics or ontology work.
- Relations must remain traceable to upstream evidence (token ids, dependency labels).
- Any new mapping rule must be fully specified and testable.

---

## Proposed implementation plan (minimal, deterministic increments)

### 1) Predicate normalization hardening
- Modify `resolvePredicate()` usage for VP predicates:
  - preserve lexical verbs
  - treat chunk-head normalization as optional, evidence-only for VP
- Add tests that ensure predicates do not collapse onto demoted heads.

### 2) Add `amod` (and optional `compound`, `nummod`) mapping
- Emit modifier relations with evidence.

### 3) Coordination metadata
- Extend coordination relations to include:
  - `coord_type` = `and` or `or`
  - `coord_token_id` evidence

### 4) Preposition generalization + comparative relations
- Emit relations that include preposition surface evidence.
- Add comparative extractor producing `compare_*` relations.

### 5) Unify modality binding
- Replace heuristic parent lookup with a single deterministic clause-window scan.
- Enforce one modality relation per MD token.

### 6) Copula frame mapping
- Emit structured copula relations sufficient for downstream assertion projection.

---

## Tests

Add golden tests for:
- predicate stability under chunk-head normalization
- `amod` retention (basic/numerical/educational/successive)
- OR vs AND preserved as coordination type
- “greater than 1” emits compare relation
- “may be used for X or Y” attaches modality to `used` and preserves disjunction
- “X are considered Y” yields structured copula relations

All tests must assert byte-stable outputs.

---

## Deliverables

1) Updated Stage 11 relation extraction rules (as above).
2) Updated docs listing:
   - supported dependency-to-relation mappings
   - relation schema + metadata fields (coord type, prep surface, compare relations)
3) Test suite additions and golden fixtures for the new relations.
