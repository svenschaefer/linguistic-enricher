# Upstream Structural Coverage Evaluation (Stages 00-11)

Date: 2026-02-13  
Scope: evaluation-only of upstream structural capture (segmentation, dependency/role extraction, relation construction).  
Target: `relations_extracted` output with `parsed` dependency trace used for origin analysis.

## Test 1.1 - Simple Passive
**Input**  
`Generated primes may be used for educational purposes.`

**Relations actually emitted**
- `theme(Generated, primes)`
- `patient(used, primes)`
- `modality(used, may)`
- `theme(used, purposes)`
- `modifier(for, educational)`

**Comparison vs expected**
- Expected `patient(used, primes)`: present
- Expected `modality(used, may)`: present
- Expected `prep_for(used, purposes)`: missing (PP role collapsed to `theme`)
- Must not omit patient: satisfied
- Must not emit primes only as generic theme: satisfied (but extra noise exists)

**Failure analysis**
- PP object is not represented as `pobj(for -> purposes)` in Stage 08 for this shape, so Stage 11 cannot emit a prep-role relation and falls back to `theme`.

**Issue origin**
- Primary: Stage 08 (`src/pipeline/stages/linguistic-analysis.js`, dependency construction for noun after adjective in PP)
- Secondary effect in Stage 11 role projection.

**Severity**
- **Degrading**

---

## Test 1.2 - Passive with Agent
**Input**  
`Reports are reviewed by supervisors.`

**Relations actually emitted**
- `actor(reviewed, Reports)`
- `patient(reviewed, Reports)`
- `agent(reviewed, supervisors)`
- `theme(reviewed, supervisors)`

**Comparison vs expected**
- Expected `patient(reviewed, reports)`: present
- Expected `agent(reviewed, supervisors)`: present
- Must not merge patient and agent: satisfied
- Must not drop either relation: satisfied
- Extra conflicting relations (`actor` for passive subject, `theme` for agent): unexpected

**Failure analysis**
- Core passive relations are present, but additional fallback relations create contradictory role signals.

**Issue origin**
- Stage 11 fallback relation heuristics (`src/pipeline/stages/relation-extraction.js`, chunk fallback path).

**Severity**
- **Degrading**

---

## Test 2.1 - Copula with Attribute
**Input**  
`Each factor is prime.`

**Relations actually emitted**
- `quantifier(factor, Each)`
- `modifier(factor, prime)`
- `actor(is, factor)`

**Comparison vs expected**
- Expected `nsubj(is, factor)`: effectively present via `actor(is, factor)`
- Expected `attr(is, prime)`: missing
- Must not promote `prime` as event: satisfied
- Must not emit event equivalent to `factor primes`: satisfied

**Failure analysis**
- `prime` is tagged/emitted as adjectival modifier of `factor` instead of copular complement (`attr/acomp`), so the copula attribute frame is not represented.

**Issue origin**
- Stage 08 dependency labeling (copula complement handling) in `src/pipeline/stages/linguistic-analysis.js`.

**Severity**
- **Blocker** (attribute relation irrecoverable downstream without guessing)

---

## Test 2.2 - Copula + Event in Same Sentence
**Input**  
`Prime factorization is commonly used in mathematics.`

**Relations actually emitted**
- `modifier(Prime, factorization)`
- `modifier(is, commonly)`
- `actor(used, Prime)`
- `patient(used, Prime)`
- `location(used, mathematics)`

**Comparison vs expected**
- Expected `nsubjpass(used, factorization)`: missing (subject collapsed to `Prime`)
- Expected `advmod(used, commonly)`: missing (`commonly` attached to `is`)
- Must not treat `is` as primary event: mostly satisfied (event head is `used`), but adverb attachment is wrong

**Failure analysis**
- NP internal structure is broken (`Prime` selected as passive subject anchor instead of `factorization`), and adverb is attached to copula token rather than passive participle.

