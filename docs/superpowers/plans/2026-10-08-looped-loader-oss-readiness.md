<!-- proposal: every code and config block in this plan was written before the files exist. Verify each against the repository as you implement it; where a block and its note disagree, the note is the requirement. -->

# Looped Loader — Open-Source Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take a working private library to the state where publishing it as an open-source project is defensible: real platform coverage, measured accessibility, a machine-checked content boundary, community files, protected settings, and a release that carries provenance and no long-lived token.

**Architecture:** Documents and configuration, plus four small scripts that make claims checkable — package metadata, README-to-component sync, asset provenance, and link integrity. The only new runtime-adjacent dependency is Playwright plus axe for the accessibility audit, and it runs on one CI leg.

**Tech Stack:** ESLint 9 flat config, Prettier, commitlint, Vitest coverage, `@axe-core/playwright`, GitHub Actions (matrix + release), `gh` CLI, npm trusted publishing via OIDC.

**Spec:** `docs/superpowers/specs/2026-10-08-looped-loader-design.md`
**Build plan (this one continues it):** `docs/superpowers/plans/2026-10-08-looped-loader.md`
**Epic, runbook and tracker:** `docs/epic/README.md`, `docs/epic/RUNBOOK.md`, `docs/epic/PROGRESS.md`

## Global Constraints

Copied from the spec and the build plan; every task's requirements include this section.

- Node `>=20.11`; CI matrix Node 20, 22, 24 on `ubuntu-latest` and `windows-latest`.
- pnpm `10.15.1`; `pnpm-lock.yaml` committed; every install uses `--frozen-lockfile`.
- TypeScript `~5.9.3`. Do **not** install 7.x.
- Published packages, lockstep versioned: `@topclans/looped-loader-core`, `-vue`, `-assets`.
  `tools/transcode` and `packages/demo` stay private.
- `@topclans/looped-loader-core` keeps **zero runtime dependencies**; `-vue` declares only
  `peerDependencies: { "vue": "^3.4" }`.
- Bundle budget, enforced by `scripts/check-size.mjs`: core ≤ 8 KB gzip, vue ≤ 12 KB gzip.
- The six error codes are closed: `manifest-fetch`, `manifest-invalid`, `clip-fetch`,
  `decode`, `autoplay-blocked`, `no-clips`.
- `gifs/` is never committed; `git log --all -- gifs/` must stay empty.
- No long-lived npm token anywhere: no `NPM_TOKEN` secret, no `.npmrc` with a token, no
  token in the vault for this project.
- Every published tarball carries its own `LICENSE`, and the assets tarball carries `NOTICE`.
- Nothing in this plan changes the spec's settled decisions D1–D8 or its accepted
  copyright risk (§9). E4.5 exists so that risk can be revisited deliberately, not
  incidentally.

## Handoff

### Start

Workspace root is `C:\dsh\looped-loader`. Open the session with that directory as the
workspace root.

```powershell
cd C:\dsh\looped-loader
git status --short                  # expect clean
git log --oneline -3                # expect df65247 or later
pnpm install
pnpm build; pnpm typecheck; pnpm test    # the baseline must be green before Task 1 starts
```

This plan assumes the build plan is **finished**: Tasks 1–11 are `done` in
`docs/epic/PROGRESS.md`, `pnpm test` is green, and the assets exist. Task 12 is the exception
and is not a blocker — this plan's Task 9 replaces its publish step and Task 8 owns its flip.
If Tasks 1–11 are not done, stop: every task here verifies claims about code that must already
exist.

Note the order of the baseline command: `pnpm build` before `pnpm typecheck`, and the root
`pnpm build`, not `pnpm -r build` — see the rulings above. A fresh clone has no
`packages/core/dist`, and two packages resolve the core through it.

Permission mode: Tasks 1–7 write only inside the workspace and run under `workspace-write`.
**Tasks 8, 9 and 10 do not** — `gh api` writes to the GitHub API, `npm trust` and
`npm publish` write `~/.npmrc` and the npm cache, and all three are outside the workspace.
Run those in a `danger-full-access` session, or hand the exact commands to the owner.

Worktrees: this plan's tasks are mostly document and configuration edits with small,
disjoint write scopes. Follow `docs/epic/RUNBOOK.md` §3 — one writer per worktree, and the
write scopes listed per task are the contract.

**Wave schedule.** The dependency graph is not the binding constraint here — the write scopes
are. Five tasks edit the root `package.json` (T1, T2, T3, T5, and T4 if a script is needed),
three edit `.github/workflows/ci.yml` and three touch `pnpm-lock.yaml` (T1, T3, T5), so at most
two writers can run at once:

| Wave | Tasks | Why this grouping |
|---|---|---|
| 1 | T1 | owns the root `package.json`, `ci.yml`, the package manifests and the lockfile |
| 2 | T2 ∥ T6 | **T6 runs in the main checkout**, not a worktree — it needs the untracked `gifs/` |
| 3 | T3 ∥ T4 | T3 consumes T2's `scripts/check-links.mjs`; T4 and T6 share `packages/core/test/`, so they must not overlap |
| 4 | T5 ∥ T7 | this wave lands through a pull request on purpose: the PR template and the six-leg matrix exist by now |
| 5 | T8 | main session; the flip is owner-gated |
| 6 | T9 | main session; the dry run runs before any tag |
| 7 | E5.2 + T10 | main session; the tag, then verification from outside |

Critical path: T1 → T2 → T3 → T8 → T9 → tag → T10. T4, T5, T6 and T7 hang off it.

### Decisions and rulings

Settled here; the executor does not reopen them. Numbering continues the tracker's journal.

- **Commitlint runs in CI only, with no husky hook.** A pre-commit hook that rejects a
  contributor's first commit costs more goodwill than a red check they can read.
- **Coverage thresholds are set from measured output, never guessed.** A threshold above
  the real value makes the first merge after this task red for a reason unrelated to the
  change.
- **The accessibility audit runs in a real browser (Playwright + axe), not in jsdom.** axe
  in jsdom cannot see computed styles or the accessibility tree, which is where this
  component's risks live.
- **`scripts/check-readme-sync.mjs` is deliberately simple** (a regex over the `defineProps`
  block compared with the README table). If it proves noisy, delete it and record why in
  the tracker — do not weaken it into something that always passes.
- **No macOS CI leg.** Nothing here is macOS-specific; the runner cost buys no signal. This
  is a decision, not an omission.
- **Staged publishing is documented, not used.** With one maintainer it adds a manual 2FA
  step for no additional protection; `docs/release.md` records it as the next step if a
  second maintainer appears.
- **The first publish may need a short-lived token** if `npm trust` turns out to require an
  existing package. Resolve this at the start of Task 9 with `npm trust … --dry-run` and
  record the answer in the task before tagging anything.

Rulings from the audit of 2026-10-09 (see the next section for what it found):

- **`pnpm build` — the root script, never `pnpm -r build` — precedes `pnpm typecheck` in every
  workflow.** The root script is `sync-legal.mjs && pnpm -r build && check-size.mjs`; the
  recursive form both loses the bundle-budget gate and, in a fresh clone, leaves
  `packages/core/dist` absent so typecheck fails with TS2307.
- **Task 6 runs in the main checkout, not a worktree**, because `gifs/` is untracked and its
  Step 7 re-runs the pipeline over it. Its wave-mate works in a worktree, so one writer per
  directory still holds.
- **`CONTRIBUTING.md` points at `docs/epic/stories/E4.3-clip-policy.md` until Task 7 creates
  `docs/content-policy.md`**, and Task 7 switches the link. Otherwise `pnpm test` is red for
  two waves for a reason that looks like a broken repository.
- **The `0.1.0` changelog entry and the version freeze live in Task 9 Step 7.** The build plan's
  Task 12 used to write them; this plan replaces that task's publish step, so the entry moves
  here rather than disappearing.
- **The tag push is an explicit, owner-gated step** (Task 9 Step 9), not an implied consequence
  of the commit before it.
- **Coverage is measured only in the three packages that have a vitest config**, because
  `pnpm -r test --coverage` appends `--coverage` to the demo's `node -e` script and fails it.
- **`tarball-inventory.json` is written by `scripts/check-tarballs.mjs` and uploaded as the
  release run's artifact**, which is what E5.1's story asks for and what `.gitignore` already
  anticipated.

### Plan audit (2026-10-09)

The audit described in
`docs/superpowers/specs/2026-10-09-looped-loader-step-2-oss-release-design.md` §4 was run on
2026-10-09, before any wave was dispatched, because this plan was written before the files it
edits existed. Each finding below was observed, not reasoned about; the ones that were probed by
running the plan's own scripts say so.

