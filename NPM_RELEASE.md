# NPM Release Process

This document captures the release flow used in recent `linguistic-enricher` releases.

## Scope

- Applies to patch/minor releases published to npm as `linguistic-enricher`.
- Goal: deterministic, test-first, no retroactive history edits.

## 1) Prepare Changes

Start every new version on a dedicated branch:

```powershell
git checkout -b release/<x.y.z>-<scope>
```

1. Implement only the scoped fix/feature.
2. Add or update regression tests for the changed behavior.
3. Update `CHANGELOG.md` with a new version section.
4. Bump version locally:

```powershell
npm version <x.y.z> --no-git-tag-version
```

## 2) Validate in Main Repo

Run full validation before any release commit/tag:

```powershell
npm test
```

## 3) Smoke-Test Packaged Artifact (Pre-Publish, Local Tarball)

Create tarball from current workspace:

```powershell
npm pack
```

Create a clean smoke workspace (example):

```powershell
New-Item -ItemType Directory -Path C:\code\linguistic-enricher-smoke-test\published-<x.y.z>-smoke -Force
cd C:\code\linguistic-enricher-smoke-test\published-<x.y.z>-smoke
npm init -y
npm install C:\code\linguistic-enricher\linguistic-enricher-<x.y.z>.tgz
```

Run smoke checks:

```powershell
node -e "console.log(require('linguistic-enricher/package.json').version)"
npx linguistic-enricher --help
npx linguistic-enricher doctor
```

Run at least one pipeline sanity run:

```powershell
node -e "const api=require('linguistic-enricher'); api.runPipeline('Generated primes may be used for educational purposes or basic numerical experiments.',{target:'relations_extracted'}).then(o=>{const rels=(o.annotations||[]).filter(a=>a.kind==='dependency'&&a.status==='accepted'&&Array.isArray(a.sources)&&a.sources.some(s=>s&&s.name==='relation-extraction')); const tok=new Map((o.tokens||[]).map(t=>[String(t.surface||'').toLowerCase(),t.id])); const used=tok.get('used'); const primes=tok.get('primes'); const may=tok.get('may'); const hasPatient=rels.some(r=>r.label==='patient'&&r.head.id===used&&r.dep.id===primes); const hasModality=rels.some(r=>r.label==='modality'&&r.head.id===used&&r.dep.id===may); if(o.stage!=='relations_extracted'||!hasPatient||!hasModality){process.exit(1);} console.log(JSON.stringify({stage:o.stage,accepted_dependency_edges:rels.length,hasPatient,hasModality},null,2));}).catch(e=>{console.error(e); process.exit(1);});"
```

Optional service-mode checks:
- Without `WIKI_INDEX_ENDPOINT`
- With `WIKI_INDEX_ENDPOINT=http://127.0.0.1:32123`

## 4) Commit + Tag + Push

Commit release contents on the release branch:

```powershell
git add CHANGELOG.md package.json package-lock.json src test
git commit -m "release: v<x.y.z>"
```

Push the release branch:

```powershell
git push origin release/<x.y.z>-<scope>
```

Merge release branch back to `main` (PR merge or fast-forward merge), then push `main`.
Tag only after `main` contains the release commit.

```powershell
# if using fast-forward from local
git checkout main
git merge --ff-only release/<x.y.z>-<scope>
git push origin main

git tag -a v<x.y.z> -m "v<x.y.z> - <short release note>"
git push origin v<x.y.z>
```

Rules:
- Do not amend release commit after tagging.
- If anything is wrong after publish/tag, ship a new patch version.

## 5) Publish to npm

Login/auth:

```powershell
npm login
npm whoami
```

Automation policy:
- If npm auth is active (`npm whoami` succeeds), release automation MAY execute `npm publish --access public` directly without additional user interaction.
- If npm auth is missing/expired (`npm whoami` fails or publish returns auth/token errors), pause and ask the user to run `npm login`.
- After user confirms successful login, continue the automated release flow from publish through post-publish verification.

Publish:

```powershell
npm publish --access public
```