**Issue origin**
- Stage 08 dependency construction and head attachment decisions (`src/pipeline/stages/linguistic-analysis.js`).

**Severity**
- **Blocker**

---

## Test 3.1 - Sequential Verbs
**Input**  
`It starts at a minimum value and tests each successive integer.`

**Relations actually emitted**
- `actor(starts, It)`
- `theme(starts, value)`
- `coordination(starts, tests)`
- `theme(starts, integer)`
- `modifier(at, minimum)`
- `quantifier(tests, each)`
- `modifier(tests, successive)`
- `theme(tests, integer)`

**Comparison vs expected**
- Expected `nsubj(starts, it)`: present
- Expected `prep_at(starts, value)`: missing (emitted as `theme`)
- Expected `nsubj(tests, it)`: missing
- Expected `dobj(tests, integer)`: present (via `theme`)
- Must not attach `tests` as complement of `starts`: satisfied (coordination relation emitted)

**Failure analysis**
- Subject is not propagated/resolved for coordinated verb `tests`, and PP role at `starts` is flattened.

**Issue origin**
- Stage 08 for initial dependency/PP labeling.
- Stage 11 partially compensates but does not reconstruct missing subject relation.

**Severity**
- **Degrading**

---

## Test 4.1 - such as Enumeration
**Input**  
`Each role grants permissions such as read, write, or administer.`

**Relations actually emitted**
- `quantifier(role, Each)`
- `modifier(role, grants)`
- `modifier(role, permissions)`
- `modifier(as, such)`
- `actor(write, role)`
- `coordination(write, administer)`

**Comparison vs expected**
- Expected `nsubj(grants, role)`: missing
- Expected `dobj(grants, permissions)`: missing
- Expected exemplifier relations for `read/write/administer`: missing
- Must not emit read/write/administer as independent events: violated (`write` becomes root event)
- Must not drop list elements: violated (`read` dropped as exemplar relation)

**Failure analysis**
- POS/dependency path collapses clause center to `write`; `grants` is treated nominally and list semantics (`such as`) are not represented.

**Issue origin**
- Stage 04 POS tagging misclassifies `grants` as `NNS` in this context.
- Stage 08 then builds incorrect dependency skeleton from that tagging.
- Stage 11 has no `such as` exemplar relation mapping.

**Severity**
- **Blocker**

---

## Test 4.2 - as well as
**Input**  
`The report includes structured fields as well as free-form descriptions.`

**Relations actually emitted**
- `actor(includes, report)`
- `theme(includes, fields)`
- `modifier(includes, as)`
- `modifier(includes, well)`
- `modifier(as, descriptions)`

**Comparison vs expected**
- Expected `nsubj(includes, report)`: present
- Expected `dobj(includes, fields)`: present
- Expected `conj(fields, descriptions)`: missing
- Must not lose `free-form descriptions`: partially violated (kept only as modifier artifact)
- Must not emit `as well as` as modifier artifact: violated

**Failure analysis**
- Multi-token connector `as well as` is not normalized into coordination semantics; downstream receives modifier noise instead of list structure.

**Issue origin**
- Stage 08 dependency labeling for connector pattern.
- Stage 11 lacks dedicated normalization for `as well as` into coordination relation.

**Severity**
- **Degrading**

---

## Test 5.1 - Inline List
**Input**  
`Users can request changes, update reports, and assign supervisors.`

**Relations actually emitted**
- `actor(request, Users)`
- `modality(request, can)`
- `theme(request, changes)`
- `theme(request, reports)`
- `theme(request, supervisors)`
- `theme(update, reports)`
- `coordination(update, assign)`
- `theme(assign, supervisors)`

**Comparison vs expected**
- Expected `nsubj(request, users)`: present
- Expected `dobj(request, changes)`: present
- Expected `nsubj(update, users)`: missing
- Expected `dobj(update, reports)`: present
- Expected `nsubj(assign, users)`: missing
- Expected `dobj(assign, supervisors)`: present
- Must not collapse into single predicate: partially violated (request collects extra objects)
- Must not discard other verbs: satisfied (`update` and `assign` retained)

