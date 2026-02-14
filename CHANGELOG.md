# Changelog

All notable changes to this project are documented in this file.

## [1.1.23] - 2026-02-14

Compared to `v1.1.22`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Narrowed the `v1.1.22` weak-carrier suppression scope to avoid Step-12 coverage regressions:
    - carrier-edge suppression now excludes `is/are` heads, restoring dependency-backed copula attribute/modifier coverage in webshop/IRS long-chain clause shapes.
    - weak-carrier suppression remains active for other demoted carriers under the existing structural preconditions.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Kept weak-carrier suppression lock for a non-`is/are` demoted carrier (`was`) to preserve guard intent.
- `test/integration/stage11-relation-extraction.test.js`
  - Restored webshop lock:
    - `modifier(are, actually)` and `attribute(are, available)` present.
  - Added IRS lock:
    - `attribute(is, valid)` and `attribute(are, present)` present.
  - Kept prime_gen monitor lock unchanged:
    - `given` is not emitted as a relation head.

## [1.1.22] - 2026-02-14

Compared to `v1.1.21`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Added a deterministic Stage 11 carrier-precursor guard for weak demoted-copula heads:
    - suppresses `attribute`/`modifier` edges emitted from demoted carrier heads (`is/are/...`) when:
      - no subject-like outgoing dependency is present, and
      - the carrier head is only incoming-linked from another verb/clausal chain.
  - Keeps normal copula behavior intact when subject evidence exists.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Added lock for suppression of weak `are` carrier edges without subject evidence.
- `test/integration/stage11-relation-extraction.test.js`
  - Added webshop long-chain lock ensuring no accepted `attribute|modifier` relation is headed by weak `are` carrier.
  - Added historical-monitor lock ensuring `given` is not emitted as relation head in the tracked `prime_gen` variant.

## [1.1.21] - 2026-02-14

Compared to `v1.1.20`.

### Fixed
- `package.json`
  - Removed accidental self-dependency:
    - `"linguistic-enricher": "file:linguistic-enricher-1.1.20.tgz"`
  - Restores installability from public npm registry for downstream consumers.

### Validation
- Full test suite (`npm test`) passes.
- Pre-publish local tarball smoke verifies install and CLI/pipeline sanity.
- Post-publish public npm smoke verifies clean install from registry.

## [1.1.20] - 2026-02-14

Compared to `v1.1.19`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Narrowed Stage 11 fallback actor suppression scope:
    - fallback `actor` suppression for verb-linked predicates now applies only to explicit clausal incoming links (`xcomp|ccomp|advcl|relcl`).
    - generic incoming `dep` links no longer trigger blanket actor suppression.
  - Keeps the `v1.1.19` IRS clausal-noise suppression while restoring legitimate actor-bearing fallback signal in dep-linked webshop long-chain clauses.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression lock proving fallback actor is allowed for incoming generic `dep` link predicates.
- `test/integration/stage11-relation-extraction.test.js`
  - Updated long-chain webshop lock:
    - `complement_clause/purpose(needs, take)` remain suppressed,
    - `actor(take, system)` is present again.

## [1.1.19] - 2026-02-13

Compared to `v1.1.18`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 chunk-fallback boundaries for long passive/complement chains:
    - suppresses fallback `actor` injection when a VP predicate is already verb-linked from another predicate (`dep`/`conj`/clausal links),
      reducing cross-clause role carryover noise.
    - suppresses `to`-nextVP fallback (`complement_clause`/`purpose`) when explicit clausal complement dependencies already exist
      on the predicate.
  - Keeps dependency-driven complement structure authoritative while reducing fallback amplification on long-chain clauses.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Added fallback-boundary locks:
    - no fallback `actor` on verb-linked clausal complement predicates.
    - no `to`-nextVP fallback when explicit `xcomp` already exists.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end locks for long-chain sentences:
    - IRS passive/complement chain: no `actor(submit, IRS)` fallback injection.
    - webshop long chain: no fallback `complement_clause/purpose(needs, take)` and no fallback `actor(take, system)`.

## [1.1.18] - 2026-02-13

