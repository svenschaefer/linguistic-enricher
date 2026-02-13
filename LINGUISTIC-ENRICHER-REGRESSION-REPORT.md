# Linguistic-Enricher Step-12 Integration Report (v1.1.5 to v1.1.16)

## Scope and Attribution Contract
This report documents issues **first observed in this repository's Step-12 validation track** after moving beyond `linguistic-enricher@1.1.4`.

Attribution rule used in this report:
- "First observed in vX" means first observed in our Step-12 upgrade track.
- It is **not** a hard upstream causality claim unless historical tags are re-verified.

Validation method per upgrade:
- `npm test`
- Step-12 `run/check/render/report`
- Artifact review on: `access_control`, `irs`, `prime_factors`, `prime_gen`, `webshop`

## Confidence Levels
- `Confirmed reproducible now`: reproducible in current integrated runs.
- `Partially reproducible`: issue class confirmed, details vary by sentence shape.
- `Historical in our artifacts`: observed in our tracked artifacts, not consistently re-proven in upstream-only checks.

## Findings by Problem Class

### A) Connector-token unresolved artifacts (`such`, `as`, `well`)
- First observed in track: `1.1.9`
- Confidence: `Confirmed reproducible now`
- Framing:
  - We treat this primarily as a **contract/interface mismatch**.
  - Upstream Stage 11 appears to suppress connector-local semantic edges by design while preserving structural/exemplar edges.
  - Step-12 unresolved-token logic still flags connector tokens in some cases.

#### Explicit examples
1. `irs` s2
- Text: "Reports may include structured fields (category, severity, location) as well as free-form descriptions."
- Downstream symptom: unresolved connector tokens (`as`, `well`) in some runs.

2. `access_control` s3
- Text: "Each role grants permissions such as read, write, or administer."
- Downstream symptom: `such` unresolved (`missing_relation`) in newer runs.

---

### B) Cross-seed quality drift after coordination/propagation hardening
- First observed in track: `1.1.11`
- Confidence: `Confirmed reproducible now`
- Framing:
  - Quality movement is mixed across seeds (improvement in one, regression in another) after relation-shape changes.

#### Explicit examples
1. `irs`
- Texts:
  - "The Incident Reporting System (IRS) is used by employees to submit reports about safety issues, policy violations, or operational incidents."
  - "Reports may include structured fields (category, severity, location) as well as free-form descriptions."
- Symptom: coverage/noise regressions in several upgrade steps.

2. `webshop`
- Texts:
  - "A WebShop is an online store where people can pick products they want to buy, put them into a shopping cart, then complete the purchase by placing an order."
  - "The shop needs to make sure that items are actually available and the system can take payment and keep a record of the order."
- Symptom: fragment/noise metric increases in some upgrades.

3. `prime_factors` vs `access_control`
- Texts:
  - "Each factor must be prime, and their product must equal the original number."
  - "Prime factorization is commonly used in mathematics and number theory."
  - "Each role grants permissions such as read, write, or administer."
- Symptom: opposite metric movement under the same release.

---

### C) Reintroduced low-quality carrier rows (`are (low)`, `given (low)`)
- First observed in track:
  - `are (low)`: `1.1.12`
  - `given (low)`: first seen in our historical upgrade artifacts around `1.1.13`
- Confidence:
  - `are (low)`: `Confirmed reproducible now` in affected webshop shape.
  - `given (low)`: `Historical in our artifacts` (currently variant-dependent, not consistently reproducible in upstream-only checks).

#### Explicit examples
1. `webshop` s2
- Text: "The shop needs to make sure that items are actually available and the system can take payment and keep a record of the order."
- Symptom: standalone `are (predicate_quality=low)` reappears in some upgraded runs.

2. `prime_gen` s2
- Text: "It starts at a given minimum value, tests each successive integer for primality."
- Symptom: `given (predicate_quality=low)` appeared in historical upgrade artifacts; currently treated as variant-dependent.

---

### D) Nominal payload noise in apposition/passive-complement contexts
- First observed in track: `1.1.13`
- Confidence: `Partially reproducible`

#### Explicit example
1. `irs` s1
- Text: "The Incident Reporting System (IRS) is used by employees to submit reports about safety issues, policy violations, or operational incidents."
- Symptom: additional nominal modifier payload/noise on apposition-like assertion rows in some upgrades.

## Versions without newly isolated regressions in this track
- `1.1.5`
- `1.1.6`
- `1.1.7`
- `1.1.8`
- `1.1.10`
- `1.1.14`

## Most Reproducible Current Concerns
1. Connector expectation mismatch (by-design suppression vs downstream unresolved expectations).
2. Complex clause/PP attachment drift in long sentences.
3. Fallback-induced role noise in long passive/complement structures.

## Recommended Joint Follow-up
1. Define connector-token contract explicitly (`such`, `as`, `well`): expected unresolved-by-design vs expected semantic projection.
2. Add cross-seed delta guards on `access_control`, `irs`, `webshop` per release.
3. Keep separate regression gates for:
   - passive/co-ordination hardening,
   - carrier suppression stability (`given`, `are (low)`),
   - connector-token behavior.