| # | Where | What was wrong | Evidence | Correction |
|---|---|---|---|---|
| A1 | Task 1 Step 5 | The metadata block omits `engines`, which `scripts/check-manifests.mjs` requires on all three packages | ran the plan's own check against the repository: `@topclans/looped-loader-vue: missing "engines"`, same for assets | `"engines": { "node": ">=20.11" }` added to the block |
| A2 | Task 1 Step 2/7 | No `.prettierignore` exists, so `prettier --write .` reformats `dist/`, the docs — including this plan — and both specs, and `format:check` then fails on any built workspace | `.prettierignore` absent; `packages/core/dist` and `packages/vue/dist` present | `.prettierignore` added and committed |
| A3 | Task 3 Step 4 | The matrix replaced `pnpm build` with `pnpm -r build` and kept `typecheck` first | current `ci.yml` runs `pnpm build`; `df65247` documents the TS2307 failure | `pnpm build` then `pnpm typecheck`, with the reason in the workflow |
| A4 | Task 3 Step 4 | `pnpm -r test --coverage` fails the demo package | `node -e "console.log('…')" --coverage` → `bad option: --coverage`, exit 9 | the script filters the three vitest packages |
| A5 | Task 3 Step 3 | The ffmpeg guard was placed inside `describe.skipIf(!available)`, where it is skipped exactly when it matters | `tools/transcode/test/pipeline.test.ts:15` | moved to its own, non-skipped `describe` |
| A6 | Task 3 Step 2 | `coverage.include: ['src/**/*.ts']` excludes the Vue component from the Vue package's own coverage | `packages/vue/src/LoopedLoader.vue` is the package's largest source file | widened to `src/**/*.{ts,vue}` |
| A7 | Task 4 Step 2 | The README props-table regex captured nothing, so the test could never pass | README uses `### Props` (line 93) followed by a blank line; `## Props[\s\S]*?\n\n` stops there | section extracted to the next heading |
| A8 | Task 5 Step 1 | `scripts/a11y-audit.mjs` imports `vite` at the repository root, where it is not a dependency | `node_modules/vite` does not exist; `vite` is a devDependency of `packages/vue` and `packages/demo` only | `vite@^8.3.3` added to the root devDependencies |
| A9 | Task 6 Step 4 | The snippet omitted the `readProvenance` import and never showed how `provenance` reaches the entry | `tools/transcode/src/index.ts` builds `entries.push({…})` and `buildManifest` maps `ClipEntry` | import, `entries.push`, `ClipEntry` and `buildManifest` all stated as exact edits |
| A10 | Task 6 Step 5 | Three bare `invalid(...)` calls that never throw | `invalid` is a factory (D-18); all 13 existing sites in `packages/core/src/manifest.ts` read `throw invalid(...)` | `throw` added at all three |
| A11 | Task 9 Step 2 | The release workflow runs `pnpm -r build`, which skips `sync-legal.mjs` — so the gitignored `LICENSE` files never exist and `check-tarballs.mjs` fails on every tarball, after the version is frozen | `.gitignore` ignores `packages/*/LICENSE`; only the root `build` script runs `sync-legal.mjs` | the workflow runs `pnpm build` |
| A12 | Task 9 Step 2 | `typecheck` before `build`, the same defect as A3 | run `37827667850` | build first |
| A13 | Task 9 Step 3 | `check-tarballs.mjs` cannot spawn `npm` on Windows, and imported an unused `readdirSync` that `pnpm lint` rejects | `execFileSync('npm')` → `ENOENT`; `execFileSync('npm.cmd')` → `EINVAL`; `no-unused-vars` is an error in this repo | `execSync`, and the import removed |
| A14 | Task 9 | The tarball inventory was never written or uploaded, although E5.1's story and `.gitignore` both require it | `.gitignore` line 41 names `tarball-inventory.json` and `check-tarballs.mjs --out` | `--out` support plus an `actions/upload-artifact` step |
| A15 | Task 8 | Protection and the security features ran before the flip, which is impossible while private | `gh api …/branches/main/protection` → `403 Upgrade to GitHub Pro or make this repository public` | order corrected to metadata → flip → protection → security → verify (D-29) |
| A16 | Task 8 Step 4 | The required-check list covers 2 of the 6 matrix legs while E3.5's acceptance says six | `contexts` names only Node 22 | made an explicit decision to record, not an oversight |
| A17 | Task 9 / build Task 12 | Nothing owned the `0.1.0` changelog entry once Task 12's publish step was superseded | Task 2 creates `CHANGELOG.md` with no released entry | Task 9 Step 7 writes it and freezes the version |
| A18 | Task 2 Step 1 | The expectation "it reports links in `docs/epic/` that do not exist yet" was false | ran the plan's own `check-links.mjs`: `relative links ok`, exit 0 | the check is now proved by a deliberate break |
| A19 | "Verified facts" | Community profile 14 %, "no licence detected", npm scope unverified | re-measured: 42 %, MIT detected, `@topclans` owned by `topclans` | section rewritten from the 2026-10-09 measurements |

Two more corrections landed outside this plan: the build plan's Task 12 no longer publishes from
this machine and no longer flips the repository (OSS Task 9 and Task 8 own those), and the wave
schedule in the design spec §6.2 places Task 6 in the main checkout.

### Verified facts

Measured 2026-10-08 on `WIN-TTEB79J8UHA`, Windows 11, and from npm's own documentation.

- **Local npm is 11.21.0** (upgraded during planning from 10.9.4). `npm@latest` is 12.2.0
  and **refuses to install here**: it requires node `^22.22.2 || ^24.15.0 || >=26.0.0` and
  the local node is exactly 22.22.0.
- **`npm trust` exists in 11.21.0**: `npm trust github <pkg> --file <workflow>
  --repo <owner/repo> [--allow-publish] [--dry-run] [--json]`, plus `npm trust list` and
  `npm trust revoke`. The trusted publisher can therefore be configured and verified from
  the CLI.
- **Provenance requires a public repository** and a case-sensitive matching
  `package.json` `repository.url`, published from a cloud CI runner. It is **not supported
  for private repositories, even when publishing public packages** (npm docs).
- **Trusted publishing** needs npm CLI ≥ 11.5.1 and Node ≥ 22.14.0, GitHub-hosted runners,
  and a configuration naming the workflow file exactly. It removes the need for
  `NPM_TOKEN`, and provenance is then generated automatically.
- **A new trusted-publisher configuration expires after 2 days** if its first publish does
  not succeed.
- **Re-measured 2026-10-09, after the build plan landed.** The design-time entries below were
  taken before the code, the README and the licence existed; where the two disagree, this list
  wins. The verification pass that produced it is recorded in
  `docs/superpowers/specs/2026-10-09-looped-loader-step-2-oss-release-design.md` §3.
- **GitHub community profile health is 42 %** (`gh api …/community/profile`): README and the
  MIT licence are present; `contributing`, `code_of_conduct`, `issue_template` and
  `pull_request_template` are `null`. The design-time 14 % predates the README.
- Repository: `visibility: private`, `default_branch: main`, topics `[]`, homepage `null`,
  licence detected as MIT, issues enabled.
- **Branch protection does not exist while the repository is private.** `gh api
  repos/TopClans/looped-loader/branches/main/protection` answers `403 Upgrade to GitHub Pro or
  make this repository public to enable this feature`. This is why Task 8 now flips before it
  protects, and why its security features also come after the flip — CodeQL and secret scanning
  are free only on public repositories.
- `gh` is authenticated as `TopClans` with the scopes `gist`, `read:org`, `repo`, `workflow` —
  enough for repository metadata and branch protection. It does **not** carry
  `security_events`, so CodeQL's default setup needs either `gh auth refresh` or the web UI
  (Task 8 requires the route to be recorded); it does not carry `admin:org`, so the
  organization's plan cannot be read through the API.
- **The local npm CLI has no session**: `npm whoami` → `ENEEDAUTH`, and `npm trust list
  @topclans/looped-loader-core` → `401`. Writing is provably impossible without the owner's
  `npm login`, which is a gate in Task 9 rather than a formality.
- **The npm org `@topclans` exists and `topclans` is its owner**: `npm org ls topclans` →
  `{"topclans":"owner"}`, and the endpoint is authoritative — a nonexistent scope returns
  `E404 Scope not found`. TD-3 is closed, and the design-time fallback to unscoped package
  names is not needed.
- **`npm trust github` accepts an unpublished package name in `--dry-run`** — but the probe ran
  without a session, so it may never have reached the registry. The question stays open: Task 9
  Step 1 answers it with the owner authenticated, before anything is tagged.
- **The tool pins resolve**: eslint 10.12.0, @eslint/js 10.0.1, typescript-eslint 8.71.1,
  eslint-plugin-vue 10.11.1, vue-eslint-parser 10.4.1, eslint-config-prettier 10.1.8, prettier
  3.9.9, @commitlint/cli 21.2.3, @commitlint/config-conventional 21.2.3, playwright 1.64.0,
  @axe-core/playwright 4.13.0 (`npm view <pkg> version`, 2026-10-09).
- **`execFileSync('npm', …)` cannot work on Windows**: `npm` → `ENOENT`, `npm.cmd` → `EINVAL`;
  a shell is required. Task 9's tarball check uses `execSync` for that reason.
- `main` = `origin/main` = `df65247`, working tree clean, CI green (run `37828155212`).
- Node **can** capture child-process stdout in this environment; the scripts in this plan
  rely on it.

### Model classes

Classes, not model names — the owner names the models before each wave.

- **Tasks 1–3, 6, 7 (configuration and scripts):** cheap worker. Fully determined by the
  code in this plan and mechanically verifiable.
- **Tasks 4, 5 (type-level and browser tests):** mid-tier worker. Vacuous assertions and
  jsdom false confidence are the failure modes, and both need judgement.
- **Tasks 8, 9, 10 (repository settings, release, post-release verification):** main
  session only. Irreversible actions, owner gates, and evidence interpretation.
- **Task 11 (optional clip set):** main session only, and it starts with a question to the
  owner rather than with work.
- **Reviewers:** a different family from the implementer, on Tasks 4, 5, 6 and 9 — the four
  where a silent mistake either ships a false claim or publishes something wrong.

### Ask the owner before

- **Task 8:** making the repository public. Irreversible; publishes 32 third-party clips.
  Requires the owner's contact-sheet review from the build plan's Task 10 first.
- **Task 8:** enabling secret scanning with push protection can block a legitimate push;
  if it fires on a fixture, the fixture changes — never bypass it silently.
- **Task 9:** configuring the trusted publisher (needs npm credentials) and pushing the
  release tag. npm cannot unpublish a version older than 72 hours.
- **Task 9:** if the first publish needs a short-lived token, the owner creates it and
  hands it over through the vault (`sec set … -FromFile`), never in chat and never as a
  command argument.
- **Task 10:** editing the README to remove the "unverified" marker for the CDN recipe —
  only after the jsDelivr check actually passed.
- **Task 11:** whether to do it at all. The accepted risk stands until the owner says
  otherwise, and this task must not begin without that instruction.

### State at handoff

- Updated 2026-10-09. Branch `main` = `origin/main` = `df65247`, working tree clean, CI green
  (run `37828155212`); build plan Tasks 1–11 are merged, Task 12 is not started and is
  superseded in part by Tasks 8 and 9 here.
- The design this plan now implements is
  `docs/superpowers/specs/2026-10-09-looped-loader-step-2-oss-release-design.md`; the product
  spec is unchanged.
- The audit of §"Plan audit (2026-10-09)" has been run and its nineteen corrections are applied
  in this file. Rulings taken with it are in "Decisions and rulings".
- `docs/epic/PROGRESS.md` is the status carrier: E4.1–E4.5, E3.3–E3.5, E2.4, E5.1 and E5.3 are
  `todo`; E4.5 is deferred by the owner's decision of 2026-10-09 (D-27) and Task 11 is not part
  of this run.
- Repository: private, `TopClans/looped-loader`, community profile 42 %, no topics, no
  homepage, MIT licence detected, branch protection unavailable until it is public.