Compared to `v1.1.17`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Hardened Stage 08 comma-coordination and nominal-attachment behavior for complex clause variants:
    - comma-separated verb coordination now selects the nearest non-boundary finite/base verb head before falling back,
      preventing modifier participles from becoming coordination anchors in cases like:
      - `It starts at a given minimum value, tests each successive integer for primality.`
    - noun attachment scans now treat modifier-like `VBN` tokens as transparent in nominal spans, allowing stable PP-object
      attachment (`pobj(value <- at)`) instead of object drift onto participles/verbs.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock for comma-coordinated complex variant:
    - `conj(tests <- starts)` (no `conj(tests <- given)`)
    - `pobj(value <- at)` (no `obj(value <- given)`).
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for:
    - `location(starts, value)` present
    - `actor(tests, it)` and `theme(tests, integer)` present
    - no `theme(at, value)` and no `coordination(at, tests)`.

## [1.1.17] - 2026-02-13

Compared to `v1.1.16`.

### Tests
- `test/integration/stage11-relation-extraction.test.js`
  - Added explicit connector-contract regression lock for:
    - `Each role grants permissions such as read, write, or administer.`
    - `Reports may include structured fields (category, severity, location) as well as free-form descriptions.`
  - Locks two expectations together:
    - connector tokens (`such`, `as`, `well`) are not emitted as accepted Stage 11 semantic relation endpoints,
    - required structural relations (`actor`, `theme`, `exemplifies`, `coordination`) remain present.

## [1.1.16] - 2026-02-13

Compared to `v1.1.15`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 coordinated nominal-tail normalization for purpose PP shapes:
    - in noun-like coordination chains where a conjunct has a compound nominal tail (e.g. `security analysis`),
      Stage 11 now resolves the conjunct to its nominal tail head for coordination emission.
    - compound projection in this bounded coordinated-tail context is normalized to head-oriented modifier form.
  - For:
    - `Actions are recorded for auditing and security analysis.`
  - this yields:
    - `coordination(auditing, analysis)`
    - `modifier(analysis, security)`
  - while preserving:
    - `patient(recorded, Actions)`
    - `beneficiary(recorded, auditing)`
    - and no fallback event-center synthesis on PP objects.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Extended purpose-chain unit lock to assert:
    - `coordination(auditing, analysis)` present
    - `modifier(analysis, security)` present
    - legacy noisy orientation (`coordination(auditing, security)`, `modifier(security, analysis)`) absent.
- `test/integration/stage11-relation-extraction.test.js`
  - Extended end-to-end purpose-chain lock with the same tail-shape assertions.

## [1.1.15] - 2026-02-13

Compared to `v1.1.14`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 dep-label projection to suppress connector-local `such as` noise:
    - skips only `amod` edges where dependent surface is `such` and the head token is the `pobj` of `as`.
  - This removes connector artifact relations such as `modifier(read, such)` while preserving:
    - governing predicate/object edges (`actor(grants, role)`, `theme(grants, permissions)`),
    - exemplar membership edges (`exemplifies(permissions, read|write|administer)`).

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Extended `such as` membership regression lock to assert connector artifact absence:
    - no `modifier(read, such)`.
- `test/integration/stage11-relation-extraction.test.js`
  - Extended end-to-end `such as` lock to assert no accepted `modifier(..., such)` relation is emitted.

## [1.1.14] - 2026-02-13

Compared to `v1.1.13`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 chunk fallback to skip VP fallback synthesis for argument-like VP chunks when dependency evidence already marks chunk tokens as external arguments (`nsubj|nsubjpass|obj|dobj|iobj|pobj` to an external head).
  - This suppresses residual passive-noise artifacts such as `theme(Generated, primes)` in:
    - `Generated primes may be used for educational purposes.`
  - Hardened modifier normalization for dep-label modifiers (`amod|compound|nummod`):
    - when chunk-head normalization would collapse a nominal modifier head onto an adposition (`IN|TO`), Stage 11 now preserves the original nominal head token.
  - This removes PP-marker-centered modifier artifacts such as `modifier(for, educational)` and keeps nominal attachment (`modifier(purposes, educational)`).

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Updated baseline fixture lock for generated-primes modifier head normalization.
  - Added regression lock ensuring VP chunk fallback is skipped for argument-like VP chunks (no synthetic `theme(Generated, primes)`).
- `test/integration/stage11-relation-extraction.test.js`
  - Extended passive `may be used` end-to-end lock:
    - required `patient(used, primes)` still present,
    - `theme(Generated, primes)` absent,
    - `modifier(for, educational)` absent.

## [1.1.13] - 2026-02-13

