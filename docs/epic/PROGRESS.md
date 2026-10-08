# Looped Loader — Progress Tracker

The only place where story status lives. Update it at the close of every story, with
evidence. Check it at the start of every session.

**Current focus:** wave 2 — **E1.2** (`.worktrees/core`) and **E2.1** (`.worktrees/tools`) in parallel. E1.1 is done.
**Baseline commit:** `a13b923` (spec, build plan and epic docs committed; no code yet).
**Test baseline:** 10 tests across 2 files, established at the close of E1.1 (`ae91409`).

## Status

| Id | Story | Status | Evidence | Notes |
|---|---|---|---|---|
| E1.1 | Workspace, licences, CI, picker | done | commit `ae91409`; `pnpm test` 10/10, `pnpm typecheck` green; `pnpm-lock.yaml` committed | 19 files, 1057 insertions; report `.waves/reports/E1.1.md` |
| E1.2 | Manifest validation, URL resolution | in-progress | — | — |
| E1.3 | Loader state machine, video lifecycle | todo | — | review-worthy |
| E1.4 | Vue adapter, composables, theming | todo | — | — |
| E1.5 | Vue behaviour tests | todo | — | reduced-motion flip, autoplay rejection, SSR |
| E1.6 | Demo playground | todo | — | needs E2.3 for real clips |
| E2.1 | Transcode ladder, ffmpeg layer | in-progress | — | independent of E1 after E1.1 |
| E2.2 | QC gate, manifest, CLI | todo | — | review-worthy |
| E2.3 | Corpus transcode, assets package | todo | — | **runs in the main checkout** (`gifs/` is untracked) |
| E2.4 | Per-clip provenance in the manifest | todo | — | review-worthy; blocks E4.3 |
| E3.1 | Browser verification with evidence | todo | — | main session only |
| E3.2 | Documentation and recipes | todo | — | — |
| E3.3 | Accessibility audit, `ACCESSIBILITY.md` | todo | — | — |
| E3.4 | Public API surface lock, type tests | todo | — | — |
| E3.5 | CI matrix and coverage thresholds | todo | — | blocks E5.1 |
| E4.1 | Repo hygiene, package metadata | todo | — | — |
| E4.2 | Community health files | todo | — | target: profile health 100 % |
| E4.3 | Clip contribution policy | todo | — | needs E2.4 |
| E4.4 | Public repo settings, branch protection | todo | — | **owner-gated** (irreversible) |
| E4.5 | *(optional)* freely-licensed clip set | todo | — | **owner-gated**; only if the risk decision changes |
| E5.1 | Release automation, trusted publishing | todo | — | main session only; 2-day validation window |
| E5.2 | First public release `0.1.0` | todo | — | **owner-gated** (irreversible) |
| E5.3 | Post-release verification | todo | — | main session only |

Status vocabulary: `todo`, `in-progress`, `review`, `done`, `blocked`, `dropped`. A
`blocked` row carries the concrete blocking condition in `Notes`, never a mood.

## Decision journal

Decisions taken after the spec was approved. The spec's D1–D8 and its accepted risk (§9)
are not repeated here.

