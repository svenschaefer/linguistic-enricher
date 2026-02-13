# ROADMAP

Current published version: `1.1.14` (`v1.1.15` release candidate in progress)

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

## Completed Queue (`1.1.5`-`1.1.15`)

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
- Status: partially resolved in release scope (`2.1` resolved, `2.2` residual blocker remains).

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
- Status: implemented and test-locked on release branch.

## Current Open Focus

With blockers cleared in the re-baseline, focus shifts to residual-noise cleanup only.

## Remaining Issues Plan (from `UPSTREAM_STRUCTURAL_COVERAGE_EVALUATION.md` re-baseline)

### Priority rule
- Blockers are closed in current re-baseline.
- Continue one-noise-family-per-cycle cleanup with deterministic locks.
- Keep one issue family per release cycle.
- Preserve deterministic behavior and avoid schema changes in patch line.

### `1.1.16` - Residual noise cleanup `6.1` (purpose PP tail shape)
- Scope:
  - keep:
    - `patient(recorded, Actions)`
    - `beneficiary(recorded, auditing)`
  - improve coordinated tail representation for `security analysis` to reduce structural ambiguity/noise while keeping no standalone event center for `auditing`.
- Owners: Stage 08 + Stage 11.
- Acceptance:
  - unit lock for purpose-PP coordinated nominal tail structure.
  - integration lock for stable purpose relation and no event-like fallback for PP object tokens.

### Post-cycle gate
- Keep `UPSTREAM_STRUCTURAL_COVERAGE_EVALUATION.md` in sync after each residual-noise cycle.
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