- Nothing in this plan has been implemented: no lint config, no community files, no CI matrix,
  no a11y audit, no provenance, no release workflow.
- Owner actions already verified as *not* done, and gating Tasks 8, 9 and E5.2: the npm session
  (`npm whoami` → `ENEEDAUTH`) and the contact-sheet review (criterion 9 of the build plan,
  open).

## Review Focus

Inputs and conditions the spec implies but no task's happy path exercises, most likely to
bite a real consumer or contributor first. Each has a test in its owning task.

1. **A published tarball missing `LICENSE`** — `files` arrays and `sync-legal.mjs` are easy
   to get wrong together, and npm silently omits a file that is listed but absent. A
   consumer then receives code with no licence text, which is worse than no package.
   Test in Task 1 (metadata script) and Task 9 (pack check in the dry run).
2. **`repository.url` case mismatch** — `TopClans` vs `topclans` passes every local check
   and fails at publish time with `ENEEDAUTH`, which reads like an auth problem.
   Test in Task 1.
3. **A non-conventional commit subject reaching `main`** — there is no local hook by
   decision, so the only gate is CI. Test in Task 1.
4. **A coverage threshold above the measured value** — the first merge after this task
   goes red for a reason unrelated to the change, and the temptation is to lower the
   threshold rather than read it. Test in Task 3.
5. **A markdown link that points at a path that no longer exists** — the epic, the runbook
   and eleven story files cross-reference each other heavily, and a renamed file breaks
   navigation silently. Test in Task 2 (`scripts/check-links.mjs`).

---
## Task 1: Repo hygiene and package metadata (E4.1)

**Files:**
- Create: `.editorconfig`, `.prettierignore`, `prettier.config.mjs`, `eslint.config.mjs`, `commitlint.config.mjs`, `.nvmrc`, `scripts/check-manifests.mjs`
- Modify: `package.json` (root: scripts and devDependencies), `.github/workflows/ci.yml` (lint and commitlint jobs), `packages/core/package.json`, `packages/vue/package.json`, `packages/assets/package.json`

**Interfaces:**
- Consumes: the workspace from build-plan Task 1.
- Produces: `pnpm lint`, `pnpm format:check`, `node scripts/check-manifests.mjs`, and the `repository.url` string every later release step depends on. Task 3 extends the CI workflow this task creates.

- [ ] **Step 1: Install the tooling**

```powershell
pnpm add -D -w eslint@^10 @eslint/js@^10 typescript-eslint@^8 eslint-plugin-vue@^10 vue-eslint-parser@^10 eslint-config-prettier@^10 prettier@^3 @commitlint/cli@^21 @commitlint/config-conventional@^21
```

Peers were checked against each other before this plan was written: `typescript-eslint@8.71` accepts `eslint ^10` and `typescript >=4.8.4 <6.1`, and `eslint-plugin-vue@10.11` accepts `eslint ^10`. `vue-eslint-parser` is listed explicitly because pnpm does not install peer dependencies for you.

- [ ] **Step 2: Write the configuration files**

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`prettier.config.mjs`:

```js
export default {
  semi: false,
  singleQuote: true,
  printWidth: 120,
  trailingComma: 'all',
}
```

`eslint.config.mjs`:

```js
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/assets/clips/**',
      'packages/demo/public/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  prettier,
)
```

`commitlint.config.mjs`:

```js
export default { extends: ['@commitlint/config-conventional'] }
```

`.nvmrc`:

```
22
```

`.prettierignore`:

```
# Build output and generated artefacts: reformatting these either breaks the build or
# makes `format:check` fail after every rebuild.
**/dist/
coverage/
packages/assets/clips/
packages/demo/public/
packages/*/LICENSE
packages/assets/NOTICE

# Documents are written by hand and by agents, not by a formatter. Without this line
# `prettier --write .` rewrites the plans, the specs and the tracker — including the plan
# the executor is reading, which is how the diff of this task turns into a 3000-line review.
docs/
README.md
NOTICE

# Lockfile and binaries
pnpm-lock.yaml
*.png
```

**Why this file is not cosmetic.** Measured on 2026-10-09: there is no `.prettierignore` in
the repository, `packages/core/dist` and `packages/vue/dist` exist in the working tree, and
`prettier --write .` formats everything it can parse — so Step 7 would rewrite built bundles,
the 1596-line plan, both specs, `PROGRESS.md` and the wave log, and CI's `format:check` would
then fail on any machine that has built the workspace. The ignore list is what keeps the
formatter pointed at sources.

Add to the root `package.json` scripts:

```json
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check:manifests": "node scripts/check-manifests.mjs",
    "test": "pnpm -r test && node scripts/check-manifests.mjs"
```

The root `test` script becomes the project's single entry point for "is everything still
true": the recursive suites plus the metadata check. Task 2 appends the link check to the
same line.

- [ ] **Step 3: Write the failing metadata check**

`scripts/check-manifests.mjs`:

```js
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Case-sensitive on purpose: trusted publishing and provenance both compare this against
// the GitHub repository, and a mismatch surfaces only at publish time as ENEEDAUTH.
const EXPECTED_REPOSITORY = 'git+https://github.com/TopClans/looped-loader.git'
const packages = ['packages/core', 'packages/vue', 'packages/assets']
const required = ['name', 'version', 'license', 'repository', 'homepage', 'bugs', 'keywords', 'engines']

const problems = []

for (const dir of packages) {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
  const name = manifest.name ?? dir

  for (const field of required) {
    if (manifest[field] === undefined) problems.push(`${name}: missing "${field}"`)
  }
  if (manifest.repository?.url && manifest.repository.url !== EXPECTED_REPOSITORY) {
    problems.push(`${name}: repository.url is "${manifest.repository.url}", expected "${EXPECTED_REPOSITORY}"`)
  }
  if (manifest.private === true) problems.push(`${name}: marked private but meant to be published`)
  if (!Array.isArray(manifest.keywords) || manifest.keywords.length < 3) {
    problems.push(`${name}: needs at least three keywords`)
  }
  if (manifest.engines?.node === undefined) problems.push(`${name}: missing engines.node`)
}

if (problems.length > 0) {
  console.error(`package metadata check failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

console.log(`package metadata ok: ${packages.length} packages`)
```

- [ ] **Step 4: Run it and confirm it fails for the right reason**

Run: `node scripts/check-manifests.mjs`

Expected: FAIL listing the missing fields for all three packages — `repository`, `homepage`, `bugs`, `keywords` at minimum. A failure about a missing file instead means the path list is wrong, not that the check works.

- [ ] **Step 5: Add the metadata**

Add to each of the three published `package.json` files, adjusting only `description`, `keywords` and `repository.directory` per package:

```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/TopClans/looped-loader.git",
    "directory": "packages/core"
  },
  "homepage": "https://github.com/TopClans/looped-loader#readme",
  "bugs": { "url": "https://github.com/TopClans/looped-loader/issues" },
  "author": "TopClans",
  "keywords": ["loader", "spinner", "vue", "looping", "video", "mp4"],
  "engines": { "node": ">=20.11" },
```

**`engines` is not optional here.** `scripts/check-manifests.mjs` requires it on all three
published packages, and only `packages/core` has it today: running the plan's own check against
the repository on 2026-10-09 reports `@topclans/looped-loader-vue: missing "engines"` and
`@topclans/looped-loader-assets: missing "engines"` (plus `missing engines.node` for each).
Step 6 cannot reach `package metadata ok: 3 packages` unless this line is added to both.

- [ ] **Step 6: Run the check again, then prove it can fail**

Run: `node scripts/check-manifests.mjs` → expected `package metadata ok: 3 packages`.

Then delete the `repository` block from `packages/core/package.json`, run again, and confirm the message names `@topclans/looped-loader-core` and the missing field. Restore with `git checkout -- packages/core/package.json` — that path is inside this task's write scope, so the restore is safe here.

- [ ] **Step 7: Apply the formatter and fix what lint finds**

```powershell
pnpm exec prettier --write .
pnpm lint
```

Expect a formatting-only diff across the existing sources — commit it separately so the next reader is not hunting for behaviour changes in it. Fix any lint error by changing the code, not by disabling the rule; if a rule genuinely does not fit, remove it from the config in this same commit and say why in the message.

- [ ] **Step 8: Add the lint and commitlint jobs to CI**

Append to `.github/workflows/ci.yml`:

```yaml
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.15.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check

  commits:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10.15.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

`fetch-depth: 0` is required: with a shallow clone the base commit is absent and commitlint fails for a reason that has nothing to do with the commit message.

- [ ] **Step 9: Commit**

```bash
git add .editorconfig .prettierignore prettier.config.mjs eslint.config.mjs commitlint.config.mjs .nvmrc scripts package.json pnpm-lock.yaml .github packages/*/package.json
git commit -m "chore: lint, format, commit style and published package metadata"
```

## Task 2: Community health files (E4.2)

