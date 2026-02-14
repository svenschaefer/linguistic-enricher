# ROADMAP

Current published version: `1.1.34`

## Versioning Strategy

- `1.1.x` is closed for the original upstream-coverage backlog (blockers/degrading/residual queue cleared through `1.1.16`).
- New work that expands structural behavior (especially Stage 08/11 subject-coverage logic) is treated as new scope and scheduled on `1.2.x`.
- Keep patch releases for regressions or narrowly bounded non-breaking fixes only; use `1.2.x` for planned structural capability increments.
- Preserve the canonical output contract during `1.2.x` (`relations_extracted` accepted semantic edges as `kind="dependency"`), unless an explicit migration decision is approved.

Exception (active):
- The currently tracked `LINGUISTIC-ENRICHER-REGRESSION-REPORT.md` integration topics are scheduled on a dedicated `1.1.x` patch line per request, with narrow scope and strict regression gates.

## Delivery Rule

- Run a strict `one blocker -> one cycle` loop.
- Regression locks come first, then minimal code change, then full gates.
- Release only after all cycle gates pass.
- Default track is patch releases.
- If a cycle needs schema change or plausibly breaking behavior, stop patch line and move to `1.2.0`.

## Cycle Template (Mandatory)

1. Add/extend unit test(s) at the originating stage.
2. Add/extend one end-to-end integration test locking `relations_extracted`.
3. Implement minimal change (single owning stage if possible; otherwise smallest cross-stage delta).
4. Run full test suite.
5. Release only via `NPM_RELEASE.md` after blocker/degrading target for that cycle is green.

## Completed Queue (`1.1.5`-`1.1.16`)

### `1.1.5` - Blocker 4.1: `such as` enumeration collapse
- Owners: Stage 04 + Stage 08 + Stage 11
- Scope:
  - Stage 04: narrow disambiguation to avoid `grants -> NNS` in the target clause frame.
  - Stage 08: keep root/dependency skeleton centered on finite predicate once POS is corrected.
  - Stage 11: deterministic normalization for `such as` so exemplars are not promoted to root events and are not dropped.
- Status: completed and released.

### `1.1.6` - Blocker 2.1/2.2: copula complement + passive subject drift in mixed copula/passive sentences
- Owners: Stage 08 + Stage 11
- Scope:
  - Stage 08 emits explicit copula complement dependency (`attr`/`acomp` equivalent).
  - Stage 11 projects deterministic `attribute(...)` relation from that structure.
- Status: completed and released (`2.1` resolved in `1.1.6`; `2.2` fully resolved in `1.1.13`).

### `1.1.7` - Blocker 6.1: purpose PP `for + VBG` and coordinated nominal purpose
- Owners: Stage 08 + Stage 11
- Scope:
  - stabilize PP object-chain so gerund complements do not become fallback predicate centers.
  - preserve coordination inside the PP purpose phrase.
- Status: completed and released.

### `1.1.8` - Degrading: temporal PP `for 10 years` attachment
- Owners: Stage 08 + Stage 11
- Status: completed and released.

### `1.1.9` - Degrading: `as well as` additive coordination normalization
- Owners: Stage 08 + Stage 11
- Status: completed and released.

### `1.1.10` - Degrading: passive-with-agent contradictory fallback noise
- Owners: Stage 08 + Stage 11
- Status: completed and released.

### `1.1.11` - Degrading: sequential coordinated verbs (subject propagation + PP role flattening)
- Owners: Stage 08 + Stage 11
- Status: completed and released.

### `1.1.12` - Degrading: inline multi-verb lists (`request/update/assign` over-absorption)
- Owners: Stage 08 + Stage 11
- Status: completed and released.

### `1.1.13` - Blocker `2.2` passive subject anchor drift
- Owners: Stage 08 + Stage 11
- Status: completed and released.

### `1.1.14` - Residual noise cleanup `1.1` (simple passive extras)
- Owners: Stage 08 + Stage 11
- Scope:
  - suppress argument-like VP chunk fallback noise (`theme(Generated, primes)`-class artifacts).
  - keep nominal modifier heads from collapsing to PP markers (`modifier(for, educational)` -> nominal-head form).
- Status: completed and released.

