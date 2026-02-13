# ROADMAP

Current published version: `1.1.16`

## Versioning Strategy

- `1.1.x` is closed for the original upstream-coverage backlog (blockers/degrading/residual queue cleared through `1.1.16`).
- New work that expands structural behavior (especially Stage 08/11 subject-coverage logic) is treated as new scope and scheduled on `1.2.x`.
- Keep patch releases for regressions or narrowly bounded non-breaking fixes only; use `1.2.x` for planned structural capability increments.
- Preserve the canonical output contract during `1.2.x` (`relations_extracted` accepted semantic edges as `kind="dependency"`), unless an explicit migration decision is approved.

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

## Remaining Issues Plan (from `TODO.md` section `12.1` re-baseline)

### Priority rule
- Blockers are closed in current re-baseline.
- Preserve deterministic behavior and avoid schema changes unless explicitly approved.
- Keep one issue family per release cycle.

### Next queue
- Active queue is the `1.2.x` plan above (new scope only).
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