**Files:**
- Create: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `GOVERNANCE.md`, `CHANGELOG.md`, `scripts/check-links.mjs`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`
- Modify: root `package.json` (`test` script gains the link check)

**Interfaces:**
- Consumes: Task 1's `scripts/` conventions and root scripts.
- Produces: `scripts/check-links.mjs`, and the community files Task 8 measures with `gh api …/community/profile`.

- [ ] **Step 1: Write the failing link check**

`scripts/check-links.mjs` — the epic, the runbook and the story files cross-reference each other heavily, and a renamed file breaks navigation silently:

```js
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entries = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'GOVERNANCE.md',
  'CHANGELOG.md',
  'ACCESSIBILITY.md',
  'docs',
]
const LINK = /\]\(([^)#\s]+)(?:#[^)]*)?\)/g

function* markdownFiles(entry) {
  const full = join(root, entry)
  if (!existsSync(full)) return
  if (statSync(full).isFile()) {
    yield full
    return
  }
  for (const name of readdirSync(full)) {
    const child = join(full, name)
    if (statSync(child).isDirectory()) yield* markdownFiles(join(entry, name))
    else if (name.endsWith('.md')) yield child
  }
}

const problems = []

for (const entry of entries) {
  for (const file of markdownFiles(entry)) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(LINK)) {
      const target = match[1]
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      if (!existsSync(resolve(dirname(file), target))) {
        problems.push(`${file.replace(root, '.')} → ${target}`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`broken relative links:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

console.log('relative links ok')
```

`CHANGELOG.md` and `ACCESSIBILITY.md` are in that list on purpose. Without the first, the root
document most likely to link a new policy file was the one document the check never read —
found by the 2026-10-09 audit. The second is listed before it exists so that E3.3 cannot escape
the check; `markdownFiles` returns nothing for an absent path, so listing it early is safe.
`CODE_OF_CONDUCT.md` is absent because the owner declined to publish one (D-31).

Run: `node scripts/check-links.mjs`

Expected: **`relative links ok`, exit 0 — and that is not a reason to doubt the script.**
Measured on 2026-10-09 by running this script verbatim against the repository: every relative
link in `README.md` and under `docs/` already resolves, so it passes on the first run. The
design-time expectation that it would list missing files in `docs/epic/` was wrong — those
story files all exist.

The check therefore has to be *proved* rather than observed: temporarily point one link in
`README.md` at `docs/content-policy.md` (which Task 7 creates, so it does not exist yet), run
the script, confirm it names that file and exits 1, then revert the edit. A check that has
never failed is not yet known to work. Fix anything it finds by creating the file or correcting
the link; do not add an ignore list for a path that should exist.

- [ ] **Step 2: Write the community files**

Each one must contain at least one fact that is true only of this project. Boilerplate with the project name substituted does not count.

- `CONTRIBUTING.md`: prerequisites (`node >=20.11`, `pnpm@10.15.1`, `ffmpeg`); the story cycle from `docs/epic/RUNBOOK.md`; TDD expectation; Conventional Commits; the PR checklist; how to run `pnpm transcode`; the clip-licence requirement (it links `docs/content-policy.md` once Task 7 creates it — until then, point at the story); and what a reviewer looks for (tests that can fail, evidence that was read).
- `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1, with the reporting route the owner actually monitors. **Ask the owner which address to publish** — do not invent one.
- `SECURITY.md`: supported versions (the current minor), private reporting through GitHub Security Advisories, and an honest statement that this is a single-maintainer project with no SLA.
- `SUPPORT.md`: Discussions for questions, issues for defects, and an explicit out-of-scope list taken from the spec's §11.
- `GOVERNANCE.md`: who decides, how a second maintainer is added, and the bus-factor statement — one maintainer, and what a fork should expect if they stop.
- `CHANGELOG.md`: Keep a Changelog format with an `Unreleased` section; the `0.1.0` entry is written at release time (build plan Task 12).
- `.github/ISSUE_TEMPLATE/bug_report.yml`: asks for the browser and version, the package versions, the asset hosting mode (self-hosted or CDN), the `baseUrl` shape, and the console output. Those five are what every real bug report for this component needs.
- `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml` (with `blank_issues_enabled: false` and a Discussions link), `.github/PULL_REQUEST_TEMPLATE.md`.
- `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      dev-dependencies:
        dependency-type: development
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

- [ ] **Step 3: Wire the link check into the test entry point**

Root `package.json`:

```json
    "test": "pnpm -r test && node scripts/check-manifests.mjs && node scripts/check-links.mjs"
```

Run: `node scripts/check-links.mjs` → expected `relative links ok`.

- [ ] **Step 4: Measure the community profile**

```powershell
gh api repos/TopClans/looped-loader/community/profile --jq '{health:.health_percentage, files:.files}'
```

Expected, **corrected by measurement on 2026-10-09**: `contributing`, `license`,
`pull_request_template` and `readme` non-null — and that is the whole of what this repository can
reach. `code_of_conduct` stays `false` because the owner declined to publish one (D-31), and
`issue_template` stays `false` even with all three templates on `main`, because this endpoint
reads the legacy single-file `.github/ISSUE_TEMPLATE.md` while the directory form is what
GitHub's issue UI serves. The measured reading with the files in place is
`health_percentage: 85`. The acceptance line is therefore "every file this project chooses to
publish is present and counted", not "100 %". `license` and `readme` come from the build plan's
Task 1 and Task 11 — if either is null, that task is not actually done and this is the check that
says so.

- [ ] **Step 5: Commit**

```bash
git add CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md SUPPORT.md GOVERNANCE.md CHANGELOG.md scripts/check-links.mjs package.json .github
git commit -m "docs: community health files and a link integrity check"
```

## Task 3: CI matrix and coverage thresholds (E3.5)

**Files:**
- Modify: `.github/workflows/ci.yml`, `packages/core/vitest.config.ts`, `packages/vue/vitest.config.ts`, `tools/transcode/vitest.config.ts`, `tools/transcode/test/pipeline.test.ts`, root `package.json`

**Interfaces:**
- Consumes: Task 1's `lint` and `commits` jobs.
- Produces: the required status checks Task 8 protects `main` with, and a `test:coverage` script.

- [ ] **Step 1: Measure coverage before setting a threshold**

```powershell
pnpm add -D -w @vitest/coverage-v8@^5
pnpm --filter @topclans/looped-loader-core exec vitest run --coverage
pnpm --filter @topclans/looped-loader-vue exec vitest run --coverage
pnpm --filter @topclans/looped-loader-tools exec vitest run --coverage
```

Read the four percentages each run prints. **The numbers in the next step are the shape of the config, not the values** — copy the measured values, subtract two points, and write those. A threshold above the real value turns the first merge after this task red for a reason unrelated to the change, and the temptation is then to lower the threshold instead of reading it.

- [ ] **Step 2: Add thresholds to each package's vitest config**

`packages/core/vitest.config.ts` (the other two are the same shape with their own `include` and environment):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      // Replace with the measured values from Step 1, minus two points.
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
  },
})
```

The `vue` config keeps `environment: 'jsdom'` and its `@vitejs/plugin-vue` plugin, and widens
`coverage.include` to `['src/**/*.{ts,vue}']`. With `src/**/*.ts` alone the component — the
largest source file in that package — is excluded from the measurement, so the threshold would
describe the composables and call it the package's coverage.

- [ ] **Step 3: Make the Windows leg fail if ffmpeg is missing**

In `tools/transcode/test/pipeline.test.ts`, add this guard in its **own** `describe` block,
outside the existing `describe.skipIf(!available)('transcode pipeline', …)`:

```ts
describe('ffmpeg availability', () => {
  it('is present in CI, where the integration tests must not silently skip', () => {
    if (process.env.CI === 'true') {
      expect(available, 'CI must install ffmpeg; the integration tests must not silently skip').toBe(true)
    }
  })
})
```

**Inside the skipped block this guard would be dead code, which is the exact case it exists
for.** `describe.skipIf(!available)` skips every test in the block when ffmpeg is absent — so
a guard placed there never runs on the one leg it was written to catch, and that leg passes by
skipping. It must live outside.

- [ ] **Step 4: Extend the workflow with the matrix**

Replace the single `test` job in `.github/workflows/ci.yml` with:

```yaml
  verify:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22, 24]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.15.1
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - name: Install ffmpeg (Linux)
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y ffmpeg && ffmpeg -version | head -1
      - name: Install ffmpeg (Windows)
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          choco install ffmpeg -y --no-progress
          ffmpeg -version | Select-Object -First 1
      - run: pnpm install --frozen-lockfile
      # The ROOT `pnpm build`, not `pnpm -r build`, and before typecheck. Two measured reasons:
      #  1. a fresh clone has no `packages/core/dist`; packages/vue and packages/demo resolve
      #     @topclans/looped-loader-core through those emitted declarations, so type-checking
      #     first fails with TS2307 plus a cascade of TS7006. That is how the first push of
      #     `main` went red, and it is fixed in df65247.
      #  2. the root script is `sync-legal.mjs && pnpm -r build && check-size.mjs`. Using
      #     `pnpm -r build` here would silently drop the bundle-budget gate from CI, which is
      #     an acceptance line of E1.1.
      - run: pnpm build
      - run: pnpm typecheck
      - name: Tests with coverage
        if: matrix.os == 'ubuntu-latest' && matrix.node == 22
        run: pnpm test:coverage
      - name: Tests
        if: ${{ !(matrix.os == 'ubuntu-latest' && matrix.node == 22) }}
        run: pnpm test
```

Add `concurrency` at the top of the file so superseded runs cancel:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

And the root script:

```json
    "test:coverage": "pnpm --filter @topclans/looped-loader-core --filter @topclans/looped-loader-vue --filter @topclans/looped-loader-tools test --coverage && node scripts/check-manifests.mjs && node scripts/check-links.mjs"
```

**The three filters are required, not stylistic.** `pnpm -r test --coverage` appends
`--coverage` to *every* package's `test` script, and two of them are not vitest: the demo's is
`node -e "console.log(...)"` and the assets package's is `node scripts/verify.mjs`. Measured on
2026-10-09:

```
node -e "console.log('demo no-op test')" --coverage
C:\nvm4w\nodejs\node.exe: bad option: --coverage
exit=9
```

Coverage runs in the three packages that have a vitest config, and nowhere else.

Coverage runs on one leg only: it is the slowest step and the number does not change with the operating system or the Node minor.

- [ ] **Step 5: Prove the coverage gate can fail**

Add an uncovered branch to `packages/core/src/prng.ts` (for example an `else` that cannot be reached), run
`pnpm --filter @topclans/looped-loader-core exec vitest run --coverage`, confirm the threshold fails, then revert the edit. A gate that cannot fail is decoration.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml packages/*/vitest.config.ts tools/transcode/vitest.config.ts tools/transcode/test/pipeline.test.ts package.json pnpm-lock.yaml
git commit -m "ci: linux and windows matrix, node 20/22/24, coverage thresholds"
```

## Task 4: Public API surface lock and type tests (E3.4)

**Files:**
- Create: `packages/core/test/public-api.test.ts`, `packages/vue/test/public-api.test.ts`
- Modify: root `package.json` if a script is needed for the build-before-test ordering note

**Interfaces:**
- Consumes: the exported names from build-plan Tasks 1–3 and the component from Task 7.
- Produces: a test that fails when the public surface moves, which is what makes a SemVer mistake visible before publication.

- [ ] **Step 1: Write the core surface test**

`packages/core/test/public-api.test.ts`:

```ts
import { describe, expect, expectTypeOf, it } from 'vitest'
import * as core from '../src/index.js'
import type { Clip, LoopedLoader, LoopedLoaderOptions, Manifest, State, VideoLike } from '../src/index.js'

const PUBLIC_API = [
  'LoopedLoaderError',
  'buildPool',
  'createLoopedLoader',
  'isLoopedLoaderError',
  'mulberry32',
  'parseManifest',
  'pickClip',
  'prefersReducedMotion',
  'resetRecent',
  'resolveSrc',
  'seededIndex',
  'xmur3',
].sort()

describe('public API', () => {
  it('exports exactly the documented names', () => {
    expect(Object.keys(core).sort()).toEqual(PUBLIC_API)
  })

  it('keeps the documented signatures', () => {
    expectTypeOf(core.createLoopedLoader).parameter(0).toEqualTypeOf<LoopedLoaderOptions>()
    expectTypeOf(core.createLoopedLoader).returns.toEqualTypeOf<LoopedLoader>()
    expectTypeOf(core.parseManifest).parameter(0).toEqualTypeOf<unknown>()
    expectTypeOf(core.parseManifest).returns.toEqualTypeOf<Manifest>()
    expectTypeOf(core.resolveSrc).parameter(0).toEqualTypeOf<string>()
    expectTypeOf(core.pickClip).returns.toEqualTypeOf<Clip>()
    expectTypeOf<State>().toEqualTypeOf<'idle' | 'resolving' | 'loading' | 'playing' | 'error'>()
    expectTypeOf<VideoLike['play']>().returns.toEqualTypeOf<Promise<void> | void>()
  })

  it('locks the six error codes', () => {
    const codes: Array<core.ErrorCode> = [
      'manifest-fetch',
      'manifest-invalid',
      'clip-fetch',
      'decode',
      'autoplay-blocked',
      'no-clips',
    ]
    expectTypeOf(codes).toEqualTypeOf<core.ErrorCode[]>()
    expect(new Set(codes).size).toBe(6)
  })
})
```

Type-only exports (`Clip`, `Manifest`, `ErrorCode`, …) are erased at runtime, which is why
`Object.keys` sees only the twelve values above. If this test fails with a list that
differs by one name, the correct response is a deliberate decision about SemVer, recorded
in `docs/epic/PROGRESS.md` — not a quiet edit of `PUBLIC_API`.

- [ ] **Step 2: Write the Vue surface and README-sync tests**

`packages/vue/test/public-api.test.ts`:

```ts
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as vue from '../src/index.js'

const packageRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(packageRoot, '..', '..')

describe('vue public API', () => {
  it('exports the component and the composables', () => {
    expect(Object.keys(vue).sort()).toEqual(['LoopedLoader', 'useLoopedLoader', 'useSmoothPending'])
  })

  it('ships non-empty declarations', () => {
    const file = join(packageRoot, 'dist', 'index.d.ts')
    expect(statSync(file).size).toBeGreaterThan(0)
    expect(readFileSync(file, 'utf8')).toContain('LoopedLoader')
  })
})

describe('README props table', () => {
  it('documents every prop the component declares, and nothing it does not', () => {
    const sfc = readFileSync(join(packageRoot, 'src', 'LoopedLoader.vue'), 'utf8')
    const block = /defineProps<\{(?<body>[\s\S]*?)\}>\(/.exec(sfc)?.groups?.body ?? ''
    const declared = [...block.matchAll(/^\s{4}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)]
      .map((match) => match[1] as string)
      .sort()

    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
    // The README's heading is `### Props` (line 93) and the next heading is `### Events`
    // (line 111). The design-time regex `/## Props[\s\S]*?\n\n/` matched the substring
    // "## Props" *inside* "### Props" and then stopped at the blank line directly after the
    // heading, so the captured section held no table rows, `documented` was always `[]`, and
    // `expect(documented).toEqual(declared)` could never pass. Verified 2026-10-09 against the
    // committed README.
    const section = /^#{2,3} Props$([\s\S]*?)^#{1,3} /m.exec(readme)?.[1] ?? ''
    const documented = [...section.matchAll(/^\|\s*`([a-zA-Z][a-zA-Z0-9]*)`/gm)]
      .map((match) => match[1] as string)
      .sort()

    expect(declared.length).toBeGreaterThan(5)
    expect(documented).toEqual(declared)
  })
})
```

The declarations test requires a build before the test run. That ordering already holds in
CI and in the acceptance criterion `pnpm -r build && pnpm -r test`; run `pnpm -r build`
first when testing locally, and do not weaken the test into "skip if dist is missing" —
that is exactly the failure it exists to catch.

- [ ] **Step 3: Run the tests and confirm they fail first**

Run: `pnpm --filter @topclans/looped-loader-core test` and `pnpm --filter @topclans/looped-loader-vue test`

Expected: the core test fails if `PUBLIC_API` disagrees with reality (read the diff before
editing the list); the Vue test fails until `README.md` has a `## Props` table, which the
build plan's Task 11 creates. If Task 11 is not done yet, this task is blocked — record
that rather than writing a second README section.

