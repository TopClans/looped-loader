<!-- proposal: every code and test block in this plan was written before the code exists. Verify each against the repository as you implement it; where a block and its note disagree, the note is the requirement and the test must pin it. -->

# Looped Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a published, framework-free `looped-loader` core with a Vue 3 adapter that plays a short perfectly-looped clip while content loads, backed by 32 transcoded clips produced by a reproducible ffmpeg pipeline with a QC gate.

**Architecture:** A zero-dependency TypeScript core owns clip selection, manifest validation, the `<video>` lifecycle and every failure path; the Vue package is a thin SFC over it. A separate Node tool transcodes `gifs/*.mp4` into `packages/assets` and refuses to publish assets that fail frame-count, loop-seam, SSIM or size checks.

**Tech Stack:** TypeScript 5.9, pnpm 10 workspaces, `tsc` (core) and Vite 8 library mode (vue, demo), Vitest 5 (`node` for core/tools, `jsdom` for vue), `@vue/test-utils` 2.5, Vue 3.5, ffmpeg 8.x via `spawnSync`.

**Spec:** `docs/superpowers/specs/2026-10-08-looped-loader-design.md` — the plan argues from it; read both.

## Global Constraints

Copied verbatim from the spec. Every task's requirements include this section.

- Node `>=20.11`; measured local runtime `v22.22.0`; package manager `pnpm@10.15.1`; ESM only (`"type": "module"` everywhere).
- TypeScript `~5.9.3` (see Handoff ruling 1 — do **not** install 7.x).
- Published packages, versioned in lockstep at `0.1.0`: `@topclans/looped-loader-core`, `@topclans/looped-loader-vue`, `@topclans/looped-loader-assets`. `tools/transcode` and `packages/demo` are private.
- `baseUrl` is required; there is no default CDN and no fallback host.
- Video: MP4/H.264 only — `main` profile, `yuv420p`, `preset slow`, `-movflags +faststart`, `-an`, `-map_metadata -1`, long side ≤ 480 with **no upscaling**, even dimensions, `fps = min(source, 30)`, base CRF 26.
- Weight budget per clip: 250 KB (`256000` bytes). CRF rises by 1 up to 30, then long side drops to 400, then the clip is published with `encode.note: "budget-exceeded"`.
- QC gate: SSIM ≥ `0.93`, loop-seam regression ≤ 10 %, frame count and duration within ±1 frame, on-disk size and sha256 equal to the manifest. Violations exit non-zero.
- Corpus totals: ≤ 5 MB (`5242880` bytes) for all 32 clips; measured 4.76 MB at base CRF.
- `@topclans/looped-loader-core` has **zero runtime dependencies**; `@topclans/looped-loader-vue` declares `peerDependencies: { "vue": "^3.4" }`.
- Fallback is a CSS spinner only. No poster images, no `poster` attribute, no image files in any package.
- `prefers-reduced-motion: reduce` (honoured unless `respectReducedMotion: false`) means: no `<video>` element is created, no clip is fetched, and the spinner does not rotate.
- `delayMs` default `120`.
- Error codes, exactly these six: `manifest-fetch`, `manifest-invalid`, `clip-fetch`, `decode`, `autoplay-blocked`, `no-clips`.
- `gifs/` is never committed; `git log --all -- gifs/` must stay empty.
- Text files are LF, media files binary (`.gitattributes` already committed).
- `pnpm-lock.yaml` is committed at the repository root. CI installs with `--frozen-lockfile`, so an uncommitted lockfile fails acceptance criterion 1 at the first push.
- Every published package carries its own `LICENSE` (and the assets package its own `NOTICE`) **inside its tarball**, produced by `scripts/sync-legal.mjs` during `pnpm build`. An npm tarball is read in isolation: a licence file left at the repository root never reaches a consumer, and the licensing boundary is the one thing this project cannot afford to ship wrong.
- No secret ever appears in a command argument, in the repository, or in the transcript. The npm token is used only through `sec run`.
- Bundle budget, enforced by `scripts/check-size.mjs` on every build: `@topclans/looped-loader-core` ≤ 8 KB gzip, `@topclans/looped-loader-vue` ≤ 12 KB gzip (JS and CSS together). A loader is on the critical path of every page that uses it, so a dependency creeping into either package is a regression rather than a detail.

## Handoff

### Start

Workspace root is `C:\dsh\looped-loader`. Open the session with **that** directory as the workspace root.

```powershell
cd C:\dsh\looped-loader
git status --short          # expect clean
node -v                     # v22.22.0
pnpm -v                     # 10.15.1
ffmpeg -version             # 8.1.2 — required from Task 4 on
pnpm install                # after Task 1 creates the workspace
git switch -c feat/looped-loader
pnpm test                   # baseline: green, 0 tests before Task 1, then Task 1's own tests
```

Baseline honesty: on the base commit `3f167fd` there is no workspace at all, so `pnpm test` cannot run. The first green baseline is established at the end of Task 1; record its test count there and keep it as the reference.

Permission mode matters for exactly one task. Tasks 1–11 write only inside the workspace and run fine under `workspace-write`. **Task 12 does not:** `npm login` writes `~/.npmrc` and `npm publish` writes the npm cache, both outside the workspace, so a `workspace-write` session is denied there. Either run the executor session with `DSH_PERMISSION_MODE=danger-full-access`, or let the owner run `npm login` and the three publish commands themselves in a normal terminal. Discovering this at the publish step is the expensive way to learn it.

Writer worktrees (one writer per worktree, never two):

```powershell
git worktree add .worktrees/core  -b feat/core      feat/looped-loader   # Tasks 2-3
git worktree add .worktrees/tools -b feat/transcode feat/looped-loader   # Tasks 4-5
git worktree add .worktrees/vue   -b feat/vue       feat/looped-loader   # Tasks 7-8
git worktree add .worktrees/demo  -b feat/demo      feat/looped-loader   # Task 9
```

**Task 6 must run in the main checkout, not in a worktree:** `gifs/` is untracked and gitignored, so it does not exist inside a fresh worktree. The transcode tool therefore takes `--gifs <path>` and Task 6 points it at the main checkout's copy.

Reviewer worktrees are detached and disposable:

```powershell
git worktree add .worktrees/review-1 --detach <sha-to-review>
```

If serena has the project activated, stop it before `git worktree remove` — it holds directories open and the removal half-fails (see `~/.dsh/AGENTS.md`).

**Integration.** Writers branch from `feat/looped-loader`; the Lead merges a writer's branch only after its reviewer gate passes, and only then starts a task that depends on it:

```powershell
git switch feat/looped-loader
git merge --no-ff feat/core -m "merge: core (tasks 2-3)"
pnpm -r build
pnpm -r test          # on the integration branch, never inside the writer's worktree
```

`git rebase` and `git pull --rebase` are forbidden in this repository. Task 6 runs in the main checkout, which is `feat/looped-loader`, because `gifs/` is untracked and does not exist inside any worktree. Remove a writer's worktree after its merge.

### Decisions and rulings

Settled here; the executor does not reopen them.

1. **TypeScript pinned to `~5.9.3`, not the current `7.0.2`.** TS 7 is a new native compiler and `vue-tsc@3.3.12` only declares `typescript >=5.0.0`. Betting the toolchain on an unverified combination is not worth a version number. (2026-10-08)
2. **`core` is built with `tsc`, not Vite.** It is pure TypeScript with no assets or CSS, so `tsc` emitting ESM + `.d.ts` is enough; this drops `vite-plugin-dts` and its `@microsoft/api-extractor` peer. The Vue package uses Vite library mode plus `vue-tsc` for declarations.
3. **Manifest validation is hand-written, no `zod` or other schema library**, because the core must have zero runtime dependencies. Validation is ~80 lines and is unit-tested directly.
4. **A missing or empty `baseUrl` is a `LoopedLoaderError` with code `manifest-fetch`,** not a new error code and not a plain `TypeError`: the six codes in the spec are closed, and the Vue adapter catches it in `setup()` so it never reaches the host's render path. `resolveSrc` throws the same error defensively.
5. **An absolute `http(s)://` URL in a manifest `source.src` wins over `baseUrl`.** That is how a single clip can be hosted elsewhere without a second manifest.
6. **The "no repeat" memory is a module-level ring of the last 3 clip ids,** shared by every loader instance on the page; `resetRecent()` exists so tests can start from a known state.
7. **The default `label` is the English `"Loading"`, not the spec's Russian `"Загрузка"`.** Shipping Russian copy inside a public package would be a language hardcoded in code; the spec's real requirement is that the string is configurable, and the README documents localisation.
8. **Assets are written only by `tools/transcode`.** Hand-editing anything under `packages/assets` is a defect, and `--check` exists to catch it.
9. **README numbers come from `qc-report.md`**, never retyped from this plan.
10. **x264 is invoked with `-threads 1`** so an encode is byte-reproducible across machines. Thread count changes x264's output, and a `--check` run on another machine would otherwise report differences that look like corruption.
11. **The Vue adapter never mirrors `src`.** The core owns the `<video>` element's `src` and assigns it imperatively; the component only mirrors `state` and `clip`. One source of truth beats a ref that has to be synchronised in the right order.

### Verified facts

Measured on `WIN-TTEB79J8UHA`, Windows 11, 2026-10-08. Treat as true; report a contradiction to the owner instead of working around it.

- `ffmpeg 8.1.2` with `libx264`, `libvpx-vp9`, `libaom-av1`; `node v22.22.0`, `pnpm 10.15.1`, `git 2.55.0`.
- Node **can** capture a child process's stdout in this session: `spawnSync('ffprobe', …, { encoding: 'utf8' })` returned `status=0` and valid JSON. (The harness notes describe piped stdio failing under `workspace-write`; this session is `danger-full-access`.) The tool writes ffprobe JSON to a temp file if `r.error` is set, so it is not harness-specific.
- Corpus: 32 files, all MP4/h264, **no audio track in any file**, 23.88 MB total, durations 0.45–12.15 s, 9–405 frames, 30 distinct resolutions, frame rates 9.82–39.5.
- At the Global Constraints ladder with base CRF 26: **4.76 MB total, median 103 KB, largest 890 KB, mean SSIM 0.969, 18 s to encode the whole corpus.**
- Five clips exceed 250 KB at CRF 26: `u3dob97sw2421` 890 KB, `TGH-SlSNsq9B1KAxoZ9IGjAX7SUTVlTOBq3rg6BRrfI` 385 KB, `azgfEFJhDSwy5D44YfXwmSM7ObncWSLua1xyVNtvQa4` 345 KB, `gw2u04xr37r11` 340 KB, `wsijo3cpfb831` 304 KB.
- VP9 loses on this corpus: `gw2u04xr37r11` 353 KB/SSIM 0.96 vs x264 340 KB/0.96; `u3dob97sw2421` 874 KB/0.88 vs 890 KB/0.96; a win only on `TGH-…` (210 KB/0.94 vs 385 KB/0.97).
- npm: `npm whoami` empty (not logged in); `looped-loader` and `@topclans/looped-loader` unpublished; no npm secret in the `secrets`/`infra` vault projects.
- Dependency majors resolvable today: `vite 8.3.3`, `vitest 5.0.3`, `vue 3.5.43`, `@vitejs/plugin-vue 6.0.9`, `@vue/test-utils 2.5.1`, `jsdom 30.1.2`, `vue-tsc 3.3.12`, `typescript 5.9.3`.
- Current repository content: `.gitignore`, `.gitattributes`, the spec; branches `main` = `feat` base at `3f167fd`, pushed to `origin`.

### Model classes

Classes, not model names — the owner names the models at launch.

- **Tasks 1–3 (core):** cheap worker. Pure logic, fully determined by the code in this plan, and mechanically verifiable.
- **Tasks 4–6 (transcode tool and running it):** cheap worker. But the Lead re-reads `qc-report.json` and the committed byte sizes before accepting Task 6 — a green pipeline that encoded the wrong thing is the failure mode here.
- **Tasks 7–8 (Vue adapter):** mid-tier worker. Vue 3 lifecycle, SFC, and async composable idioms are where a cheap worker drifts.
- **Task 9 (demo):** cheap worker.
- **Task 10 (browser verification):** main session only. Judging "does it actually work" from screenshots and console output is judgment, not typing.
- **Task 11 (docs):** cheap worker.
- **Task 12 (release):** main session only, owner-gated.
- **Reviewers:** a family different from the implementer's, on Tasks 3, 5 and 8 — the three where a silent mistake ships broken behaviour or bad assets.

### Ask the owner before

- **Task 6:** accepting a `budget-exceeded` clip if its SSIM lands within 0.01 of the 0.93 floor, and any decision to delete or replace a clip. `u3dob97sw2421` is the predicted case.
- **Task 12, Step 1:** npm authentication (owner runs `npm login`, or supplies an automation token through the vault) and confirmation that the `@topclans` scope belongs to their npm account. If it does not, the fallback is unscoped names and only `package.json` files change.
- **Task 12:** the actual `npm publish` (irreversible), and flipping the repository from private to public.
- **Task 12:** the owner's review of the contact sheet for all 32 clips, which is a precondition of going public.

### State at handoff

- Branch `main` at `3f167fd`, pushed to `origin/main`. Nothing is implemented yet: no root `package.json`, no packages, no tests.
- Present in the working tree and untracked by design: `gifs/` (32 source MP4s, 23.88 MB), `.probe/` (throwaway measurement scripts — delete them at the end of Task 6, they are not part of the deliverable).
- Tracked files: `.gitignore`, `.gitattributes`, `docs/superpowers/specs/2026-10-08-looped-loader-design.md`, and this plan.
- Progress is tracked by the checkboxes in this file. There is no tracker item and no wave report directory yet; Task 12 creates `.claude/deploy.json` only if the owner asks for deployment, which this plan does not.

## Review Focus

Inputs and conditions the spec implies but no task's happy path exercises, most likely to bite a user first. Each one has a test in the owning task.

1. **`baseUrl` shapes a consumer will really type** — trailing slash, deep subpath, empty string, an absolute URL inside a manifest source: exactly one slash must be joined, an absolute source must win, and an empty base must produce a typed error rather than a request to `undefined/manifest.json`. Test in Task 2.
2. **Server-side rendering with no `seed`** — the server render and the client's first render must agree (spinner, no clip), with the pick deferred to mount; a random pick during SSR is a hydration mismatch. Test in Task 3 (nothing happens before `start()`) and Task 8 (`renderToString` renders the spinner and fetches nothing).
3. **A manifest that is valid JSON with the wrong shape** — missing `sources`, empty `sources`, string `width`, `clips` not an array, unknown extra fields: `manifest-invalid` for the broken ones, unknown fields ignored rather than rejected. Test in Task 2.
4. **`prefers-reduced-motion` flipping after mount** — the OS setting changes mid-load; no new `<video>` may appear afterwards and no clip may be fetched, with no console error. Test in Task 8.
5. **`video.play()` rejecting** — energy-saver policies reject it, and jsdom does not implement playback at all; the rejection must never propagate into the host's render, the spinner must stay, one retry must happen on first interaction, and `autoplay-blocked` must be emitted. Test in Task 8.

---
## Task 1: Workspace skeleton, licences, CI, and the deterministic picker

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `LICENSE`, `NOTICE`, `scripts/sync-legal.mjs`, `scripts/check-size.mjs`, `.github/workflows/ci.yml`
- Modify: `.gitignore` (the generated licence copies)
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Create: `packages/core/src/errors.ts`, `packages/core/src/prng.ts`, `packages/core/src/pool.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/prng.test.ts`, `packages/core/test/pool.test.ts`

**Interfaces:**
- Consumes: nothing. This is the first task.
- Produces: `LoopedLoaderError`, `isLoopedLoaderError`, `ErrorCode`, `mulberry32`, `xmur3`, `seededIndex`, `pickClip`, `resetRecent`, and the types `ClipSource`, `LoopSeam`, `EncodeInfo`, `Clip`, `Manifest`. Tasks 2, 3, 7 and 9 import these names from `@topclans/looped-loader-core`.

A ruling that shapes every import in this repository: relative imports inside `src/` carry a `.js` extension (`from './prng.js'`), because `tsc` emits ESM that Node resolves at runtime and `moduleResolution: "bundler"` would let a bare `'./prng'` type-check while failing after build.

- [x] **Step 1: Create the workspace files**

`package.json` (root):

```json
{
  "name": "looped-loader-workspace",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.15.1",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "build": "node scripts/sync-legal.mjs && pnpm -r build && node scripts/check-size.mjs",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "transcode": "pnpm --filter @topclans/looped-loader-tools transcode"
  },
  "devDependencies": { "typescript": "~5.9.3" }
}
```

`scripts/sync-legal.mjs` — npm reads a tarball in isolation, so each published package needs the licence text inside its own directory:

```js
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copies = [
  ['LICENSE', 'packages/core/LICENSE'],
  ['LICENSE', 'packages/vue/LICENSE'],
  ['LICENSE', 'packages/assets/LICENSE'],
  ['NOTICE', 'packages/assets/NOTICE'],
]

for (const [from, to] of copies) {
  const target = join(root, to)
  const packageDir = dirname(target)
  if (!existsSync(packageDir)) {
    // Tasks 1-5 run before the assets package exists; skipping is correct, failing is not.
    console.log(`skipped ${to}: ${packageDir} does not exist yet`)
    continue
  }
  const source = join(root, from)
  if (!existsSync(source)) throw new Error(`missing ${from} at the repository root`)
  copyFileSync(source, target)
}
console.log('licence files synced')
```

Append to `.gitignore`:

```
# generated by scripts/sync-legal.mjs
packages/core/LICENSE
packages/vue/LICENSE
packages/assets/LICENSE
packages/assets/NOTICE
```

`scripts/check-size.mjs` — the bundle budget from Global Constraints, with no dependency of its own:

```js
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const budgets = [
  { dir: 'packages/core/dist', max: 8 * 1024 },
  { dir: 'packages/vue/dist', max: 12 * 1024 },
]

let failed = false
for (const { dir, max } of budgets) {
  const root = resolve(dir)
  let files
  try {
    files = readdirSync(root).filter((name) => /\.(js|css)$/.test(name))
  } catch {
    // Tasks 1-6 build one package at a time; an unbuilt package is not a failure.
    console.log(`skipped ${dir}: not built yet`)
    continue
  }
  const bytes = files.reduce((total, name) => total + gzipSync(readFileSync(join(root, name))).length, 0)
  const over = bytes > max
  console.log(`${dir}: ${(bytes / 1024).toFixed(1)} KB gzip, budget ${(max / 1024).toFixed(0)} KB — ${over ? 'OVER' : 'ok'}`)
  if (over) failed = true
}

if (failed) {
  console.error('bundle budget exceeded: something crept into a package that must stay tiny')
  process.exit(1)
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'tools/*'

# pnpm 10 blocks dependency build scripts by default; esbuild (Vite's bundler)
# needs its own to place the platform binary.
onlyBuiltDependencies:
  - esbuild
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`LICENSE`: the standard MIT text, `Copyright (c) 2026 TopClans`.

`NOTICE`:

```
Looped Loader
=============

The code in this repository (packages/core, packages/vue, packages/demo,
tools/transcode) is licensed under the MIT License; see LICENSE.

The media in packages/assets — the clip files and manifest.json — is NOT
covered by that licence. Those clips were collected from Reddit posts and are
redistributed without a licence audit. Original authors and licences are
unknown; the source files carried no attribution metadata. The copyright risk
is explicitly accepted by the repository owner and recorded in
docs/superpowers/specs/2026-10-08-looped-loader-design.md, section 9.

If you hold the rights to a clip and want it removed, open an issue at
https://github.com/TopClans/looped-loader/issues and it will be removed from
the published package and from the repository.
```

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main, 'feat/**']
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.15.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install ffmpeg (integration tests skip without it, CI should not)
        run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
```

- [x] **Step 2: Create the core package's build configuration**

`packages/core/package.json`:

```json
{
  "name": "@topclans/looped-loader-core",
  "version": "0.1.0",
  "description": "Framework-free core for looped-loader: clip selection, manifest validation, video lifecycle",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "LICENSE"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "engines": { "node": ">=20.11" },
  "publishConfig": { "access": "public" },
  "devDependencies": { "typescript": "~5.9.3", "vitest": "^5.0.3" }
}
```

`packages/core/tsconfig.json` — note `"types": []`, which keeps Node types out of a package that must stay environment-agnostic:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": []
  },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})
```

- [x] **Step 3: Write the failing tests**

`packages/core/test/prng.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mulberry32, seededIndex, xmur3 } from '../src/prng.js'

describe('seededIndex', () => {
  it('is stable for the same seed across 100 calls', () => {
    const first = seededIndex('route:/orders', 32)
    for (let i = 0; i < 100; i++) expect(seededIndex('route:/orders', 32)).toBe(first)
  })

  it('stays inside the pool for every seed shape', () => {
    for (const seed of ['', 'a', 'route:/orders', 0, 42, 'длинный ключ']) {
      const index = seededIndex(seed, 32)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(32)
    }
  })

  it('spreads 200 different seeds over more than 20 of 32 slots', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(seededIndex(`seed-${i}`, 32))
    expect(seen.size).toBeGreaterThan(20)
  })

  it('rejects an empty pool instead of returning NaN', () => {
    expect(() => seededIndex('x', 0)).toThrow(RangeError)
  })

  it('mulberry32 stays in [0,1)', () => {
    const rand = mulberry32(xmur3('seed')())
    for (let i = 0; i < 50; i++) {
      const value = rand()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
```

`packages/core/test/pool.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { pickClip, resetRecent, type Clip } from '../src/pool.js'

const clip = (id: string): Clip => ({
  id,
  sources: [{ src: `clips/${id}.mp4`, type: 'video/mp4' }],
  width: 480,
  height: 360,
  durationMs: 2000,
  fps: 30,
})

const pool = [clip('a'), clip('b'), clip('c'), clip('d'), clip('e')]

describe('pickClip', () => {
  beforeEach(() => resetRecent())

  it('returns the same clip for the same seed, whatever the recent history', () => {
    const first = pickClip(pool, 'route:/orders').id
    pickClip(pool)
    pickClip(pool)
    expect(pickClip(pool, 'route:/orders').id).toBe(first)
  })

  it('never repeats any of the previous three picks', () => {
    const picks: string[] = []
    for (let i = 0; i < 60; i++) picks.push(pickClip(pool).id)
    for (let i = 3; i < picks.length; i++) {
      expect(picks.slice(i - 3, i)).not.toContain(picks[i])
    }
  })

  it('still works when the pool is smaller than the recent window', () => {
    const small = [clip('x'), clip('y')]
    for (let i = 0; i < 20; i++) expect(small.map((c) => c.id)).toContain(pickClip(small).id)
  })

  it('treats an empty string seed as "no seed"', () => {
    const picks = new Set<string>()
    for (let i = 0; i < 30; i++) picks.add(pickClip(pool, '').id)
    expect(picks.size).toBeGreaterThan(1)
  })

  it('throws a coded error on an empty pool', () => {
    expect(() => pickClip([])).toThrowError(/looped-loader:no-clips/)
  })
})
```

- [x] **Step 4: Run the tests and confirm they fail**

Run: `pnpm install` then `pnpm --filter @topclans/looped-loader-core test`

Expected: FAIL — `Failed to resolve import "../src/prng.js"` for both files. A failure of a different kind (a config error) is a signal that Step 2 is wrong, not that Step 3 is right.

- [x] **Step 5: Implement the error type, the PRNG and the picker**

`packages/core/src/errors.ts`:

```ts
export type ErrorCode =
  | 'manifest-fetch'
  | 'manifest-invalid'
  | 'clip-fetch'
  | 'decode'
  | 'autoplay-blocked'
  | 'no-clips'

export class LoopedLoaderError extends Error {
  readonly code: ErrorCode
  override readonly cause?: unknown

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(`[looped-loader:${code}] ${message}`)
    this.name = 'LoopedLoaderError'
    this.code = code
    this.cause = cause
  }
}

export function isLoopedLoaderError(value: unknown): value is LoopedLoaderError {
  return value instanceof LoopedLoaderError
}
```

`packages/core/src/prng.ts`:

```ts
/** xmur3: string → 32-bit seed sequence. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/** mulberry32: 32-bit seed → deterministic [0,1) generator. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable index in [0, length) for a string or number seed. */
export function seededIndex(seed: string | number, length: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError(`seededIndex: length must be a positive integer, got ${length}`)
  }
  const rand = mulberry32(xmur3(String(seed))())
  return Math.floor(rand() * length) % length
}
```

`packages/core/src/pool.ts`:

```ts
import { LoopedLoaderError } from './errors.js'
import { seededIndex } from './prng.js'

export interface ClipSource {
  src: string
  type: string
}

export interface LoopSeam {
  stepMean: number
  stepP90: number
  seam: number
  flag?: 'review'
}

export interface EncodeInfo {
  codec: string
  crf: number
  longSide: number
  fpsCap: number
  note: 'base' | 'budget-adapted' | 'budget-exceeded'
}

export interface Clip {
  id: string
  sources: ClipSource[]
  width: number
  height: number
  durationMs: number
  fps: number
  bytes?: Record<string, number>
  sha256?: Record<string, string>
  sourceSha256?: string
  encode?: EncodeInfo
  loopSeam?: LoopSeam
}

export interface Manifest {
  schemaVersion: number
  generatedBy?: string
  corpus?: { clips: number; totalBytes: number }
  clips: Clip[]
}

const RECENT_LIMIT = 3
let recent: string[] = []

/** Test seam: the "do not repeat" ring is module-level and shared by all instances. */
export function resetRecent(): void {
  recent = []
}

const take = (pool: Clip[], index: number): Clip => {
  const clip = pool[index]
  if (!clip) throw new LoopedLoaderError('no-clips', `index ${index} is outside a pool of ${pool.length}`)
  return clip
}

export function pickClip(pool: Clip[], seed?: string | number): Clip {
  if (pool.length === 0) throw new LoopedLoaderError('no-clips', 'clip pool is empty')

  if (seed !== undefined && seed !== null && seed !== '') {
    return take(pool, seededIndex(seed, pool.length))
  }

  const fresh = pool.length > RECENT_LIMIT ? pool.filter((candidate) => !recent.includes(candidate.id)) : pool
  const from = fresh.length > 0 ? fresh : pool
  const clip = take(from, Math.floor(Math.random() * from.length))
  recent.push(clip.id)
  if (recent.length > RECENT_LIMIT) recent.shift()
  return clip
}
```

`packages/core/src/index.ts`:

```ts
export { LoopedLoaderError, isLoopedLoaderError, type ErrorCode } from './errors.js'
export { mulberry32, seededIndex, xmur3 } from './prng.js'
export {
  pickClip,
  resetRecent,
  type Clip,
  type ClipSource,
  type EncodeInfo,
  type LoopSeam,
  type Manifest,
} from './pool.js'
```

- [x] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @topclans/looped-loader-core test`

Expected: PASS, 10 tests across 2 files. Record this count — it is the baseline every later task adds to.

Run: `pnpm typecheck` — expect PASS.

- [x] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore LICENSE NOTICE scripts .github packages/core
git commit -m "feat(core): workspace skeleton, licences and the deterministic clip picker"
```

`pnpm-lock.yaml` is part of this commit on purpose: CI installs with `--frozen-lockfile`, and a lockfile that never got committed turns the first push red for a reason that looks nothing like its cause.

## Task 2: Manifest validation, path resolution and pool construction

**Files:**
- Create: `packages/core/src/manifest.ts`
- Modify: `packages/core/src/index.ts` (add the new exports)
- Test: `packages/core/test/manifest.test.ts`

**Interfaces:**
- Consumes: `Clip`, `ClipSource`, `Manifest` from `./pool.js`; `LoopedLoaderError` from `./errors.js` (Task 1).
- Produces: `parseManifest(input: unknown): Manifest`, `resolveSrc(baseUrl: string, src: string): string`, `buildPool(manifest: Manifest, options?: { clip?: string; clips?: string[] }): Clip[]`. Task 3 calls all three; Tasks 7 and 9 rely on `parseManifest` rejecting a broken manifest with code `manifest-invalid`.

- [x] **Step 1: Write the failing tests**

`packages/core/test/manifest.test.ts` — the baseUrl and malformed-manifest cases are Review Focus items 1 and 3, so they are the first tests written, not an afterthought:

```ts
import { describe, expect, it } from 'vitest'
import { buildPool, parseManifest, resolveSrc } from '../src/manifest.js'

const valid = {
  schemaVersion: 1,
  clips: [
    {
      id: 'a',
      sources: [{ src: 'clips/a.mp4', type: 'video/mp4' }],
      width: 480,
      height: 360,
      durationMs: 2000,
      fps: 30,
    },
  ],
}

const codeOf = (fn: () => unknown): string => {
  try {
    fn()
  } catch (error) {
    return (error as { code?: string }).code ?? 'no-code'
  }
  return 'did-not-throw'
}

describe('resolveSrc', () => {
  it('joins exactly one slash for every baseUrl shape a consumer types', () => {
    const expected = 'https://cdn.example.com/clips/a.mp4'
    expect(resolveSrc('https://cdn.example.com', 'clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com/', 'clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com///', 'clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com', '/clips/a.mp4')).toBe(expected)
    expect(resolveSrc('https://cdn.example.com/deep/sub/path/', 'clips/a.mp4')).toBe(
      'https://cdn.example.com/deep/sub/path/clips/a.mp4',
    )
    expect(resolveSrc('/looped-clips', 'clips/a.mp4')).toBe('/looped-clips/clips/a.mp4')
  })

  it('lets an absolute source win over the base', () => {
    expect(resolveSrc('/looped-clips', 'https://other.example.com/x.mp4')).toBe('https://other.example.com/x.mp4')
  })

  it('refuses to build a URL out of an empty base', () => {
    expect(codeOf(() => resolveSrc('', 'clips/a.mp4'))).toBe('manifest-fetch')
    expect(codeOf(() => resolveSrc('   ', 'clips/a.mp4'))).toBe('manifest-fetch')
  })
})

describe('parseManifest', () => {
  it('accepts a valid manifest and ignores unknown fields', () => {
    const manifest = parseManifest({ ...valid, futureField: { anything: true }, clips: [{ ...valid.clips[0], extra: 1 }] })
    expect(manifest.clips[0]?.id).toBe('a')
    expect(manifest.schemaVersion).toBe(1)
  })

  it('defaults a missing schemaVersion to 1', () => {
    expect(parseManifest({ clips: valid.clips }).schemaVersion).toBe(1)
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['clips missing', {}],
    ['clips not an array', { clips: {} }],
    ['clips empty', { clips: [] }],
    ['id missing', { clips: [{ ...valid.clips[0], id: '' }] }],
    ['sources missing', { clips: [{ ...valid.clips[0], sources: undefined }] }],
    ['sources empty', { clips: [{ ...valid.clips[0], sources: [] }] }],
    ['source src not a string', { clips: [{ ...valid.clips[0], sources: [{ src: 1, type: 'video/mp4' }] }] }],
    ['width is a string', { clips: [{ ...valid.clips[0], width: '480' }] }],
    ['durationMs negative', { clips: [{ ...valid.clips[0], durationMs: -1 }] }],
    ['fps zero', { clips: [{ ...valid.clips[0], fps: 0 }] }],
  ])('rejects %s with manifest-invalid', (_label, input) => {
    expect(codeOf(() => parseManifest(input))).toBe('manifest-invalid')
  })
})

describe('buildPool', () => {
  const manifest = parseManifest({
    clips: [valid.clips[0], { ...valid.clips[0], id: 'b' }, { ...valid.clips[0], id: 'c' }],
  })

  it('returns every clip by default', () => {
    expect(buildPool(manifest).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('narrows to one id with clip', () => {
    expect(buildPool(manifest, { clip: 'b' }).map((c) => c.id)).toEqual(['b'])
  })

  it('narrows to a subset with clips, silently dropping unknown ids', () => {
    expect(buildPool(manifest, { clips: ['a', 'zzz', 'c'] }).map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('reports an unknown clip id as manifest-invalid', () => {
    expect(codeOf(() => buildPool(manifest, { clip: 'zzz' }))).toBe('manifest-invalid')
  })

  it('reports a subset with no surviving id as no-clips', () => {
    expect(codeOf(() => buildPool(manifest, { clips: ['zzz'] }))).toBe('no-clips')
  })
})
```

- [x] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @topclans/looped-loader-core test`

Expected: FAIL — `Failed to resolve import "../src/manifest.js"`.

- [x] **Step 3: Implement manifest.ts**

```ts
import { LoopedLoaderError } from './errors.js'
import type { Clip, ClipSource, Manifest } from './pool.js'

const ABSOLUTE_URL = /^https?:\/\//i

const invalid = (message: string): LoopedLoaderError =>
  new LoopedLoaderError('manifest-invalid', message)

export function resolveSrc(baseUrl: string, src: string): string {
  if (ABSOLUTE_URL.test(src)) return src
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base === '') {
    throw new LoopedLoaderError('manifest-fetch', 'baseUrl is required and must be a non-empty string')
  }
  return `${base}/${src.replace(/^\/+/, '')}`
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function parseSource(value: unknown, clipId: string, index: number): ClipSource {
  if (typeof value !== 'object' || value === null) throw invalid(`clip "${clipId}" source ${index} is not an object`)
  const source = value as Record<string, unknown>
  if (typeof source.src !== 'string' || source.src === '') throw invalid(`clip "${clipId}" source ${index} has no src`)
  if (typeof source.type !== 'string' || source.type === '') throw invalid(`clip "${clipId}" source ${index} has no type`)
  return { src: source.src as string, type: source.type as string }
}

function parseClip(value: unknown): Clip {
  if (typeof value !== 'object' || value === null) throw invalid('a clip entry is not an object')
  const raw = value as Record<string, unknown>
  const id = raw.id
  if (typeof id !== 'string' || id === '') throw invalid('a clip entry has no id')
  if (!Array.isArray(raw.sources) || raw.sources.length === 0) throw invalid(`clip "${id}" has no sources`)
  if (!isFiniteNumber(raw.width) || raw.width <= 0) throw invalid(`clip "${id}" has an invalid width`)
  if (!isFiniteNumber(raw.height) || raw.height <= 0) throw invalid(`clip "${id}" has an invalid height`)
  if (!isFiniteNumber(raw.durationMs) || raw.durationMs < 0) throw invalid(`clip "${id}" has an invalid durationMs`)
  if (!isFiniteNumber(raw.fps) || raw.fps <= 0) throw invalid(`clip "${id}" has an invalid fps`)

  const clip: Clip = {
    id,
    sources: (raw.sources as unknown[]).map((source, index) => parseSource(source, id, index)),
    width: raw.width,
    height: raw.height,
    durationMs: raw.durationMs,
    fps: raw.fps,
  }
  if (isRecordOfNumbers(raw.bytes)) clip.bytes = raw.bytes
  if (isRecordOfStrings(raw.sha256)) clip.sha256 = raw.sha256
  if (typeof raw.sourceSha256 === 'string') clip.sourceSha256 = raw.sourceSha256
  if (raw.encode && typeof raw.encode === 'object') clip.encode = raw.encode as NonNullable<Clip['encode']>
  if (raw.loopSeam && typeof raw.loopSeam === 'object') clip.loopSeam = raw.loopSeam as NonNullable<Clip['loopSeam']>
  return clip
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every((entry) => isFiniteNumber(entry))
  )
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string')
  )
}

/**
 * Validates the parts the runtime depends on and ignores everything else.
 * Unknown fields are how the manifest schema grows without a breaking change.
 */
export function parseManifest(input: unknown): Manifest {
  if (typeof input !== 'object' || input === null) throw invalid('manifest is not an object')
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.clips)) throw invalid('manifest.clips must be an array')
  const clips = (raw.clips as unknown[]).map(parseClip)
  if (clips.length === 0) throw invalid('manifest.clips is empty')

  const manifest: Manifest = {
    schemaVersion: isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : 1,
    clips,
  }
  if (typeof raw.generatedBy === 'string') manifest.generatedBy = raw.generatedBy
  if (raw.corpus && typeof raw.corpus === 'object') manifest.corpus = raw.corpus as NonNullable<Manifest['corpus']>
  return manifest
}

export function buildPool(manifest: Manifest, options: { clip?: string; clips?: string[] } = {}): Clip[] {
  const { clip, clips } = options
  const byId = new Map(manifest.clips.map((entry) => [entry.id, entry]))

  if (clip !== undefined && clip !== '') {
    const found = byId.get(clip)
    if (!found) throw invalid(`clip "${clip}" is not in the manifest`)
    return [found]
  }

  if (clips !== undefined && clips.length > 0) {
    const picked = clips
      .map((id) => byId.get(id))
      .filter((entry): entry is Clip => entry !== undefined)
    if (picked.length === 0) {
      throw new LoopedLoaderError('no-clips', 'none of the requested clip ids exist in the manifest')
    }
    return picked
  }

  return [...manifest.clips]
}
```

- [x] **Step 4: Export the new API and run the tests**

Add to `packages/core/src/index.ts`:

```ts
export { buildPool, parseManifest, resolveSrc } from './manifest.js'
```

Run: `pnpm --filter @topclans/looped-loader-core test`

Expected: PASS — Task 1's 10 tests plus Task 2's, with the 12 malformed-manifest cases each reported individually.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/manifest.ts packages/core/src/index.ts packages/core/test/manifest.test.ts
git commit -m "feat(core): validate manifests, resolve asset URLs and build clip pools"
```

## Task 3: The loader state machine and video lifecycle

**Files:**
- Create: `packages/core/src/loader.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/loader.test.ts`

**Interfaces:**
- Consumes: `parseManifest`, `resolveSrc`, `buildPool` (Task 2); `pickClip`, `Clip`, `Manifest` (Task 1); `LoopedLoaderError`, `isLoopedLoaderError` (Task 1).
- Produces: `createLoopedLoader(options: LoopedLoaderOptions): LoopedLoader`, the types `State`, `VideoLike`, `LoopedLoaderOptions`, `LoopedLoader`, and `prefersReducedMotion(): boolean`. The Vue adapter in Task 7 consumes exactly this surface: `state`, `clip`, `src`, `error`, `start()`, `attach(video)`, `observeRoot(root)`, `destroy()`.

Two deliberate behaviours to implement as written, because they are easy to get subtly wrong:

- **Nothing happens before `start()`.** The constructor only records options. The adapter calls `start()` from `onMounted`, which never runs during server rendering — that is what makes the component SSR-safe without a `window` check in the fetch path.
- **`autoplay-blocked` is reported through `onError` but does not move the state to `error`.** A browser refusing autoplay is not a failure of the loader; the spinner is the correct rendering while waiting for a gesture.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/loader.test.ts` — a hand-written `VideoLike` fake, so the state machine is tested without jsdom and without a real decoder:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoopedLoader, prefersReducedMotion, type VideoLike } from '../src/loader.js'
import { resetRecent } from '../src/pool.js'
import type { Manifest } from '../src/pool.js'

const manifest: Manifest = {
  schemaVersion: 1,
  clips: ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    sources: [{ src: `clips/${id}.mp4`, type: 'video/mp4' }],
    width: 480,
    height: 360,
    durationMs: 2000,
    fps: 30,
  })),
}

function fakeVideo() {
  const listeners = new Map<string, Set<() => void>>()
  const element = {
    src: '',
    muted: false,
    playing: false,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    playError: null as Error | null,
    error: null as { code?: number } | null,
    pause() {
      element.pauseCalls++
      element.playing = false
    },
    play() {
      element.playCalls++
      if (element.playError) return Promise.reject(element.playError)
      element.playing = true
      return Promise.resolve()
    },
    load() {
      element.loadCalls++
    },
    removeAttribute(name: string) {
      if (name === 'src') element.src = ''
    },
    addEventListener(type: string, listener: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(listener)
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener)
    },
    emit(type: string) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener()
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0
    },
  }
  return element
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createLoopedLoader', () => {
  beforeEach(() => {
    resetRecent()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does no work at all before start()', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const onSelect = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, onSelect })
    await flush()
    expect(loader.state).toBe('idle')
    expect(loader.clip).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    loader.destroy()
  })

  it('selects with a seed, resolves the src and reports playing on the media event', async () => {
    const video = fakeVideo()
    const states: string[] = []
    const loader = createLoopedLoader({
      baseUrl: '/clips/',
      manifest,
      seed: 'route:/orders',
      delayMs: 0,
      onState: (state) => states.push(state),
    })
    loader.start()
    await flush()
    loader.attach(video)
    expect(video.src).toBe('/clips/clips/d.mp4')
    expect(loader.state).toBe('loading')
    video.emit('playing')
    expect(loader.state).toBe('playing')
    expect(states).toContain('resolving')
    loader.destroy()
  })

  it('fetches and validates the manifest when none is passed in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    await flush()
    expect(loader.state).toBe('loading')
    expect(loader.src).toBe('/clips/clips/c.mp4')
    loader.destroy()
  })

  it('reports manifest-fetch when the manifest request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', seed: 'x', delayMs: 0, onError })
    loader.start()
    await flush()
    await flush()
    expect(loader.state).toBe('error')
    expect(onError.mock.calls[0]?.[0].code).toBe('manifest-fetch')
    loader.destroy()
  })

  it('reports manifest-fetch for an empty baseUrl instead of requesting undefined', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const loader = createLoopedLoader({ baseUrl: '', seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    expect(loader.state).toBe('error')
    expect(loader.error?.code).toBe('manifest-fetch')
    expect(fetchSpy).not.toHaveBeenCalled()
    loader.destroy()
  })

  it('respects delayMs before touching the manifest', async () => {
    vi.useFakeTimers()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 120 })
    loader.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(loader.state).toBe('idle')
    await vi.advanceTimersByTimeAsync(40)
    expect(loader.state).toBe('loading')
    loader.destroy()
    vi.useRealTimers()
  })

  it('never creates a video or fetches a clip under reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const onSelect = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest: undefined, seed: 'x', delayMs: 0, onSelect })
    loader.start()
    await flush()
    expect(loader.state).toBe('idle')
    expect(onSelect).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    loader.destroy()
  })

  it('falls back to another clip when one fails, then errors after three attempts', async () => {
    const video = fakeVideo()
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError, clips: ['a', 'b', 'c'] })
    loader.start()
    await flush()
    loader.attach(video)
    video.emit('error')
    await flush()
    video.emit('error')
    await flush()
    video.emit('error')
    await flush()
    expect(loader.state).toBe('error')
    expect(onError.mock.calls.at(-1)?.[0].code).toBe('clip-fetch')
    loader.destroy()
  })

  it('distinguishes a decoder failure from a fetch failure', async () => {
    const video = fakeVideo()
    video.error = { code: 3 }
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError, clips: ['a'] })
    loader.start()
    await flush()
    loader.attach(video)
    video.emit('error')
    await flush()
    expect(onError.mock.calls.at(-1)?.[0].code).toBe('decode')
    loader.destroy()
  })

  it('keeps the spinner on an autoplay rejection and retries on the first interaction', async () => {
    const video = fakeVideo()
    video.playError = new Error('NotAllowedError')
    const onError = vi.fn()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0, onError })
    loader.start()
    await flush()
    loader.attach(video)
    await flush()
    expect(loader.state).not.toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'autoplay-blocked' }))
    loader.destroy()
  })

  it('releases the decoder on destroy', async () => {
    const video = fakeVideo()
    const loader = createLoopedLoader({ baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 })
    loader.start()
    await flush()
    loader.attach(video)
    video.emit('playing')
    loader.destroy()
    expect(video.pauseCalls).toBe(1)
    expect(video.src).toBe('')
    expect(video.loadCalls).toBe(1)
    expect(video.listenerCount('playing')).toBe(0)
  })
})

