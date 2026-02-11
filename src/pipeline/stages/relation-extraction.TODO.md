# Relation Extraction - TODO

Status: Completed (Cycles 1-8)
Runtime behavior stable.
All unit/integration tests green.

This stage projects deterministic dependency observations (Stage 08) and chunk heads (Stage 10) into a labeled,
token/mention-level relation layer (`relations_extracted`).

---

## High-level objectives

1. Preserve strict determinism and byte-stable outputs for identical inputs.
2. Reduce predicate distortion introduced by chunk-head normalization.
3. Expand relation label coverage for structurally important dependency types.
4. Preserve key evidence needed for later stages.
5. Keep Stage 11 as a structural projection layer with no probabilistic inference.

---

## Current model (summary)

Stage 11 now:
- enforces hard stage/index-basis and chunk/chunk_head cardinality invariants
- indexes dependency edges by head and by dependent
- maps dependency labels into deterministic relation roles
- preserves lexical VP predicates against demoted chunk-head collapse
- emits evidence-rich relations including coordination, prep, comparative, modality, and copula metadata
- transitions stage to `relations_extracted`

---

## Completed hardening by cycle

### A) Baseline harness and invariants
Addressed in Cycle 1: hard preconditions added (`heads_identified` gate, supported `index_basis.unit`, exactly one `chunk_head` per accepted chunk) with baseline golden fixtures and invariant-failure tests.

### B) Predicate preservation via resolvePredicate()
Addressed in Cycle 2: VP predicate preservation keeps lexical verb predicates when chunk-head projection points to a demoted verbish token.

### C) Modifier coverage
Addressed in Cycle 3: deterministic modifier projection added for `amod` and optional `compound`/`nummod` paths via `modifier` role mapping.

### D) Coordination metadata
Addressed in Cycle 4: coordination relations now carry deterministic `coord_type`, `coord_token_id`, and stable `coord_group_id` evidence.

### E) Preposition evidence and comparative relations
Addressed in Cycle 5: PP-derived relations consistently carry preposition/object evidence and explicit `compare_*` relations are emitted for `than` comparatives.

### F) Unified modality binding
Addressed in Cycle 6: single deterministic modality rule emits exactly one modality relation per MD token with clause-window boundaries and rightward preference.

### G) Copula frame mapping
Addressed in Cycle 7: deterministic `copula` relation emitted with `subject`, `complement`, `copula_token_id`, and `complement_kind` evidence.

---

## Design constraints

- Deterministic and replayable for identical input artifacts.
- No probabilistic ranking or hidden semantic inference.
- Relations remain traceable to upstream token/dependency evidence.
- New rules are bounded, auditable, and test-locked.

---

## Tests

Completed regression locks cover:
- invariant enforcement and baseline harness stability
- VP predicate preservation under chunk-head projection
- modifier projection (`amod`/`compound`/`nummod`)
- coordination metadata (`coord_type`, `coord_token_id`, `coord_group_id`)
- comparative extraction and PP evidence fields
- unified modality binding (one modality per MD)
- copula frame mapping with complement typing

All outputs are deterministic and byte-stable under the test fixtures.

---

## Deliverables

Completed deliverables:
1) Supported deterministic mapping set includes:
   `actor`, `theme`, `patient`, `attribute`, `recipient`, `modifier`, `location`, `topic`, `agent`, `instrument`, `beneficiary`, `purpose`, `complement_clause`, `coordination`, `modality`, `negation`, `compare_*`, `copula`.
2) Evidence fields emitted for:
   - coordination (`coord_type`, `coord_token_id`, `coord_group_id`)
   - preposition-derived relations (`prep_surface`, `prep_token_id`, `pobj_token_id`)
   - modality (`md_token_id`, unified modality pattern fields)
   - comparative (`compare_surface`, `compare_token_id`, `rhs_token_id`, `prep_surface=than`)
   - copula (`subject_token_id`, `complement_token_id`, `copula_token_id`, `complement_kind`)
3) Stage transition to `relations_extracted` is stable and validated.

Stage 11 (relation-extraction) is considered functionally complete.
