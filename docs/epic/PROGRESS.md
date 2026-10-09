# Looped Loader — Progress Tracker

The only place where story status lives. Update it at the close of every story, with
evidence. Check it at the start of every session.

**Current focus:** build plan Tasks 1–11 are complete and merged into `main`; **step 2's release preparation is committed and verified** — community files, the tag-triggered release workflow, the tarball and link checks, and the `0.1.0` changelog — and the working tree is clean. What remains is the irreversible pair: **E4.4** (flip `TopClans/looped-loader` public, then protect `main` and enable the security features) and **E5.2** (configure the trusted publisher, push `v0.1.0`, watch the release), then **E5.3** verification from outside. Both are owner-gated: nothing irreversible has been run, the repository is still private, and nothing is published.
**Baseline commit:** `a13b923` (spec, build plan and epic docs committed; no code yet).
**Test baseline:** 116 automated tests on the integration branch at `f9afcc1` — core 53, tools 49, vue 14 under jsdom — plus the assets verifier, which reads the committed media rather than a fixture, and the browser evidence in `docs/verification/2026-10-08-browser/`. Operational note: run `pnpm install` after **every** merge that touches the lockfile, or the newly merged package's own suite fails for want of its dependencies, which looks like a code failure and is not.

## Status

| Id | Story | Status | Evidence | Notes |
|---|---|---|---|---|
| E1.1 | Workspace, licences, CI, picker | done | commit `ae91409`; `pnpm test` 10/10, `pnpm typecheck` green; `pnpm-lock.yaml` committed | 19 files, 1057 insertions; report `.waves/reports/E1.1.md` |
| E1.2 | Manifest validation, URL resolution | done | commit `d214a83`, merged `21d976c`; core 32/32 green, `pnpm typecheck` green | 2 plan defects found and fixed in the plan file (D-18); report `.waves/reports/E1.2.md` |
| E1.3 | Loader state machine, video lifecycle | done | commit `ce50a1e`, merged `6c00bf6`; core 49/49 green, `pnpm typecheck` and `pnpm build` green | review `revise` (critical=1) → fix round → re-review `approve`; plan corrections D-20 |
| E1.4 | Vue adapter, composables, theming | done | commit `b63bb53` in the merged range | build emits `index.js`, `index.d.ts` and `index.css`, both CSS selectors present; merged together with E1.5 at `87bceed` | held unmerged until E1.5 landed so `pnpm -r test` was never red |
| E1.5 | Vue behaviour tests | done | commit `f847e8a`, merged `87bceed`; vue 14/14 green after E3.2's two fixes, bundle 2.5 KB gzip of a 12 KB budget, `pnpm typecheck` green | review 1 `approve` critical=0 minor=2 (TD-11, TD-12) — the suite caught two real component defects (SSR emitted `<video>`; the video then never received `src`); review 2 on the follow-up changes `approve` critical=0 minor=1 (a hardening note: the `rounded` test reads the source, not the built CSS) — reports `.waves/reports/E1.5-review*.md` |
| E1.6 | Demo playground | done | commit `6e495d8`, merged `2e0284e`; typecheck green over 5 packages | the browser found the layout defect the plan shipped (see E3.1); fixed in `c9db3ce`, merged `99db10b` |
| E2.1 | Transcode ladder, ffmpeg layer | done | commit `ce6c313`, merged `acdc054`; tools 18/18 green, `pnpm typecheck` green | lockfile staged with the `@types/node` addition (D-19); report `.waves/reports/E2.1.md` |
| E2.2 | QC gate, manifest, CLI | done | commit `f659786`, merged `e0a2158`; tools 46/46 green (0 skipped), `pnpm typecheck` and `pnpm build` green | review `revise` (critical=4) → fix round → re-review `approve` (10/12 new tests red on the old commit); D-21 in flight |
| E2.3 | Corpus transcode, assets package | done | commit `1422349`; `wrote 32 clips, 3.86 MB, 0 error(s), 14 review(s)` exit 0; `--check passed: 32 clips are byte-identical`; verifier `assets verified: 32 clips, 3.86 MB`; tamper test went red then was restored from a backup | 41 files, 4 049 965 bytes ≤ 5 242 880; 27 `base` + 4 `budget-adapted` + 1 `budget-exceeded` (`u3dob97sw2421`, 430 452 B, SSIM 0.9493); report `.waves/reports/E2.3.md` |
| E2.4 | Per-clip provenance in the manifest | todo | — | review-worthy; blocks E4.3 |
| E3.1 | Browser verification with evidence | done | `docs/verification/2026-10-08-browser/README.md` + three screenshots; 32/32 playing, 0 console errors, 0 failed requests of 83, 0 long tasks | the browser found three defects no test could (D-24, D-25 and the favicon 404); criteria 5, 6 and the main-thread addition are all met at `ce5261b` |
| E3.2 | Documentation and recipes | done | commit `bd4201f` + fix round `49e2b80`, merged `d1b8ef9`; vue 14/14, build and typecheck green; packed-tarball recipe verified in `$env:TEMP` | the fix round closed TD-11 and TD-13 and added the `./style.css` export (D-23); the CDN recipe stays marked unverified until E5.2 publishes |
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
| D-18 | The plan's Task 2 `manifest.ts` block was wrong twice and is corrected in the plan file: 13 `invalid(...)` calls were bare statements that never threw, and three `as Clip[...]` / `as Manifest[...]` casts fail under `exactOptionalPropertyTypes` | the plan's own tests fail 12/12 and `pnpm typecheck` fails with the block verbatim — observed, not assumed. Blast radius: every story that consumes `parseManifest` (E1.3, E1.4, E1.5, E1.6, E3.2, E3.4) and any later reader who copies the block | 2026-10-08 |
| D-19 | The plan's Task 4, 6, 7 and 9 commit lists omitted `pnpm-lock.yaml`; all three are corrected in the plan file | adding `@types/node` (T4), the `packages/assets` importer (T6), the Vue toolchain (T7) and the demo's deps (T9) rewrites the root lockfile, and CI installs with `--frozen-lockfile`, so the plan as written turns the first push red for a reason that looks nothing like its cause | 2026-10-08 |
| D-20 | Wave 3's plan blocks were wrong four more times and are corrected in the plan file: Task 3 passed explicit `undefined` into `buildPool`'s optional options under `exactOptionalPropertyTypes`, and two seeded expectations named the wrong clip; Task 5's duration guard used `> 100` where its own test requires exactly 100 ms to fail, and its seam fixture asked for `200 > 200`, unsatisfiable by any correct implementation | every one was observed as a failing test before anything changed. Rule applied: fix the code when the code can satisfy the test, fix the fixture when no correct implementation can. Blast radius: E1.5, E1.6, E3.2, E3.4 | 2026-10-08 |
| D-21 | The seam-regression gate fails the build only above an absolute noise floor of 2 (MAE on the 0–255 scale); below it the same regression is recorded as a `review` finding with code `seam-regression-noise` | measured on the real corpus: six clips failed at seam growth of 0.1–0.6 gray levels — invisible encoder noise — while the two clips with genuinely visible jumps (seam 27.09 and 22.77) only reached `review`, so the error tier was inverted. **Owner's ruling, 2026-10-08**; spec 5.3 updated by that decision | 2026-10-08 |
| D-22 | A complete `packages/assets` tree appeared in the main checkout during wave 3 (20:52–20:53) although no dsh session in this workspace ran the transcode — verified by decompressing every session transcript and searching for the invocation. The owner ruled: delete it, and let E2.3 produce it through the process | the tree was byte-identical to a fresh run (4 049 965 bytes, same sha256 set), so nothing was lost; but an artefact no process of this wave produced must never be adopted as a task's output. Recorded as an incident, not absorbed | 2026-10-08 |
| D-23 | The Vue package must expose its stylesheet — `"./style.css": "./dist/index.css"` in `exports`, and `sideEffects: ["**/*.css"]` in place of `false` | Vite library mode emits the scoped CSS as a separate `dist/index.css` and `dist/index.js` does not import it, so with no subpath export an npm consumer cannot load the styles by any route — proven by a failing build in a packed-tarball app. Spec §4.8's "inlined in the built bundle, no CSS import needed" was false for this build and is corrected. The `sideEffects` glob is the second half: `false` lets a consumer's bundler tree-shake the very import that makes the component visible | 2026-10-08 |
| D-24 | `attach()` no longer calls `resolve()`; resolution is owned by `start()` alone | the browser found that on a page with 32 loaders half of them died with `no-clips`: `attach()` started a fetch that bypassed `delayMs`, `start()`'s timer then started a second one, and the second pass re-entered `selectNext()`, which marks the clip it just selected as failed — so a one-clip pool reported `no-clips` on a pool that never failed. It also closed a second hole: under reduced motion `start()` deliberately does nothing, yet the removed branch still fetched on attach. Four regression tests pin it, each failing on the old source (`dc96e60`) | 2026-10-08 |
| D-25 | A self-hosted deployment copies `manifest.json` **and** `clips/` into one directory and points `base-url` at that directory | the manifest's `sources[].src` are `clips/<id>.mp4`, so `base-url` must be the parent of `clips/`, not `clips/` itself. The demo shipped the wrong layout and no manifest at all; Vite's SPA fallback then answered the missing path with `index.html` at status **200**, which passed the loader's `response.ok` check and failed at `response.json()` — 0 of 32 clips playing. The README's recipe was already right; the demo now follows it (`c9db3ce`) | 2026-10-08 |
| D-26 | `pnpm build` runs before `pnpm typecheck` in CI | in a fresh clone `packages/core/dist` does not exist (it is gitignored), and packages/vue and packages/demo resolve `@topclans/looped-loader-core` through those emitted declarations — so type-checking first fails with TS2307 plus a cascade of TS7006, and `pnpm test` would fail the same way. The first push of `main` went red exactly here; reproduced in a clean worktree, and the reordering turns the same tree green. A local run cannot catch it, because a developer's `dist/` is already built | 2026-10-08 |
| D-27 | Step 2 publishes the **current 32 clips**; E4.5 (the freely-licensed set) is deferred | **Owner's decision, 2026-10-09.** The copyright risk is already accepted in the product spec §9, and E4.5 stays planned and costed so the option remains real rather than forgotten. Starting it now would delay the release by an L-sized story whose outcome may be a visibly worse clip set | 2026-10-09 |
| D-28 | The OSS plan is **audited against the repository before any wave is dispatched** | it was written before the files it edits existed, and its own header says so. The build plan was written the same way and executing it surfaced nine defects (D-18…D-20) that reading had not caught; six are already visible in the OSS plan. The audit corrects blocks in the plan file and is then independently checked by a reviewer on a different model family, whose brief is to find blocks marked "verified" that are wrong | 2026-10-09 |
| D-29 | Task 8's order is corrected to **metadata → flip → branch protection → security features → verification** | on a private repository on this plan, protection and the GitHub security features do not exist: `gh api …/branches/main/protection` answers `403 Upgrade to GitHub Pro or make this repository public`, and CodeQL and secret scanning are free only on public repositories. The plan's order stops at its step 3, before ever reaching the flip. The consequence is a window of minutes in which the repository is public and unprotected — accepted explicitly, with nothing pushed during it | 2026-10-09 |
| D-30 | The OSS plan was audited against the repository and corrected in place: **nineteen findings**, two of them critical | the plan was written before the files it edits existed. The critical two: the release workflow ran `pnpm -r build`, which skips `scripts/sync-legal.mjs`, so the gitignored `LICENSE` files never exist and every tarball fails `check-tarballs.mjs` after the version is frozen; and the CI matrix both put `typecheck` before `build` (the `df65247` failure) and used `pnpm -r build`, which silently drops the bundle-budget gate. Others include three bare `invalid(...)` calls that never throw (D-18 recurring), a README props-table regex that could never match, a `vite` import at the repo root where `vite` is not installed, an ffmpeg guard placed inside the very `skipIf` block it was written to catch, and a `prettier --write .` with no `.prettierignore` that would reformat this plan and both specs. Each finding carries its evidence in the plan's "Plan audit (2026-10-09)" table | 2026-10-09 |
| D-31 | **No `CODE_OF_CONDUCT.md`**: the owner declined to publish one, 2026-10-09 | E4.2's acceptance line is "`gh api …/community/profile` reports `health_percentage: 100`", and GitHub's score counts a code of conduct among its six inputs, so this repository will read below 100 % and the design §7 precondition "the community profile reads 100 %" cannot be met as written. Recorded rather than hidden, and the target becomes "100 % of the files this project chooses to publish". `scripts/check-links.mjs` does not list the file, with a comment saying why, so a later reader does not read it as an oversight | 2026-10-09 |
| D-32 | The release preparation produced by a second, now-stopped session is **adopted, verified and committed** rather than redone | a parallel DSH session in this workspace was stopped by the owner mid-task and left eighteen uncommitted files. Every one was re-verified here rather than taken on trust: `pnpm test` 116 tests + assets verifier + link check, `pnpm typecheck` across five packages, `check-tarballs.mjs` green, a `pnpm -r publish --dry-run` rehearsal green with the owner's npm session, and the link check's failure path proved with a deliberately broken link. Its handover ledger (`.superpowers/sdd/2026-10-08-looped-loader/progress.md`) listed four corrections: three are applied, and the fourth — replacing its tested `execFileSync`-plus-platform-branch with a single `execSync` path — was deliberately not taken, because the branch was run green on this machine and churning tested code before a release buys nothing. What was not adopted is its draft root `test` script, which pre-empted E4.1 | 2026-10-09 |