- [ ] **Step 4: Prove each assertion can fail**

Three deliberate breaks, each reverted immediately:

1. Remove one name from `packages/core/src/index.ts` → the exports snapshot fails.
2. Rename `delayMs` to `delay` in the component's `defineProps` → the README sync test fails.
3. Change `createLoopedLoader`'s parameter type to `any` → the `expectTypeOf` assertion fails.

If any of the three does not fail, the assertion is vacuous and must be rewritten before
this task is called done.

- [ ] **Step 5: Commit**

```bash
git add packages/core/test/public-api.test.ts packages/vue/test/public-api.test.ts
git commit -m "test: lock the public API surface, types and README props table"
```

## Task 5: Accessibility audit and `ACCESSIBILITY.md` (E3.3)

**Files:**
- Create: `scripts/a11y-audit.mjs`, `docs/verification/a11y-report.json`, `ACCESSIBILITY.md`
- Modify: root `package.json` (script and devDependencies), `.github/workflows/ci.yml` (one audit step on the ubuntu leg)

**Interfaces:**
- Consumes: the built demo from build-plan Task 9.
- Produces: the committed axe report E3.1's browser pass references, and the guarantees `ACCESSIBILITY.md` states.

- [ ] **Step 1: Install the audit tooling**

```powershell
pnpm add -D -w playwright@^1.64 @axe-core/playwright@^4.13 vite@^8.3.3
pnpm exec playwright install --with-deps chromium
```

**`vite` is added to the root on purpose.** The script below does `import { preview } from
'vite'` and lives in `scripts/` at the repository root, so Node resolves it from the root
`node_modules` — where `vite` is absent today (measured 2026-10-09: `node_modules/vite` does
not exist; `vite` is a devDependency of `packages/vue` and `packages/demo` only, and pnpm does
not hoist it to the root). Without this line `pnpm a11y` dies with `ERR_MODULE_NOT_FOUND`
before it reaches a browser.

The audit runs in a **real browser**, not jsdom. axe in jsdom cannot see computed styles or the accessibility tree, which is exactly where this component's risks live.

- [ ] **Step 2: Write the audit script**

`scripts/a11y-audit.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'
import { preview } from 'vite'

const demoRoot = resolve('packages/demo')
const server = await preview({ root: demoRoot, preview: { port: 4173, strictPort: true } })
const url = server.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:4173/'
const browser = await chromium.launch()
const results = []

try {
  for (const tab of ['sheet', 'scenarios']) {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'load' })
    if (tab === 'scenarios') await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.waitForTimeout(1500)

    const analysis = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    results.push({
      tab,
      violations: analysis.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
      })),
    })
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}

mkdirSync('docs/verification', { recursive: true })
writeFileSync(
  resolve('docs/verification/a11y-report.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), url, results }, null, 2)}\n`,
)

const blocking = results.flatMap((result) =>
  result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical'),
)

if (blocking.length > 0) {
  console.error(`accessibility violations:\n${JSON.stringify(blocking, null, 2)}`)
  process.exit(1)
}

console.log(`axe clean: ${results.length} pages, 0 serious/critical violations`)
```

Add to the root scripts:

```json
    "a11y": "pnpm --filter @topclans/looped-loader-demo build && node scripts/a11y-audit.mjs",
```

The script boots Vite's preview server in-process rather than shelling out, so there is no port race to wait on and no orphan process to kill.

- [ ] **Step 3: Run it and read the violations**

Run: `pnpm a11y`

Expected: either `axe clean`, or a list of violations to fix in the component. Fix them in the component — never with an axe ignore rule, and never by removing the check.

- [ ] **Step 4: Prove the check can fail**

Temporarily remove `aria-live="polite"` from `packages/vue/src/LoopedLoader.vue`, run `pnpm a11y`, confirm a violation appears, then restore. A check that cannot fail is decoration.

- [ ] **Step 5: Write `ACCESSIBILITY.md`**

It states, in this order:

1. What is guaranteed: `role="status"` with `aria-live="polite"` while pending; the `<video>` is `aria-hidden` and never enters the accessibility tree; the label is visually hidden but present in the accessibility tree; the loader takes no focus and contains no focusable element; under `prefers-reduced-motion: reduce` no `<video>` element is created at all.
2. What the consumer owns: the label text (the default is English and should be localised), the contrast pair between `--ll-spinner-color` and `--ll-overlay-bg` (minimum 3:1), and the overlay's stacking order.
3. How each guarantee is verified: the axe report path, the command that produces it, and the unit tests in `packages/vue/test/LoopedLoader.test.ts` that pin the attributes.
4. The known limits, stated plainly: no captions, because no clip carries audio or information — the clip is decoration and the label carries the meaning. A screen-reader user hears "Loading" and nothing else, which is the intent.

- [ ] **Step 6: Add the audit to CI**

One step on the ubuntu leg only, after the build:

```yaml
      - name: Accessibility audit
        if: matrix.os == 'ubuntu-latest' && matrix.node == 22
        run: |
          pnpm exec playwright install --with-deps chromium
          pnpm a11y