## 6) Verify npm Propagation

Run explicit registry checks:

```powershell
npm view linguistic-enricher versions --json --registry=https://registry.npmjs.org/
npm view linguistic-enricher@<x.y.z> version --registry=https://registry.npmjs.org/
npm info linguistic-enricher dist-tags --registry=https://registry.npmjs.org/
```

Expected:
- `<x.y.z>` present in `versions`
- `npm view linguistic-enricher@<x.y.z> version` returns `<x.y.z>`
- `dist-tags.latest` points to `<x.y.z>`

Note: short propagation delay can occur right after publish.

## 7) Smoke-Test Published Package (Post-Publish, Public npm)

After npm propagation confirms the new version is available, perform a second smoke test from the public registry.

Create a clean smoke workspace (example):

```powershell
New-Item -ItemType Directory -Path C:\code\linguistic-enricher-smoke-test\published-<x.y.z>-public-smoke -Force
cd C:\code\linguistic-enricher-smoke-test\published-<x.y.z>-public-smoke
npm init -y
npm install linguistic-enricher@<x.y.z>
```

Run smoke checks:

```powershell
node -e "console.log(require('linguistic-enricher/package.json').version)"
npx linguistic-enricher --help
npx linguistic-enricher doctor
```

Run at least one pipeline sanity run:

```powershell
node -e "const api=require('linguistic-enricher'); api.runPipeline('Generated primes may be used for educational purposes or basic numerical experiments.',{target:'relations_extracted'}).then(o=>{const rels=(o.annotations||[]).filter(a=>a.kind==='dependency'&&a.status==='accepted'&&Array.isArray(a.sources)&&a.sources.some(s=>s&&s.name==='relation-extraction')); const tok=new Map((o.tokens||[]).map(t=>[String(t.surface||'').toLowerCase(),t.id])); const used=tok.get('used'); const primes=tok.get('primes'); const may=tok.get('may'); const hasPatient=rels.some(r=>r.label==='patient'&&r.head.id===used&&r.dep.id===primes); const hasModality=rels.some(r=>r.label==='modality'&&r.head.id===used&&r.dep.id===may); if(o.stage!=='relations_extracted'||!hasPatient||!hasModality){process.exit(1);} console.log(JSON.stringify({stage:o.stage,accepted_dependency_edges:rels.length,hasPatient,hasModality},null,2));}).catch(e=>{console.error(e); process.exit(1);});"
```

Optional service-mode checks:
- Without `WIKI_INDEX_ENDPOINT`
- With `WIKI_INDEX_ENDPOINT=http://127.0.0.1:32123`

## 8) Create GitHub Release

Create release for the pushed tag using the matching `CHANGELOG.md` section:

```powershell
gh release create v<x.y.z> --title "v<x.y.z>" --notes-file <notes-file>
```

Verify:

```powershell
gh release view v<x.y.z> --json name,tagName,url,isDraft,isPrerelease,publishedAt
```

## 9) Final Checklist

- `git status` is clean.
- `main` is synced with `origin/main`.
- npm package is live with expected `latest` tag.
- post-publish smoke test with public npm package passed.
- GitHub release exists for `v<x.y.z>`.

## 10) Semantic Output Contract Gate (Mandatory)

Canonical contract decision (current):
- Stage 11 extracted semantics are validated as `status="accepted"` edges in `kind="dependency"`.
- Smoke checks MUST NOT rely on counting `kind="relation"` annotations.

Mandatory smoke assertion rule:
- Assert semantic edge presence by label in the canonical kind (for example: `patient`, `agent`, `modality`, `theme`, `actor`, `attribute`), with `status="accepted"`.
- Keep sentence-specific expected labels deterministic and versioned in release notes/tests.

Mandatory integration guard:
- Maintain at least one integration test that fails if Stage 11 stops emitting accepted extracted semantic edges in the canonical kind for `relations_extracted`.

Future migration note:
- If public contract is changed to `kind="relation"`, ship as a controlled compatibility migration (likely minor release), with schema/docs/test updates and explicit migration notes.
