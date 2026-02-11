#  Linguistic Analysis - TODO

## Progress (small optimization cycles)

- 2026-02-11 (Cycle 1, completed): added deterministic coordination evidence for Stage 08 dependency observations.
  - `cc` and `conj` edges now carry `coordination_type` (`and`/`or`) and `coordinator_token_id` in source evidence.
  - Scope intentionally kept minimal: no relation-label expansion, no coordination grouping rewrite yet.
  - Validation added: unit test `stage08 emits coordination evidence for cc and conj dependencies`.
- 2026-02-11 (Cycle 2, completed): extended noun coordination linking to create `conj` for noun-like tokens after `and`/`or`.
  - Added deterministic evidence fields on noun `conj` edges (`coordination_type`, `coordinator_token_id`).
  - Validation added: unit test `stage08 emits noun conj with or-coordination evidence`.
- 2026-02-11 (Cycle 3, completed): locked verb `or` coordination with explicit tests.
  - Confirmed Stage 08 verb `conj` path already supports `and`/`or` through shared coordinator detection.
  - Validation added:
    - unit test `stage08 emits verb conj with or-coordination evidence`
    - integration test `runPipeline parsed carries or-coordination evidence on cc and conj in verbal coordination`.
- 2026-02-11 (Cycle 4, completed): added deterministic comparative observations for `than` patterns.
  - Stage 08 now emits `comparative` observation annotations when a comparative head is followed by marker `than` and a right-hand numeric/nominal target.
  - Added explicit evidence payload fields: `pattern=comparative_than`, `marker_surface=than`, `marker_token_id`.
  - Validation added:
    - unit test `stage08 emits comparative observation for greater-than numeric threshold`
    - integration test `runPipeline parsed emits comparative observation for greater than 1`.
- 2026-02-11 (Cycle 5, completed): added deterministic quantifier/scope observations.
  - Stage 08 now emits `quantifier_scope` observation annotations for markers:
    - quantifier: `each`, `every`, `all`, `some`, `no`
    - scope: `only`
  - Deterministic attachment policy: nearest noun to the right, otherwise nearest noun to the left.
  - Added explicit evidence payload fields: `marker_surface`, `marker_token_id`, `attachment_rule=nearest_noun_right_else_left`.
  - Validation added:
    - unit test `stage08 emits quantifier/scope observations with deterministic noun attachment`
    - integration test `runPipeline parsed emits quantifier/scope observations for each and only`.
- 2026-02-11 (Cycle 6, completed): added deterministic copula frame observations.
  - Stage 08 now emits `copula_frame` observation annotations for copula surfaces (`be`, `am`, `is`, `are`, `was`, `were`, `been`, `being`) with:
    - `subject` token ref (nearest noun/pronoun to the left)
    - `copula` token ref
    - `complement` token ref (nearest noun/adjective/verb to the right)
  - Added explicit evidence payload fields: `pattern=copula_subject_complement`, `copula_surface`, `copula_token_id`, `complement_kind`, `attachment_rule=nearest_subject_left_nearest_complement_right`.
  - Validation added:
    - unit test `stage08 emits copula_frame with subject/copula/complement evidence`
    - integration test `runPipeline parsed emits copula_frame observation for copula clauses`.
- 2026-02-11 (Cycle 7, completed): added deterministic PP attachment observations.
  - Stage 08 now emits `pp_attachment` observation annotations for preposition-like markers (`IN`/`TO` and bounded marker surfaces such as `in`, `at`, `for`, `with`, `by`, `of`, `from`, `into`, `than`, ...).
  - Deterministic attachment policy: nearest content head to the left (verb/noun/adj/adv) + nearest nominal object to the right (noun/pronoun/number).
  - Added explicit evidence payload fields: `pattern=pp_head_object`, `prep_surface`, `marker_token_id`, `attachment_rule=nearest_content_left_nearest_object_right`.
  - Validation added:
    - unit test `stage08 emits pp_attachment with deterministic head/marker/object evidence`
    - integration test `runPipeline parsed emits pp_attachment observations for at/for markers`.
- 2026-02-11 (Cycle 8, completed): added deterministic modality/negation scope observations.
  - Stage 08 now emits:
    - `modality_scope` for modal markers (`MD`)
    - `negation_scope` for bounded negation markers (`not`, `n't`, `never`)
  - Policy refinement: `no` is exclusively modeled as `quantifier_scope` (`quantifier_no`) to avoid double-counting.
  - Deterministic attachment policy: nearest lexical verb to the right, otherwise nearest lexical verb to the left.
  - Added explicit evidence payload fields:
    - modality: `pattern=modal_verb_scope`
    - negation: `pattern=negation_scope`
    - shared: `marker_surface`, `marker_token_id`, `attachment_rule=nearest_lexical_verb_right_else_left`.
  - Validation added:
    - unit test `stage08 emits modality_scope and negation_scope observations`
    - integration test `runPipeline parsed emits modality_scope and negation_scope observations`.

