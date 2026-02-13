# Changelog

All notable changes to this project are documented in this file.

## [1.1.5] - 2026-02-13

Compared to `v1.1.4`.

### Changed
- `src/pipeline/stages/pos-tagging.js`
  - Added bounded finite-verb disambiguation for determiner-subject clause frames to prevent `grants`-class predicate tokens from staying nominal (`NNS`) in sentences like `Each role grants permissions ...`.
- `src/pipeline/stages/relation-extraction.js`
  - Added deterministic `such as` exemplar projection from `prep(as)` structures:
    - emits `exemplifies(<container>, <member>)` relations for enumerated exemplars.
  - Keeps exemplar lists from being dropped while preserving predicate focus on the governing finite verb.

### Tests
- `test/unit/stage04-pos-tagging.test.js`
  - Added regression locking `grants -> VBZ` in determiner-subject predicate context.
  - Added negative-control regression keeping nominal `grants` as `NNS` in noun phrase context.
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression locking `such as` exemplar membership structure in relation extraction.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for:
    - `actor(grants, role)`
    - `theme(grants, permissions)`
    - `exemplifies(permissions, read|write|administer)`
    - and no spurious `actor(write, role)` event promotion.

## [1.1.4] - 2026-02-11

Compared to `v1.1.3`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Added deterministic passive-head detection for `be + VBN` constructions.
  - Stage 08 now emits `nsubjpass` for pre-verbal nominal subjects in passive constructions (e.g. `Generated primes may be used ...`).
  - Root selection in passive `be + VBN` clauses now prefers the participle head (e.g. `used`) instead of earlier participial modifiers.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression test locking passive subject extraction for:
    - `Generated primes may be used for educational purposes.`
    - expected `nsubjpass(used, primes)`.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end regression lock for passive subject projection:
    - accepted `patient(used, primes)` in `relations_extracted`.

## [1.1.3] - 2026-02-11

Compared to `v1.1.2`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Extended Stage 08 noun-like gating to include pronouns (`PRP`, `PRP$`) in deterministic dependency heuristics.
  - Prevents pronoun dependents in simple finite/transitive clauses from degrading to generic `dep` when subject/object signals are available.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression test locking pronoun subject extraction:
    - `They want to buy.` -> `nsubj(want, They)`.
  - Added regression test locking pronoun object extraction:
    - `People put them into a cart.` -> `obj(put, them)` and no `dep` fallback for `them`.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end regression for pronoun subject relation materialization:
    - accepted `actor(want, they)`.
  - Added end-to-end regression for pronoun object relation materialization:
    - accepted `theme(put, them)`.

## [1.1.2] - 2026-02-11

Compared to `v1.1.1`.

### Changed
- `src/pipeline/stages/pos-tagging.js`
  - Added deterministic finite-verb disambiguation for a narrow `NNS -> VBZ` error class in clause context.
  - Corrects coordinated finite verb patterns such as:
    - `It starts ... and tests ...`
  - Keeps noun-list behavior stable by applying bounded contextual checks only.

### Tests
- `test/unit/stage04-pos-tagging.test.js`
  - Added regression test locking `starts/tests` as `VBZ`/`VERB` in coordinated finite-verb context.
  - Added negative-control test locking noun coordination (`cats and dogs`) as nominal.

## [1.1.1] - 2026-02-11

Compared to `v1.1.0`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Added deterministic bridging from Stage 08 observation annotations into Stage 11 accepted relations:
    - `comparative` observations now materialize accepted `compare_*` dependency relations.
    - `quantifier_scope` observations now materialize accepted `quantifier`/`scope_quantifier` dependency relations.
  - This keeps relation output consumable by downstream stages that project only relation-extraction dependencies.
  - Duplicate relation-key handling now preserves observation provenance deterministically:
    - when a duplicate compare/quantifier edge is encountered, `source_annotation_id` from
      `comparative_observation` / `quantifier_scope_observation` is merged instead of being dropped.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression coverage for comparative-observation bridge and quantifier-scope-observation bridge.
  - Added regression coverage for duplicate-edge provenance merge on both comparative and quantifier bridges.

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
