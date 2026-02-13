# ROADMAP

Current published version: `1.1.8`

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

## Blocker Queue (Execute First)

### `1.1.5` - Blocker 4.1: `such as` enumeration collapse
- Owners: Stage 04 + Stage 08 + Stage 11
- Scope:
  - Stage 04: narrow disambiguation to avoid `grants -> NNS` in the target clause frame.
  - Stage 08: keep root/dependency skeleton centered on finite predicate once POS is corrected.
  - Stage 11: deterministic normalization for `such as` so exemplars are not promoted to root events and are not dropped.
- Stop condition:
  - Evaluation sentence yields stable predicate/object for `grants` and preserves exemplars as membership/coordination structure in `relations_extracted`.
- Tests:
  - stage-level unit regressions + one `relations_extracted` e2e lock.

### `1.1.6` - Blocker 2.1/2.2: copula complement + passive subject drift in mixed copula/passive sentences
- Owners: Stage 08 + Stage 11
- Scope:
  - Stage 08 emits explicit copula complement dependency (`attr`/`acomp` equivalent).
  - Stage 11 projects deterministic `attribute(...)` relation from that structure.
- Tests:
  - stage-level unit regressions + one `relations_extracted` e2e lock.

### `1.1.7` - Blocker 6.1: purpose PP `for + VBG` and coordinated nominal purpose
- Owners: Stage 08 + Stage 11
- Scope:
  - stabilize PP object-chain so gerund complements do not become fallback predicate centers.
  - preserve coordination inside the PP purpose phrase.
- Tests:
  - stage-level unit regressions + one `relations_extracted` e2e lock.

## Degrading Queue (After All Blockers Are Green, ordered low -> high risk/complexity)

### `1.1.8` - Degrading: temporal PP `for 10 years` attachment
- Owners: Stage 08 + Stage 11

### `1.1.9` - Degrading: `as well as` additive coordination normalization
- Owners: Stage 08 + Stage 11

### `1.1.10` - Degrading: passive-with-agent contradictory fallback noise
- Owners: Stage 08 + Stage 11

### `1.1.11` - Degrading: sequential coordinated verbs (subject propagation + PP role flattening)
- Owners: Stage 08 + Stage 11

### `1.1.12` - Degrading: inline multi-verb lists (`request/update/assign` over-absorption)
- Owners: Stage 08 + Stage 11

For each degrading cycle, use the same mandatory cycle template and full release gates.

## Release Gate

- Use `NPM_RELEASE.md` exactly for every release:
  - full tests
  - pre-publish local tarball smoke
  - git commit/tag/push
  - npm publish
  - propagation checks
  - post-publish public npm smoke
  - GitHub release