Compared to `v1.1.12`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Hardened Stage 08 passive-subject anchoring for pre-passive noun phrases in `be + VBN` clauses.
  - For noun chains before the passive head, the rightmost noun now remains the passive subject anchor (`nsubjpass`) while left nouns attach as `compound` dependents.
  - This prevents subject-anchor drift in clauses like:
    - `Prime factorization is commonly used in mathematics.`

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock ensuring passive subject anchors to `factorization` (not `Prime`) in the prime-factorization passive clause.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for:
    - `patient(used, factorization)` present
    - `patient(used, prime)` absent.

## [1.1.12] - 2026-02-13

Compared to `v1.1.11`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Hardened Stage 08 inline multi-verb list handling for comma-separated coordinated predicates.
  - In bounded verb-list contexts, intermediate verbs are emitted as `conj` (instead of generic `dep`) to preserve coordinated predicate structure.
  - Added guard to avoid applying comma-list verb coordination inside `such as` exemplar spans.
- `src/pipeline/stages/relation-extraction.js`
  - Retained deterministic actor propagation across verb coordination, now benefiting from improved Stage 08 conj structure in inline lists.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock for:
    - `Users can request changes, update reports, and assign supervisors.`
    - asserts `conj(update <- request)` and `conj(assign <- update)` plus per-verb object attachment (`request->changes`, `update->reports`, `assign->supervisors`).
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for inline multi-verb coverage:
    - `actor(request, users)` + `theme(request, changes)`
    - `actor(update, users)` + `theme(update, reports)`
    - `actor(assign, users)` + `theme(assign, supervisors)`.

## [1.1.11] - 2026-02-13

Compared to `v1.1.10`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Hardened Stage 08 noun attachment for sequential coordinated clauses:
    - noun objects now prefer the nearest left verb in the same local clause window when no preposition boundary intervenes.
    - noun heads in determiner/adjective spans after a preposition now attach as `pobj` to that preposition (`at a minimum value` -> `pobj(value <- at)`).
  - This prevents object flattening onto earlier coordinated predicates in patterns like:
    - `It starts ... and tests each successive integer.`
- `src/pipeline/stages/relation-extraction.js`
  - Added deterministic coordination role propagation for verb `conj` edges:
    - propagates `actor` across coordinated verb predicates when one side has an explicit actor relation.
  - Keeps clause-level subject coverage stable across coordinated verb sequences without changing passive fallback policy.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock:
    - `It starts at a minimum value and tests each successive integer.`
    - asserts `pobj(value <- at)` and `obj(integer <- tests)` (and no `obj(integer <- starts)`).
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for sequential coordinated verbs:
    - `actor(starts, it)`
    - `actor(tests, it)`
    - `theme(tests, integer)`
    - `location(starts, value)`
    - and no flattened `theme(starts, integer)`.

## [1.1.10] - 2026-02-13

Compared to `v1.1.9`.

### Changed
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 fallback to suppress contradictory passive-role synthesis when passive structure is already explicit:
    - no fallback `actor(...)` when `nsubjpass` is present for the predicate.
    - no fallback `theme(...)` for by-agent NP when a `prep(by) + pobj(...)` chain exists.
  - Keeps dependency-driven passive roles authoritative and prevents duplicate/conflicting fallback relations.

### Tests
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression lock for passive-with-agent fallback suppression:
    - `Reports are reviewed by supervisors.`
    - asserts `patient(reviewed, reports)` + `agent(reviewed, supervisors)`
    - asserts no `actor(reviewed, reports)` and no `theme(reviewed, supervisors)`.
  - Updated one Stage 11 baseline fixture ID lock to reflect intentional removal of obsolete fallback relation in passive structure.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for passive-with-agent behavior:
    - accepted `patient` and `agent`
    - no contradictory fallback `actor/theme` on same predicate.

## [1.1.9] - 2026-02-13

Compared to `v1.1.8`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Added deterministic Stage 08 normalization for additive `as well as` connector patterns in noun coordination contexts.
  - In this bounded pattern:
    - connector tokens are emitted as `fixed` dependencies (instead of generic adverb/preposition attachments),
    - right-hand noun is emitted as `conj` of the left noun,
    - coordination evidence is attached with:
      - `coordination_type: "and"`
      - `coordinator_token_id` set to the second `as` token.
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 `conj` handling to honor Stage 08 coordination evidence when `cc` lookup is absent.
  - For evidence-backed nominal coordination, relation extraction preserves raw noun conjunct ids (prevents chunk-head collapse onto connector tokens like `as`).

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock for:
    - `The report includes structured fields as well as free descriptions.`
    - asserts noun `conj(fields, descriptions)` with `and`-coordination evidence and connector tokens emitted as `fixed` (no `advmod(well, ...)`).
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression lock for evidence-driven coordination metadata on `conj` edges without `cc` lookup.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for additive coordination:
    - `actor(includes, report)`
    - `theme(includes, fields)`
    - `coordination(fields, descriptions)`
    - and no relation projections on connector token `well`.