### `1.1.15` - Residual noise cleanup `4.1` (`such as` connector artifacts)
- Owners: Stage 08 + Stage 11
- Scope:
  - keep exemplar structure while suppressing connector-local residue in:
    - `Each role grants permissions such as read, write, or administer.`
  - preserve:
    - `actor(grants, role)`
    - `theme(grants, permissions)`
    - `exemplifies(permissions, read|write|administer)`
  - reduce:
    - `modifier(read, such)`-class connector artifacts unless explicitly required.
- Status: completed and released.

### `1.1.16` - Residual noise cleanup `6.1` (purpose PP tail shape)
- Owners: Stage 08 + Stage 11
- Scope:
  - keep:
    - `patient(recorded, Actions)`
    - `beneficiary(recorded, auditing)`
  - improve coordinated tail representation for `security analysis` to reduce structural ambiguity/noise while keeping no standalone event center for `auditing`.
- Status: completed and released.

## Current Open Focus

With blockers cleared in the re-baseline and the residual-noise queue closed through `1.1.16`, the project is in monitor mode (open new cycles only for reproducible regressions or new scope).

## `1.2.x` Planned Schedule (New Scope)

Execution order rule:
- Execute strictly in order (`1.2.0` -> `1.2.1` -> ...).
- Do not start a later cycle until the current cycle is green (unit + integration + smoke gates).
- If a cycle proves unnecessary after prior fixes, mark it skipped with rationale.

### `1.2.0` - Embedded subject-edge retention (`pick`)
- Owners: Stage 08 (dominant), Stage 11 (secondary)
- Status: planned
- Goal:
  - preserve explicit subject-like edges for embedded webshop predicate `pick` where subject is overt in-clause (`people -> pick`).
- Required gates:
  - Stage 08 unit regressions locking subject-edge emission for embedded clauses.
  - Stage 11 integration lock at `relations_extracted` for actor-role availability on `pick`.
  - Full test suite + local/public smoke using canonical semantic-edge checks.

### `1.2.1` - Embedded subject-edge retention (`want`)
- Owners: Stage 08 (dominant), Stage 11 (secondary)
- Status: planned
- Goal:
  - preserve explicit subject-like edges for embedded webshop predicate `want` where subject is overt in-clause (`they -> want`).
- Required gates:
  - Stage 08 unit regressions locking subject-edge emission for embedded clauses.
  - Stage 11 integration lock at `relations_extracted` for actor-role availability on `want`.
  - Full test suite + local/public smoke using canonical semantic-edge checks.

### `1.2.2` - Coordinated embedded subject propagation (`put`)
- Owners: Stage 08 (dominant), Stage 11 (secondary)
- Status: planned
- Goal:
  - preserve subject-role continuity for coordinated embedded predicate `put` without synthetic Stage 11 role injection.
- Required gates:
  - Stage 08 unit regressions for coordinated predicate subject propagation.
  - Stage 11 integration lock for actor coverage on coordinated embedded predicates.
  - Full test suite + local/public smoke using canonical semantic-edge checks.

### `1.2.3` - Coordinated embedded subject propagation (`complete`)
- Owners: Stage 08 (dominant), Stage 11 (secondary)
- Status: planned
- Goal:
  - preserve subject-role continuity for coordinated embedded predicate `complete` without synthetic Stage 11 role injection.
- Required gates:
  - Stage 08 unit regressions for coordinated predicate subject propagation.
  - Stage 11 integration lock for actor coverage on coordinated embedded predicates.
  - Full test suite + local/public smoke using canonical semantic-edge checks.

### `1.2.4` - Fallback-boundary hardening (`actor` path)
- Owners: Stage 11 (dominant), Stage 08 (secondary)
- Status: planned
- Goal:
  - ensure fallback `actor` paths do not manufacture contradictory roles while preserving genuine upstream-emitted subject relations.
- Required gates:
  - Stage 11 unit regressions for fallback `actor` suppression/allow rules in subject-gap contexts.
  - End-to-end integration lock for stable subject-role set in webshop-family fixtures.
  - Full test suite + local/public smoke using canonical semantic-edge checks.

### `1.2.5` - Fallback-boundary hardening (`theme` path)
- Owners: Stage 11 (dominant), Stage 08 (secondary)
- Status: planned
- Goal:
  - ensure fallback `theme` paths in the same sentence family do not reintroduce contradictory role artifacts when subject coverage improves.
- Required gates:
  - Stage 11 unit regressions for fallback `theme` suppression/allow rules in subject-gap contexts.
  - End-to-end integration lock for stable argument-role set in webshop-family fixtures.
  - Full test suite + local/public smoke using canonical semantic-edge checks.