**Failure analysis**
- Coordinated verbs retain objects but not explicit subject propagation; primary verb over-absorbs sibling objects.

**Issue origin**
- Stage 08 initial dependencies (`update` emitted as weak `dep` in comma list).
- Stage 11 fallback adds partial structure but not complete subject distribution.

**Severity**
- **Degrading**

---

## Test 6.1 - Purpose PP
**Input**  
`Actions are recorded for auditing and security analysis.`

**Relations actually emitted**
- `coordination(Actions, security)`
- `actor(recorded, Actions)`
- `patient(recorded, Actions)`
- `theme(recorded, security)`
- `actor(auditing, Actions)`
- `theme(auditing, security)`
- `modifier(security, analysis)`

**Comparison vs expected**
- Expected `patient(recorded, actions)`: present
- Expected `prep_for(recorded, auditing)`: missing
- Expected `conj(auditing, analysis)`: missing
- Must not emit auditing as standalone event: violated (`actor/theme` anchored on `auditing`)
- Must not attach PP to unrelated verb: violated

**Failure analysis**
- `auditing` is promoted into event-like relation center and PP purpose structure is not preserved.

**Issue origin**
- Stage 08 dependency formation around `for + VBG` and coordination attachment.
- Stage 11 fallback amplifies by emitting actor/theme from weak local structure.

**Severity**
- **Blocker**

---

## Test 6.2 - Temporal Modifier
**Input**  
`The system must retain reports for 10 years.`

**Relations actually emitted**
- `actor(retain, system)`
- `modality(retain, must)`
- `theme(retain, reports)`
- `theme(retain, years)`

**Comparison vs expected**
- Expected `nsubj(retain, system)`: present
- Expected `dobj(retain, reports)`: present
- Expected `prep_for(retain, years)`: missing
- Must not put temporal spans into object/theme: violated (`years` emitted as `theme`)

**Failure analysis**
- Temporal PP is flattened into direct object/theme relation; prep relation semantics are lost.

**Issue origin**
- Stage 08 dependency labeling around `for 10 years` (no stable `prep+pobj` chain for projection).
- Stage 11 can only emit what Stage 08 exposes.

**Severity**
- **Degrading**

---

## Overall Assessment

- **Fully passing cases:** none
- **Primary blockers:** 2.1, 2.2, 4.1, 6.1
- **Major degrading cases:** 1.1, 1.2, 3.1, 4.2, 5.1, 6.2

### Root-cause concentration
- **Stage 08 (dominant):** dependency skeleton, root choice, PP/coplanar attachment, coordination/list structure.
- **Stage 04 (contributing):** verb/noun ambiguity in some list constructions (notably `grants`).
- **Stage 11 (secondary):** fallback heuristics introduce contradictory noise (extra actor/theme in passives) but are usually not the initial loss point.

### Success criteria status
- Not met. Multiple tests require downstream guessing to reconstruct core structure (passive subjects/agents, copula attributes, list semantics, PP roles).

---

## Validation Notes - Detailed Code Correlation (2026-02-13)

The following validates the detailed statement set against current code (`main` after `v1.1.4`).

### Stage 04 - POS tagging (`src/pipeline/stages/pos-tagging.js`)

1. `grants` misclassified as `NNS` in Test 4.1 due to narrow `NNS -> VBZ` repair scope.  
Status: **Confirmed.**  
Evidence:
- Finite repair only runs for `NNS` + likely finite surface + bounded context.
- Promotion to `VBZ` requires either:
  - previous tag `PRP`, or
  - previous tag `CC` and an earlier verb/modal in clause.
- This does not cover `Each role grants ...`.  
Code:
- `src/pipeline/stages/pos-tagging.js:126`
- `src/pipeline/stages/pos-tagging.js:143`
- `src/pipeline/stages/pos-tagging.js:146`

