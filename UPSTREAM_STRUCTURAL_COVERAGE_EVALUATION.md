# Upstream Structural Coverage Evaluation (Stages 00-11)

Date: 2026-02-13  
Scope: evaluation-only of upstream structural capture (segmentation, dependency/role extraction, relation construction).  
Target: `relations_extracted` output with `parsed` dependency trace used for origin analysis.

## Re-Baseline (Post `v1.1.14`) - 2026-02-13

This re-baseline reran all evaluation sentences against current release-candidate behavior (`v1.1.14` branch).

### Re-baseline outcome by test
- `1.1` Simple Passive: **Pass with minor residual modifier noise**
  - Present: `patient(used, primes)`, `modality(used, may)`, `beneficiary(used, purposes)`.
  - Residual: `modifier(purposes, educational)` (non-blocking descriptor edge).
- `1.2` Passive with Agent: **Pass**
  - Present: `patient(reviewed, Reports)`, `agent(reviewed, supervisors)`.
  - No contradictory passive fallback relations observed.
- `2.1` Copula with Attribute: **Pass**
  - Present: `actor(is, factor)`, `attribute(is, prime)` (+ `copula(is, prime)`).
- `2.2` Copula + Event in Same Sentence: **Pass**
  - Present: `patient(used, factorization)`, `modifier(used, commonly)`, `location(used, mathematics)`.
  - No passive-subject anchor drift to `Prime`.
- `3.1` Sequential Verbs: **Pass**
  - Present: `actor(starts, It)`, `location(starts, value)`, `actor(tests, It)`, `theme(tests, integer)`.
  - Coordinated predicate structure preserved.
- `4.1` such as Enumeration: **Pass with minor connector residue**
  - Present: `actor(grants, role)`, `theme(grants, permissions)`, `exemplifies(permissions, read|write|administer)`.
  - Residual: connector-local `modifier(read, such)`.
- `4.2` as well as: **Pass**
  - Present: `actor(includes, report)`, `theme(includes, fields)`, additive coordination retained.
- `5.1` Inline List: **Pass**
  - Present per predicate:
    - `actor(request, Users)` + `theme(request, changes)`
    - `actor(update, Users)` + `theme(update, reports)`
    - `actor(assign, Users)` + `theme(assign, supervisors)`
- `6.1` Purpose PP: **Pass with residual NP-tail shape noise**
  - Present: `patient(recorded, Actions)`, `beneficiary(recorded, auditing)`.
  - No standalone event projection for `auditing`.
  - Residual tail shape: `coordination(auditing, security)` + `modifier(security, analysis)`.
- `6.2` Temporal Modifier: **Pass**
  - Present: `actor(retain, system)`, `theme(retain, reports)`, `beneficiary(retain, years)`, `modifier(years, 10)`.

## Test 1.1 - Simple Passive
**Input**  
`Generated primes may be used for educational purposes.`

**Relations actually emitted**
- `patient(used, primes)`
- `modality(used, may)`
- `beneficiary(used, purposes)`
- `modifier(purposes, educational)`

**Comparison vs expected**
- Core passive structure expected by evaluation: satisfied.
- Additional modifier edge remains but does not collapse predicate/argument structure.

**Severity**
- **Noise**

---

## Test 1.2 - Passive with Agent
**Input**  
`Reports are reviewed by supervisors.`

**Relations actually emitted**
- `patient(reviewed, Reports)`
- `agent(reviewed, supervisors)`

**Comparison vs expected**
- Expected passive patient and agent: satisfied.
- No contradictory fallback actor/theme: satisfied.

**Severity**
- **Pass**

---

## Test 2.1 - Copula with Attribute
**Input**  
`Each factor is prime.`

**Relations actually emitted**
- `actor(is, factor)`
- `attribute(is, prime)`
- `copula(is, prime)`
- `quantifier(factor, Each)`

**Comparison vs expected**
- Copula subject/complement structure preserved and projected.

**Severity**
- **Pass**

---