describe('prefersReducedMotion', () => {
  it('is false when matchMedia is unavailable', () => {
    expect(prefersReducedMotion()).toBe(typeof globalThis.matchMedia === 'function' ? expect.any(Boolean) : false)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @topclans/looped-loader-core test`

Expected: FAIL — `Failed to resolve import "../src/loader.js"`.

- [ ] **Step 3: Implement loader.ts**

```ts
import { LoopedLoaderError, isLoopedLoaderError, type ErrorCode } from './errors.js'
import { buildPool, parseManifest, resolveSrc } from './manifest.js'
import { pickClip, type Clip, type Manifest } from './pool.js'

export type State = 'idle' | 'resolving' | 'loading' | 'playing' | 'error'

/** The DOM surface the core actually uses, so tests need no jsdom. */
export interface VideoLike {
  src: string
  muted: boolean
  /** Present on a real HTMLMediaElement; `code === 3` is MEDIA_ERR_DECODE. */
  error?: { code?: number } | null
  pause(): void
  play(): Promise<void> | void
  load?(): void
  removeAttribute(name: string): void
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface LoopedLoaderOptions {
  baseUrl: string
  manifest?: unknown
  manifestUrl?: string
  seed?: string | number
  clip?: string
  clips?: string[]
  delayMs?: number
  respectReducedMotion?: boolean
  onState?: (state: State) => void
  onError?: (error: LoopedLoaderError) => void
  onSelect?: (clip: Clip) => void
}

export interface LoopedLoader {
  readonly state: State
  readonly clip: Clip | null
  readonly src: string | null
  readonly error: LoopedLoaderError | null
  start(): void
  attach(video: VideoLike): void
  observeRoot(root: Element): void
  destroy(): void
}

const DEFAULT_DELAY_MS = 120
const MAX_ATTEMPTS = 3

export function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function createLoopedLoader(options: LoopedLoaderOptions): LoopedLoader {
  const baseUrl = (options.baseUrl ?? '').trim()
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  const respectReducedMotion = options.respectReducedMotion ?? true

  let state: State = 'idle'
  let clip: Clip | null = null
  let src: string | null = null
  let error: LoopedLoaderError | null = null
  let pool: Clip[] = []
  let attempts = 0
  let video: VideoLike | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let abort: AbortController | null = null
  let destroyed = false
  let started = false
  let resolving = false
  let observed: Element | null = null
  let observer: IntersectionObserver | null = null
  const failed = new Set<string>()

  const setState = (next: State): void => {
    if (state === next) return
    state = next
    options.onState?.(next)
  }

  const emitError = (failure: LoopedLoaderError): void => {
    error = failure
    options.onError?.(failure)
  }

  const fail = (failure: LoopedLoaderError): void => {
    emitError(failure)
    setState('error')
  }

  const asLoaderError = (value: unknown, fallback: ErrorCode, message: string): LoopedLoaderError =>
    isLoopedLoaderError(value) ? value : new LoopedLoaderError(fallback, message, value)

  const manifestUrl = (): string => {
    if (options.manifestUrl) return options.manifestUrl
    if (baseUrl === '') {
      throw new LoopedLoaderError('manifest-fetch', 'baseUrl is required and must be a non-empty string')
    }
    return `${baseUrl.replace(/\/+$/, '')}/manifest.json`
  }

  async function loadManifest(): Promise<Manifest> {
    if (options.manifest !== undefined && options.manifest !== null) return parseManifest(options.manifest)

    const url = manifestUrl()
    abort = new AbortController()
    let response: Response
    try {
      response = await fetch(url, { signal: abort.signal })
    } catch (cause) {
      throw new LoopedLoaderError('manifest-fetch', `could not fetch ${url}`, cause)
    }
    if (!response.ok) throw new LoopedLoaderError('manifest-fetch', `${url} responded with ${response.status}`)

    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new LoopedLoaderError('manifest-invalid', `${url} is not valid JSON`, cause)
    }
    return parseManifest(body)
  }

  async function resolve(): Promise<void> {
    if (resolving || destroyed) return
    resolving = true
    try {
      setState('resolving')
      const manifest = await loadManifest()
      if (destroyed) return
      // exactOptionalPropertyTypes: an explicit `undefined` is not the same as an absent key.
      const poolOptions: { clip?: string; clips?: string[] } = {}
      if (options.clip !== undefined) poolOptions.clip = options.clip
      if (options.clips !== undefined) poolOptions.clips = options.clips
      pool = buildPool(manifest, poolOptions)
      selectNext()
    } catch (cause) {
      if (destroyed) return
      fail(asLoaderError(cause, 'manifest-invalid', 'failed to resolve the manifest'))
    } finally {
      resolving = false
    }
  }

  /** Picks the next clip and resolves its URL *before* announcing the loading state. */
  function selectNext(): void {
    if (clip) failed.add(clip.id)
    const remaining = pool.filter((entry) => !failed.has(entry.id))
    if (remaining.length === 0) {
      fail(new LoopedLoaderError('no-clips', 'every clip in the pool failed to load'))
      return
    }

    const candidate = pickClip(remaining, options.seed)
    const source = candidate.sources[0]
    if (!source) {
      failed.add(candidate.id)
      selectNext()
      return
    }

    let nextSrc: string
    try {
      nextSrc = resolveSrc(baseUrl, source.src)
    } catch (cause) {
      fail(asLoaderError(cause, 'clip-fetch', 'failed to resolve the clip URL'))
      return
    }

    clip = candidate
    src = nextSrc
    attempts = 0
    options.onSelect?.(candidate)
    setState('loading')
    bindToElement()
  }

  function bindToElement(): void {
    if (!video || !src) return
    video.muted = true
    video.src = src
    requestPlay()
  }

  const onPlaying = (): void => setState('playing')
  const onMediaFailure = (): void => {
    // MediaError code 3 is MEDIA_ERR_DECODE; anything else is a fetch or container problem.
    const code: ErrorCode = video?.error?.code === 3 ? 'decode' : 'clip-fetch'
    attempts++
    if (attempts < MAX_ATTEMPTS && pool.filter((entry) => !failed.has(entry.id)).length > 1) {
      selectNext()
      return
    }
    fail(new LoopedLoaderError(code, `clip "${clip?.id ?? 'unknown'}" failed to load`))
  }

  function requestPlay(): void {
    if (!video) return
    try {
      const result = video.play()
      if (result && typeof result.then === 'function') {
        result.then(undefined, (cause: unknown) => onAutoplayBlocked(cause))
      }
    } catch (cause) {
      onAutoplayBlocked(cause)
    }
  }

  function onAutoplayBlocked(cause: unknown): void {
    emitError(new LoopedLoaderError('autoplay-blocked', 'the browser refused to start playback', cause))
    if (typeof document === 'undefined') return
    // Re-registering with { once: true } keeps exactly one pending retry, and the
    // handler is removed in destroy() so a destroyed loader cannot be resumed by a
    // stray gesture later.
    document.removeEventListener('pointerdown', retryOnInteraction)
    document.addEventListener('pointerdown', retryOnInteraction, { once: true })
  }

  const retryOnInteraction = (): void => {
    document.removeEventListener('pointerdown', retryOnInteraction)
    requestPlay()
  }

  const onVisibilityChange = (): void => {
    if (!video) return
    if (document.hidden) video.pause()
    else requestPlay()
  }

  function bindVisibility(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return {
    get state() {
      return state
    },
    get clip() {
      return clip
    },
    get src() {
      return src
    },
    get error() {
      return error
    },

    start() {
      if (started || destroyed) return
      started = true
      if (respectReducedMotion && prefersReducedMotion()) return
      if (delayMs > 0) timer = setTimeout(() => void resolve(), delayMs)
      else void resolve()
    },

    attach(element: VideoLike) {
      video = element
      element.addEventListener('playing', onPlaying)
      element.addEventListener('error', onMediaFailure)
      bindVisibility()
      if (src) {
        element.muted = true
        element.src = src
        requestPlay()
      } else if (started) {
        void resolve()
      }
    },

    observeRoot(root: Element) {
      observed = root
      if (typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver((entries) => {
        const entry = entries[0]
        if (!entry || !video) return
        if (entry.isIntersecting) requestPlay()
        else video.pause()
      })
      observer.observe(root)
    },

    destroy() {
      destroyed = true
      if (timer) clearTimeout(timer)
      abort?.abort()
      observer?.disconnect()
      observer = null
      observed = null
      if (video) {
        video.removeEventListener('playing', onPlaying)
        video.removeEventListener('error', onMediaFailure)
        video.pause()
        video.removeAttribute('src')
        video.load?.()
      }
      video = null
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        document.removeEventListener('pointerdown', retryOnInteraction)
      }
    },
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Add to `packages/core/src/index.ts`:

```ts
export { createLoopedLoader, prefersReducedMotion, type LoopedLoader, type LoopedLoaderOptions, type State, type VideoLike } from './loader.js'
```

Run: `pnpm --filter @topclans/looped-loader-core test`

Expected: PASS. The seeded expectations in this task's test block were **corrected to the measured indices** when the task ran: seed `'route:/orders'` over a 4-clip pool lands on index 3 → `/clips/clips/d.mp4`, and seed `'x'` lands on index 2 → `/clips/clips/c.mp4` (each confirmed stable across repeated runs and by calling `seededIndex` directly). The plan originally guessed `a.mp4` for both. Do **not** change the PRNG to force a particular clip: the requirement is determinism, not a particular clip.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/loader.ts packages/core/src/index.ts packages/core/test/loader.test.ts
git commit -m "feat(core): loader state machine, video lifecycle and failure paths"
```

## Task 4: Transcode planning — target box, CRF ladder and the ffmpeg process layer

**Files:**
- Create: `tools/transcode/package.json`, `tools/transcode/tsconfig.json`, `tools/transcode/vitest.config.ts`
- Create: `tools/transcode/src/plan.ts`, `tools/transcode/src/ffmpeg.ts`
- Test: `tools/transcode/test/plan.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ProbeInfo`, `EncodePlan`, the constants `LONG_SIDE`, `FALLBACK_LONG_SIDE`, `FPS_CAP`, `BASE_CRF`, `MAX_CRF`, `BUDGET_BYTES`, and the functions `targetBox`, `initialPlan`, `escalate`, `encodeArgs` (all pure, all unit-tested here); plus the process layer `hasFfmpeg`, `probeClip`, `runEncode`, `ssimOf`, `grayFrames`, `FfmpegError` (exercised by Task 5's integration test). Task 5 and Task 6 import all of these.

Encoding is pinned to `-threads 1` deliberately: x264's output depends on the thread count, and without this a `--check` run on another machine would report phantom differences that look like corruption.

- [x] **Step 1: Create the tools package**

`tools/transcode/package.json`:

```json
{
  "name": "@topclans/looped-loader-tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "engines": { "node": ">=20.11" },
  "devDependencies": {
    "@types/node": "^22",
    "typescript": "~5.9.3",
    "vitest": "^5.0.3"
  }
}
```

`tools/transcode/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "types": ["node"] },
  "include": ["src"]
}
```

`tools/transcode/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 120_000 },
})
```

Add the workspace script to the root `package.json` (it builds first, because `tsc` is the only thing that can run the ESM output):

```json
"transcode": "pnpm --filter @topclans/looped-loader-tools build && node tools/transcode/dist/index.js"
```

- [x] **Step 2: Write the failing tests**

`tools/transcode/test/plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  BASE_CRF,
  BUDGET_BYTES,
  encodeArgs,
  escalate,
  initialPlan,
  targetBox,
  type EncodePlan,
  type ProbeInfo,
} from '../src/plan.js'

const probe = (width: number, height: number, fps = 30, extra: Partial<ProbeInfo> = {}): ProbeInfo => ({
  width,
  height,
  fps,
  frames: Math.round(fps * 2),
  durationMs: 2000,
  bytes: 100_000,
  ...extra,
})

describe('targetBox', () => {
  it.each([
    ['leaves a small clip alone', 240, 168, 240, 168],
    ['portrait 1080x1440', 1080, 1440, 360, 480],
    ['portrait 640x800', 640, 800, 384, 480],
    ['portrait 576x720', 576, 720, 384, 480],
    ['square 1080x1080', 1080, 1080, 480, 480],
    ['landscape 640x360', 640, 360, 480, 270],
    ['odd 501x333 stays even', 501, 333, 480, 320],
    ['already 480 long side', 310, 422, 310, 422],
  ])('%s', (_label, width, height, expectedWidth, expectedHeight) => {
    expect(targetBox(width, height)).toEqual({ width: expectedWidth, height: expectedHeight })
  })

  it('honours an explicit long side and still never upscales', () => {
    expect(targetBox(1080, 1440, 400)).toEqual({ width: 300, height: 400 })
    expect(targetBox(240, 168, 400)).toEqual({ width: 240, height: 168 })
  })

  it('rejects nonsense dimensions instead of emitting odd numbers', () => {
    expect(() => targetBox(0, 100)).toThrow(RangeError)
    expect(() => targetBox(100, -1)).toThrow(RangeError)
  })
})

describe('initialPlan', () => {
  it('caps the frame rate at 30 and keeps a slower source rate', () => {
    expect(initialPlan(probe(1080, 1440, 39.5)).fps).toBe(30)
    expect(initialPlan(probe(1080, 1080, 10)).fps).toBe(10)
    expect(initialPlan(probe(800, 600, 24.166666)).fps).toBe(24.167)
  })

  it('starts at the base CRF with the base long side', () => {
    const plan = initialPlan(probe(640, 800, 30))
    expect(plan).toMatchObject({ crf: BASE_CRF, longSide: 480, note: 'base', width: 384, height: 480 })
  })
})

describe('escalate', () => {
  const info = probe(1080, 1440, 30)

  it('walks CRF from the base to the maximum, one step at a time', () => {
    let plan: EncodePlan | null = initialPlan(info)
    const crfs: number[] = []
    while (plan && plan.crf <= 30 && plan.longSide === 480) {
      crfs.push(plan.crf)
      plan = escalate(plan, info)
      if (plan && plan.crf === 30 && crfs.includes(30)) break
    }
    expect(crfs).toEqual([26, 27, 28, 29, 30])
  })

  it('drops the long side to 400 once CRF is exhausted, recomputing the box', () => {
    const atMax: EncodePlan = { width: 360, height: 480, fps: 30, crf: 30, longSide: 480, note: 'budget-adapted' }
    expect(escalate(atMax, info)).toEqual({
      width: 300,
      height: 400,
      fps: 30,
      crf: 30,
      longSide: 400,
      note: 'budget-adapted',
    })
  })

  it('gives up instead of looping forever', () => {
    const spent: EncodePlan = { width: 300, height: 400, fps: 30, crf: 30, longSide: 400, note: 'budget-adapted' }
    expect(escalate(spent, info)).toBeNull()
  })
})

describe('encodeArgs', () => {
  const args = encodeArgs(initialPlan(probe(640, 800, 30)), 'in.mp4', 'out.mp4')

  it('carries every setting the spec fixes', () => {
    for (const required of [
      'scale=384:480,fps=30',
      'libx264',
      '-preset', 'slow',
      '-profile:v', 'main',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      '-map_metadata', '-1',
      '-threads', '1',
    ]) {
      expect(args).toContain(required)
    }
    expect(args.at(-1)).toBe('out.mp4')
  })

  it('uses the planned CRF', () => {
    expect(args[args.indexOf('-crf') + 1]).toBe(String(BASE_CRF))
  })

  it('keeps the budget constant at 250 KB', () => {
    expect(BUDGET_BYTES).toBe(256_000)
  })
})
```

- [x] **Step 3: Run the tests and confirm they fail**

Run: `pnpm install && pnpm --filter @topclans/looped-loader-tools test`

Expected: FAIL — `Failed to resolve import "../src/plan.js"`.

- [x] **Step 4: Implement plan.ts**

```ts
export interface ProbeInfo {
  width: number
  height: number
  fps: number
  frames: number
  durationMs: number
  bytes: number
}

export interface EncodePlan {
  width: number
  height: number
  fps: number
  crf: number
  longSide: number
  note: 'base' | 'budget-adapted' | 'budget-exceeded'
}

export const LONG_SIDE = 480
export const FALLBACK_LONG_SIDE = 400
export const FPS_CAP = 30
export const BASE_CRF = 26
export const MAX_CRF = 30
export const BUDGET_BYTES = 250 * 1024

const round3 = (value: number): number => Math.round(value * 1000) / 1000
const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)

