# Head Identification - TODO

Status: Completed (Cycles 0-5)
Runtime behavior stable.
All unit/integration tests green.

This stage selects deterministic `chunk_head` tokens for every chunk produced in Stage 09.
Downstream impact is unusually strong:

- Stage 11’s `resolvePredicate()` projects token-level predicate ids onto `chunk_head` values.
  If Stage 10 selects a poor head for a VP chunk, Stage 11 will systematically “rename” predicates to that head.
- Stage 12 (elementary assertions) is conservative and will not repair missing or distorted structure.
  Therefore, head-selection errors often surface as:
  - “wrong predicate” assertions (e.g., `given` or `are` as predicate)
  - predicate fragmentation (modality attached to `be`, content verb rendered separately)
  - coverage/unresolved inflation for key tokens

This TODO captures the completed optimization work and rationale while preserving strict determinism.

---

## High-level objectives

1. Preserve byte-stable deterministic head selection.
2. Reduce cases where auxiliary/copula/participle tokens become VP heads when a better lexical verb exists.
3. Ensure VP head selection supports later relation extraction and operator scope (modality/negation).
4. Provide auditable evidence for head decisions (tie-break reasons).
5. Keep the implementation conservative: no statistical models, no semantic guessing, no domain knowledge.

---

## Current head selection model (summary)

For each chunk:
1. Build head candidates based on chunk type:
   - NP: nouns/pronouns (+ limited fallbacks)
   - PP: preposition token or object head (depending on rules)
   - VP: verb-like tokens (includes `MD`)
2. Prefer the dependency root *inside the chunk* (`chooseDependencyRoot`).
3. If no dependency root resolves, fallback to a positional rule (often leftmost for VP).
4. Apply a VP lexical override only when the initially selected head is “demoted verbish”:
   - auxiliary verbs (be/have/do)
   - any `MD`
   - a small list of `VBG` and `VBN` lexemes (e.g., `used`, `assigned`, `considered`, ...)

This is deterministic, but gaps appear when the demotion set is incomplete or when candidate sets are not aligned with clause structure.

---

## Gap patterns and why head identification contributes

### A) VP participle drift ("given" patterns)
Addressed in Cycle 3: deterministic VP participle demotion now applies to immediate-neighbor `given + NP-like` and `DT + VBN + NP-like` contexts, preventing modifier-like VBN heads when a lexical alternative exists.

---

### B) Copula/aux-root brittleness
Addressed in Cycle 2: VP matrix lexical preference now deterministically prefers non-demoted lexical verbs over demoted roots, with tie-break order `incident_degree desc -> token index asc -> token id asc`.

---

### C) MD in primary VP candidates
Addressed in Cycle 1: MD is excluded from primary VP head candidates whenever any lexical verb exists, while remaining available as deterministic fallback when no lexical candidate exists.

---

### D) Dependency-root-in-chunk brittleness
Addressed in Cycles 2 and 3: root selection is now constrained by VP demotion + matrix lexical preference before finalization, reducing brittle root-driven VP head drift while preserving deterministic behavior.

---

### E) Auditable head decision evidence
Addressed in Cycle 4: every emitted `chunk_head` now carries deterministic `head_decision` metadata (`candidates`, `chosen`, `rule`, `tie_break`) for auditability.

---

## Design constraints

- Must remain deterministic and platform-stable.
- Must not call external services or models.
- Must not introduce domain semantics.
- Any new heuristic must be fully specified, rule-based, and evidence-carrying.

---

## Proposed implementation plan (deterministic increments)

### 1) VP demotion policy expansion (completed)
- Addressed in Cycle 3 with deterministic VP context demotion for `given + NP-like` and `DT + VBN + NP-like` immediate-neighbor patterns.

### 2) Matrix lexical verb preference (completed)
- Addressed in Cycle 2 with deterministic VP matrix preference using argument-degree and stable tie-break ordering before finalization.

### 3) Exclude MD from primary VP head candidates (completed)
- Addressed in Cycle 1: MD excluded from primary VP candidates unless no lexical verb exists.

### 4) Emit head decision evidence (completed)
- Addressed in Cycle 4: `head_decision` payload is emitted on every `chunk_head` with deterministic rule-path metadata.

---

## Tests

Golden tests and regression locks are in place for deterministic head correctness:
- VP heads avoid MD when lexical alternatives exist (Cycle 1).
- VP matrix lexical preference is locked, including degree/index/id tie-break behavior (Cycle 2).
- VP participle demotion for `given` and `DT+VBN+NP-like` patterns is locked (Cycle 3).
- `head_decision` metadata is asserted for dependency-root, matrix preference, and fallback paths (Cycle 4).

All tests are byte-stable and validate deterministic evidence emission.

---

## Deliverables

Completed deliverables:
1) `chunk_head` emitted for every accepted chunk with deterministic selection.
2) Stage transition to `heads_identified` preserved with stable behavior.
3) VP head-selection hardening delivered across Cycles 1-3 (MD exclusion, matrix lexical preference, participle context demotion).
4) `head_decision` audit payload emitted on every `chunk_head` (Cycle 4).
5) Golden regression coverage maintained for head correctness and decision evidence.

Stage 10 (head-identification) is considered functionally complete.