### `1.2.6` - Stabilization follow-up (only if needed)
- Owners: Stage 08 + Stage 11
- Status: conditional
- Goal:
  - address regressions/noise introduced by `1.2.0`-`1.2.5` while preserving new subject coverage.
- Required gates:
  - targeted regression additions for any observed drift.
  - unchanged `relations_extracted` contract (`kind="dependency"` accepted semantic labels).

### `1.2.7` - Optional contract migration planning seed (deferred by default)
- Owners: Stage 11 + docs/schema/release process
- Status: deferred
- Goal:
  - only if explicitly approved later: begin controlled migration design for semantic-edge kind contract (`dependency` -> `relation`).
- Required gates before implementation:
  - explicit compatibility plan, schema/doc updates, and migration test matrix.
- Default:
  - remain deferred; do not execute in patch/minor cycle without explicit decision.

## `1.1.x` Regression-Report Schedule (Patch Line)

Source:
- `LINGUISTIC-ENRICHER-REGRESSION-REPORT.md`
- `TODO.md` section `Step-12 Integration Watchlist (Validated, 2026-02-13)`

Execution rule:
- One problem family per patch release.
- Keep canonical output contract unchanged (`kind="dependency"` accepted semantic edges).
- Treat version timing as "first observed in validation track" unless historical tags are replayed.

### `1.1.17` - Connector contract alignment guard (`such`/`as`/`well`)
- Scope:
  - lock connector behavior as contract/interface compatibility between Stage 11 connector suppression and downstream unresolved-token expectations.
- Owners: Stage 11 + integration tests/docs.
- Status: completed and released.
- Required gates:
  - integration lock on exemplar/additive sentences (`such as`, `as well as`) with explicit connector expectation assertions.
  - full test suite + pre/post-publish smoke.

### `1.1.18` - Clause/PP attachment drift reduction (complex variants)
- Scope:
  - reduce complex-sentence clause/PP head drift (`at`/connector-headed relation artifacts) without changing stable simple-case behavior.
- Owners: Stage 08 (dominant), Stage 11 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 08/11 unit regressions on complex variants.
  - end-to-end lock at `relations_extracted` for targeted long-sentence fixtures.
  - full test suite + pre/post-publish smoke.

### `1.1.19` - Fallback-induced role-noise hardening (passive/complement chains)
- Scope:
  - tighten fallback boundaries to prevent contradictory/noisy role injection in long passive/complement structures.
- Owners: Stage 11 (dominant), Stage 08 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 11 fallback-pattern unit locks (`chunk_fallback` boundaries).
  - end-to-end stability lock for `irs`/`webshop` long-chain fixtures.
  - full test suite + pre/post-publish smoke.

### `1.1.20` - Hotfix: narrow fallback suppression scope from `1.1.19`
- Scope:
  - keep the intended `1.1.19` noise reduction (`irs` passive/complement fallback amplification),
  - restore legitimate downstream role-bearing signal in webshop long-chain clauses where `1.1.19` suppression proved too broad.
- Owners: Stage 11 (dominant), Stage 08 (secondary).
- Status: completed and released.
- Required gates:
  - unit lock for precise fallback-boundary narrowing (no blanket suppression on verb-linked predicates).
  - end-to-end lock set for:
    - IRS chain: noisy fallback remains suppressed,
    - webshop chains: legitimate actor/complement role-bearing signal not over-suppressed.
  - full test suite + pre/post-publish smoke.

### `1.1.21` - Emergency packaging hotfix (self-dependency removal)
- Scope:
  - remove accidental package self-dependency from npm metadata and restore clean public installability.
- Owners: packaging/release process.
- Status: completed and released.
- Required gates:
  - full test suite.
  - local tarball smoke.
  - public npm propagation + install smoke.

### `1.1.22` - Carrier precursor guard (`are (low)`) + `given` historical lock
- Scope:
  - guard against reproducible `are` low-carrier precursor shapes.
  - maintain `given` as historical/variant-dependent check (non-blocking unless reproducible under current gates).
- Owners: Stage 08 + Stage 10 + Stage 11.
- Status: completed and released.
- Required gates:
  - targeted unit/integration assertions for carrier precursor suppression.
  - variant-sensitive check for `given` treated as monitor-only unless reproducible.
  - full test suite + pre/post-publish smoke.