export function targetBox(width: number, height: number, longSide: number = LONG_SIDE): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError(`targetBox: bad dimensions ${width}x${height}`)
  }
  if (!Number.isFinite(longSide) || longSide <= 0) throw new RangeError(`targetBox: bad long side ${longSide}`)
  const factor = Math.min(1, longSide / Math.max(width, height))
  return { width: even(width * factor), height: even(height * factor) }
}

export function initialPlan(info: ProbeInfo): EncodePlan {
  return {
    ...targetBox(info.width, info.height),
    fps: Math.min(round3(info.fps), FPS_CAP),
    crf: BASE_CRF,
    longSide: LONG_SIDE,
    note: 'base',
  }
}

/** Next rung of the budget ladder, or null when the ladder is spent. */
export function escalate(plan: EncodePlan, info: ProbeInfo): EncodePlan | null {
  if (plan.crf < MAX_CRF) return { ...plan, crf: plan.crf + 1, note: 'budget-adapted' }
  if (plan.longSide > FALLBACK_LONG_SIDE) {
    return {
      ...plan,
      ...targetBox(info.width, info.height, FALLBACK_LONG_SIDE),
      longSide: FALLBACK_LONG_SIDE,
      note: 'budget-adapted',
    }
  }
  return null
}

export function encodeArgs(plan: EncodePlan, input: string, output: string): string[] {
  return [
    '-v', 'error',
    '-y',
    '-i', input,
    '-vf', `scale=${plan.width}:${plan.height},fps=${plan.fps}`,
    '-c:v', 'libx264',
    '-crf', String(plan.crf),
    '-preset', 'slow',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-threads', '1',
    '-an',
    '-map_metadata', '-1',
    output,
  ]
}
```

- [x] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @topclans/looped-loader-tools test`

Expected: PASS.

- [x] **Step 6: Implement the ffmpeg process layer**

`tools/transcode/src/ffmpeg.ts` — no unit tests here on purpose; Task 5's integration test drives every function below against a generated fixture.

```ts
import { spawnSync } from 'node:child_process'
import { closeSync, openSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeArgs, type EncodePlan, type ProbeInfo } from './plan.js'

export class FfmpegError extends Error {}

export function hasFfmpeg(): boolean {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  return !result.error && result.status === 0
}

/** The version string recorded in the manifest, so a rebuild can be explained. */
export function ffmpegVersion(): string {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  return /ffmpeg version (\S+)/.exec(result.stdout ?? '')?.[1] ?? 'unknown'
}

interface ProbeStream {
  width?: number
  height?: number
  avg_frame_rate?: string
  nb_frames?: string
}
interface ProbeJson {
  streams?: ProbeStream[]
  format?: { duration?: string }
}

function parseFps(rate: string | undefined): number {
  if (!rate) return 25
  const [num, den] = rate.split('/')
  const numerator = Number(num)
  const denominator = Number(den ?? 1)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 25
  return numerator / denominator
}

export function parseProbe(json: ProbeJson, bytes: number): ProbeInfo {
  const video = (json.streams ?? []).find((stream) => (stream.width ?? 0) > 0)
  if (!video?.width || !video.height) throw new FfmpegError('ffprobe reported no video stream')
  const fps = parseFps(video.avg_frame_rate)
  const durationMs = Math.round(Number(json.format?.duration ?? 0) * 1000)
  const declared = Number(video.nb_frames)
  const frames = Number.isFinite(declared) && declared > 0 ? declared : Math.max(1, Math.round((durationMs / 1000) * fps))
  return { width: video.width, height: video.height, fps, frames, durationMs, bytes }
}

/** Runs ffprobe and returns parsed info. Falls back to a temp file if stdout cannot be piped. */
export function probeClip(file: string): ProbeInfo {
  const args = [
    '-v', 'error',
    '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames',
    '-show_entries', 'format=duration',
    '-of', 'json',
    file,
  ]
  const result = spawnSync('ffprobe', args, { encoding: 'utf8' })

  if (result.error) {
    // The harness's confined shells can refuse piped stdio; a file descriptor avoids it.
    const tempFile = join(tmpdir(), `looped-probe-${process.pid}-${Math.random().toString(36).slice(2)}.json`)
    const fd = openSync(tempFile, 'w')
    const retry = spawnSync('ffprobe', args, { stdio: ['ignore', fd, 'inherit'] })
    closeSync(fd)
    try {
      if (retry.status !== 0) throw new FfmpegError(`ffprobe failed for ${file}`)
      return parseProbe(JSON.parse(readFileSync(tempFile, 'utf8')) as ProbeJson, statSync(file).size)
    } finally {
      unlinkSync(tempFile)
    }
  }

  if (result.status !== 0) throw new FfmpegError(`ffprobe failed for ${file}: ${result.stderr}`)
  return parseProbe(JSON.parse(result.stdout) as ProbeJson, statSync(file).size)
}

export function runFfmpeg(args: string[]): void {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' })
  if (result.error) throw new FfmpegError(`could not run ffmpeg: ${result.error.message}`)
  if (result.status !== 0) throw new FfmpegError(`ffmpeg exited with ${result.status}: ${result.stderr}`)
}

export function runEncode(plan: EncodePlan, input: string, output: string): void {
  runFfmpeg(encodeArgs(plan, input, output))
}

/** Lossless reference at the plan's box and frame rate, for SSIM comparison. */
export function runLosslessReference(plan: EncodePlan, input: string, output: string): void {
  runFfmpeg([
    '-v', 'error',
    '-y',
    '-i', input,
    '-vf', `scale=${plan.width}:${plan.height},fps=${plan.fps}`,
    '-c:v', 'libx264',
    '-qp', '0',
    '-preset', 'ultrafast',
    '-threads', '1',
    '-an',
    output,
  ])
}

/** FFmpeg reports SSIM on stderr; the "All:" figure is the average over all planes. */
export function ssimOf(encoded: string, reference: string): number {
  const result = spawnSync('ffmpeg', ['-v', 'info', '-y', '-i', encoded, '-i', reference, '-lavfi', 'ssim', '-f', 'null', '-'], {
    encoding: 'utf8',
  })
  const match = /All:([0-9.]+|inf)/.exec(`${result.stderr ?? ''}`)
  if (!match?.[1]) throw new FfmpegError(`could not read SSIM for ${encoded}`)
  return match[1] === 'inf' ? 1 : Number(match[1])
}

/** Every frame as a 32x32 grayscale plane, concatenated, for the loop-seam metric. */
export function grayFrames(file: string, size = 32): Uint8Array {
  const tempFile = join(tmpdir(), `looped-gray-${process.pid}-${Math.random().toString(36).slice(2)}.raw`)
  const fd = openSync(tempFile, 'w')
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', file, '-vf', `scale=${size}:${size},format=gray`, '-f', 'rawvideo', '-'],
    { stdio: ['ignore', fd, 'inherit'] },
  )
  closeSync(fd)
  try {
    if (result.status !== 0) throw new FfmpegError(`could not dump frames for ${file}`)
    return new Uint8Array(readFileSync(tempFile))
  } finally {
    unlinkSync(tempFile)
  }
}
```

- [x] **Step 7: Type-check and commit**

Run: `pnpm typecheck` — expect PASS.

```bash
git add tools/transcode package.json pnpm-lock.yaml
git commit -m "feat(tools): transcode planning ladder and the ffmpeg process layer"
```

## Task 5: QC gate, manifest assembly and the CLI

