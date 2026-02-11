# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-02-11

Compared to `v1.0.0`.

### Added
- Stage TODO tracking files for all active pipeline stages:
  - `src/pipeline/stages/linguistic-analysis.TODO.md`
  - `src/pipeline/stages/chunking.TODO.md`
  - `src/pipeline/stages/head-identification.TODO.md`
  - `src/pipeline/stages/relation-extraction.TODO.md`
- Deterministic Stage 08 observation kinds and evidence coverage for:
  - coordination evidence on `cc`/`conj` (`coordination_type`, `coordinator_token_id`)
  - comparative observations (`compare_gt|compare_lt|compare`, `than` evidence)
  - quantifier/scope observations (`each|every|all|some|no|only`)
  - copula frame observations
  - PP attachment observations
  - modality/negation scope observations (with frozen policy: `no` is quantifier-only)
- Stage 09 PP subtype metadata on emitted PP chunks:
  - `pp_kind` with deterministic surface mapping and `generic` fallback.
- Stage 10 head audit metadata on every `chunk_head` annotation:
  - `head_decision` payload with deterministic rule/tie-break trace.
- Stage 10 deterministic VP participle demotion for contextual `given` and conservative `DT + VBN + NP-like` patterns (VP head stabilization).
- Stage 11 relation coverage additions:
  - modifier mapping for `amod` (plus deterministic `compound`/`nummod` handling)
  - coordination metadata evidence (`coord_type`, `coord_token_id`, `coord_group_id`)
  - explicit comparative relations for `than` patterns (`compare_*`)
  - copula relation with frame evidence and `complement_kind`.
- Stage 11 unified modality binding:
  - exactly one modality relation per `MD`
  - deterministic clause-window selection
  - rightward lexical-verb preference
  - evidence payload (`pattern: modality_unified`, `md_token_id`, `chosen_predicate_token_id`)

### Changed
- `schema.json`
  - Updated to support newly emitted Stage 08/09/10/11 metadata and annotation kinds.
- `src/pipeline/stages/linguistic-analysis.js`
  - Hardened deterministic structural observation extraction and partial-parse guards.
- `src/pipeline/stages/chunking.js`
  - Coordinator hard-boundary policy (`and`/`or`/`CC`) in FSM chunk building.
  - Refined VP matching: AUX/MD chain + lexical verb nucleus + optional complements.
  - VP-PP absorption deny-list policy (`for`, `at`, `in`, `than`) with stable boundaries.
  - NP modifier hardening to include `VBN`/`VBG` in NP-internal modifier runs.
  - MWE integration constrained to NP-only allow-list behavior to avoid VP/PP collapse.
- `src/pipeline/stages/head-identification.js`
  - VP head candidate policy excludes `MD` when lexical verb exists.
  - Matrix lexical verb preference added (degree + index + id deterministic tie-break).
  - Contextual participle demotion for VP head selection (`given` and conservative `DT+VBN+NP-like` patterns).
  - Cleanup: removed unused parameter in degree helper.
- `src/pipeline/stages/relation-extraction.js`
  - Stage gates and invariants enforced (`heads_identified`, supported index basis, 1:1 accepted chunk to chunk_head).
  - VP predicate preservation against demoted chunk-head projection.
  - PP evidence generalization (`prep_surface`, `prep_token_id`, `pobj_token_id`).
  - Unified modality binding: exactly one modality relation per MD via deterministic clause-window rule.

### Tests
- Expanded and locked regression coverage across:
  - `test/unit/stage08-linguistic-analysis.test.js`
  - `test/integration/stage08-linguistic-analysis.test.js`
  - `test/unit/stage09-chunking.test.js`
  - `test/unit/stage10-head-identification.test.js`
  - `test/unit/stage11-relation-extraction.test.js`
- Added golden/invariant checks for:
  - coordination boundaries and AND/OR evidence
  - VP/PP boundary policy and PP subtype behavior
  - VP head determinism and head decision traceability
  - relation extraction invariants, modality uniqueness, comparative and copula mapping.

### Documentation
- Normalized all stage TODO documents to reflect implementation-complete status and locked policies for:
  - Stage 08 (`linguistic-analysis`)
  - Stage 09 (`chunking-pos-fsm`)
  - Stage 10 (`head-identification`)
  - Stage 11 (`relation-extraction`)

### Compatibility Notes
- This release is deterministic-hardening and metadata-enrichment focused.
- Existing core stage flow is preserved; output is richer and more constrained.
- Consumers should treat newly added evidence fields/labels as additive.