| # | Decision | Reason | Date |
|---|---|---|---|
| D-1 | TypeScript pinned to `~5.9.3`, not the current `7.0.2` | TS 7 is a new native compiler and `vue-tsc@3.3.12` only declares `typescript >=5.0.0`; an unverified toolchain is not worth a version number | 2026-10-08 |
| D-2 | Core is built with `tsc`, not Vite | pure TypeScript with no assets; drops `vite-plugin-dts` and its `@microsoft/api-extractor` peer | 2026-10-08 |
| D-3 | Manifest validation is hand-written | core must have zero runtime dependencies | 2026-10-08 |
| D-4 | Missing or empty `baseUrl` raises `manifest-fetch` | the six error codes are closed; a new code would be a spec change | 2026-10-08 |
| D-5 | An absolute `http(s)://` source wins over `baseUrl` | lets one clip live elsewhere without a second manifest | 2026-10-08 |
| D-6 | The "no repeat" memory is a module-level ring of the last 3 ids | one page can hold several loaders; `resetRecent()` exists for tests | 2026-10-08 |
| D-7 | Default `label` is English `"Loading"`, not the spec's Russian | a public package must not hardcode a language; the spec's real requirement is that it is configurable | 2026-10-08 |
| D-8 | Assets are written only by `tools/transcode` | `--check` exists to catch a hand edit | 2026-10-08 |
| D-9 | x264 is invoked with `-threads 1` | thread count changes x264's output; without it a `--check` on another machine reports differences that look like corruption | 2026-10-08 |
| D-10 | The Vue adapter never mirrors `src` | the core owns the element's `src`; one source of truth avoids an ordering bug | 2026-10-08 |
| D-11 | The release publishes from GitHub Actions with trusted publishing, not from this machine | the binding reason is that trusted publishing and provenance both require a **cloud CI runner with an OIDC provider** — self-hosted and local runs are unsupported, so no local npm version can substitute for it. OIDC also removes the long-lived token entirely. The local npm version was cited here originally and was **not** the real constraint: it is now 11.21.0, above the 11.5.1 floor, and this decision is unchanged | 2026-10-08 |
| D-12 | The repository goes public **before** the first release | npm does not generate provenance for private repositories, even when publishing public packages — so provenance-first ordering requires public-first | 2026-10-08 |
| D-13 | Lockstep versioning across the three published packages for v1 | changesets is machinery without a second maintainer yet | 2026-10-08 |
| D-14 | Story files exist only where requirements are new | the spec and plans already carry the build requirements; a story file restating a plan task drifts within two edits | 2026-10-08 |
| D-15 | Local npm upgraded 10.9.4 → **11.21.0**; `npm@latest` is 12.2.0 and refuses to install on this machine | npm 12 requires node `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` and the local node is exactly 22.22.0. npm 11.21.0 is above the 11.5.1 trusted-publishing floor and ships **`npm trust`**, so trusted publishers can be configured from the CLI (`npm trust github --file release.yml --repo TopClans/looped-loader --allow-publish`, then `npm trust list` to verify) instead of through the npmjs.com UI | 2026-10-08 |
| D-16 | `.worktrees/` and `.waves/` are gitignored; a wave report lives at `.waves/reports/<story>.md`, outside every worktree and never committed | the report is completion evidence the Lead reads, not a deliverable; inside a worktree it would ride into that writer's own commit, and an untracked `.worktrees/` in the integration checkout makes `git status` unreadable | 2026-10-08 |
| D-17 | Wave 1 ran Task 1 in the main checkout on `feat/looped-loader`, as the plan's `Start` section directs, and it is the only task besides Task 6 with no worktree | Task 1 creates the workspace every later worktree branches from, so there is nothing to branch from until it lands; the runbook's isolation rule starts at Task 2 | 2026-10-08 |

## Technical debt and open items

| # | Item | Owner story | Status |
|---|---|---|---|
| TD-1 | `u3dob97sw2421` (12.2 s) is expected to land at `budget-exceeded` — 890 KB at CRF 26, above the 250 KB budget even after both ladder steps | E2.3 | open — owner decides weight vs. dropping the clip |
| TD-2 | Copyright on the 32 clips is **accepted, not solved**; the code/asset boundary and `NOTICE` mitigate, they do not fix | E4.5 | open — only if the owner revisits the risk decision |
| TD-3 | Ownership of the `@topclans` npm scope is unverified — npmjs.com refuses non-browser clients | E5.1 | open — check with `npm whoami` + `npm org ls` once authenticated, or with `npm access` |
| TD-4 | The CDN hosting recipe cannot be verified before the first publish | E5.3 | open — marked unverified in the README until then |
| TD-5 | No React adapter in `0.1.0`; the core interface is designed for one | roadmap (E3.2) | accepted |
| TD-6 | No published example app; consumers get the README recipes and the demo source | E3.2 | accepted |
| TD-7 | No docs site and no social preview image | — | accepted (YAGNI for a single-component library) |
| TD-8 | The demo's `test` script is a no-op that says so; its acceptance is a browser run | E3.1 | accepted |

## Baseline metrics

Measured 2026-10-08, before any code. These are the numbers a later claim gets compared
against, so they are recorded here rather than remembered.

| Metric | Baseline |
|---|---|
| GitHub community profile health | **14 %** — README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates, PR template, licence all missing |
| Repository topics / homepage | none / empty |
| Detected licence | none |
| Local npm / Node | **11.21.0** (upgraded from 10.9.4 during planning) / v22.22.0. `npm@latest` is 12.2.0 and refuses this machine: it requires node ≥ 22.22.2 |
| Corpus at CRF 26, long side 480 | 32 clips, 4.76 MB, median 103 KB, largest 890 KB, mean SSIM 0.969, 18 s to encode |
| Corpus source material | 32 MP4/h264, no audio, 23.88 MB, 0.45–12.15 s |
| Test suite | none yet; the first green baseline is established at the close of E1.1 |

## Waves

Wave logs live in `docs/epic/waves/<plan-name>.waves.md`, in the format given in
[`RUNBOOK.md`](RUNBOOK.md) §3. No wave has been run yet.

## Session log

One line per working session, newest last. This is what a later session reads to find out
what actually happened, as opposed to what was planned.

| Date | Session | Result |
|---|---|---|
| 2026-10-08 | brainstorm → spec → build plan → epic, runbook, tracker | repo created (private), spec and plan committed; 10 plan defects found and fixed in review; no code yet |
| 2026-10-08 | wave 1 — E1.1 | subagent run started; workers `glm-5.3-flash`, reviewers `MiniMax-M3`; E1.1 `done` at `ae91409` (10 tests green, lockfile committed), wave 2 dispatched |