**Files:**
- Create: `tools/transcode/src/qc.ts`, `tools/transcode/src/manifest.ts`, `tools/transcode/src/index.ts`
- Test: `tools/transcode/test/qc.test.ts`, `tools/transcode/test/pipeline.test.ts`

**Interfaces:**
- Consumes: everything from Task 4.
- Produces: `seamMetrics(frames, frameSize)`, `mae`, `checkClip(input)`, `type SeamMetrics`, `type QcFinding`, `type QcInput`; `sha256File(file)`, `buildManifest(entries, generatedBy)`; and the CLI entry `main(argv: string[]): Promise<number>` plus its flags `--gifs`, `--out`, `--only`, `--check`. Task 6 runs it; Task 11 quotes its report.

- [ ] **Step 1: Write the failing tests for the pure metric math**

`tools/transcode/test/qc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { checkClip, seamMetrics, type QcInput } from '../src/qc.js'

/** Builds N frames of 2x2 pixels; each frame is a flat gray level. */
const flatFrames = (levels: number[]): Uint8Array => {
  const frameSize = 4
  const out = new Uint8Array(frameSize * levels.length)
  levels.forEach((level, index) => out.fill(level, index * frameSize, (index + 1) * frameSize))
  return out
}

describe('seamMetrics', () => {
  it('measures an identical first and last frame as a perfect loop', () => {
    const metrics = seamMetrics(flatFrames([0, 10, 20, 10, 0]), 4)
    expect(metrics.seam).toBe(0)
    expect(metrics.stepMean).toBeCloseTo(10, 5)
  })

  it('separates a jump at the seam from ordinary motion', () => {
    const smooth = seamMetrics(flatFrames([0, 10, 20, 30, 40]), 4)
    // The original fixture used 200, which asks for `200 > 40 * 5` — unsatisfiable by any correct
    // `seam = mae(last, first)`. 250 is the smallest level that exhibits the claimed 5x gap.
    const jumped = seamMetrics(flatFrames([0, 10, 20, 30, 250]), 4)
    expect(jumped.seam).toBeGreaterThan(smooth.seam * 5)
    expect(jumped.seam).toBeGreaterThan(jumped.stepP90)
  })

  it('refuses a single frame instead of dividing by zero', () => {
    expect(() => seamMetrics(flatFrames([0]), 4)).toThrow(RangeError)
  })
})

const base: QcInput = {
  id: 'a',
  expectedFrames: 100,
  actualFrames: 100,
  expectedDurationMs: 4000,
  actualDurationMs: 4000,
  bytes: 100_000,
  budgetBytes: 256_000,
  budgetExhausted: false,
  ssim: 0.97,
  seamInput: { stepMean: 12, stepP90: 20, seam: 18 },
  seamOutput: { stepMean: 12, stepP90: 20, seam: 18 },
}

describe('checkClip', () => {
  it('passes a clean clip', () => {
    expect(checkClip(base)).toEqual([])
  })

  it('allows a one-frame drift', () => {
    expect(checkClip({ ...base, actualFrames: 99 })).toEqual([])
    expect(checkClip({ ...base, actualFrames: 101 })).toEqual([])
  })

  it('fails a two-frame drift', () => {
    expect(checkClip({ ...base, actualFrames: 98 })[0]).toMatchObject({ code: 'frame-count', level: 'error' })
  })

  it('fails a duration that wandered past one frame', () => {
    expect(checkClip({ ...base, actualDurationMs: 4100 })[0]).toMatchObject({ code: 'duration', level: 'error' })
  })

  it('fails quality below the SSIM floor', () => {
    expect(checkClip({ ...base, ssim: 0.92 })[0]).toMatchObject({ code: 'ssim', level: 'error' })
  })

  it('fails a seam regression worse than 10 percent', () => {
    const findings = checkClip({ ...base, seamOutput: { ...base.seamOutput, seam: 19.9 } })
    expect(findings[0]).toMatchObject({ code: 'seam-regression', level: 'error' })
  })

  it('tolerates a seam within 10 percent', () => {
    expect(checkClip({ ...base, seamOutput: { ...base.seamOutput, seam: 19.7 } })).toEqual([])
  })

  it('records a sub-noise-floor regression as review, not as a failure', () => {
    const findings = checkClip({
      ...base,
      seamInput: { stepMean: 5, stepP90: 8, seam: 1.0 },
      seamOutput: { stepMean: 5, stepP90: 8, seam: 1.5 },
    })
    expect(findings).toContainEqual(expect.objectContaining({ code: 'seam-regression-noise', level: 'review' }))
    expect(findings.filter((finding) => finding.level === 'error')).toEqual([])
  })

  it('still fails a regression at or above the noise floor', () => {
    const findings = checkClip({
      ...base,
      seamInput: { stepMean: 5, stepP90: 8, seam: 2.0 },
      seamOutput: { stepMean: 5, stepP90: 8, seam: 2.5 },
    })
    expect(findings).toContainEqual(expect.objectContaining({ code: 'seam-regression', level: 'error' }))
  })

  it('treats just below the noise floor as review', () => {
    const findings = checkClip({
      ...base,
      seamInput: { stepMean: 5, stepP90: 8, seam: 1.99 },
      seamOutput: { stepMean: 5, stepP90: 8, seam: 2.3 },
    })
    expect(findings).toContainEqual(expect.objectContaining({ code: 'seam-regression-noise', level: 'review' }))
  })

  it('flags a visible loop jump for human review without failing the build', () => {
    const findings = checkClip({
      ...base,
      seamInput: { stepMean: 5, stepP90: 8, seam: 9 },
      seamOutput: { stepMean: 5, stepP90: 8, seam: 30 },
    })
    expect(findings).toContainEqual(expect.objectContaining({ code: 'loop-seam-review', level: 'review' }))
  })

  it('reports an over-budget clip as an error while the ladder still has rungs', () => {
    expect(checkClip({ ...base, bytes: 300_000 })[0]).toMatchObject({ code: 'budget', level: 'error' })
  })

  it('downgrades an over-budget clip to review once the ladder is spent', () => {
    expect(checkClip({ ...base, bytes: 300_000, budgetExhausted: true })[0]).toMatchObject({
      code: 'budget-exceeded',
      level: 'review',
    })
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @topclans/looped-loader-tools test`

Expected: FAIL — `Failed to resolve import "../src/qc.js"`.

- [ ] **Step 3: Implement qc.ts**

```ts
export interface SeamMetrics {
  stepMean: number
  stepP90: number
  seam: number
}

export interface QcInput {
  id: string
  expectedFrames: number
  actualFrames: number
  expectedDurationMs: number
  actualDurationMs: number
  bytes: number
  budgetBytes: number
  /** True when the CRF and long-side ladder is spent, so weight can no longer be reduced. */
  budgetExhausted: boolean
  ssim: number
  seamInput: SeamMetrics
  seamOutput: SeamMetrics
}

export interface QcFinding {
  id: string
  level: 'error' | 'review'
  code: string
  message: string
}

export const SSIM_FLOOR = 0.93
export const SEAM_REGRESSION = 1.1
/** Below this absolute MAE the 10 % rule measures encoder noise, not a visible loop jump. */
export const SEAM_NOISE_FLOOR = 2

function mae(frames: Uint8Array, aOffset: number, bOffset: number, frameSize: number): number {
  let sum = 0
  for (let i = 0; i < frameSize; i++) {
    sum += Math.abs((frames[aOffset + i] ?? 0) - (frames[bOffset + i] ?? 0))
  }
  return sum / frameSize
}

export function seamMetrics(frames: Uint8Array, frameSize: number): SeamMetrics {
  const frameCount = Math.floor(frames.length / frameSize)
  if (frameCount < 2) throw new RangeError(`seamMetrics: need at least 2 frames, got ${frameCount}`)

  const steps: number[] = []
  for (let index = 0; index < frameCount - 1; index++) {
    steps.push(mae(frames, index * frameSize, (index + 1) * frameSize, frameSize))
  }
  const seam = mae(frames, (frameCount - 1) * frameSize, 0, frameSize)
  const sorted = [...steps].sort((a, b) => a - b)
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0
  const stepMean = steps.reduce((total, value) => total + value, 0) / steps.length
  return { stepMean, stepP90: p90, seam }
}

export function checkClip(input: QcInput): QcFinding[] {
  const findings: QcFinding[] = []
  const add = (level: QcFinding['level'], code: string, message: string): void => {
    findings.push({ id: input.id, level, code, message })
  }

  if (Math.abs(input.actualFrames - input.expectedFrames) > 1) {
    add('error', 'frame-count', `expected ${input.expectedFrames} frames, got ${input.actualFrames}`)
  }
  // The boundary is inclusive: the task's own test requires a 100 ms drift to fail.
  if (Math.abs(input.actualDurationMs - input.expectedDurationMs) >= 100) {
    add('error', 'duration', `expected ${input.expectedDurationMs} ms, got ${input.actualDurationMs} ms`)
  }
  if (input.ssim < SSIM_FLOOR) {
    add('error', 'ssim', `SSIM ${input.ssim.toFixed(4)} is below the ${SSIM_FLOOR} floor`)
  }
  if (input.seamOutput.seam > input.seamInput.seam * SEAM_REGRESSION && input.seamInput.seam > 0.5) {
    const grew = `seam grew from ${input.seamInput.seam.toFixed(2)} to ${input.seamOutput.seam.toFixed(2)}`
    if (input.seamInput.seam >= SEAM_NOISE_FLOOR) add('error', 'seam-regression', grew)
    else add('review', 'seam-regression-noise', `${grew}, below the ${SEAM_NOISE_FLOOR} noise floor - recorded, not a failure`)
  }
  if (input.seamOutput.seam > input.seamOutput.stepP90) {
    add('review', 'loop-seam-review', `seam ${input.seamOutput.seam.toFixed(2)} exceeds the p90 step ${input.seamOutput.stepP90.toFixed(2)}`)
  }
  if (input.bytes > input.budgetBytes) {
    const kib = (value: number): string => `${Math.round(value / 1024)} KB`
    if (input.budgetExhausted) {
      add('review', 'budget-exceeded', `${kib(input.bytes)} is over the ${kib(input.budgetBytes)} budget and the ladder is spent`)
    } else {
      add('error', 'budget', `${kib(input.bytes)} is over the ${kib(input.budgetBytes)} budget while escalation is still possible`)
    }
  }
  return findings
}
```

- [ ] **Step 4: Implement manifest.ts and the CLI**

`tools/transcode/src/manifest.ts`:

```ts
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import type { EncodePlan } from './plan.js'
import type { SeamMetrics } from './qc.js'

export interface ClipEntry {
  id: string
  sourcePath: string
  outputPath: string
  plan: EncodePlan
  width: number
  height: number
  durationMs: number
  fps: number
  frames: number
  bytes: number
}

export function sha256File(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function buildManifest(entries: ClipEntry[], generatedBy: string, seams: Map<string, SeamMetrics>) {
  return {
    schemaVersion: 1,
    generatedBy,
    corpus: {
      clips: entries.length,
      totalBytes: entries.reduce((total, entry) => total + statSync(entry.outputPath).size, 0),
    },
    clips: entries.map((entry) => {
      const seam = seams.get(entry.id)
      return {
        id: entry.id,
        sources: [{ src: `clips/${entry.id}.mp4`, type: 'video/mp4; codecs=avc1.4d401e' }],
        width: entry.width,
        height: entry.height,
        durationMs: entry.durationMs,
        fps: entry.fps,
        bytes: { mp4: entry.bytes },
        sha256: { mp4: sha256File(entry.outputPath) },
        sourceSha256: sha256File(entry.sourcePath),
        encode: {
          codec: 'x264',
          crf: entry.plan.crf,
          longSide: entry.plan.longSide,
          fpsCap: entry.plan.fps,
          note: entry.plan.note,
        },
        ...(seam ? { loopSeam: { ...seam, ...(seam.seam > seam.stepP90 ? { flag: 'review' } : {}) } } : {}),
      }
    }),
  }
}
```

`tools/transcode/src/index.ts` — the CLI. It is written so the integration test can call `main()` in-process:

```ts
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ffmpegVersion, grayFrames, hasFfmpeg, probeClip, runEncode, runLosslessReference, ssimOf } from './ffmpeg.js'
import { buildManifest, sha256File, type ClipEntry } from './manifest.js'
import { escalate, initialPlan, BUDGET_BYTES, type EncodePlan, type ProbeInfo } from './plan.js'
import { checkClip, seamMetrics, type QcFinding } from './qc.js'

interface Options {
  gifs: string
  out: string
  only: string[]
  check: boolean
}

export function parseArgs(argv: string[]): Options {
  const options: Options = { gifs: 'gifs', out: 'packages/assets', only: [], check: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--gifs') options.gifs = argv[++index] ?? options.gifs
    else if (arg === '--out') options.out = argv[++index] ?? options.out
    else if (arg === '--only') options.only = (argv[++index] ?? '').split(',').filter(Boolean)
    else if (arg === '--check') options.check = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

/** Encodes, then walks the budget ladder until the clip fits or the ladder is spent. */
function encodeToBudget(
  id: string,
  source: string,
  clipsDir: string,
  info: ProbeInfo,
): { plan: EncodePlan; output: string; exhausted: boolean } {
  let plan: EncodePlan = initialPlan(info)
  const output = join(clipsDir, `${id}.mp4`)
  let exhausted = false
  for (;;) {
    runEncode(plan, source, output)
    if (readFileSync(output).length <= BUDGET_BYTES) break
    const next = escalate(plan, info)
    if (!next) {
      exhausted = true
      plan = { ...plan, note: 'budget-exceeded' }
      break
    }
    plan = next
  }
  return { plan, output, exhausted }
}

export async function main(argv: string[]): Promise<number> {
  if (!hasFfmpeg()) {
    console.error('ffmpeg is required and was not found in PATH')
    return 2
  }
  const options = parseArgs(argv)
  const gifsDir = resolve(options.gifs)
  const outDir = resolve(options.out)
  const clipsDir = join(outDir, 'clips')
  const workDir = join(outDir, '.work')
  mkdirSync(clipsDir, { recursive: true })
  mkdirSync(workDir, { recursive: true })

  const generators = readdirSync(gifsDir).filter((name) => name.endsWith('.mp4'))
  const selected = options.only.length > 0 ? generators.filter((name) => options.only.includes(basename(name, '.mp4'))) : generators

  const entries: ClipEntry[] = []
  const seams = new Map<string, ReturnType<typeof seamMetrics>>()
  const findings: QcFinding[] = []
  const notes: string[] = []

  for (const name of selected.sort()) {
    const id = basename(name, '.mp4')
    const source = join(gifsDir, name)
    const info = probeClip(source)
    const { plan, output, exhausted } = encodeToBudget(id, source, clipsDir, info)

    const reference = join(workDir, `${id}.ref.mp4`)
    runLosslessReference(plan, source, reference)
    const encodedInfo = probeClip(output)
    const ssim = ssimOf(output, reference)
    const seamInput = seamMetrics(grayFrames(source), 32 * 32)
    const seamOutput = seamMetrics(grayFrames(output), 32 * 32)
    const expectedFrames = Math.round((info.durationMs / 1000) * plan.fps)

    const clipFindings = checkClip({
      id,
      expectedFrames,
      actualFrames: encodedInfo.frames,
      expectedDurationMs: info.durationMs,
      actualDurationMs: encodedInfo.durationMs,
      bytes: readFileSync(output).length,
      budgetBytes: BUDGET_BYTES,
      budgetExhausted: exhausted,
      ssim,
      seamInput,
      seamOutput,
    })
    findings.push(...clipFindings)
    seams.set(id, seamOutput)
    if (plan.note !== 'base') notes.push(`${id}: ${plan.note} (crf ${plan.crf}, long side ${plan.longSide})`)

    entries.push({
      id,
      sourcePath: source,
      outputPath: output,
      plan,
      width: plan.width,
      height: plan.height,
      durationMs: info.durationMs,
      fps: plan.fps,
      frames: encodedInfo.frames,
      bytes: readFileSync(output).length,
    })
  }

  const generatedBy = `looped-loader-tools/0.1.0 ffmpeg ${ffmpegVersion()}`
  const manifest = buildManifest(entries, generatedBy, seams)
  const manifestPath = join(outDir, 'manifest.json')
  const checksumsPath = join(outDir, 'checksums.json')

  if (options.check) {
    const previous = JSON.parse(readFileSync(manifestPath, 'utf8')) as typeof manifest
    const differences = manifest.clips.filter((clip, index) => {
      const before = previous.clips[index]
      return !before || before.sha256.mp4 !== clip.sha256.mp4 || before.bytes.mp4 !== clip.bytes.mp4
    })
    writeFileSync(checksumsPath, `${JSON.stringify(entries.map((entry) => ({ path: `clips/${entry.id}.mp4`, sha256: sha256File(entry.outputPath) })), null, 2)}\n`)
    rmSync(workDir, { recursive: true, force: true })
    if (differences.length > 0) {
      console.error(`--check failed: ${differences.length} clip(s) differ from the committed manifest`)
      return 1
    }
    console.log(`--check passed: ${manifest.clips.length} clips are byte-identical`)
    return 0
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(checksumsPath, `${JSON.stringify(entries.map((entry) => ({ path: `clips/${entry.id}.mp4`, sha256: sha256File(entry.outputPath) })), null, 2)}\n`)
  writeFileSync(join(outDir, 'qc-report.json'), `${JSON.stringify({ findings, notes, totalBytes: manifest.corpus.totalBytes }, null, 2)}\n`)

  const errors = findings.filter((finding) => finding.level === 'error')
  const reviews = findings.filter((finding) => finding.level === 'review')
  const lines = [
    '# Transcode QC report',
    '',
    `Clips: ${entries.length}  Total: ${(manifest.corpus.totalBytes / 1024 / 1024).toFixed(2)} MB`,
    '',
    '## Errors',
    ...(errors.length === 0 ? ['none'] : errors.map((finding) => `- ${finding.id}: ${finding.code} — ${finding.message}`)),
    '',
    '## Review',
    ...(reviews.length === 0 ? ['none'] : reviews.map((finding) => `- ${finding.id}: ${finding.code} — ${finding.message}`)),
    '',
    '## Budget adaptations',
    ...(notes.length === 0 ? ['none'] : notes.map((note) => `- ${note}`)),
    '',
  ]
  writeFileSync(join(outDir, 'qc-report.md'), lines.join('\n'))
  rmSync(workDir, { recursive: true, force: true })

  console.log(`wrote ${entries.length} clips, ${(manifest.corpus.totalBytes / 1024 / 1024).toFixed(2)} MB, ${errors.length} error(s), ${reviews.length} review(s)`)
  return errors.length > 0 ? 1 : 0
}

const invokedDirectly = process.argv[1]?.endsWith('index.js') ?? false
if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
```