### `1.1.23` - Hotfix: restore integration-safe copula-carrier coverage after `1.1.22`
- Scope:
  - restore dependency-backed copula carrier edges needed by downstream coverage in webshop/IRS long-chain clause shapes.
  - keep weak-carrier suppression active only for non-`is/are` demoted carriers under existing structural preconditions.
- Owners: Stage 11 (dominant), integration tests.
- Status: completed and released.
- Required gates:
  - integration locks for:
    - webshop s2: `modifier(are, actually)` and `attribute(are, available)` present.
    - IRS s4-like: `attribute(is, valid)` and `attribute(are, present)` present.
  - full test suite + pre/post-publish smoke.

### `1.1.24` - Webshop copula-theme drift fix (`is -> purchase` misassignment)
- Scope:
  - prevent copula/theme reassignment in webshop `s1` where `is` incorrectly absorbs `purchase` as `theme`.
  - keep copula/attribute coverage intact while removing unrelated theme carryover on the same clause.
- Owners: Stage 11 (dominant), Stage 08 (secondary), integration tests.
- Status: completed and released.
- Required gates:
  - unit lock for copula-theme boundary selection in webshop-like clause chains.
  - end-to-end lock: no `theme(is, purchase)` in webshop `s1`, while expected copula/attribute rows remain present.
  - full test suite + pre/post-publish smoke.

### `1.1.25` - Webshop pronoun-as-predicate suppression (`them` head artifacts)
- Scope:
  - prevent pronoun-centered predicate projection in webshop `s1` (`them` becoming relation head for location/topic structure).
  - preserve valid object-role signal for `them` as argument without promoting it to predicate center.
- Owners: Stage 11 (dominant), Stage 08 (secondary), integration tests.
- Status: completed and released.
- Required gates:
  - unit lock for pronoun predicate-head rejection in fallback/projection path.
  - end-to-end lock: no accepted relation with head surface `them` in webshop `s1` for location/topic artifacts.
  - full test suite + pre/post-publish smoke.

### `1.1.26` - Webshop carrier-shape normalization (`are` standalone overemphasis)
- Scope:
  - reduce downstream-fragile standalone carrier overemphasis in webshop `s2` while preserving coverage-required payload (`actually/available`).
  - keep integration-safe behavior from `1.1.23` (no loss of `is/are` payload coverage).
- Owners: Stage 11 (dominant), Stage 08 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 11 unit lock for bounded carrier-shape normalization.
  - end-to-end lock for webshop `s2` role stability with no coverage drop.
  - full test suite + pre/post-publish smoke.

### `1.1.27` - Hotfix: webshop `while doing` carrier-remap overshoot
- Scope:
  - prevent weak-carrier payload remap onto non-propositional gerund host (`doing`) in webshop `s2` clause shape.
  - preserve payload presence (`available`/`actually`) and keep IRS copula locks unchanged.
- Owners: Stage 11 (dominant), integration tests.
- Status: completed and released.
- Required gates:
  - Stage 11 unit lock: no remap to gerund host for weak `are` carrier payload.
  - end-to-end lock for webshop `while doing ... are actually available` shape.
  - IRS lock unchanged: `attribute(is, valid)` and `attribute(are, present)`.
  - full test suite + pre/post-publish smoke.

### `1.1.28` - Connector contract/interface alignment follow-up
- Scope:
  - keep Stage 11 connector-local suppression by design while tightening downstream integration expectations for unresolved connector tokens (`such`, `as`, `well`).
  - refresh regression locks so connector behavior is explicitly treated as contract-level compatibility, not semantic-edge loss.
- Owners: Stage 11 + integration tests/docs.
- Status: completed and released.
- Required gates:
  - integration lock refresh on `such as` and `as well as` fixtures with explicit connector-contract assertions.
  - full test suite + pre/post-publish smoke.

### `1.1.29` - Cross-seed drift guardrails (quality delta lock)
- Scope:
  - add deterministic cross-seed delta guards to prevent mixed quality regressions after relation-shape/fallback hardening.
  - target seed family: `access_control`, `irs`, `webshop`, with stable accepted-label/role-presence checks.
- Owners: Stage 11 (dominant), Stage 08 (secondary), integration tests.
- Status: completed and released.
- Required gates:
  - integration delta locks across the tracked seed set.
  - no regression of currently locked Stage 11 canonical semantic-edge contract.
  - full test suite + pre/post-publish smoke.