This stage produces a *deterministic, heuristic* dependency observation layer from:
- tokens + POS (Stage 04)
- accepted MWEs (Stages 05-07)
- segments (Stage 02)

Downstream stages rely on these observations heavily:
- Stage 10 uses them to pick `chunk_head` values.
- Stage 11 projects them into labeled relations.
- Stage 12 (elementary assertions) is conservative and will not “invent” missing structure. Any systematic gaps here will therefore surface as coverage / unresolved and as distorted predicates/roles.

The goal of this TODO is to tighten Stage 08 so it remains deterministic but becomes a *more faithful structural scaffold* for later stages.

---

## High-level objectives

1. Preserve determinism and replayability.
2. Increase structural fidelity for:
   - coordination (AND/OR)
   - prepositional attachment and objects
   - comparatives / numeric constraints
   - quantifiers and scope markers
   - modality and negation attachment
   - copula / complement patterns
3. Reduce downstream distortion caused by brittle or missing dependency signals.
4. Improve evidence richness so later stages can remain conservative and still reconstruct correct slot structure.

---

## Current gap patterns and why they matter

### A) Coordination is incomplete and loses logical type (AND vs OR)
Current behavior typically treats coordinating tokens as generic coordination signals, but does not reliably:
- connect coordinated *verbs* and *noun phrases* symmetrically,
- preserve whether the coordinator is **and** or **or**.

Why this matters:
- Stage 11 can emit “coordination” but cannot distinguish conjunction from disjunction.
- Stage 12 cannot bind modality or roles across an OR-list correctly without explicit evidence.

Required optimization:
- Create deterministic coordination structures that:
  - link all conjuncts
  - include coordinator surface/type (`and` vs `or`)
  - include the coordinator token id as evidence

Acceptance criteria:
- Coordinated lists are always represented as a connected component with a stable id.
- Coordinator type is present as a field (or as a dedicated relation label) and remains byte-stable.

---

### B) Prepositions and objects are too narrowly modeled
Current behavior often uses a narrow `prep` -> `pobj` pattern. This fails when:
- syntactic patterns do not match that exact shape,
- attachments are ambiguous and need stable tie-breaking,
- “case”-like constructions do not fit the simple model.

Why this matters:
- Stage 11’s mapping logic expects specific edges; missing edges cause roles like location/source/target to disappear.
- Comparatives (e.g., “greater than X”) are structurally expressed via function words that resemble prepositions.

Required optimization:
- Expand deterministic handling for prepositional/object attachment:
  - ensure every preposition-like token has a well-defined head selection rule
  - ensure a robust object selection rule (single object, stable tie-break)
  - explicitly emit the preposition surface (“at”, “for”, “than”, etc.) as evidence

Acceptance criteria:
- If a PP exists in the surface form, it must yield at least one attach edge and one object edge (when a noun/pronoun object exists).
- Attachment ties are broken deterministically by a documented ordering rule.

---

### C) Comparatives and numeric constraints are not represented explicitly
Patterns like:
- comparative adjectives/adverbs (“greater”, “less”, “at least”)
- numeric thresholds (“> 1” style constraints in text form)
- “than”-phrases
are currently not represented as a structured comparative relation.

Why this matters:
- Downstream cannot reconstruct the constraint as a machine-checkable structure.
- Coverage/unresolved grows because the key tokens (“greater”, numbers) are present but not linked into a constraint graph.

Required optimization:
- Introduce deterministic comparative observation:
  - identify comparative head (JJ/RB in comparative form, or known comparative lexemes)
  - identify comparator target (numeric token, quantity NP)
  - bind “than” / comparator marker as evidence
  - emit a canonical comparative relation label (e.g., `compare_gt`, `compare_lt`, `compare_ge`, `compare_le`)

Acceptance criteria:
- Comparative constructs always produce one explicit comparative relation with:
  - `head_token_id`
  - `rhs_token_id` (or rhs mention span)
  - `marker_token_id` (e.g., “than”) when present

---

### D) Quantifiers and scope markers are ignored or under-modeled
Examples include determiners and quantifiers:
- “each”, “every”, “only”, “all”, “some”, “no”
and scope-affecting adverbs/particles.