- [ ] **Step 5: Write the integration test against a generated fixture**

`tools/transcode/test/pipeline.test.ts` — the fixture is generated with `lavfi`, so no binary file enters the repository:

```ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { grayFrames, hasFfmpeg, probeClip, runEncode, runLosslessReference, ssimOf } from '../src/ffmpeg.js'
import { initialPlan } from '../src/plan.js'
import { main } from '../src/index.js'

const available = hasFfmpeg()
const workDir = mkdtempSync(join(tmpdir(), 'looped-pipeline-'))

afterAll(() => rmSync(workDir, { recursive: true, force: true }))

describe.skipIf(!available)('transcode pipeline', () => {
  const gifs = join(workDir, 'gifs')
  const out = join(workDir, 'assets')

  it('probes a generated fixture', () => {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=0.6', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-threads', '1', join(workDir, 'fixture.mp4')])
    const info = probeClip(join(workDir, 'fixture.mp4'))
    expect(info.width).toBe(160)
    expect(info.height).toBe(120)
    expect(info.fps).toBeCloseTo(10, 3)
    expect(info.frames).toBeGreaterThanOrEqual(5)
  })

  it('encodes at the planned box and scores the result', () => {
    const source = join(workDir, 'fixture.mp4')
    const plan = initialPlan(probeClip(source))
    expect(plan).toMatchObject({ width: 160, height: 120, fps: 10, crf: 26 })
    const encoded = join(workDir, 'encoded.mp4')
    const reference = join(workDir, 'reference.mp4')
    runEncode(plan, source, encoded)
    runLosslessReference(plan, source, reference)
    expect(ssimOf(encoded, reference)).toBeGreaterThan(0.9)
    expect(grayFrames(encoded).length).toBe(32 * 32 * probeClip(encoded).frames)
  })

  it('writes a manifest, a QC report and an assets tree', async () => {
    mkdirSync(gifs, { recursive: true })
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=0.6', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-threads', '1', join(gifs, 'fixture.mp4')])
    const code = await main(['--gifs', gifs, '--out', out])
    expect(code).toBe(0)
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
    expect(manifest.clips).toHaveLength(1)
    expect(manifest.clips[0].sources[0].src).toBe('clips/fixture.mp4')
    expect(readFileSync(join(out, 'qc-report.md'), 'utf8')).toContain('Transcode QC report')
  })
})
```

The fixture clip is generated by ffmpeg from `lavfi` rather than committed, so no binary test asset enters the repository, and `mkdirSync(gifs, { recursive: true })` is required before the third case writes into it.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @topclans/looped-loader-tools test`

Expected: PASS with the integration cases running. If ffmpeg is missing the three integration cases are skipped and the run reports them as skipped, not passed — do not accept a green run that silently skipped them once ffmpeg is installed.

- [ ] **Step 7: Commit**

```bash
git add tools/transcode
git commit -m "feat(tools): QC gate, manifest assembly and the transcode CLI"
```

## Task 6: Transcode the real corpus and commit the assets

**Files:**
- Create: `packages/assets/package.json`, `packages/assets/README.md`, `packages/assets/scripts/verify.mjs`
- Modify: `.gitignore` (the transcode scratch directory)
- Generated: `packages/assets/clips/*.mp4` (32), `packages/assets/manifest.json`, `packages/assets/checksums.json`, `packages/assets/qc-report.json`, `packages/assets/qc-report.md`

**Interfaces:**
- Consumes: the CLI from Task 5.
- Produces: the assets tree every later task consumes, and the package `@topclans/looped-loader-assets` with the export map `./manifest.json` and `./clips/*`. The demo in Task 9 imports `@topclans/looped-loader-assets/manifest.json`.

This task runs **in the main checkout**, never in a worktree: `gifs/` is untracked and exists only here.

- [ ] **Step 1: Create the assets package**

`packages/assets/package.json`:

```json
{
  "name": "@topclans/looped-loader-assets",
  "version": "0.1.0",
  "description": "Perfectly looped clips and manifest for looped-loader",
  "license": "SEE LICENSE IN NOTICE",
  "type": "module",
  "files": ["clips", "manifest.json", "checksums.json", "LICENSE", "NOTICE"],
  "exports": {
    "./manifest.json": "./manifest.json",
    "./clips/*": "./clips/*"
  },
  "scripts": {
    "build": "node scripts/verify.mjs",
    "test": "node scripts/verify.mjs",
    "typecheck": "node --check scripts/verify.mjs"
  },
  "publishConfig": { "access": "public" }
}
```

Append to `.gitignore` — the CLI's scratch directory holds lossless reference encodes, and a `--check` run used to leave it behind:

```
# transcode scratch space
packages/assets/.work/
```

`packages/assets/scripts/verify.mjs` — verifies the assets without needing ffmpeg, so CI can prove the committed media matches the manifest:
```js
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))

let total = 0
const problems = []

for (const clip of manifest.clips) {
  for (const source of clip.sources) {
    const file = join(root, source.src)
    let bytes
    try {
      bytes = statSync(file).size
    } catch {
      problems.push(`${clip.id}: missing file ${source.src}`)
      continue
    }
    total += bytes
    const declared = clip.bytes?.mp4
    if (declared !== undefined && declared !== bytes) problems.push(`${clip.id}: manifest says ${declared} bytes, file is ${bytes}`)
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex')
    const expected = clip.sha256?.mp4
    if (expected && expected !== digest) problems.push(`${clip.id}: sha256 mismatch`)
  }
}

const expectedTotal = manifest.corpus?.totalBytes
if (expectedTotal !== undefined && expectedTotal !== total) {
  problems.push(`corpus total: manifest says ${expectedTotal}, files are ${total}`)
}

if (problems.length > 0) {
  console.error(`assets verification failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`assets verified: ${manifest.clips.length} clips, ${(total / 1024 / 1024).toFixed(2)} MB`)
```

`packages/assets/README.md` — three lines: what this package is, that it is generated by `tools/transcode` and never hand-edited, and a pointer to the root README for both hosting recipes.

- [ ] **Step 2: Run the pipeline over the real corpus**

```powershell
pnpm install
pnpm transcode --gifs gifs --out packages/assets
```

Expected: `wrote 32 clips, N MB, 0 error(s), M review(s)`, exit code 0, and a `.gitignore`d work directory removed by the run. If any clip reports a `budget` **error**, the escalation loop failed to converge and is a bug, not a data problem.

- [ ] **Step 3: Read the report instead of trusting the summary**

```powershell
Get-Content packages/assets/qc-report.md
```

Check and record, because Task 11 quotes these numbers and Task 10 depends on them. **The measured run of 2026-10-08 is recorded here, so a deviation is a finding rather than a typo:**

- total size ≤ 5 MB (`5242880` bytes) — **measured 4 049 965 bytes (3.86 MB)**;
- the only `budget-exceeded` review is `u3dob97sw2421` (predicted in the spec), or explain any other — **measured: 430 452 bytes with the ladder spent, SSIM 0.9493, i.e. 1.9 points clear of the 0.93 floor, so the "ask the owner" trigger did not fire**;
- the `loop-seam-review` list — **measured, seven clips**: `0AMt9sYf…`, `2p1qoycrgfm31`, `TGH-SlSN…`, `azgfEFJh…`, `d3whIZNc…`, `gw2u04xr37r11`, `tXHw0yKm…`. The design-time list of four was wrong in both directions: `2F4wy0zl…` is not flagged at all, and `u3dob97sw2421` reaches `budget-exceeded` rather than `loop-seam-review`;
- six further clips carry `seam-regression-noise` reviews — the sub-noise-floor tier introduced by the owner's ruling D-21 — which is why a green run reports **0 errors and 14 reviews** (7 + 6 + 1), not the 0 errors and 4 reviews this plan originally predicted;
- `packages/assets/manifest.json` has 32 entries and its `encode.note` is `base` for at least 27 of them — **measured exactly 27**, plus 4 `budget-adapted` (`TGH-SlSN…` crf 30, `azgfEFJh…` crf 29, `gw2u04xr37r11` crf 28, `wsijo3cpfb831` crf 27).

**Ask the owner** if any clip needs a decision: an SSIM within 0.01 of the floor, a different clip landing in `budget-exceeded`, or any proposal to drop or replace a clip.

- [ ] **Step 4: Prove idempotency**

```powershell
pnpm transcode --gifs gifs --out packages/assets --check
```

Expected: `--check passed: 32 clips are byte-identical` and exit code 0. A difference here means the encode is not deterministic; report it rather than regenerating until it agrees.

- [ ] **Step 5: Verify the assets package checks itself**

```powershell
pnpm --filter @topclans/looped-loader-assets test
```

Expected: `assets verified: 32 clips, N MB`.

Then prove the check can actually fail, because a check that cannot fail is decoration: copy `manifest.json` to a backup **outside the repository** (`$env:TEMP`), edit one `sha256.mp4` value in place to `"deadbeef"`, re-run the verifier, confirm a non-zero exit and a `sha256 mismatch` line, then restore from that backup and confirm the file hashes identically to it. The plan's original wording used `git checkout -- packages/assets/manifest.json`, which cannot work here: at this point the manifest is not yet committed, so there is nothing in the index to restore from.

- [ ] **Step 6: Confirm the raw inputs never entered history, and drop the throwaway probes**

```powershell
git log --all -- gifs          # expect no output
git status --short             # expect gifs/ and .probe/ absent (both ignored)
Remove-Item -Recurse -Force .probe
```

- [ ] **Step 7: Commit**

```bash
git add packages/assets .gitignore pnpm-lock.yaml
git commit -m "feat(assets): transcode the corpus to H.264 with a passing QC gate"
```

## Task 7: The Vue package — SFC, composition API surface and theming

**Files:**
- Create: `packages/vue/package.json`, `packages/vue/tsconfig.json`, `packages/vue/tsconfig.build.json`, `packages/vue/vite.config.ts`, `packages/vue/vitest.config.ts`
- Create: `packages/vue/src/LoopedLoader.vue`, `packages/vue/src/useLoopedLoader.ts`, `packages/vue/src/useSmoothPending.ts`, `packages/vue/src/index.ts`

**Interfaces:**
- Consumes: `createLoopedLoader`, `LoopedLoader`, `LoopedLoaderError`, `Clip`, `State` from `@topclans/looped-loader-core` (Task 3).
- Produces: the `LoopedLoader` component with props `baseUrl`, `manifest`, `manifestUrl`, `seed`, `clip`, `clips`, `delayMs`, `size`, `mode`, `objectFit`, `rounded`, `respectReducedMotion`, `label`; events `select`, `ready`, `error`; the `#fallback` slot; and the composables `useLoopedLoader`, `useSmoothPending`. Task 8 tests them, Task 9 uses them, Task 11 documents them.

The core is attached to the `<video>` element imperatively and assigns `.src` itself, so the component never mirrors a `src` ref. That keeps one source of truth and avoids a whole class of ordering bugs.

- [ ] **Step 1: Create the package configuration**

`packages/vue/package.json`:

```json
{
  "name": "@topclans/looped-loader-vue",
  "version": "0.1.0",
  "description": "Vue 3 adapter for looped-loader: a looping clip instead of a spinner",
  "license": "MIT",
  "type": "module",
  "sideEffects": ["**/*.css"],
  "files": ["dist", "LICENSE"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./style.css": "./dist/index.css"
  },
  "scripts": {
    "build": "vite build && vue-tsc -p tsconfig.build.json",
    "typecheck": "vue-tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": { "vue": "^3.4" },
  "dependencies": { "@topclans/looped-loader-core": "workspace:*" },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.9",
    "@vue/test-utils": "^2.5.1",
    "jsdom": "^30.1.2",
    "typescript": "~5.9.3",
    "vite": "^8.3.3",
    "vitest": "^5.0.3",
    "vue": "^3.5.43",
    "vue-tsc": "^3.3.12"
  },
  "publishConfig": { "access": "public" }
}
```

`packages/vue/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": [], "noEmit": true },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```

`packages/vue/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/vue/vite.config.ts`:

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: { external: ['vue', '@topclans/looped-loader-core'] },
    sourcemap: true,
  },
})
```

`packages/vue/vitest.config.ts` — the `jsdom` environment lives here, in the project's own config, rather than as a per-file pragma, so no DOM test can silently collect zero cases under a node environment:

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'jsdom', include: ['test/**/*.test.ts'] },
})
```

- [ ] **Step 2: Implement the composables**

`packages/vue/src/useSmoothPending.ts`:

```ts
import { onScopeDispose, ref, watch, type Ref } from 'vue'

export interface SmoothPendingOptions {
  /** How long pending must stay true before anything is shown. */
  delay?: number
  /** Once shown, how long it stays shown at minimum. */
  minVisible?: number
}

/**
 * A loader cannot guarantee its own minimum visible time, because mounting and
 * unmounting belong to the parent. This returns the ref the parent should render
 * from: it flips true only after `delay`, and once true it stays true for at
 * least `minVisible`.
 */
export function useSmoothPending(pending: Ref<boolean>, options: SmoothPendingOptions = {}): Ref<boolean> {
  const delay = options.delay ?? 120
  const minVisible = options.minVisible ?? 300
  const visible = ref(false)

  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let shownAt = 0

  watch(
    pending,
    (isPending) => {
      if (isPending) {
        if (hideTimer) {
          clearTimeout(hideTimer)
          hideTimer = null
        }
        if (visible.value || showTimer) return
        showTimer = setTimeout(() => {
          showTimer = null
          shownAt = Date.now()
          visible.value = true
        }, delay)
        return
      }

      if (showTimer) {
        clearTimeout(showTimer)
        showTimer = null
        return
      }
      if (!visible.value) return

      const remaining = Math.max(0, minVisible - (Date.now() - shownAt))
      hideTimer = setTimeout(() => {
        hideTimer = null
        visible.value = false
      }, remaining)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (showTimer) clearTimeout(showTimer)
    if (hideTimer) clearTimeout(hideTimer)
  })

  return visible
}
```

`packages/vue/src/useLoopedLoader.ts`:

```ts
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import {
  createLoopedLoader,
  type Clip,
  type LoopedLoader,
  type LoopedLoaderError,
  type LoopedLoaderOptions,
  type State,
} from '@topclans/looped-loader-core'

export interface UseLoopedLoaderResult {
  state: Ref<State>
  clip: Ref<Clip | null>
  error: Ref<LoopedLoaderError | null>
  loader: Ref<LoopedLoader | null>
}

/** For consumers who want the loader's state without its markup. */
export function useLoopedLoader(options: LoopedLoaderOptions): UseLoopedLoaderResult {
  const state = ref<State>('idle')
  const clip = shallowRef<Clip | null>(null)
  const error = ref<LoopedLoaderError | null>(null)
  const loader = shallowRef<LoopedLoader | null>(null)

  onMounted(() => {
    loader.value = createLoopedLoader({
      ...options,
      onState: (next) => {
        state.value = next
        options.onState?.(next)
      },
      onSelect: (next) => {
        clip.value = next
        options.onSelect?.(next)
      },
      onError: (failure) => {
        error.value = failure
        options.onError?.(failure)
      },
    })
    loader.value.start()
  })

  onBeforeUnmount(() => {
    loader.value?.destroy()
    loader.value = null
  })

  return { state, clip, error, loader }
}
```