### `1.1.30` - IRS nominal payload noise reduction (apposition/passive-complement)
- Scope:
  - reduce partially reproducible nominal payload noise in IRS-family apposition/passive-complement structures without losing core patient/agent/theme coverage.
- Owners: Stage 11 (dominant), Stage 08 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 11 unit lock for bounded nominal-noise suppression.
  - end-to-end integration lock for IRS sentence family (`relations_extracted`).
  - full test suite + pre/post-publish smoke.

### `1.1.31` - Connector interface contract closure (downstream alignment)
- Scope:
  - close the remaining connector contract mismatch by locking explicit compatibility expectations for connector-token unresolved handling (`such`, `as`, `well`) at integration/release-gate level.
  - keep Stage 11 semantic suppression behavior unchanged unless a minimal non-breaking compatibility adjustment is required.
- Owners: integration/docs/release-gates (Stage 11 secondary).
- Status: completed and released.
- Required gates:
  - integration lock proving connector behavior is interpreted consistently with downstream unresolved-policy contract.
  - release-smoke lock for canonical connector expectations on `such as` / `as well as`.
  - full test suite + pre/post-publish smoke.

### `1.1.32` - Complex clause/PP drift reduction (long-chain variants)
- Scope:
  - reduce root-centric clause/PP flattening in complex long-chain shapes without changing stable simple-case outputs.
  - target sentences where Stage 08 currently emits host-centric `dep/obj` structures that collapse local clause roles.
- Owners: Stage 08 (dominant), Stage 11 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 08 unit locks for long-chain clause/PP attachment stability.
  - end-to-end integration lock on webshop-family complex variants (`relations_extracted`).
  - no regression of existing `1.1.24`-`1.1.30` locks.
  - full test suite + pre/post-publish smoke.

### `1.1.33` - Generalized fallback-noise hardening (post-IRS)
- Scope:
  - extend fallback-boundary hardening beyond the bounded IRS case fixed in `1.1.30`.
  - keep useful fallback recovery while reducing remaining noisy fallback emissions in long passive/complement chains.
- Owners: Stage 11 (dominant), Stage 08 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 11 unit locks distinguishing allowed fallback recovery vs noisy fallback synthesis.
  - cross-seed integration lock update (`access_control`, `irs`, `webshop`) to prevent drift.
  - full test suite + pre/post-publish smoke.

### `1.1.34` - Low-quality `are (low)` carrier persistence hardening (bounded)
- Scope:
  - reduce remaining bounded `are (low)` carrier persistence in webshop-priority long-chain variants without reintroducing `1.1.26`/`1.1.27` overshoot patterns.
  - preserve payload coverage and existing IRS copula locks.
- Owners: Stage 11 (dominant), Stage 08 (secondary).
- Status: completed and released.
- Required gates:
  - Stage 11 unit lock for bounded weak-carrier persistence suppression.
  - end-to-end lock for webshop `s2` carrier shape stability with unchanged coverage contract.
  - no regression of `1.1.23` and `1.1.27` integration locks.
  - full test suite + pre/post-publish smoke.

## Remaining Issues Plan (from `TODO.md` section `12.1` re-baseline)

### Priority rule
- Blockers are closed in current re-baseline.
- Preserve deterministic behavior and avoid schema changes unless explicitly approved.
- Keep one issue family per release cycle.

### Next queue
- `1.1.x` follow-up queue is currently closed (no open scheduled patch-scope items).
- Continue with the `1.2.x` plan above (new scope only), unless a new reproducible patch regression appears.
- `1.1` residual descriptor-modifier shape remains closed as non-actionable nominal detail.

### Post-cycle gate
- Keep `TODO.md` section `12.1` in sync after each `1.2.x` cycle.
- Keep blocker set at zero; treat regressions to blocker/degrading as release-stoppers.

## Release Gate

- Use `NPM_RELEASE.md` exactly for every release:
  - full tests
  - pre-publish local tarball smoke
  - git commit/tag/push
  - npm publish
  - propagation checks
  - post-publish public npm smoke
  - GitHub release
- Semantic-output contract gate:
  - smoke + integration checks validate accepted semantic edge labels in canonical `kind="dependency"` output for `relations_extracted`,
  - do not use `kind="relation"` count as release pass/fail signal.