### Stage 08 - dependency skeleton (`src/pipeline/stages/linguistic-analysis.js`)

2. Copula complement is structurally unavailable as `attr/acomp` because Stage 08 emits adjective complements as `amod`.  
Status: **Confirmed.**  
Evidence:
- Adjective branch emits `amod` only.
- No dependency emission path for `attr` or `acomp`.  
Code:
- `src/pipeline/stages/linguistic-analysis.js:189`
- `src/pipeline/stages/linguistic-analysis.js:196`

3. `for + VBG` purpose pattern can leave VBG as verb-ish `dep` and later appear as an event center (Test 6.1).  
Status: **Confirmed.**  
Evidence:
- `for` is emitted as `prep` attached left.
- `VBG` enters verb-like branch and defaults to `dep` unless `TO + VB` or direct coordinator condition applies.  
Code:
- `src/pipeline/stages/linguistic-analysis.js:213`
- `src/pipeline/stages/linguistic-analysis.js:227`
- `src/pipeline/stages/linguistic-analysis.js:251`

4. Temporal `for 10 years` lacks stable dependency `prep+pobj` chain because `CD` is not noun-like in core dependency branch (Test 6.2).  
Status: **Confirmed.**  
Evidence:
- `pobj` assignment in dependency builder requires immediate previous ADP token.
- `isNounLikeTag` excludes `CD`, so `10` does not become PP object.
- `years` then follows `CD`, not ADP, and falls into general noun heuristics (`obj`).  
Code:
- `src/pipeline/stages/linguistic-analysis.js:27`
- `src/pipeline/stages/linguistic-analysis.js:274`
- `src/pipeline/stages/linguistic-analysis.js:292`

5. Multi-token connectors (`such as`, `as well as`) are not normalized as coordination patterns in Stage 08.  
Status: **Confirmed.**  
Evidence:
- Coordination detection is single-token surface check on immediate previous token (`and`/`or`) only.  
Code:
- `src/pipeline/stages/linguistic-analysis.js:51`
- `src/pipeline/stages/linguistic-analysis.js:238`
- `src/pipeline/stages/linguistic-analysis.js:261`

### Stage 11 - relation projection and fallback (`src/pipeline/stages/relation-extraction.js`)

6. Evaluation expectation `prep_for(...)` does not match current Stage 11 role vocabulary (`for -> beneficiary`) and requires `prep+pobj` chain.  
Status: **Confirmed (with vocabulary clarification).**  
Evidence:
- `for` maps to `beneficiary`, not a `prep_for` label.
- PP relation emission requires `dep.label === "prep"` plus child edges where `label === "pobj"`.  
Code:
- `src/pipeline/stages/relation-extraction.js:346`
- `src/pipeline/stages/relation-extraction.js:354`
- `src/pipeline/stages/relation-extraction.js:1024`
- `src/pipeline/stages/relation-extraction.js:1031`

7. Chunk fallback actor/theme can amplify weak Stage 08 structure (including VBG-centered VP artifacts).  
Status: **Confirmed.**  
Evidence:
- If VP has no core `nsubj`/`obj`, fallback injects nearest NP actor/theme.
- Subject presence check currently looks only for `nsubj` (not `nsubjpass`), which can introduce extra passive noise.  
Code:
- `src/pipeline/stages/relation-extraction.js:411`
- `src/pipeline/stages/relation-extraction.js:462`
- `src/pipeline/stages/relation-extraction.js:470`
- `src/pipeline/stages/relation-extraction.js:480`

### Additional useful context

- `v1.1.4` added a targeted passive improvement (`be + VBN` head preference with `nsubjpass` emission), which fixes the core passive-subject absence seen earlier in `Generated primes may be used ...`.
- This improvement does **not** resolve the broader blocker/degrading classes above (copula attribute gaps, list/connective normalization gaps, and PP object-chain instability).