Why this matters:
- Many requirements/constraints depend on scope (“only X”, “each Y”).
- Without an explicit scope/quantifier edge, later stages must either guess (disallowed) or drop the logic.

Required optimization:
- Emit explicit quantifier/scope observations:
  - `quantifier(each|every|all|some|no)` attached to the governed NP head
  - `scope_only` (or `focus_only`) attached to the governed phrase head
  - preserve the marker token id as evidence

Acceptance criteria:
- If a scope/quantifier token is present and tagged appropriately, a corresponding observation must exist.
- These observations must be deterministic and not depend on statistical ranking.

---

### E) Modality attachment must be unambiguous and stable
Modal auxiliaries (MD) should be attached to the correct lexical predicate.
Current patterns can misattach modality when:
- the next verb is not the true matrix predicate,
- chunks split the verbal complex,
- coordination is present.

Why this matters:
- Stage 12 operators like `modality(may|must|should)` must attach to the correct assertion.
- Wrong attachment yields fragmented assertions and incorrect operator scope.

Required optimization:
- Deterministic modality binding rule set:
  1) attach MD to the nearest lexical verb to the right within the same clause window
  2) if not found, attach to the nearest lexical verb to the left
  3) clause windows and tie-breakers must be documented

Acceptance criteria:
- For MD tokens, modality edges must always resolve to a lexical predicate token id.
- The same input produces identical modality edges across runs.

---

### F) Copula and complement structures need richer observation
Copula patterns (“X is Y”, “X are considered Y”) need:
- subject link
- copula link
- complement link
- optionally: predicate adjective / predicate nominal typing

Why this matters:
- Downstream predicate selection can collapse onto “is/are” and lose the meaningful complement relation.
- Stage 10 may demote certain verbs, but without richer structure, later steps cannot reconstruct meaning reliably.

Required optimization:
- Emit explicit copula frames:
  - `copula(subject, copula_verb, complement)`
  - or a set of edges that unambiguously encode this triple
- Add stable typing for complement kind: nominal vs adjectival vs clause.

Acceptance criteria:
- Copula sentences yield enough edges to allow Stage 11 to represent the complement as the core predicate content (without guessing).

---

## Design constraints

- Must remain deterministic and library-independent (no model calls).
- Must not depend on probabilistic scoring.
- Must produce auditable evidence fields (token ids, surfaces, spans).
- Must not introduce domain-specific knowledge or semantic normalization.
- Must not require external services.

---

## Proposed implementation plan (deterministic increments)

### 1) Coordination upgrade
- Add a coordinator detector for both “and” and “or”.
- Build conjunct groups over:
  - verb candidates
  - NP heads (list items)
- Emit:
  - `coordination` edges between conjunct heads
  - `coordination_type` (and/or) stored in edge metadata or a distinct label
  - coordinator token id as evidence

### 2) Preposition + object generalization
- Generalize beyond strict `prep`/`pobj` by:
  - allowing “case-like” markers to behave as prepositions
  - defining a stable head-selection for attachment
  - defining a stable object-selection rule

### 3) Comparative/threshold observation
- Recognize “than” and comparative JJ/RB forms.
- Emit a structured comparative edge label.
- Bind RHS numeric tokens or NP heads deterministically.

### 4) Quantifier and scope observation
- Recognize a bounded set of quantifier/scope tokens by surface + POS.
- Attach them to the nearest NP head in a deterministic window.
- Emit labels with the marker token id as evidence.

### 5) Modality binding hardening
- Replace any “guess parent” behavior with a deterministic clause-window search.
- Ensure one modality edge per MD token.

### 6) Copula frame enrichment
- Emit explicit `cop` + `attr`/`acomp`/`pcomp` style edges sufficient to reconstruct:
  - subject
  - copula verb
  - complement

---

## Test strategy

Add golden-run fixtures that assert only *structural* properties, such as:
- Coordination groups are connected and labeled with type.
- Preposition objects exist when a PP exists.
- Comparative constructs emit one comparative edge with RHS binding.
- Quantifier tokens always yield a quantifier observation.
- MD tokens always yield one modality edge attached to a lexical verb.
- Copula sentences yield subject + complement edges.

All tests must be byte-stable and operate purely on deterministic artifacts.

---

## Deliverables

1) Updated Stage 08 code with the above observation enrichments.
2) Documentation:
   - explicitly document tie-break rules and clause windows
   - list supported observation labels and their evidence payload
3) Test suite additions for the new observation types.
4) Migration note for Stage 11 mapping to consume any new labels/metadata (especially coordination type and comparative relations).