## Technical debt and open items

| # | Item | Owner story | Status |
|---|---|---|---|
| TD-1 | `u3dob97sw2421` (12.2 s) is expected to land at `budget-exceeded` — 890 KB at CRF 26, above the 250 KB budget even after both ladder steps | E2.3 | open — owner decides weight vs. dropping the clip |
| TD-2 | Copyright on the 32 clips is **accepted, not solved**; the code/asset boundary and `NOTICE` mitigate, they do not fix | E4.5 | open — only if the owner revisits the risk decision |
| TD-3 | Ownership of the `@topclans` npm scope is unverified — npmjs.com refuses non-browser clients | E5.1 | **closed** 2026-10-09 — `npm org ls topclans` returns `{"topclans":"owner"}`, and the endpoint is authoritative: a nonexistent scope returns `E404 Scope not found`. It answers without a session, so the ownership question is settled independently of the npm login. The missing local session (`npm whoami` → `ENEEDAUTH`) is a separate gate, not an ownership question |
| TD-4 | The CDN hosting recipe cannot be verified before the first publish | E5.3 | open — marked unverified in the README until then |
| TD-5 | No React adapter in `0.1.0`; the core interface is designed for one | roadmap (E3.2) | accepted |
| TD-6 | No published example app; consumers get the README recipes and the demo source | E3.2 | accepted |
| TD-7 | No docs site and no social preview image | — | accepted (YAGNI for a single-component library) |
| TD-8 | The demo's `test` script is a no-op that says so; its acceptance is a browser run | E3.1 | accepted |
| TD-9 | `clip.id` is not validated as URL-safe, in the CLI or in the core: a source file named `a b#c.mp4` becomes an un-fetchable `sources[].src` | E2.4 or E3.4 | open — flagged by the E2.2 review, deliberately deferred out of that story |
| TD-10 | `qc-report.json` records findings but not the per-clip SSIM, so the plan's "SSIM within 0.01 of the floor" owner gate cannot be checked from the committed artefacts; the one budget-exceeded clip's SSIM (0.9493) was measured directly by the Lead and recorded in the wave log | E2.3 | open — not worth a re-run on its own; fold it into the next change that re-encodes |
| TD-11 | The Vue `rounded` prop is declared and bound as a class, but no rule in the SFC targets it, so `rounded={false}` does nothing | E3.2 | **closed** in `49e2b80` — the radius moved under `.ll-rounded .ll-video` and a test pins it |
| TD-12 | `autoplay-blocked` is emitted on every rejected `play()`, not once per loader; the spec's wording ("one retry, and `error('autoplay-blocked')") is singular and can be read either way | E1.5 | accepted — the review called it a defensible trade-off; the behaviour is now documented rather than changed |
| TD-13 | Spec §4.6 promises the clip fades in over 150 ms; the plan's Task 7 never implemented it, so the plan omitted a spec requirement | E3.2 | **closed** in `49e2b80` — a `ll-playing` class drives `opacity` over `var(--ll-fade-ms, 150ms)`, disabled under reduced motion |

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
[`RUNBOOK.md`](RUNBOOK.md) §3. Waves 1–5 of the build plan are logged in
[`waves/2026-10-08-looped-loader.waves.md`](waves/2026-10-08-looped-loader.waves.md); no wave of
the OSS plan has been run yet.