```

- [ ] **Step 7: Commit**

```bash
git add scripts/a11y-audit.mjs ACCESSIBILITY.md docs/verification/a11y-report.json package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "test(a11y): axe audit in a real browser, with the guarantees written down"
```

## Task 6: Per-clip provenance, enforced by the pipeline (E2.4)

**Files:**
- Create: `tools/transcode/src/provenance.ts`, `packages/assets/provenance-exceptions.json`
- Modify: `tools/transcode/src/manifest.ts`, `tools/transcode/src/index.ts`, `tools/transcode/src/qc.ts`, `packages/core/src/manifest.ts`, `packages/assets/scripts/verify.mjs`, tests in `tools/transcode/test/` and `packages/core/test/`

**Run this task in the main checkout, not in a worktree.** Step 7 re-runs the pipeline over
`gifs/`, which is untracked and therefore absent from every fresh worktree, and it rewrites the
committed `packages/assets/manifest.json` in place. Build-plan Task 6 had the same constraint
for the same reason (D-17). Its wave-mate works in its own worktree, so the one-writer-per-
directory rule still holds: this task owns the main checkout for the duration.

**Interfaces:**
- Consumes: build-plan Tasks 4–6 (the pipeline and the assets).
- Produces: `Provenance`, `readProvenance`, `DEFAULT_PROVENANCE`, a `provenance` block in every manifest clip, and the assets check E4.3's policy depends on.

- [ ] **Step 1: Write the failing tests**

`tools/transcode/test/provenance.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_PROVENANCE, readProvenance } from '../src/provenance.js'