## [1.1.8] - 2026-02-13

Compared to `v1.1.7`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Added deterministic temporal PP attachment hardening for `for + CD + noun` duration patterns.
  - Stage 08 now emits:
    - `prep` attached to governing verb for temporal `for` spans in this bounded pattern.
    - `pobj` on the duration noun (`years`, `months`, etc.) even with an intervening cardinal token.
    - `nummod` from cardinal duration token (`10`) to duration noun head.
- `src/pipeline/stages/relation-extraction.js`
  - Hardened chunk fallback to skip synthetic VP fallback actor/theme emissions when the VP head token is already a `pobj` in dependency evidence.
  - Prevents PP-object tokens from being promoted to fallback predicate centers.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock for:
    - `The system must retain reports for 10 years.`
    - asserts `prep(for <- retain)`, `pobj(years <- for)`, and `nummod(10 -> years)`.
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression lock for temporal `prep+pobj` projection:
    - accepted `beneficiary(retain, years)` and numeric modifier retention.
  - Added fallback guard lock to avoid synthetic `actor/theme` when candidate VP head is a `pobj` token.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for:
    - `theme(retain, reports)`
    - `beneficiary(retain, years)`
    - numeric modifier retention for `10`
    - and no `theme(retain, years)` fallback misprojection.

## [1.1.7] - 2026-02-13

Compared to `v1.1.6`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Added deterministic Stage 08 PP hardening for purpose chains with gerunds:
    - `for + VBG` now emits `pobj` on the gerund token instead of default `dep` fallback.
  - Added noun-like attachment handling for `VBG` in `for`-PP object contexts so coordinated nominal tails remain structurally attached (e.g., `auditing and security analysis`).
- `src/pipeline/stages/relation-extraction.js`
  - Hardened Stage 11 chunk fallback to skip VP fallback actor/theme synthesis when the VP head is already a `pobj` in dependency evidence.
  - Prevents PP-object gerunds from being promoted to synthetic event centers by fallback.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock for:
    - `Actions are recorded for auditing and security analysis.`
    - asserts `pobj(for, auditing)`, coordinated nominal tail attachment, and no `dep(auditing, ...)` fallback.
- `test/unit/stage11-relation-extraction.test.js`
  - Added regression lock ensuring chunk fallback does not emit synthetic `actor/theme` for VP heads functioning as `pobj`.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for:
    - `patient(recorded, actions)`
    - `beneficiary(recorded, auditing)`
    - coordination structure anchored in PP object chain
    - and no synthetic `actor/theme` with `auditing` as predicate.

## [1.1.6] - 2026-02-13

Compared to `v1.1.5`.

### Changed
- `src/pipeline/stages/linguistic-analysis.js`
  - Added deterministic copula-complement dependency emission in Stage 08:
    - adjective complements after copula verbs are emitted as `acomp`
    - nominal complements after copula verbs are emitted as `attr`
  - Added deterministic passive adverb attachment hardening:
    - in `be + ... + VBN` chains, mid-position adverbs now attach to the passive participle head (e.g. `used`) instead of the auxiliary copula.

### Tests
- `test/unit/stage08-linguistic-analysis.test.js`
  - Added regression lock for copula complements as `acomp/attr` in:
    - `A webshop is an online store.`
  - Added regression lock for passive adverb attachment in:
    - `Prime factorization is commonly used in mathematics.`
    - asserts root/passive-subject/adverb all target `used`.
- `test/integration/stage11-relation-extraction.test.js`
  - Added end-to-end lock for copula attribute projection:
    - `Each factor is prime.` -> accepted `attribute(is, prime)`.
  - Added end-to-end lock for passive adverb projection:
    - `Factorization is commonly used in mathematics.` -> accepted `modifier(used, commonly)` and no `modifier(is, commonly)`.

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
  - Stage 08 linguistic-analysis TODO (historical)
  - Stage 09 chunking TODO (historical)
  - Stage 10 head-identification TODO (historical)
  - Stage 11 relation-extraction TODO (historical)
  - Historical note: these were later consolidated into central `TODO.md` and removed as standalone files.
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