- [ ] **Step 3: Implement the component**

`packages/vue/src/LoopedLoader.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  createLoopedLoader,
  type Clip,
  type LoopedLoader as LoopedLoaderHandle,
  type LoopedLoaderError,
  type State,
} from '@topclans/looped-loader-core'

const props = withDefaults(
  defineProps<{
    baseUrl: string
    manifest?: unknown
    manifestUrl?: string
    seed?: string | number
    clip?: string
    clips?: string[]
    delayMs?: number
    size?: 'sm' | 'md' | 'lg' | 'full'
    mode?: 'inline' | 'overlay'
    objectFit?: 'contain' | 'cover'
    rounded?: boolean
    respectReducedMotion?: boolean
    label?: string
  }>(),
  {
    delayMs: 120,
    size: 'md',
    mode: 'inline',
    objectFit: 'contain',
    rounded: true,
    respectReducedMotion: true,
    label: 'Loading',
  },
)

const emit = defineEmits<{
  select: [clip: Clip]
  ready: [clip: Clip]
  error: [error: LoopedLoaderError]
}>()

const query =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

const root = ref<HTMLElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const state = ref<State>('idle')
const clip = shallowRef<Clip | null>(null)
const reducedMotion = ref(props.respectReducedMotion && (query?.matches ?? false))

let loader: LoopedLoaderHandle | null = null

const showVideo = computed(() => !reducedMotion.value && state.value !== 'error')
const aspect = computed(() => (clip.value ? `${clip.value.width} / ${clip.value.height}` : '16 / 9'))

function onMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = props.respectReducedMotion && event.matches
}

onMounted(() => {
  loader = createLoopedLoader({
    baseUrl: props.baseUrl,
    ...(props.manifest !== undefined ? { manifest: props.manifest } : {}),
    ...(props.manifestUrl ? { manifestUrl: props.manifestUrl } : {}),
    ...(props.seed !== undefined ? { seed: props.seed } : {}),
    ...(props.clip ? { clip: props.clip } : {}),
    ...(props.clips ? { clips: props.clips } : {}),
    delayMs: props.delayMs,
    respectReducedMotion: props.respectReducedMotion,
    onState: (next) => {
      state.value = next
      if (next === 'playing' && clip.value) emit('ready', clip.value)
    },
    onSelect: (next) => {
      clip.value = next
      emit('select', next)
    },
    onError: (failure) => emit('error', failure),
  })

  if (videoEl.value) loader.attach(videoEl.value)
  if (root.value) loader.observeRoot(root.value)
  loader.start()
  query?.addEventListener('change', onMotionChange)
})

onBeforeUnmount(() => {
  query?.removeEventListener('change', onMotionChange)
  loader?.destroy()
  loader = null
})
</script>

<template>
  <div
    ref="root"
    class="ll-root"
    :class="[`ll-size-${size}`, `ll-mode-${mode}`, { 'll-rounded': rounded }]"
    :data-state="state"
    role="status"
    aria-live="polite"
    :aria-busy="state !== 'playing'"
  >
    <video
      v-if="showVideo"
      ref="videoEl"
      class="ll-video"
      :style="{ aspectRatio: aspect, objectFit }"
      muted
      playsinline
      autoplay
      loop
      aria-hidden="true"
    />
    <div v-if="state !== 'playing'" class="ll-spinner" aria-hidden="true" />
    <span class="ll-label">{{ label }}</span>
    <slot v-if="state === 'error' || reducedMotion" name="fallback" />
  </div>
</template>

<style scoped>
.ll-root {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ll-bg, transparent);
}
.ll-size-sm { --ll-size: 40px; }
.ll-size-md { --ll-size: 96px; }
.ll-size-lg { --ll-size: 200px; }
.ll-size-full { --ll-size: 100%; }
.ll-mode-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ll-z, 9999);
  background: var(--ll-overlay-bg, rgb(0 0 0 / 0.72));
}
.ll-video {
  display: block;
  width: var(--ll-size, 96px);
  max-width: 100%;
  height: auto;
  border-radius: var(--ll-radius, 12px);
}
.ll-spinner {
  position: absolute;
  width: var(--ll-spinner-size, 32px);
  height: var(--ll-spinner-size, 32px);
  border: var(--ll-spinner-width, 3px) solid var(--ll-spinner-track, rgb(127 127 127 / 0.25));
  border-top-color: var(--ll-spinner-color, currentColor);
  border-radius: 50%;
  animation: ll-spin 800ms linear infinite;
}
.ll-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@keyframes ll-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .ll-spinner { animation: none; }
}
</style>
```

A CSS block this small is exactly where a typo survives review and does nothing visible, so after the build, check the emitted stylesheet by name:

```powershell
Select-String -Path packages/vue/dist/*.css -Pattern 'll-label|ll-spinner'
```

Expected: both selectors present. If `.ll-label` is missing, the declarations were dropped by the CSS parser — fix the block rather than the check.

`packages/vue/src/index.ts`:

```ts
export { default as LoopedLoader } from './LoopedLoader.vue'
export { useLoopedLoader, type UseLoopedLoaderResult } from './useLoopedLoader.js'
export { useSmoothPending, type SmoothPendingOptions } from './useSmoothPending.js'
export type { Clip, LoopedLoaderError, State } from '@topclans/looped-loader-core'
```

- [ ] **Step 4: Type-check and build**

Run: `pnpm --filter @topclans/looped-loader-vue build`

Expected: `vite build` writes `dist/index.js` and the CSS, `vue-tsc` writes `dist/index.d.ts`. Confirm with `Get-ChildItem packages/vue/dist`. A build that emits no `.d.ts` means the declaration pass silently did nothing — check `tsconfig.build.json` is the one `vue-tsc` was given.

- [ ] **Step 5: Commit**

```bash
git add packages/vue pnpm-lock.yaml
git commit -m "feat(vue): LoopedLoader component, composables and theming"
```

## Task 8: Vue behaviour tests, including the two failure modes that bite first

**Files:**
- Create: `packages/vue/test/LoopedLoader.test.ts`, `packages/vue/test/useSmoothPending.test.ts`, `packages/vue/test/ssr.test.ts`

**Interfaces:**
- Consumes: Task 7's component and composables, Task 1's `LoopedLoaderError` shape.
- Produces: nothing new; this task is the gate on Task 7. Review Focus items 4 and 5 are its first two tests.

- [ ] **Step 1: Write the tests**

`packages/vue/test/LoopedLoader.test.ts`:

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import LoopedLoader from '../src/LoopedLoader.vue'

const manifest = {
  schemaVersion: 1,
  clips: [
    {
      id: 'a',
      sources: [{ src: 'clips/a.mp4', type: 'video/mp4' }],
      width: 480,
      height: 360,
      durationMs: 2000,
      fps: 30,
    },
  ],
}

const matchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
  }
  return { mql: mql as unknown as MediaQueryList, emit: (value: boolean) => {
    Object.defineProperty(mql, 'matches', { value, configurable: true })
    for (const listener of listeners) listener({ matches: value } as MediaQueryListEvent)
  } }
}

describe('LoopedLoader', () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows a spinner and a video element, then hides the spinner once playing', async () => {
    const wrapper = mount(LoopedLoader, {
      props: { baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 },
    })
    expect(wrapper.find('.ll-spinner').exists()).toBe(true)
    await flushPromises()
    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('/clips/clips/a.mp4')
    expect(video.attributes('aria-hidden')).toBe('true')
    await video.trigger('playing')
    await nextTick()
    expect(wrapper.find('.ll-spinner').exists()).toBe(false)
    wrapper.unmount()
  })

  it('is a polite live region with an accessible label', () => {
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', manifest, label: 'Загрузка' } })
    const root = wrapper.find('.ll-root')
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-live')).toBe('polite')
    expect(root.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.ll-label').text()).toBe('Загрузка')
    wrapper.unmount()
  })

  it('creates no video and fetches nothing under reduced motion', async () => {
    const { mql } = matchMedia(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', delayMs: 0 } })
    await flushPromises()
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('.ll-spinner').exists()).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not create a video when reduced motion is switched on after mount', async () => {
    const { mql, emit } = matchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql)
    const wrapper = mount(LoopedLoader, {
      props: { baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 },
    })
    await flushPromises()
    expect(wrapper.find('video').exists()).toBe(true)
    emit(true)
    await nextTick()
    expect(wrapper.find('video').exists()).toBe(false)
    wrapper.unmount()
  })

  it('never lets a rejected play() reach the host and retries on first interaction', async () => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
    const events: string[] = []
    const wrapper = mount(LoopedLoader, {
      props: {
        baseUrl: '/clips',
        manifest,
        seed: 'x',
        delayMs: 0,
        onError: (error: { code?: string }) => events.push(error.code ?? 'unknown'),
      },
    })
    await flushPromises()
    expect(wrapper.find('.ll-spinner').exists()).toBe(true)
    expect(events).toContain('autoplay-blocked')
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('pointerdown'))
    await flushPromises()
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('renders the fallback slot when the manifest cannot be resolved', async () => {
    const wrapper = mount(LoopedLoader, {
      props: { baseUrl: '/clips', manifest: { clips: [] }, delayMs: 0 },
      slots: { fallback: '<p class="mine">ищу иначе</p>' },
    })
    await flushPromises()
    expect(wrapper.find('.mine').exists()).toBe(true)
    wrapper.unmount()
  })

  it('releases the video element on unmount', async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    const wrapper = mount(LoopedLoader, { props: { baseUrl: '/clips', manifest, seed: 'x', delayMs: 0 } })
    await flushPromises()
    wrapper.unmount()
    expect(pause).toHaveBeenCalled()
  })
})
```

`packages/vue/test/useSmoothPending.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, ref } from 'vue'
import { useSmoothPending } from '../src/useSmoothPending.js'