const dir = mkdtempSync(join(tmpdir(), 'looped-prov-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('readProvenance', () => {
  it('falls back to unverified when there is no sidecar', () => {
    const result = readProvenance(dir, 'no-such-clip')
    expect(result).toEqual({ provenance: DEFAULT_PROVENANCE, fromSidecar: false })
    expect(result.provenance.license).toBe('unverified')
  })

  it('reads a sidecar and keeps its values', () => {
    writeFileSync(
      join(dir, 'cc0.provenance.json'),
      JSON.stringify({ source: 'wikimedia', sourceUrl: 'https://example.org/x', license: 'CC0-1.0' }),
    )
    const result = readProvenance(dir, 'cc0')
    expect(result.fromSidecar).toBe(true)
    expect(result.provenance).toMatchObject({ license: 'CC0-1.0', source: 'wikimedia' })
  })

  it('refuses a sidecar without a licence rather than guessing', () => {
    writeFileSync(join(dir, 'bad.provenance.json'), JSON.stringify({ source: 'wikimedia' }))
    expect(() => readProvenance(dir, 'bad')).toThrow(/license/)
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @topclans/looped-loader-tools test`

Expected: FAIL — `Failed to resolve import "../src/provenance.js"`.

- [ ] **Step 3: Implement provenance.ts**

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Provenance {
  source: string
  sourceUrl?: string
  license: string
  author?: string
  retrievedAt?: string
}

/**
 * The honest default for the clips that shipped with the accepted copyright risk:
 * their licence is unknown, and the manifest says so rather than implying one.
 */
export const DEFAULT_PROVENANCE: Provenance = { source: 'reddit', license: 'unverified' }

export function readProvenance(gifsDir: string, id: string): { provenance: Provenance; fromSidecar: boolean } {
  const sidecar = join(gifsDir, `${id}.provenance.json`)
  if (!existsSync(sidecar)) return { provenance: { ...DEFAULT_PROVENANCE }, fromSidecar: false }

  const parsed = JSON.parse(readFileSync(sidecar, 'utf8')) as Partial<Provenance>
  if (typeof parsed.source !== 'string' || parsed.source === '') {
    throw new Error(`${sidecar} must declare a non-empty "source"`)
  }
  if (typeof parsed.license !== 'string' || parsed.license === '') {
    throw new Error(`${sidecar} must declare a non-empty "license"`)
  }
  return { provenance: parsed as Provenance, fromSidecar: true }
}
```

- [ ] **Step 4: Carry it into the manifest and the report**

Three edits, in this order. The snippet in the first one is the whole change; the other two are
stated as exact edits because the surrounding code already exists.

1. `tools/transcode/src/index.ts` — import the new module beside the existing imports
   (`import { buildManifest, sha256File, type ClipEntry } from './manifest.js'` is the line it
   goes next to):

```ts
import { readProvenance } from './provenance.js'
```

   Then, inside the per-clip loop (`for (const name of selected.sort())`, right after
   `const id = basename(name, '.mp4')`), read the sidecar:

```ts
      const { provenance, fromSidecar } = readProvenance(gifsDir, id)
      if (!fromSidecar) {
        findings.push({
          id,
          level: 'review',
          code: 'license-unverified',
          message: 'no provenance sidecar: published with license "unverified"',
        })
      }
```

   and add `provenance,` to the object the loop pushes into `entries` (currently `{ id,
   sourcePath, outputPath, plan, width, height, durationMs, fps, frames, bytes }`).

2. `tools/transcode/src/manifest.ts` — add `provenance: Provenance` to the `ClipEntry`
   interface, and copy it into the clip the `entries.map` in `buildManifest` returns:

```ts
        provenance: entry.provenance,
```

3. `tools/transcode/src/index.ts` — add a `## Provenance` section to the generated
   `qc-report.md`, grouping clips by licence value so the count of `unverified` clips is
   visible on every run. The report is assembled in the lines-array at the end of `main()`;
   add the section before the `writeFileSync(join(outDir, 'qc-report.md'), lines.join('\n'))`.

- [ ] **Step 5: Validate the shape in the core, without rejecting the unknown**

In `packages/core/src/manifest.ts`, inside `parseClip`, after the existing field checks:

```ts
  if (raw.provenance !== undefined) {
    if (typeof raw.provenance !== 'object' || raw.provenance === null) {
      throw invalid(`clip "${id}" has a malformed provenance block`)
    }
    const provenance = raw.provenance as Record<string, unknown>
    if (typeof provenance.source !== 'string' || provenance.source === '') {
      throw invalid(`clip "${id}" provenance has no source`)
    }
    if (typeof provenance.license !== 'string' || provenance.license === '') {
      throw invalid(`clip "${id}" provenance has no license`)
    }
    clip.provenance = { source: provenance.source, license: provenance.license }
  }
```

**All three calls need `throw`.** `invalid` is a factory that *returns* a `LoopedLoaderError`;
a bare `invalid(...)` is a statement that evaluates an error and discards it. This is D-18
exactly — the same defect carried thirteen non-throwing sites into the build plan, where the
plan's own tests then failed 12/12. Every one of the thirteen sites already in
`packages/core/src/manifest.ts` reads `throw invalid(...)`, and without the `throw` the three
guards above also stop narrowing their types, so the assignment on the last line fails
`pnpm typecheck` as well as failing at runtime.

Add `provenance?: { source: string; license: string; sourceUrl?: string }` to the `Clip`
interface in `packages/core/src/pool.ts`. Unknown top-level fields stay ignored — that is
what lets the schema grow without breaking a consumer on an older runtime.

- [ ] **Step 6: Make the assets check enforce it**

In `packages/assets/scripts/verify.mjs`, add the grandfathering list and the rule:

```js
const exceptions = new Set(
  JSON.parse(readFileSync(join(root, 'provenance-exceptions.json'), 'utf8')).grandfathered,
)

for (const clip of manifest.clips) {
  const license = clip.provenance?.license
  if (!license) {
    problems.push(`${clip.id}: no provenance.license in the manifest`)
    continue
  }
  if (license === 'unverified' && !exceptions.has(clip.id)) {
    problems.push(`${clip.id}: license "unverified" and the clip is not grandfathered`)
  }
}
```

`packages/assets/provenance-exceptions.json` lists the 32 ids that shipped under the
accepted risk, with a comment field naming the spec section that records the acceptance.
Every id in it must also appear in the manifest — a stale exception is a problem, not a
silent allowance.

- [ ] **Step 7: Re-run the pipeline over the corpus**

```powershell
pnpm transcode --gifs gifs --out packages/assets
pnpm transcode --gifs gifs --out packages/assets --check
pnpm --filter @topclans/looped-loader-assets test
```

Expected: the manifest gains `provenance` for all 32 clips, `qc-report.md` lists 32
`unverified` clips under Provenance, `--check` still reports byte-identical clips (the
manifest changed, the media did not), and the assets check passes.

- [ ] **Step 8: Prove the check fails**

Delete one clip's `provenance` block from `packages/assets/manifest.json`, run
`pnpm --filter @topclans/looped-loader-assets test`, confirm it fails naming that clip, then
restore with `git checkout -- packages/assets/manifest.json`.

- [ ] **Step 9: Commit**

```bash
git add tools/transcode packages/core/src packages/core/test packages/assets
git commit -m "feat(assets): per-clip provenance, enforced for anything added from now on"
```

## Task 7: Clip contribution policy (E4.3)

**Files:**
- Create: `docs/content-policy.md`
- Modify: `CONTRIBUTING.md`, `NOTICE`, `README.md`

**Interfaces:**
- Consumes: Task 6's enforcement and Task 2's `CONTRIBUTING.md`.
- Produces: the written rule that Task 6's check makes real.

- [ ] **Step 1: Write `docs/content-policy.md`**

Sections, in this order:

1. **What this project is, content-wise.** It redistributes short video clips it did not
   create. That is a fact about the project, stated up front rather than in a footnote.
2. **The current set.** 32 clips collected from Reddit, each marked
   `license: "unverified"` in the manifest, published under a risk the owner accepted
   explicitly. Link to the spec section that records the acceptance, verbatim.
3. **What is accepted from now on.** CC0, public domain, CC-BY with attribution, or the
   contributor's own work. A source URL is mandatory, and the reviewer checks it.
4. **What is refused.** Third-party memes, re-uploads, anything whose provenance the
   contributor cannot point at.
5. **Enforcement.** The pipeline refuses a clip with no provenance; the assets check fails
   on a non-grandfathered `unverified` clip; the grandfathering list is in
   `packages/assets/provenance-exceptions.json`.
6. **The honest limit.** This cannot detect a false claim. Requiring a source URL makes the
   claim checkable, and that is the ceiling of what tooling can do here.
7. **Takedown.** The route and the response expectation, matching `NOTICE`.

- [ ] **Step 2: Link it from the three places that must reach it**

`README.md` (licensing section), `CONTRIBUTING.md` (adding a clip), `NOTICE` (a clause).
Then run `node scripts/check-links.mjs` — this is the check that proves the links resolve.

- [ ] **Step 3: Prove the pipeline refuses an unlicensed new clip**

In a scratch copy of `packages/assets`, add a clip entry with no `provenance` and run the
assets verification. Confirm it fails naming that clip. Remove the scratch copy. Do not
test this by editing the real assets.

- [ ] **Step 4: Commit**

```bash
git add docs/content-policy.md CONTRIBUTING.md NOTICE README.md
git commit -m "docs: clip contribution policy and the content boundary it enforces"
```

## Task 8: Repository settings, branch protection, public flip (E4.4)

**Files:**
- Create: `docs/verification/repo-settings.md` (the settings snapshot before and after)

**Interfaces:**
- Consumes: Tasks 1–3 (the checks that become required status checks) and Task 2 (the community files).
- Produces: a public repository with protected settings, which Task 9 requires for provenance.

**Owner-gated.** Do not run Step 3 without an explicit instruction in the current conversation.

- [ ] **Step 1: Record the before state**

```powershell
gh api repos/TopClans/looped-loader/community/profile --jq '{health:.health_percentage}'
gh repo view TopClans/looped-loader --json visibility,repositoryTopics,homepageUrl
gh api repos/TopClans/looped-loader/branches/main/protection 2>&1 | Select-Object -First 3
```

Write all three outputs into `docs/verification/repo-settings.md`. A before-and-after
record is what makes the change reviewable later.

- [ ] **Step 2: Set the repository metadata**

```powershell
gh repo edit TopClans/looped-loader --description "A Vue loader that plays a perfectly looped clip instead of a spinner" --homepage "https://github.com/TopClans/looped-loader#readme"
gh repo edit TopClans/looped-loader --add-topic vue,loader,spinner,video,mp4,looping,typescript,webm
```

- [ ] **Step 3: Flip the repository to public — owner-gated**

**This step moved here from the end of the task, and the move is the point.** Branch protection
does not exist on this repository while it is private. Measured on 2026-10-09:

```
gh api repos/TopClans/looped-loader/branches/main/protection
-> 403 Upgrade to GitHub Pro or make this repository public to enable this feature
```

So the design-time order (protect → security features → flip) stops at its own second step and
never reaches the flip at all.

Before running this: the owner has reviewed the contact sheet (build-plan Task 10, criterion 9)
and said so in the current conversation. This publishes 32 third-party clips and the whole
working record — the incident journal in `PROGRESS.md`, both plans, both specs, the story files
and the wave log. That is a decision, not a side effect.

```powershell
gh repo edit TopClans/looped-loader --visibility public --accept-visibility-change-consequences
```

Between this step and Step 4 the repository is public and `main` is unprotected. The window is
minutes long, nothing is pushed during it, and it is accepted, because the alternative — being
protected first — is impossible on this plan.

- [ ] **Step 4: Protect `main` and the release tags**

```powershell
gh api -X PUT repos/TopClans/looped-loader/branches/main/protection --input protection.json
```

with `protection.json`:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "commits", "verify (ubuntu-latest, 22)", "verify (windows-latest, 22)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
```

`required_approving_review_count: 0` is deliberate for a single-maintainer project: requiring
an approval you cannot obtain alone makes the rule theatre. Read the exact check names from
a real run before filling `contexts` — a required check whose name does not match any job
blocks every pull request forever.

**Decide deliberately which legs gate a merge.** The list above names Node 22 on both operating
systems, so the Node 20 and Node 24 legs run without gating anything, while E3.5's acceptance
line reads "six matrix legs green". Either add all six contexts (slower merges, stronger claim)
or keep two and say in `docs/release.md` that the other four are advisory. Leaving it unstated
means a reader of the acceptance map assumes six.

- [ ] **Step 5: Turn on the security features and labels**

These are free only on a public repository: on a private one, secret scanning and CodeQL's
default setup are GitHub Advanced Security features and their endpoints answer 403 or 404. That
is the second reason this step follows the flip rather than preceding it.

```powershell
gh api -X PATCH repos/TopClans/looped-loader --input security.json
```

with:

```json
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
```

Then enable Dependabot alerts and CodeQL default setup in the repository's security
settings (the API for both is fiddlier than the UI; record in the report which route was
used), and create the labels:

```powershell
gh label create "good first issue" --color 7057ff --description "Approachable, well-scoped"
gh label create "help wanted" --color 008672 --description "Extra attention is needed"
gh label create assets --color fbca04 --description "Clip set, pipeline or QC"
gh label create release --color 0e8a16 --description "Versioning and publishing"
```

- [ ] **Step 6: Re-run the checks that are cheap now and expensive later**

```powershell
git log --all -- gifs          # expect no output
gh api repos/TopClans/looped-loader/community/profile --jq '{health:.health_percentage}'
gh repo view TopClans/looped-loader --json visibility,repositoryTopics,homepageUrl
```

Expected: no `gifs/` in history, `health_percentage: 100`, `visibility: public` with topics
and homepage set. Append all of it to `docs/verification/repo-settings.md`.

- [ ] **Step 7: Commit**

```bash
git add docs/verification/repo-settings.md
git commit -m "docs: repository settings before and after going public"
```

## Task 9: Release automation with trusted publishing (E5.1)

**Files:**
- Create: `.github/workflows/release.yml`, `docs/release.md`
- Modify: `CHANGELOG.md` (the `0.1.0` entry is written in Step 7 of this task — the build plan's Task 12 no longer writes it), `packages/*/package.json` (version check only)

**Interfaces:**
- Consumes: Task 3's CI, Task 8's public repository, Task 1's `repository.url`.
- Produces: the tag-triggered publish that build-plan Task 12 (E5.2) uses instead of publishing from this machine.

**Main session only.** Steps 4–6 are irreversible and owner-gated.

- [ ] **Step 1: Resolve the one open question first**

> **Answered on 2026-10-09: `npm trust` requires an existing package.** Authenticated, the call
> answered `404 Not Found` on the POST and on `list` while the package did not exist, and
> succeeded once a placeholder `0.0.1` had reserved the name. The release therefore followed the
> placeholder route: `0.0.1` under the `placeholder` dist-tag, deprecated; the trusted publisher
> configured for all three; then `0.1.0` published by the tag workflow with OIDC and provenance.
> The text below is kept as the record of how the question was framed before it was answered —
> see `docs/release.md` → "The first publish, as it went" and
> `docs/verification/2026-10-09-release.md`.

**Answered by measurement on 2026-10-09, and the answer is "not from this session".** The
`--dry-run` probe is green, but it never reaches the registry. The real call was made once the
owner had logged in:

```text
$ npm trust github @topclans/looped-loader-core --file release.yml --repo TopClans/looped-loader --allow-publish
Two-factor authentication is required for this operation
npm error 403 403 Forbidden - POST https://registry.npmjs.org/-/package/@topclans%2flooped-loader-core/trust

$ npm trust list @topclans/looped-loader-core
npm error 403 403 Forbidden - GET https://registry.npmjs.org/-/package/@topclans%2flooped-loader-core/trust
```

Nothing was configured — `npm trust list` confirms it. **Two causes remain possible and cannot
be separated without an owner-supplied one-time password:** the session created by `npm login`
carries no 2FA approval for this operation, or npm refuses to attach a trusted publisher to a
package that does not exist yet (its documentation describes configuring one from the package's
*settings*).

So the branch taken is decided by the owner's own attempt, run with their 2FA:

```powershell
npm trust github @topclans/looped-loader-core   --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust github @topclans/looped-loader-vue    --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust github @topclans/looped-loader-assets --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust list @topclans/looped-loader-core
```

- **If those succeed:** the two-day window starts immediately — tag and publish in the same
  sitting, because a configuration whose first publish fails expires and must be recreated.
  `0.1.0` then ships with provenance.
- **If they fail with `403` again:** the package must exist first. Publish `0.1.0` once with a
  short-lived token the owner creates and hands over through the vault (`sec set … -FromFile`,
  never in chat and never as a command argument), then configure trusted publishing for `0.1.1`.
  `0.1.0` will carry **no attestation** — the release notes must say so rather than hide it, and
  E5.1's acceptance line then reads "provenance from `0.1.1` onward".

- [ ] **Step 2: Write the workflow**

`.github/workflows/release.yml`:

```yaml
name: release

on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run the pack and dry-run publish without touching the registry'
        type: boolean
        default: true

permissions:
  contents: read
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.15.1
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
          # No `cache:` input. The design-time block had `package-manager-cache: false`,
          # which setup-node does not define: the dry run on 2026-10-09 warned
          # "Unexpected input(s) 'package-manager-cache'" and the line did nothing.
      - run: pnpm install --frozen-lockfile
      # The ROOT `pnpm build`, for the same TS2307 reason as the CI matrix and for one more
      # that only this job has: the root script runs `scripts/sync-legal.mjs`, which writes
      # packages/*/LICENSE and packages/assets/NOTICE — all four are gitignored, so a fresh CI
      # clone has none of them. `pnpm -r build` skips sync-legal, `check-tarballs.mjs` then
      # finds no LICENSE in any tarball, and the release fails after the version is frozen.
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
      - name: Inspect the tarballs and write the inventory
        run: node scripts/check-tarballs.mjs
      - name: Upload the tarball inventory
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: tarball-inventory
          path: tarball-inventory.json
      - name: Publish (dry run)
        if: github.event_name == 'workflow_dispatch' && inputs.dry_run
        run: pnpm -r publish --access public --no-git-checks --dry-run
      - name: Publish
        if: startsWith(github.ref, 'refs/tags/v')
        run: pnpm -r publish --access public --no-git-checks
```

No `NPM_TOKEN` anywhere: with trusted publishing the npm CLI detects the OIDC environment
and exchanges it for a short-lived publish token. Node 24 is pinned because it ships npm 11,
which is above the 11.5.1 trusted-publishing floor.

- [ ] **Step 3: Write the tarball check**

`scripts/check-tarballs.mjs` — the dry run must fail if a package is incomplete, not merely
print a list a human might skim:

```js
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packages = ['packages/core', 'packages/vue', 'packages/assets']
const forbidden = [/^gifs\//, /^src\//, /^test\//, /\.probe\//]
const problems = []
const inventory = []

const outIndex = process.argv.indexOf('--out')
const outFile = outIndex === -1 ? join(root, 'tarball-inventory.json') : resolve(process.argv[outIndex + 1])

for (const dir of packages) {
  const cwd = join(root, dir)
  // `execSync`, not `execFileSync('npm', …)`: on Windows npm is a `.cmd` shim that Node refuses
  // to spawn without a shell — measured on this machine on 2026-10-09:
  //   execFileSync('npm', ['--version'])     -> ENOENT
  //   execFileSync('npm.cmd', ['--version']) -> EINVAL
  // A shell resolves `npm` on Linux and `npm.cmd` on Windows, so this is one code path, not a
  // platform branch.
  const output = execSync('npm pack --dry-run --json', { cwd, encoding: 'utf8' })
  const [{ files, filename }] = JSON.parse(output)
  const paths = files.map((file) => file.path)

  if (!paths.includes('LICENSE')) problems.push(`${filename}: no LICENSE in the tarball`)
  for (const path of paths) {
    if (forbidden.some((pattern) => pattern.test(path))) problems.push(`${filename}: ships ${path}`)
  }
  inventory.push({
    package: dir,
    filename,
    bytes: files.reduce((total, file) => total + (file.size ?? 0), 0),
    files: paths,
  })
  console.log(`${filename}: ${paths.length} files`)
}

// The release workflow uploads this file as the run's artifact, so the inventory a reviewer
// reads is the one the check actually judged. The path is already ignored by `.gitignore`.
writeFileSync(outFile, `${JSON.stringify(inventory, null, 2)}\n`)

if (problems.length > 0) {
  console.error(`tarball check failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log('tarballs ok')
```

The previous version imported `readdirSync` and never used it, and `@typescript-eslint`'s
`no-unused-vars` is an error in this repository's config — `pnpm lint` would have failed the
same task that wrote the script. It is gone.

Run it locally after `pnpm -r build`; `sync-legal.mjs` must have run first, which is why the
root `build` script calls it.

- [ ] **Step 4: Rehearse**

```powershell
gh workflow run release.yml -f dry_run=true
gh run watch
```

Expected: the job is green, `tarballs ok` appears, and the dry-run publish prints what it
would upload without uploading it. Nothing in the registry changes.

- [ ] **Step 5: Configure the trusted publishers — owner-gated**

Per package, from a session that can write `~/.npmrc`:

```powershell
npm trust github @topclans/looped-loader-core  --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust github @topclans/looped-loader-vue   --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust github @topclans/looped-loader-assets --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust list @topclans/looped-loader-core
```

The workflow filename must match exactly, including the extension. **A new configuration
expires after 2 days if its first publish does not succeed** — configure it when the
release is imminent, not days ahead.

- [ ] **Step 6: Write `docs/release.md`**

The tag → CI → npm → GitHub Release flow; the version-bump procedure (lockstep across the
three packages); the SemVer and deprecation policy (`deprecate`, never `unpublish`); what to
do when a release is wrong; how to revoke and recreate a trusted publisher; and staged
publishing documented as the next step if a second maintainer appears.

- [ ] **Step 7: Write the `0.1.0` entry and freeze the version**

`CHANGELOG.md` is created in Task 2 with an `Unreleased` section and no released entry, and the
build plan's Task 12 — which used to write this — has its publish step replaced by this task.
So the entry belongs here, before the tag exists: the core, the Vue adapter, the 32 clips with
the corpus total quoted from `packages/assets/qc-report.md`, and one line stating that the clip
set is redistributed without a licence audit, linking `NOTICE`.

Confirm all three published packages read `"version": "0.1.0"` and that `packages/vue/package.json`
declares `@topclans/looped-loader-core` as `workspace:*`, which pnpm rewrites at publish time. A
tag whose packages disagree on the version publishes a mismatched set that cannot be unpublished.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/release.yml scripts/check-tarballs.mjs docs/release.md CHANGELOG.md
git commit -m "ci: tag-triggered release with trusted publishing and no long-lived token"
```

- [ ] **Step 9: Tag and watch — owner-gated and irreversible**

The tag is the release. npm will not unpublish a version older than 72 hours, so a tag pushed
against a workflow that was never rehearsed (Step 4) burns `0.1.0` permanently.

```powershell
git tag -a v0.1.0 -m "0.1.0"
git push origin v0.1.0
gh run watch
```

Expected: `release.yml` runs, publishes core → vue → assets in that order, and the run's log
shows an attestation for each package. Record the run id, the three published versions and the
attestation links in `docs/verification/<date>-release.md` (Task 10 owns that file).

## Task 10: Post-release verification (E5.3)

**Files:**
- Create: `docs/verification/<date>-release.md`
- Modify: `README.md` (remove the "unverified" marker from the CDN recipe)

**Interfaces:**
- Consumes: a published release from E5.2 (build-plan Task 12).
- Produces: the evidence that the release works for someone who is not the author.

**Main session only.**

- [ ] **Step 1: Install from the registry in a scratch directory outside the repository**

```powershell
$scratch = Join-Path $env:TEMP "looped-release-check"
Remove-Item -Recurse -Force $scratch -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $scratch | Out-Null
Set-Location $scratch
npm init -y | Out-Null
npm install @topclans/looped-loader-vue@0.1.0 @topclans/looped-loader-assets@0.1.0
Get-Content node_modules/@topclans/looped-loader-vue/package.json | Select-String 'workspace:'
```

Expected: the install resolves the published version and the `workspace:` grep finds
nothing. A `workspace:` field leaking into a published manifest is the failure this checks
for.

- [ ] **Step 2: Run the self-hosted recipe end to end**

Copy `node_modules/@topclans/looped-loader-assets/clips` into the scratch app's static
directory, write the minimal Vite app from the README, and confirm a clip plays. Quote the
commands and the observed result.

- [ ] **Step 3: Verify the attestations**

```powershell
npm audit signatures
```

Expected: verified attestations for all three packages. If `0.1.0` shipped without
provenance because of Task 9 Step 1's answer, record that as the reason instead of as a
failure.

- [ ] **Step 4: Verify the CDN recipe and update the README**

```powershell
Invoke-WebRequest -Method Head "https://cdn.jsdelivr.net/npm/@topclans/looped-loader-assets@0.1.0/clips/<a-real-clip-id>.mp4" |
  Select-Object StatusCode, Headers
```

Expected: `200` with a video content type. Record the version actually served, then remove
the "unverified" marker from the CDN recipe in `README.md` in the same commit.

- [ ] **Step 5: Check the public surfaces**

npm package pages (provenance link, licence, rendered README, keywords), the GitHub release
with notes, community profile 100 %, tag protected. Record each with the command or URL
used.

- [ ] **Step 6: Write the report and commit**

`docs/verification/<date>-release.md` quotes every command and its actual output. A report
that paraphrases instead of quoting is not evidence.

```bash
git add docs/verification README.md
git commit -m "docs: post-release verification with quoted evidence"
```

## Task 11: *(optional)* freely-licensed default clip set (E4.5)

**Owner-gated. Do not start without an explicit instruction.** The accepted risk stands
until the owner revisits it, and this task exists so the option is costed rather than
imagined.

**Deferred on 2026-10-09 (PROGRESS.md D-27).** The owner decided that `0.1.0` ships the current
32 clips and that this task does not start now. It stays in this plan, and E4.5 stays `todo`
rather than `dropped`, because the option remains real — including doing it before a later
release. Nothing else in this plan depends on it.

**Files:**
- Create: `docs/verification/<date>-free-clip-set.md`, sidecar files under `gifs/`
- Modify: `packages/assets/provenance-exceptions.json` (shrinks as clips are replaced), `README.md`, `docs/content-policy.md`

- [ ] **Step 1: Ask the owner whether to do this at all**

If the answer is no, mark the story `dropped` in `docs/epic/PROGRESS.md` with the date and
the reason. A dropped story with a reason is a decision; an untouched story is an
ambiguity.

- [ ] **Step 2: Source 8–12 clips with recorded licences**

Wikimedia Commons (CC0/PD), Pexels, Pixabay, Mixkit. For each: download the original, verify
the licence **at the source page**, and write a sidecar `gifs/<id>.provenance.json` with
`source`, `sourceUrl`, `license` and `retrievedAt`. A search-result page is not a licence
record.

- [ ] **Step 3: Run them through the same pipeline and the same gate**

```powershell
pnpm transcode --gifs gifs --out packages/assets --only <id1>,<id2>
```

No manual files, no exceptions. If a free clip cannot pass the seam metric or the SSIM
floor, it does not ship — the QC gate does not have a mode for clips we like.

- [ ] **Step 4: Keep the previous set reachable**

Either a second published package or a documented `--set` switch plus a manifest swap, so a
consumer who pinned the original assets is not cut off. Prove it by installing the previous
version in a scratch directory and rendering a clip.

- [ ] **Step 5: Update the docs and commit**

`README.md` states which set is which and why two exist; `docs/content-policy.md` records
the change; `provenance-exceptions.json` shrinks to whatever remains grandfathered.

```bash
git add packages/assets docs README.md
git commit -m "feat(assets): freely-licensed default clip set"
```

## Acceptance criteria map

| Story | Plan task | Settled by |
|---|---|---|
| E4.1 Repo hygiene and metadata | Task 1 | `node scripts/check-manifests.mjs` green and failing on a removed field; `pnpm lint` green |
| E4.2 Community health files | Task 2 | `gh api …/community/profile` shows `contributing`, `license`, `pull_request_template` and `readme` present — measured 85 %, not 100 %: the code of conduct is declined (D-31) and the endpoint does not count the `ISSUE_TEMPLATE/` directory form |
| E3.5 CI matrix and coverage | Task 3 | six matrix legs green; a deliberately uncovered branch fails |
| E3.4 Public API surface | Task 4 | three deliberate breaks each fail the right assertion |
| E3.3 Accessibility audit | Task 5 | `pnpm a11y` clean; removing `aria-live` fails it |
| E2.4 Clip provenance | Task 6 | 32 clips carry provenance; a removed block fails the assets check |
| E4.3 Clip contribution policy | Task 7 | links resolve; an unlicensed new clip is refused |
| E4.4 Repo settings and public flip | Task 8 | `gh api` shows protection, scanning and `visibility: public` |
| E5.1 Release automation | Task 9 | dry run green; a tag publishes with provenance; `npm trust list` shows one entry per package |
| E5.2 First public release | build-plan Task 12, revised by Task 9 | three packages on npm at `0.1.0` |
| E5.3 Post-release verification | Task 10 | the report quotes every command; the README has no unverified marker |
| E4.5 *(optional)* free clip set | Task 11 | every clip has a licence and a source URL, or the story is `dropped` with a reason |

## Definition of done for a task

1. Its own command was run and the output read, not assumed.
2. `pnpm lint`, `pnpm typecheck`, `pnpm -r build` and `pnpm test` are green on the
   integration branch.
3. The commit contains only that task's files.
4. Every claim in the task's evidence is quoted output or an artifact path.
5. Anything the task could not settle is recorded in `docs/epic/PROGRESS.md`.