## Test 2.2 - Copula + Event in Same Sentence
**Input**  
`Prime factorization is commonly used in mathematics.`

**Relations actually emitted**
- `patient(used, factorization)`
- `modifier(used, commonly)`
- `location(used, mathematics)`
- `modifier(factorization, Prime)`

**Comparison vs expected**
- Passive patient anchor now resolves to `factorization` (expected).
- Adverb attaches to `used` (expected).

**Severity**
- **Pass**

---

## Test 3.1 - Sequential Verbs
**Input**  
`It starts at a minimum value and tests each successive integer.`

**Relations actually emitted**
- `actor(starts, It)`
- `location(starts, value)`
- `actor(tests, It)`
- `theme(tests, integer)`
- plus deterministic modifier/quantifier edges

**Comparison vs expected**
- Distinct predicate frames preserved across coordination.

**Severity**
- **Pass**

---

## Test 4.1 - such as Enumeration
**Input**  
`Each role grants permissions such as read, write, or administer.`

**Relations actually emitted**
- `actor(grants, role)`
- `theme(grants, permissions)`
- `exemplifies(permissions, read)`
- `exemplifies(permissions, write)`
- `exemplifies(permissions, administer)`
- residual connector edge: `modifier(read, such)`

**Comparison vs expected**
- Governing predicate/object and exemplar membership are preserved.
- Connector residue remains minor.

**Severity**
- **Noise**

---

## Test 4.2 - as well as
**Input**  
`The report includes structured fields as well as free-form descriptions.`

**Relations actually emitted**
- `actor(includes, report)`
- `theme(includes, fields)`
- `coordination(fields, free-form)`

**Comparison vs expected**
- Additive secondary member is retained through coordination.

**Severity**
- **Pass**

---

## Test 5.1 - Inline List
**Input**  
`Users can request changes, update reports, and assign supervisors.`

**Relations actually emitted**
- `actor(request, Users)`, `theme(request, changes)`
- `actor(update, Users)`, `theme(update, reports)`
- `actor(assign, Users)`, `theme(assign, supervisors)`
- coordination/modality edges preserved

**Comparison vs expected**
- No list collapse; all predicate frames retained.

**Severity**
- **Pass**

---

## Test 6.1 - Purpose PP
**Input**  
`Actions are recorded for auditing and security analysis.`

**Relations actually emitted**
- `patient(recorded, Actions)`
- `beneficiary(recorded, auditing)`
- `coordination(auditing, security)`
- `modifier(security, analysis)`

**Comparison vs expected**
- Core purpose PP attachment preserved.
- Tail NP shape remains slightly noisy but non-blocking.

**Severity**
- **Noise**

---

## Test 6.2 - Temporal Modifier
**Input**  
`The system must retain reports for 10 years.`

**Relations actually emitted**
- `actor(retain, system)`
- `theme(retain, reports)`
- `beneficiary(retain, years)`
- `modifier(years, 10)`
- `modality(retain, must)`

**Comparison vs expected**
- Temporal PP is preserved as structured prepositional relation.

**Severity**
- **Pass**

---

## Overall Assessment

- **Blockers:** none
- **Degrading:** none in the original blocker/degrading classes
- **Residual noise only:** `1.1`, `4.1`, `6.1`

### Root-cause concentration (residual)
- Residual artifacts remain predominantly tied to Stage 08 structural granularity and Stage 11 projection normalization decisions.
- Core argument/predicate capture is now stable enough that downstream reconstruction is not required for baseline coverage tests.

### Success criteria status
- **Met for upstream structural capture baseline.**
- Remaining work is quality/noise tightening, not blocker recovery.

---

## Validation Notes - Detailed Code Correlation (2026-02-13)

Current status after re-baseline:
- Previously identified blocker paths in Stage 04/08/11 were addressed across `v1.1.5` to `v1.1.14`.
- Current remaining issues are residual noise-shaping concerns and not missing core structure.
- Canonical output contract remains:
  - extracted semantics are accepted `kind="dependency"` edges at `relations_extracted`.
