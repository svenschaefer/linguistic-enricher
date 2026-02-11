# Linguistic Analysis - TODO

Status: Completed (Cycles 1-8)
Runtime behavior stable.
All unit/integration tests green.

This stage emits deterministic structural observations from tokens/POS/MWE/segments and serves as the
upstream scaffold for Stage 10 head selection and Stage 11 relation projection.

---

## Completed cycles

- 2026-02-11 (Cycle 1, completed): coordination evidence on dependency observations.
  - `cc` and `conj` edges carry `coordination_type` (`and`/`or`) and `coordinator_token_id`.

- 2026-02-11 (Cycle 2, completed): noun coordination linking for `and/or`.
  - noun-like conjuncts deterministically emit `conj` edges with coordination evidence.

- 2026-02-11 (Cycle 3, completed): verb coordination coverage for `or` locked by tests.
  - shared coordinator detection supports `and` and `or` for verbal conjunct paths.

- 2026-02-11 (Cycle 4, completed): comparative observations for `than` patterns.
  - emits `comparative` with labels `compare_gt|compare_lt|compare` and marker/rhs references.
  - evidence includes `pattern=comparative_than`, `marker_surface`, `marker_token_id`.

- 2026-02-11 (Cycle 5, completed): quantifier/scope observations.
  - emits `quantifier_scope` for `each/every/all/some/no/only`.
  - deterministic attachment rule: nearest noun right, else nearest noun left.

- 2026-02-11 (Cycle 6, completed): copula frame observations.
  - emits `copula_frame` with `subject`, `copula`, `complement` refs.
  - evidence includes `pattern=copula_subject_complement`, `copula_surface`, `copula_token_id`, `complement_kind`.

- 2026-02-11 (Cycle 7, completed): PP attachment observations.
  - emits `pp_attachment` with `head`, `marker`, `object` refs and deterministic attachment evidence.

- 2026-02-11 (Cycle 8, completed): modality/negation scope observations.
  - emits `modality_scope` for MD and `negation_scope` for `not`, `n't`, `never`.
  - policy freeze: `no` is quantifier-only (`quantifier_no`) and is excluded from negation scope.

---

## Frozen policy summary

- Deterministic heuristic observation layer only; no semantic inference.
- Coordination evidence preserved on `cc/conj` with explicit AND/OR type.
- Comparative, quantifier/scope, copula-frame, PP-attachment, modality, and negation evidence are emitted.
- Partial-parse guard rejects pre-existing Stage 08-owned annotation kinds to prevent duplicate projections.

---

## Tests

Completed regression locks cover:
- coordination evidence and noun/verb `and/or` conjunct behavior
- comparative `than` observations
- quantifier/scope observations and deterministic noun attachment
- copula-frame observation structure and evidence fields
- PP attachment evidence
- modality and negation scope with `no` quantifier-only policy

Outputs are deterministic and byte-stable under unit and integration fixtures.

---

## Deliverables

Completed deliverables:
1) Deterministic Stage 08 structural observation set for downstream stages.
2) Evidence-rich annotations for coordination, comparative, quantifier/scope, copula, PP, modality, and negation.
3) Stable partial-parse guard for Stage 08-owned annotation kinds.
4) Regression coverage across unit and integration tests.

Stage 08 (linguistic-analysis) is considered functionally complete.