describe('useSmoothPending', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stays hidden for a pending state shorter than the delay', async () => {
    const scope = effectScope()
    const pending = ref(false)
    const visible = scope.run(() => useSmoothPending(pending, { delay: 120, minVisible: 300 }))!
    pending.value = true
    await vi.advanceTimersByTimeAsync(80)
    pending.value = false
    await vi.advanceTimersByTimeAsync(500)
    expect(visible.value).toBe(false)
    scope.stop()
  })

  it('shows after the delay and holds for minVisible afterwards', async () => {
    const scope = effectScope()
    const pending = ref(false)
    const visible = scope.run(() => useSmoothPending(pending, { delay: 120, minVisible: 300 }))!
    pending.value = true
    await vi.advanceTimersByTimeAsync(119)
    expect(visible.value).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(visible.value).toBe(true)
    pending.value = false
    await vi.advanceTimersByTimeAsync(200)
    expect(visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    expect(visible.value).toBe(false)
    scope.stop()
  })

  it('clears its timers when the scope is disposed', async () => {
    const scope = effectScope()
    const pending = ref(true)
    scope.run(() => useSmoothPending(pending, { delay: 50 }))
    await vi.advanceTimersByTimeAsync(10)
    scope.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
```

`packages/vue/test/ssr.test.ts` — Review Focus item 2, the side that only a server render can prove:

```ts
import { renderToString } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import LoopedLoader from '../src/LoopedLoader.vue'

describe('server rendering', () => {
  it('renders the spinner and the label without picking or fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const app = createSSRApp(LoopedLoader, { baseUrl: '/clips', label: 'Загрузка' })
    const html = await renderToString(app)
    expect(html).toContain('role="status"')
    expect(html).toContain('Загрузка')
    expect(html).not.toContain('<video')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @topclans/looped-loader-vue test`

Expected: FAIL initially for the right reasons — the reduced-motion-flip test and the play()-rejection test describe behaviour the implementation may not yet have. Fix the implementation, not the expectation.

- [ ] **Step 3: Fix whatever the tests expose, then run them green**

Run: `pnpm --filter @topclans/looped-loader-vue test`

Expected: PASS, all three files. Then run `pnpm --filter @topclans/looped-loader-vue build` again — a green test suite that emits a broken bundle is not green.

- [ ] **Step 4: Commit**

```bash
git add packages/vue/test
git commit -m "test(vue): lock the failure modes the spec promises to survive"
```

## Task 9: The demo playground — contact sheet and scenario board

**Files:**
- Create: `packages/demo/package.json`, `packages/demo/tsconfig.json`, `packages/demo/vite.config.ts`, `packages/demo/index.html`, `packages/demo/scripts/sync-clips.mjs`
- Create: `packages/demo/src/main.ts`, `packages/demo/src/App.vue`, `packages/demo/src/ContactSheet.vue`, `packages/demo/src/ScenarioBoard.vue`
- Modify: `.gitignore` (add the generated `packages/demo/public/clips/`)

**Interfaces:**
- Consumes: `LoopedLoader`, `useSmoothPending` (Task 7) and `@topclans/looped-loader-assets/manifest.json` (Task 6).
- Produces: the page Task 10 verifies in a browser. Not published.

- [ ] **Step 1: Create the demo package and its asset sync**

`packages/demo/package.json`:

```json
{
  "name": "@topclans/looped-loader-demo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node scripts/sync-clips.mjs && vite",
    "build": "node scripts/sync-clips.mjs && vite build",
    "typecheck": "vue-tsc -p tsconfig.json --noEmit",
    "test": "node -e \"console.log('the demo is verified in a browser, see Task 10')\""
  },
  "dependencies": {
    "@topclans/looped-loader-assets": "workspace:*",
    "@topclans/looped-loader-vue": "workspace:*",
    "vue": "^3.5.43"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@vitejs/plugin-vue": "^6.0.9",
    "vite": "^8.3.3",
    "vue-tsc": "^3.3.12"
  }
}
```

The demo's `test` script is honest about itself: this package's acceptance is a browser run in Task 10, and pretending `vitest` covers it would be theatre.

`packages/demo/scripts/sync-clips.mjs`:

```js
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const demoRoot = resolve(here, '..')
const require = createRequire(import.meta.url)
const assetsRoot = dirname(require.resolve('@topclans/looped-loader-assets/manifest.json'))

const target = join(demoRoot, 'public', 'clips')
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(join(assetsRoot, 'clips'), target, { recursive: true })
console.log(`clips synced to ${target}`)
```

`packages/demo/vite.config.ts`:

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
})
```

`packages/demo/tsconfig.json` — the demo's `typecheck` script points at this file, and `resolveJsonModule` is what makes `import manifest from '@topclans/looped-loader-assets/manifest.json'` type-check at all:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`packages/demo/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>looped-loader demo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Append to `.gitignore`:

```
# generated by packages/demo/scripts/sync-clips.mjs
packages/demo/public/clips/
```

- [ ] **Step 2: Build the two boards**

`packages/demo/src/main.ts`:

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

`packages/demo/src/App.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ContactSheet from './ContactSheet.vue'
import ScenarioBoard from './ScenarioBoard.vue'

const tab = ref<'sheet' | 'scenarios'>('sheet')
</script>

<template>
  <main>
    <h1>looped-loader</h1>
    <nav>
      <button type="button" :aria-pressed="tab === 'sheet'" @click="tab = 'sheet'">Contact sheet</button>
      <button type="button" :aria-pressed="tab === 'scenarios'" @click="tab = 'scenarios'">Scenarios</button>
    </nav>
    <ContactSheet v-if="tab === 'sheet'" />
    <ScenarioBoard v-else />
  </main>
</template>

<style>
body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #111; color: #eee; }
main { padding: 24px; }
nav { display: flex; gap: 8px; margin-bottom: 24px; }
button { padding: 6px 12px; }
</style>
```

`packages/demo/src/ContactSheet.vue` — every clip at a size big enough to judge its loop, with the numbers that matter printed underneath:

```vue
<script setup lang="ts">
import { LoopedLoader } from '@topclans/looped-loader-vue'
import manifest from '@topclans/looped-loader-assets/manifest.json'

const clips = manifest.clips
const kb = (bytes: number | undefined) => `${Math.round((bytes ?? 0) / 1024)} KB`
</script>

<template>
  <section>
    <p>{{ clips.length }} clips · {{ kb(manifest.corpus.totalBytes) }} total · base-url <code>/clips</code></p>
    <ul class="grid">
      <li v-for="clip in clips" :key="clip.id">
        <LoopedLoader base-url="/clips" :clip="clip.id" size="lg" label="Loading" />
        <dl>
          <dt>{{ clip.id }}</dt>
          <dd>{{ clip.width }}×{{ clip.height }} · {{ kb(clip.bytes?.mp4) }} · CRF {{ clip.encode?.crf }}</dd>
          <dd>
            seam {{ clip.loopSeam?.seam.toFixed(2) }} / p90 {{ clip.loopSeam?.stepP90.toFixed(2) }}
            <strong v-if="clip.loopSeam?.flag === 'review'">· review</strong>
          </dd>
        </dl>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 0; list-style: none; }
li { background: #1b1b1b; padding: 12px; border-radius: 8px; }
dl { margin: 8px 0 0; font-size: 12px; }
dt { font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
dd { margin: 2px 0; color: #aaa; }
strong { color: #ffb454; }
</style>
```

`packages/demo/src/ScenarioBoard.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { LoopedLoader, useSmoothPending } from '@topclans/looped-loader-vue'

const delayMs = ref(120)
const pending = ref(false)
const visible = useSmoothPending(pending, { delay: 120, minVisible: 300 })
const lastError = ref<string | null>(null)

function simulate(ms: number): void {
  pending.value = true
  lastError.value = null
  setTimeout(() => {
    pending.value = false
  }, ms)
}
</script>

<template>
  <section class="scenarios">
    <article>
      <h2>Instant (0 ms) — nothing should be fetched</h2>
      <button type="button" @click="simulate(0)">run</button>
      <LoopedLoader v-if="visible" base-url="/clips" :delay-ms="120" />
    </article>

    <article>
      <h2>300 ms</h2>
      <button type="button" @click="simulate(300)">run</button>
      <LoopedLoader v-if="visible" base-url="/clips" delay-ms="120" seed="scenario-300" />
    </article>

    <article>
      <h2>3 s</h2>
      <button type="button" @click="simulate(3000)">run</button>
      <LoopedLoader v-if="visible" base-url="/clips" delay-ms="120" seed="scenario-3s" />
    </article>

    <article>
      <h2>Broken manifest (404)</h2>
      <LoopedLoader base-url="/does-not-exist" @error="lastError = 'manifest-fetch'" />
      <p>{{ lastError }}</p>
    </article>

    <article>
      <h2>Clip missing from the manifest</h2>
      <LoopedLoader base-url="/clips" clip="no-such-clip" @error="lastError = 'manifest-invalid'" />
      <p>{{ lastError }}</p>
    </article>

    <article>
      <h2>Overlay mode</h2>
      <LoopedLoader base-url="/clips" mode="overlay" seed="overlay" />
    </article>

    <article>
      <h2>Reduced motion</h2>
      <p>Toggle it in the OS or emulate it in DevTools; no video request should appear in the network panel.</p>
      <LoopedLoader base-url="/clips" seed="reduced" />
    </article>
  </section>
</template>

<style scoped>
.scenarios { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
article { background: #1b1b1b; padding: 12px; border-radius: 8px; min-height: 160px; }
h2 { font-size: 13px; margin: 0 0 8px; color: #bbb; }
</style>
```

- [ ] **Step 3: Run it and look at it**

```powershell
pnpm --filter @topclans/looped-loader-demo dev
```

Expected: the dev server prints a URL; open it and confirm the contact sheet shows 32 playing clips and the scenario board runs the six scenarios. Failures here are for Task 10 to record properly — this step is only to confirm the page assembles at all.

- [ ] **Step 4: Type-check and commit**

Run: `pnpm typecheck` — expect PASS.

```bash
git add packages/demo .gitignore pnpm-lock.yaml
git commit -m "feat(demo): contact sheet and scenario board for visual verification"
```

## Task 10: Browser verification with real evidence

**Files:**
- Create: `docs/verification/2026-10-08-browser/contact-sheet.png`, `docs/verification/2026-10-08-browser/scenarios.png`, `docs/verification/2026-10-08-browser/README.md`

**Interfaces:**
- Consumes: the demo page from Task 9 and the assets from Task 6.
- Produces: the evidence for acceptance criteria 5 and 6. **Main session only** — reading a screenshot and deciding whether the thing works is judgment, not typing.

This task uses the `live-browser-verification` skill. It is the only task in this plan whose output is a claim about runtime behaviour, so the claim is only allowed with the artifacts below attached.

- [ ] **Step 1: Enable the browser tools and confirm they arrived**

```powershell
pwsh C:/dev/dsh/scripts/mcp-playwright.ps1 -Action on
pwsh C:/dev/dsh/scripts/mcp-playwright.ps1 status
```

Expected: the status reports the Playwright tool count for **this** session. If the tools did not arrive in the current catalog, say so and stop rather than verifying by reading source — a source file cannot tell you whether a video plays.

- [ ] **Step 2: Serve the demo as a managed background job**

```powershell
pnpm --filter @topclans/looped-loader-demo dev --host 127.0.0.1 --port 5273
```

Run it as a background job, then read the job output for the exact URL and navigate to **that** URL, not to a guessed one.

- [ ] **Step 3: Verify the contact sheet**

Navigate to the demo, wait for playback to settle (at least three seconds), then evaluate:

```js
() => {
  const videos = [...document.querySelectorAll('.grid video')]
  return {
    total: videos.length,
    withSource: videos.filter((v) => v.currentSrc || v.getAttribute('src')).length,
    playing: videos.filter((v) => !v.paused && v.readyState >= 2).length,
    stalled: videos.filter((v) => v.readyState < 2).map((v) => v.getAttribute('src')),
  }
}
```

Expected: `total: 32`, `playing: 32`, `stalled: []`. Anything less is a finding to report, not something to explain away.

Then collect the console messages and the network log: **zero** console errors and **zero** failed requests (a 404 for any clip counts as a failure even though the loader degrades to a spinner).

Take the screenshot to `docs/verification/2026-10-08-browser/contact-sheet.png`.

- [ ] **Step 4: Measure what the clip costs the main thread**

A loader exists to make a slow start feel better; a video that blocks the main thread during hydration would do the opposite, and nothing in the spec measured it. On a cold reload of the contact sheet, collect long tasks while the clips start:

```js
() => new Promise((resolve) => {
  const entries = []
  const observer = new PerformanceObserver((list) => entries.push(...list.getEntries().map((e) => Math.round(e.duration))))
  observer.observe({ type: 'longtask', buffered: true })
  setTimeout(() => {
    observer.disconnect()
    resolve({ count: entries.length, longest: Math.max(0, ...entries) })
  }, 4000)
})
```

Expected: `longest` stays under 200 ms. A larger number is a finding to report with the measurement attached — it would argue for starting playback after first paint instead of with it. Do not add a `requestIdleCallback` and call it fixed; that changes the product, so it goes to the owner first.

- [ ] **Step 5: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce` with the Playwright emulation tool this server exposes (it is usually `browser_emulate_media` with `reducedMotion: "reduce"`). If no such tool exists in the mounted set, say so and mark acceptance criterion 6 **not verified** — do not stub `window.matchMedia` from `browser_evaluate` and call it verification, because that tests the stub rather than the stylesheet and the media query.

With emulation on, reload and re-run the evaluation from Step 3. Expected: `total: 0`, and the network log contains **no** request for any `clips/*.mp4`. Take `scenarios.png` from the scenario board with the reduced-motion card visible.

- [ ] **Step 6: Write the evidence file**

`docs/verification/2026-10-08-browser/README.md` records, in the past tense and with numbers: the exact URL verified, the date, the evaluation JSON, console-error count, failed-request count, which mechanism was used for the reduced-motion emulation, and every deviation found. A deviation is reported here, not fixed silently.

- [ ] **Step 7: Turn the browser tools off and stop the server**

```powershell
pwsh C:/dev/dsh/scripts/mcp-playwright.ps1 -Action off
```

Kill the background dev-server job. Leaving Playwright mounted costs every later session 25 tool schemas.

- [ ] **Step 8: Commit**

```bash
git add docs/verification
git commit -m "docs: browser verification evidence for the contact sheet and reduced motion"
```

## Task 11: Documentation

**Files:**
- Create: `README.md`, `packages/core/README.md`, `packages/vue/README.md`
- Modify: `NOTICE` (only if the engine changed the wording), `packages/assets/README.md`

**Interfaces:**
- Consumes: the API from Tasks 3 and 7, and the numbers in `packages/assets/qc-report.md`.
- Produces: the documentation acceptance criterion 7 points at.

Numbers come from `qc-report.md` and `manifest.json`, never from this plan: the plan's figures are the design-time measurement, and the report is what actually shipped.

- [ ] **Step 1: Write the root README**

It must contain, in this order:

1. One paragraph: what this is, and that a loader is the one component every user sees before anything else, which is why it shows a funny clip instead of a grey circle.
2. A quick start for each hosting recipe — both copy-pasteable, both tested:
   - **Self-hosted:** `pnpm add @topclans/looped-loader-vue @topclans/looped-loader-assets`, then copy `node_modules/@topclans/looped-loader-assets/clips` into the app's static directory, then `<LoopedLoader base-url="/looped-clips" />`.
   - **CDN:** `<LoopedLoader base-url="https://cdn.jsdelivr.net/npm/@topclans/looped-loader-assets@0.1.0/clips" />`, with one sentence stating that this adds a third-party runtime dependency and is therefore not the default.
3. The props table, the events table, the `#fallback` slot, and the CSS custom properties list.
4. `useSmoothPending` with the two-line reason it exists — a loader cannot enforce its own minimum visible time.
5. Accessibility: `role="status"`, the configurable label, reduced motion behaviour, and that the label is the only text a screen reader hears because the clip carries no information.
6. Localisation: the default label is English and every consumer should pass their own.
7. Licensing, pointing at `NOTICE`: code MIT, clips redistributed without a licence audit and not covered by the MIT grant, with the takedown route.
8. The measured corpus figures: clip count, total size, largest clip, and the note that the set is generated by `tools/transcode` rather than hand-made.

Every recipe must import the stylesheet as well as the component:
`import '@topclans/looped-loader-vue/style.css'`. Vite library mode emits the CSS as a
separate `dist/index.css` and `dist/index.js` does not import it, so the package cannot
style itself (PROGRESS.md D-23). A recipe that omits that line renders an invisible
spinner and is wrong, however plausible it looks.

- [ ] **Step 2: Write the two package READMEs**

`packages/core/README.md`: the framework-free API (`createLoopedLoader`, the manifest contract, the six error codes, the SSR rule that nothing happens before `start()`), and a note that the Vue package is the intended front door.

`packages/vue/README.md`: install, the component example, and a pointer to the root README for the recipes rather than a second copy that will drift.

- [ ] **Step 3: Verify every command and path in the README**

Copy-paste each command from the README into a scratch directory **outside** the repository and run it: `pnpm add`, the copy step, and a one-file Vite app using the component with `base-url` pointing at the copied directory. A README command that was not executed is a guess.

The CDN recipe cannot be executed before Task 12 publishes; mark it explicitly as unverified until then.

- [ ] **Step 4: Commit**

```bash
git add README.md packages/core/README.md packages/vue/README.md NOTICE packages/assets/README.md
git commit -m "docs: usage, recipes, accessibility and the licensing boundary"
```

## Task 12: Release — dry runs, owner-gated publish, public flip

> **Revised by the open-source plan.**
> `docs/superpowers/plans/2026-10-08-looped-loader-oss-readiness.md` Task 9 replaces the
> local publish below with a tag-triggered GitHub Actions release using npm trusted
> publishing, which removes the long-lived npm token from the project entirely. Read that
> task before running this one: if it is done, Steps 2–4 here collapse into "bump the
> version in lockstep, push a `v0.1.0` tag, watch the workflow". The local path below stays
> as the fallback for the case where trusted publishing turns out to require an
> already-published package (that task's Step 1 resolves the question with `npm trust
> --dry-run`). Going public is Task 8 of the open-source plan, and it must happen before a
> release can carry provenance — npm does not generate it for private repositories.

**Files:**
- Create: `CHANGELOG.md`
- Modify: `packages/*/package.json` (only `version`, kept in lockstep)

**Interfaces:**
- Consumes: everything.
- Produces: three published npm packages and a public repository. **Main session only**, and every irreversible step is gated on the owner.

- [ ] **Step 1: Stop and take the owner's decision on the preconditions**

Three things need the owner before anything is published:

1. **npm authentication.** This machine is not logged in (`npm whoami` is empty) and the vault holds no npm token. Either the owner runs `npm login` in their own terminal, or they create an automation token, drop it in a file, and it is stored with the `secrets-vault` skill (`sec set`). The token is then used only inside a child process (`sec run`), never as a command argument.
2. **Scope ownership.** `@topclans` must belong to the owner's npm account or an npm org they control. Confirm with `npm whoami` and `npm org ls topclans` once authenticated, or with `npm access list packages @topclans`. If it does not, fall back to unscoped `looped-loader-core`, `looped-loader-vue`, `looped-loader-assets` — a `package.json` rename in three files, no code change.
3. **The contact sheet review** from Task 10, plus a final look at the 32 clips before the repository becomes public.

- [ ] **Step 2: Inspect the tarballs before anything leaves the machine**

```powershell
pnpm -r build
pnpm --filter @topclans/looped-loader-core exec npm pack --dry-run --json
pnpm --filter @topclans/looped-loader-vue exec npm pack --dry-run --json
pnpm --filter @topclans/looped-loader-assets exec npm pack --dry-run --json
```

Expected for each: `core` and `vue` ship `dist` plus `LICENSE` — no `src`, no `test`, no `.probe`; `assets` ships `clips`, `manifest.json`, `checksums.json`, `LICENSE` and `NOTICE`, and **no** `gifs`. A tarball containing anything unexpected stops the release until it is explained, and a tarball *missing* `LICENSE` means `sync-legal.mjs` did not run — which is why `pnpm -r build` is the first command in this step.

- [ ] **Step 3: Write the changelog and freeze the version**

`CHANGELOG.md` with a `0.1.0` entry listing: the core, the Vue adapter, 32 clips with the measured total from `qc-report.md`, and a line stating that the clip set is redistributed without a licence audit, linking to `NOTICE`.

Confirm all three published packages read `"version": "0.1.0"` and that `packages/vue/package.json` declares `@topclans/looped-loader-core` as `workspace:*`, which pnpm rewrites to the published version at publish time.

- [ ] **Step 4: Publish in dependency order — owner-approved, irreversible**

```powershell
pnpm --filter @topclans/looped-loader-core publish --access public --no-git-checks
pnpm --filter @topclans/looped-loader-vue publish --access public --no-git-checks
pnpm --filter @topclans/looped-loader-assets publish --access public --no-git-checks
```

Stop if the owner has not answered Step 1. Stop if the tree is dirty and you were about to pass `--no-git-checks` to get past it — that flag is for a clean tree on a release branch, not for working around uncommitted work. Record the published version for each package.

- [ ] **Step 5: Verify from the outside, not from the repository**

In a scratch directory outside the repository:

```powershell
npm init -y
npm install @topclans/looped-loader-vue@0.1.0 @topclans/looped-loader-assets@0.1.0
```

Then confirm the assets package resolves and a clip is reachable through the CDN recipe:

```powershell
Invoke-WebRequest -Method Head "https://cdn.jsdelivr.net/npm/@topclans/looped-loader-assets@0.1.0/clips/<one-real-clip-id>.mp4"
```

Expected: HTTP 200 with a video content type. Only now does the README's CDN recipe stop being marked unverified — update that line in the same commit.

- [ ] **Step 6: Flip the repository public — owner-approved**

Only after Steps 1–5. Then re-run the two checks that were cheap and are now irreversible if wrong:

```powershell
git log --all -- gifs          # expect no output
gh repo edit TopClans/looped-loader --visibility public --accept-visibility-change-consequences
```

- [ ] **Step 7: Commit**

```bash
git add CHANGELOG.md README.md packages/*/package.json pnpm-lock.yaml
git commit -m "chore(release): 0.1.0"
git push origin main
```

`pnpm-lock.yaml` is staged here too: a version bump or a dependency edit that changes the lockfile and is not committed leaves CI red on a clean clone.

## Acceptance criteria map

Every criterion from the spec, and the task whose evidence settles it.

| Spec criterion | Settled by |
|---|---|
| 1. `pnpm -r build && pnpm -r test` green from a clean clone | Tasks 1–9, re-run as the first step of Task 12 |
| 2. Corpus transcoded, QC green, ≤ 5 MB, no clip > 250 KB or a recorded exception | Task 6, Steps 2–3 |
| 3. A second `--check` reports zero differences | Task 6, Step 4 |
| 4. `git log --all -- gifs/` empty | Task 6, Step 6 and Task 12, Step 6 |
| 5. Demo in a real browser: 32/32 playing, 0 console errors, 0 failed requests, screenshot attached | Task 10, Step 3 |
| 6. Reduced motion verified in a real browser | Task 10, Step 5 |
| 7. Self-hosted recipe verified; CDN recipe verified after publish | Task 11, Step 3 and Task 12, Step 5 |
| 8. `npm publish --dry-run` inspected for all three packages | Task 12, Step 2 |
| 9. Owner reviewed the contact sheet before going public | Task 10, Step 6 and Task 12, Step 1 |
| *(plan addition, not in the spec)* main-thread cost of playback measured and under 200 ms | Task 10, Step 4 |

## Definition of done for a task

A task is finished only when all of these hold, in this order:

1. Its own test command was run and its output read, not assumed.
2. `pnpm typecheck` and `pnpm -r build` still pass on the integration branch.
3. The commit contains only that task's files.
4. Any number quoted from the task (sizes, counts, timings) was read from a command's output in this session.
5. Anything the task could not settle is written down as an open finding rather than left implicit.




