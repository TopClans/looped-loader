# Wave log — build plan `2026-10-08-looped-loader.md`

Format: [`../RUNBOOK.md`](../RUNBOOK.md) §3. One section per wave, newest last.
Model picks for this run: **workers `glm-5.3-flash`** (ccr), **reviewers `MiniMax-M3`** (ccr),
chosen by the owner on 2026-10-08 (Thursday, 19:11 Yekaterinburg — GLM off-peak, 0.4×).
Scope agreed with the owner: plan Tasks 1–11 plus Task 10 in the main session; Task 12
(publish) stays owner-gated and is not started.

## Wave 1 — story E1.1 — started 2026-10-08T14:15Z — base 365cbde — runner lead

- NOTE: Task 1 runs in the **main checkout** on `feat/looped-loader`, as the plan's `Start`
  section directs; it is the only task with no worktree of its own, because it creates the
  workspace every later worktree branches from.
- NOTE: report files live in `.waves/reports/<story>.md`, outside every worktree and never
  committed, so a writer's report cannot ride into its own commit.
- E1.1 — DONE — `ae91409` — ccr/glm-5.3-flash — `pnpm test` 10/10, `pnpm typecheck` green, `git show --stat` 19 files/1057 insertions, stash empty, `git log --all -- gifs` empty — review n/a (plan marks T1 review-exempt) — 1 cycle — ~12m
- NOTE: the worker's red run failed with Vitest 5's wording (`Cannot find module '../src/prng.js'`) rather than the plan's Vitest-4-era `Failed to resolve import`; same failure class, no config error. A future reader should not treat the wording difference as a deviation.
### Closed 2026-10-08T14:26Z — STATUS: DONE at E1.1

## Wave 2 — stories E1.2, E2.1 — started 2026-10-08T14:26Z — base db6cf28 — runner lead

- NOTE: two writers with disjoint scopes — `.worktrees/core` (`packages/core/**`) and `.worktrees/tools` (`tools/transcode/**` plus the root `transcode` script). Neither scope overlaps the other, so one-writer-per-directory holds.
- E1.2 — DONE — `d214a83`, merged `21d976c` — ccr/glm-5.3-flash — core 32/32, typecheck green — review n/a (T2 is not review-worthy) — 1 cycle — ~10m
- E2.1 — DONE — `ce6c313`, merged `acdc054` — ccr/glm-5.3-flash — tools 18/18, typecheck green — review n/a (T4 is not review-worthy) — 1 cycle — ~10m
- NOTE: **plan defect, corrected in the plan file** — Task 2's `manifest.ts` block had 13 bare `invalid(...)` calls that never threw (the helper is a factory) and three casts that fail under `exactOptionalPropertyTypes`. The worker found it by running the plan's own tests, which failed 12/12; it did not "fix the test". Blast radius in PROGRESS.md D-18.
- NOTE: **plan defect, corrected in the plan file** — Task 4's commit list omits `pnpm-lock.yaml`, and so do Tasks 7 and 9; all three now stage it. CI installs with `--frozen-lockfile`, so the plan as written would have turned the first push red. PROGRESS.md D-19.
- NOTE: E2.1 relayed one transient `pnpm` registry `ECONNRESET`, auto-retried by pnpm, install succeeded. Not an incident, recorded so a later reader does not re-derive it.
- NOTE: branches `feat/core` and `feat/transcode` are retired after the merge; wave 3 opens fresh worktrees on `feat/loader` and `feat/qc` so no task inherits another task's worktree state.
- Lead re-verification on the integration branch after both merges: `pnpm install`, `pnpm test` **50/50** (core 32, tools 18), `pnpm typecheck` green, `pnpm build` green with `packages/core/dist` at 2.9 KB gzip against the 8 KB budget.
### Closed 2026-10-08T14:38Z — STATUS: DONE at E1.2 and E2.1

## Wave 3 — stories E1.3, E2.2 — started 2026-10-08T14:39Z — base acdc054 — runner lead

- NOTE: both stories are review-worthy per the plan; each gets a `MiniMax-M3` review in its own detached worktree, judging the committed sha only. Reviews run after the merges, not inside a writer's worktree.
- E1.3 — DONE — `ce50a1e` (fix round on top of `5803a31`), merged `6c00bf6` — ccr/glm-5.3-flash — core 49/49, typecheck green — review ccr/MiniMax-M3: first pass `revise` critical=1 major=2 minor=3, re-review at `ce50a1e` `approve` critical=0 — 2 cycles
- E2.2 — DONE — `f659786` (fix round on top of `6edc2a3`), merged `e0a2158` — ccr/glm-5.3-flash — tools 46/46 (0 skipped), typecheck and build green — review ccr/MiniMax-M3: first pass `revise` critical=4 major=1 minor=2, re-review at `f659786` `approve` critical=0 minor=4 — 2 cycles
- NOTE: both re-reviews proved their own machinery rather than trusting the implementer's tests. The E1.3 reviewer copied the five new tests onto the **old** `loader.ts` and watched all five fail; the E2.2 reviewer did the same for the CLI and got 10 red of 12. A regression test that also passes on the broken code pins nothing, and neither review accepted one.
- NOTE: the first E1.3 review found a real spec violation the plan had shipped — spec §6 caps the clip-failure fallback at three attempts, and `attempts = 0` inside `selectNext()` made that cap dead code, so a 32-clip pool with every clip broken performed 32 media loads. The re-review confirmed the fix brings it to exactly three, and that the new 4-clip test fails on the old source.
- NOTE: the first E2.2 review found four shipping defects the plan's happy path never reaches — `clips: []` written as if it were a valid manifest, `--check` blessing a build that produced nothing, orphan clips riding into the published tarball, and every operator error surfacing as a stack trace. All four are fixed and pinned by tests that regress on the old commit.
- NOTE: the four plan-block defects this wave produced are recorded in PROGRESS.md D-20 and corrected in the plan file.
### Closed 2026-10-08T16:05Z — STATUS: DONE at E1.3 and E2.2

## Wave 4 — stories E1.4, E1.5, and the QC-gate noise floor — started 2026-10-08T15:10Z — base e0a2158 — runner lead

- NOTE: E1.4 (Task 7, the Vue package) runs first and is deliberately left **unmerged**: the package has no test files until E1.5, so `pnpm -r test` would be red on the integration branch in between. E1.4's gate is its build and CSS check, not a test run.
- NOTE: the real corpus was transcoded twice — once by an unattributed run into the main checkout (incident D-22) and once by the Lead into a scratch directory — and the two agreed byte-for-byte at 4 049 965 bytes. The gate fails it with six `seam-regression` errors at seam growth of 0.1–0.6 gray levels, while the two clips with genuinely visible jumps (seam 27.09 and 22.77) only reach `review`. That is the measurement behind the owner's ruling D-21.
- NOTE: `u3dob97sw2421`, predicted `budget-exceeded`, landed at 430 452 bytes with the ladder spent and SSIM **0.9493** — 1.9 points above the 0.93 floor, so the plan's "within 0.01 of the floor" owner gate is not triggered. Measured by the Lead with the tool's own `ssimOf` against a lossless reference, not read from a report.
- NOTE: `qc-report.json` records findings but not the per-clip SSIM, which is what made that gate un-checkable from the artefacts; recorded as TD-10.
- E1.4 — DONE, unmerged — `b63bb53` — ccr/glm-5.3-flash — build emits `index.js`, `index.d.ts` and `index.css`, both CSS selectors present, `pnpm typecheck` green — review n/a (T7 is not review-worthy; the E1.5 review covers the package) — 1 cycle ~12m