## Session log

One line per working session, newest last. This is what a later session reads to find out
what actually happened, as opposed to what was planned.

| Date | Session | Result |
|---|---|---|
| 2026-10-08 | brainstorm → spec → build plan → epic, runbook, tracker | repo created (private), spec and plan committed; 10 plan defects found and fixed in review; no code yet |
| 2026-10-08 | wave 1 — E1.1 | subagent run started; workers `glm-5.3-flash`, reviewers `MiniMax-M3`; E1.1 `done` at `ae91409` (10 tests green, lockfile committed), wave 2 dispatched |
| 2026-10-08 | wave 2 — E1.2 + E2.1 | both `done` (`d214a83`, `ce6c313`) and merged (`21d976c`, `acdc054`); integration branch 50/50 tests, typecheck and build green; 2 plan defects fixed (D-18, D-19); wave 3 dispatched |
| 2026-10-08 | wave 3 — E1.3 + E2.2 | both `done` after a fix round each: E1.3 `ce50a1e` merged `6c00bf6`, E2.2 `f659786` merged `e0a2158`; integration branch 95/95 tests, typecheck and build green; both re-reviews `approve`; incident D-22 and the owner's gate ruling D-21 recorded |
| 2026-10-08 | wave 4 — E1.4 done, E1.5 and the QC gate in flight | E1.4 `b63bb53` (unmerged by design so the suite never goes red); the real corpus reproduced at 3.86 MB with 6 noise-level seam errors and one budget-exceeded clip at SSIM 0.9493 — exactly what D-21 answers |
| 2026-10-08 | wave 4 — E2.3 | assets transcoded in the main checkout at `1422349`: 32 clips, 4 049 965 bytes, 0 QC errors, 14 reviews, `--check` byte-identical, verifier green; the ACL was proven able to fail by tampering a sha256 and restoring it |
| 2026-10-08 | wave 5 start — E1.4 + E1.5 merged, E1.6 and E3.2 dispatched | `87bceed`, integration branch 109 tests + verifier green, typecheck and build green (core 5.4/8 KB, vue 2.4/12 KB); the Vue survey found two real component defects and one inert prop |
| 2026-10-08 | wave 5 — E1.6 + E3.2 merged; E3.1 opened | demo at `99db10b` after the manifest-layout fix `c9db3ce`; docs and the two bounded Vue fixes at `d1b8ef9`; 113 tests + verifier green; the browser then found a **core** race that kills half the loaders on a page with many instances — the reason E3.1 exists |
| 2026-10-08 | wave 5 close — E3.1 | the browser found three defects, all fixed: the demo served no manifest and Vite answered with HTML at 200 (`c9db3ce`), a core double-resolve killed half the loaders (`dc96e60`, merged `ce5261b`), and a favicon 404 failed criterion 5. Final run: 32/32 playing, 0 console errors, 0 failed requests, 0 long tasks, and reduced motion verified by real media emulation. Tasks 1–11 complete at `f9afcc1` |
| 2026-10-08 | ship — merge to `main` and push | `feat/looped-loader` merged fast-forward; the first push of `main` went red on CI because `pnpm typecheck` ran before `pnpm build` and a clean clone has no `packages/core/dist`; reproduced in a clean worktree, fixed in `df65247`, CI green (run `37828155212`), `origin/main` in sync. Recorded as D-26 |
| 2026-10-09 | step 2 brainstorm — design spec | measured the state rather than trusting the plan (CI green at `df65247`, community profile 42 % not 14 %, `@topclans` verified as the owner's org, no npm session, branch protection impossible while private); six OSS-plan defects found by comparing it with the repository; design spec written and committed; E4.5 deferred by the owner (D-27), audit-before-execute adopted (D-28), Task 8 reordered (D-29) |
| 2026-10-09 | step 2 — plan audit (D-30) | ran the plan's own scripts read-only as probes and checked every block against the repository: nineteen findings, two critical, all corrected in the plan file with evidence in a new "Plan audit (2026-10-09)" table; build-plan Task 12 de-duplicated so the publish and the flip have one owner each; the wave schedule recorded in both the spec and the plan, with Task 6 in the main checkout. The plan is executable; no wave has been dispatched |
| 2026-10-09 | step 2 — release preparation adopted and committed | a parallel session was stopped by the owner and its eighteen uncommitted files were handed over; every one was re-verified here rather than trusted (116 tests, typecheck across five packages, tarball check green, publish dry-run rehearsal green with the owner's npm session, link-check failure path proved with a deliberately broken link), then committed in three task-sized chunks (`1ea6965`, `773a6de`, `67290ba`) and recorded as D-32; the declined code of conduct is D-31. The repository is still private, nothing is published, no tag exists |
