# Looped Loader — Step 2 Execution Design: open-source readiness and the `0.1.0` release

Status: awaiting owner review (stage 4 of 6 of the brainstorming path)
Date: 2026-10-09
Repo: https://github.com/TopClans/looped-loader (private; becomes public in this step)
Author: session with the owner (TopClans)
Product spec (unchanged): `docs/superpowers/specs/2026-10-08-looped-loader-design.md`
Plan this design governs: `docs/superpowers/plans/2026-10-08-looped-loader-oss-readiness.md`
Epic, runbook, tracker: `docs/epic/README.md`, `docs/epic/RUNBOOK.md`, `docs/epic/PROGRESS.md`

## 1. Intent

Step 1 (build plan tasks 1–11) produced a working library: core, Vue adapter, assets, demo,
browser evidence, documentation. Step 2 takes that working private library to the state where
publishing it as an open-source project is **defensible**, and releases `0.1.0` to npm with a
provenance attestation and no long-lived token anywhere.

Success is: the repository is public with a protected `main` and a 100 % community profile;
CI is green on Linux and Windows across Node 20/22/24; the public API is pinned by tests, so a
breaking change cannot ship unnoticed; an axe audit in a real browser is clean; every clip
carries provenance and the pipeline refuses one that does not; and all three packages at
`0.1.0` install from the registry with `npm audit signatures` verifying their attestations.

Explicitly **not** in this intent: new product features, a React adapter (TD-5), a docs site
(TD-7), a freely-licensed clip set (E4.5 — deferred, §2), a macOS CI leg (a recorded decision
in the plan), or any change to the product spec's settled decisions D1–D8.

## 2. Scope

**In:** E4.1, E4.2, E3.5, E3.4, E3.3, E2.4, E4.3, E4.4, E5.1, E5.2, E5.3 — that is plan tasks
1–10 plus the release itself.

**Deferred by the owner on 2026-10-09:** E4.5 (freely-licensed default clip set, plan task 11).
`0.1.0` publishes the current 32 clips, whose copyright risk the owner accepted in the product
spec §9. E4.5 stays planned and costed; it is not started. This is a decision, not an omission
(D-27).

**Not reopened by this design:** product spec D1–D8, the accepted copyright risk (§9), D-11
(release from GitHub Actions with trusted publishing, never from this machine), D-12 (the
repository goes public before the first release, because provenance requires it).

**Deliverables of step 2, in one line each:**

| Deliverable | Story | Evidence that ends it |
|---|---|---|
| Lint, format, commit style, package metadata | E4.1 | `scripts/check-manifests.mjs` green, and red on a removed field |
| Community health files | E4.2 | `gh api …/community/profile` reports `health_percentage: 100` |
| CI matrix and coverage thresholds | E3.5 | six matrix legs green; a deliberately uncovered branch fails the gate |
| Public API locked by tests | E3.4 | three deliberate breaks each fail the right assertion |
| Accessibility audit in a real browser | E3.3 | `pnpm a11y` clean; removing `aria-live` fails it |
| Per-clip provenance, enforced by the pipeline | E2.4 | 32 clips carry provenance; a removed block fails the assets check |
| Clip contribution policy | E4.3 | links resolve; an unlicensed new clip is refused |
| Repository settings, protection, public flip | E4.4 | `gh api` shows protection, scanning, `visibility: public` |
| Release automation with trusted publishing | E5.1 | dry run green; a tag publishes with provenance; `npm trust list` shows one entry per package |
| First public release `0.1.0` | E5.2 | three packages on npm at `0.1.0` |
| Post-release verification | E5.3 | the report quotes every command; the README has no "unverified" marker |

## 3. Measured state at the start of step 2

Measured on 2026-10-09 in this session, with the command that produced each fact. Anything a
task depends on and that is not in this table must be re-checked before it is relied upon.

| Fact | Value | How it was measured |
|---|---|---|
| Branch and sync | `main` = `origin/main` = `df65247`, working tree clean | `git log --oneline -1 main`, `git status --short` |
| CI on `main` | green — run `37828155212`, "fix(ci): build before typecheck", success; the previous push (`2a27075`) failed | `gh run list --limit 6` |
| Test baseline | 116 automated tests at `f9afcc1` — core 53, tools 49, vue 14 — plus the assets verifier | `docs/epic/PROGRESS.md` |
| Corpus | 32 clips, 4 049 965 bytes, 0 QC errors, 14 review findings | `packages/assets/qc-report.md`, `manifest.json` |
| npm org `@topclans` | exists; member `topclans` has role **owner** | `npm org ls topclans` → `{"topclans":"owner"}`; control `npm org ls zzz-no-such-org-12345` → `E404 Scope not found` |
| Local npm session | **none** — `npm whoami` → `ENEEDAUTH`; `npm trust list @topclans/looped-loader-core` → `401` | both commands |
| `@topclans/looped-loader-core` | not published yet (`404`) | `npm view @topclans/looped-loader-core version` |
| `npm trust` on an unpublished name | the `--dry-run` call printed the intended trust relationship and did not error | `npm trust github @topclans/looped-loader-core --file release.yml --repo TopClans/looped-loader --allow-publish --dry-run` — **weak evidence**, see §5.3 |
| Local toolchain | npm 11.21.0, node 22.22.0, pnpm 10.15.1 | `npm --version`, `node -v`, `pnpm -v` |
| Tool pins from plan task 1 | all resolve: eslint 10.12.0, @eslint/js 10.0.1, typescript-eslint 8.71.1, eslint-plugin-vue 10.11.1, vue-eslint-parser 10.4.1, eslint-config-prettier 10.1.8, prettier 3.9.9, @commitlint/cli 21.2.3, @commitlint/config-conventional 21.2.3 | `npm view <pkg> version` for each |
| Community profile | **42 %** (the plan's "Verified facts" say 14 %) — LICENSE detected as MIT, README present; contributing, code of conduct, issue templates and PR template are `null` | `gh api repos/TopClans/looped-loader/community/profile` |
| Repository | `visibility: private`, `default_branch: main`, `topics: []`, `homepage: null`, license MIT | `gh api repos/TopClans/looped-loader` |
| Branch protection | **unavailable while private**: `403 Upgrade to GitHub Pro or make this repository public to enable this feature` | `gh api repos/TopClans/looped-loader/branches/main/protection` |
| `gh` authentication | account `TopClans`, scopes `gist`, `read:org`, `repo`, `workflow` — no `security_events`, no `admin:org` | `gh auth status` |
| Criterion 9 of the build plan | **open** — the owner's contact-sheet review; build plan `Task 12 Step 1` is unticked | `grep '^- \[.\] \*\*Step' docs/superpowers/plans/2026-10-08-looped-loader.md` |

## 4. The plan audit — the first deliverable

The OSS plan was written on 2026-10-08 **before the files it edits existed**, and it says so in
its own header. The build plan was written the same way, and executing it surfaced nine defects
(D-18, D-19, D-20) that no amount of reading had caught. Step 2 therefore begins with an audit
rather than with a wave (D-28).

**Contract.** For every block in the plan that creates or modifies a file, four things are
checked, and each answer is recorded against the block:

1. **Existence and shape** — the file exists and its current content matches what the block
   assumes it is editing.
2. **Resolvability** — dependencies and versions install.
3. **Executability here** — the command runs on Windows with PowerShell, pnpm 10.15.1 and node
   22.22.0. `bash` does not run in this environment, so no step may depend on it.
4. **Consistency with decisions taken after the plan was written** — D-21…D-26, the `df65247`
   CI ordering fix, the `./style.css` export, the radius moving under `.ll-rounded`, the demo
   manifest layout.

The plan's "Verified facts" section is rewritten from §3 of this design.

**Output.** A table of defects, each with the file, line and command output that proves it, and
the correction applied **in the plan file** — the same treatment D-18…D-20 gave the build plan.
Nothing in the audit is a rewrite of the plan: a block that is correct is left byte-identical.

**Independence.** The audit is performed in the main session, because it is judgement about a
repository rather than typing. It then gets one independent check by a reviewer on a different
model family, whose brief is narrow and adversarial: find blocks marked "verified against file
X" that are in fact wrong. That is the failure mode which carried thirteen `throw` statements
and two wrong seed indices through the build plan.

**Done when:** every block in the plan carries either "verified against `<file>`, line N" or a
correction. No block may be left with only "looks right".

**Stops the audit:** if a correction would require changing the product spec or reopening D1–D8,
D-11, D-12 or the accepted risk in §9. That is an owner question, not an audit finding.

## 5. Defects already found, before the audit began

These are seeds, not the audit's output. Each was found by comparing the plan with the
repository as it now exists.

**5.1 Task 3 reintroduces the CI failure that was just fixed.** The matrix workflow block puts
`pnpm typecheck` before `pnpm -r build`. In a fresh clone `packages/core/dist` does not exist,
`packages/vue` and `packages/demo` resolve `@topclans/looped-loader-core` through those emitted
declarations, and type-checking first fails with TS2307 plus a cascade of TS7006 — exactly the
failure that turned the first push of `main` red (run `37827667850`) and was fixed in `df65247`.
**Correction:** `build` before `typecheck` in the matrix job, with the reason as a comment.

**5.2 Task 8 does the impossible before doing the possible.** Its steps run in the order
metadata → protect `main` → security features → flip to public. On a private repository on this
plan, protection and the security features do not exist: `gh api
…/branches/main/protection` answers `403 Upgrade to GitHub Pro or make this repository public`,
and CodeQL and secret scanning are free only on public repositories. **Correction:** metadata →
**flip** → protection → security features → verification, in one sitting. The consequence is a
window of minutes in which the repository is public and not yet protected; §7 makes that window
an explicit, accepted part of the gate rather than an accident.

**5.3 The plan's one open question is only half answered.** Task 9 asks whether `npm trust`
accepts a package that does not exist yet, because the npm documentation describes configuring a
trusted publisher from the *package's* settings. The `--dry-run` probe accepts the unpublished
name, but it ran without a session, so it may not have reached the registry — the same command
without a session returned `401` for `list`. **Correction:** the question stays open and is
answered by the owner's authenticated `--dry-run` at the start of task 9; the plan's text keeps
the fallback (publish `0.1.0` with a short-lived token, configure the publisher for `0.1.1`) but
does not adopt it.

**5.4 The build plan still publishes from this machine.** Build plan `Task 12 Step 4` runs
`pnpm --filter … publish` locally, which contradicts D-11 (release from GitHub Actions with
trusted publishing). The OSS plan says it "revises" that task, but the build plan's text was
never changed. **Correction:** `Task 12 Step 4` becomes "push the `v0.1.0` tag and watch
`release.yml`"; the local publish commands are deleted.

**5.5 The flip has two owners.** It appears in build plan `Task 12 Step 6` and in OSS plan
`Task 8 Step 5`. **Correction:** OSS `Task 8` owns it; the build plan's step becomes a pointer,
so a reader cannot execute the flip from the older document.

**5.6 The build plan's token fallback is obsolete.** `Task 12 Step 1` offers an npm automation
token in the vault as an alternative to `npm login`. The scope is verified as the owner's (§3),
D-11 forbids the token, and an invariant of this step is "no long-lived token anywhere".
**Correction:** delete the token path; keep the `npm login` requirement, now backed by the
measured `ENEEDAUTH`.

## 6. Execution model

### 6.1 The real bottleneck is the write scopes, not the dependency graph

Five tasks write to the root `package.json` (T1, T2, T3, T5, and T4 if a script is needed),
three write to `.github/workflows/ci.yml` (T1, T3, T5) and to `pnpm-lock.yaml` (T1, T3, T5).
The epic's "parallel-friendly pairs" therefore overstate what is possible: **at most two writers
can run at once**, and the schedule below is derived from the file lists in the plan, not from
the epic's diagram.

Two dependencies the epic does not show, both found in the file lists:

- **T3 depends on T2**: T3's `test:coverage` script calls `scripts/check-links.mjs`, which T2
  creates.
- **T3 and T6 both write inside `tools/transcode/test/`**, and **T4 and T6 both write inside
  `packages/core/test/`** — one writer per directory, so they must not overlap in time.
- **T6 cannot run in a worktree at all**: its Step 7 re-runs the pipeline over `gifs/`, which is
  untracked and therefore absent from every worktree, and it rewrites the committed
  `packages/assets/manifest.json` in place. It runs in the **main checkout**, exactly as
  build-plan Task 6 did (D-17), while its wave-mate runs in a worktree. *(Corrected by the
  2026-10-09 audit: this section first placed both writers in worktrees.)*

### 6.2 Schedule

| Wave | Tasks | Why this grouping |
|---|---|---|
| 1 | T1 | owns the root `package.json`, `ci.yml`, the package manifests and the lockfile; everything else extends them |
| 2 | T2 ∥ T6 | community files and link check (root `.md`, `.github/`, `scripts/`) against provenance in the pipeline (`tools/transcode`, `packages/assets`, `packages/core/src`) — disjoint directories |
| 3 | T3 ∥ T4 | CI matrix (`ci.yml`, root pkg, vitest configs, `tools/transcode/test/pipeline.test.ts`) against public-API tests (`packages/*/test`) — disjoint |
| 4 | T5 ∥ T7 | a11y audit (`pkg`, `ci.yml`, `scripts/`, `docs/verification/`) against content policy (`docs/`, `CONTRIBUTING.md`, `NOTICE`, `README.md`) — disjoint |
| 5 | T8 | repository settings and the flip — main session, irreversible, on the owner's word |
| 6 | T9 | release workflow and `docs/release.md` — main session; its dry-run job runs before any tag, so a broken workflow is found before a version is spent |
| 7 | E5.2 + T10 | publish `0.1.0`, then verify from outside — main session |

**Critical path:** T1 → T2 → T3 → T8 → T9 → publish → T10. T4, T5, T6 and T7 hang off it and do
not lengthen it.

### 6.3 Isolation, reports, merges

As in the build plan: one writer per worktree under `.worktrees/<name>`, its own branch, and a
report at `.waves/reports/<story>.md` outside every worktree, never committed (D-16). The Lead
merges after the task's own gate is green and re-runs the integration checks on `main` itself.

### 6.4 Branches and pull requests

Waves 1–3 merge into `main` directly: there is no protection yet, and the build phase used the
same route. **Wave 4 is deliberately taken through a pull request**: by then the PR template
(T2) and the six-leg matrix (T3) exist, and it is the only way to exercise the contributor path
before the repository is public. After T8, pull requests are the only route — the protection
rule requires them.

### 6.5 Review

Independent review on a different model family for **T4, T5, T6 and T9** — the four tasks where
a silent mistake publishes a false claim. The audit gets its own independent check (§4). The
reviewer judges the committed sha only, in its own detached worktree, and a regression test is
accepted only if it fails on the pre-fix commit.

### 6.6 Models

Asked before every wave, as `~/.dsh/AGENTS.md` requires — never chosen silently. The plan's
classes: cheap worker for T1, T2, T3, T6, T7; mid-tier for T4 and T5 (vacuous assertions and
jsdom false confidence are the failure modes there); main session only for T8, T9, T10 and E5.2.

## 7. Irreversible steps and the gate protocol

Three actions in step 2 cannot be taken back in any meaningful sense:

1. **Flipping the repository to public.** It can be flipped back, but the clips and the
   repository's history have already been fetched by then. Returning to private reduces further
   exposure; it does not undo it.
2. **Publishing `0.1.0`.** npm does not allow unpublishing a version older than 72 hours. A
   wrong release is treated with `deprecate`, and a fix ships as `0.1.1`.
3. **Configuring the trusted publisher.** The configuration expires after two days if its first
   publish does not succeed, so configuration and tag must happen the same day.

**Gate protocol, identical for all three.** The action runs only on an explicit instruction in
the current conversation. Before it, the state is printed: what changes, why it is irreversible,
and how it would be rolled back. After it, the promised state is verified and the result is
written into `docs/verification/`. No step is taken "while we are here".

**Preconditions of the flip — checked, not assumed:**

- [ ] The owner has reviewed the contact sheet (`docs/verification/2026-10-08-browser/contact-sheet.png`).
      This is criterion 9 of the build plan and it is still open (§3).
- [ ] Waves 1–4 are merged, `main` is green, and the community profile reads 100 %.
- [ ] `git log --all -- gifs/` is empty (already true) and no file in the history contains a
      credential-shaped string.
- [ ] **The owner accepts that the whole working record becomes public** — `PROGRESS.md` with
      its incident journal and the accepted clip risk, both plans, the product spec, the story
      files and the wave log. This is a decision, and it is irreversible.
- [ ] The "unverified" marker stays in the README: the CDN recipe can only be verified after a
      publish.

**The corrected order for T8, and the window it creates:** metadata → flip → protection →
security features and labels → verification, all in one session. Between the flip and the
protection rule there is a window of minutes in which `main` is public and unprotected. The
window is accepted because the alternative — protecting first — is impossible on this plan
(§5.2), and because nothing is pushed during it.

**What the owner must do personally:**

- `npm login`, and 2FA when the trusted publisher is configured. There is no npm session on this
  machine today (`ENEEDAUTH`), and writing without one is provably impossible (`401`).
- Review the contact sheet.
- Give the word for the flip and for the tag.

`gh` is already authenticated as `TopClans` with `gist`, `read:org`, `repo`, `workflow` — enough
for repository metadata and branch protection. It is **not** enough for CodeQL's default setup
(`security_events` missing), so that step either refreshes the scope or uses the web UI; the
plan already allows either route and requires the route to be recorded. The org's plan cannot be
read through the API without `admin:org`, but the `403` on branch protection already establishes
that this repository does not get protection while private.

**Rollback, honestly stated.** Flip: back to private — mitigation, not reversal. Publish:
`npm deprecate`, never `unpublish`; the version stays in the registry forever. Tag: the tag can
be deleted; the version cannot.

## 8. Verification and acceptance

**Per task, a gate that can fail.** Every claim ends in command output or an artifact, and every
gate is demonstrated failing at least once:

- **T1** — `check-manifests.mjs` green, and red when a required field is removed from a manifest.
- **T2** — `check-links.mjs` green, and red on a deliberately broken link.
- **T3** — the coverage threshold fails the build on a deliberately unreachable branch.
- **T4** — three deliberate breaks of the public surface, each failing its own assertion.
- **T5** — removing `aria-live` fails the axe audit.
- **T6** — removing a provenance block fails the assets check.
- **T9** — the dry-run job prints three tarballs and fails if one lacks `LICENSE` or contains
  `src/`, `test/` or `gifs/`.

**After every merge, on `main` and not in the writer's worktree:** `pnpm install
--frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm -r build`, `pnpm test`, plus the task's
own command. This is how the build phase learned that "green in the worktree" is not "green in a
clean clone".

**Acceptance of step 2 as a whole:** the plan's acceptance-criteria map, plus the "Definition of
public-ready" checklist in `docs/epic/README.md`, each line carrying a quoted output or an
artifact path.

**Recorded as it happens:** `PROGRESS.md` (status, evidence, decisions), the decision journal
(D-27 onward), the wave log under `docs/epic/waves/`, and the per-task reports under
`.waves/reports/`.

**Honest limits, stated so they are not read later as promises.** The accessibility audit covers
the demo page, not every consumer integration. Provenance enforcement proves a claim exists, not
that it is true — nothing in the repository can tell whether a contributor's licence claim is
honest, and the policy says so. CodeQL on a small TypeScript library mostly restates what ESLint
and the type checker already catch; it is enabled because its absence is a question a
security-conscious consumer asks. The matrix covers Node 20/22/24 on Linux and Windows, not
other browsers and not other CI providers.

## 9. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| The trusted-publisher configuration expires in two days | Configuration and tag are one sitting; the error does not look like a timeout | Configure it when the release is imminent, publish the same day (§7) |
| No npm session, 2FA required | Every release step stops without the owner | The owner's `npm login` is a named precondition, verified with `npm whoami` before the gate |
| The first publish may need a traditional path | If `npm trust` refuses an unpublished package, the plan's shape changes | The authenticated `--dry-run` answers it at the start of T9, before anything is tagged (§5.3) |
| Windows CI leg | `choco install ffmpeg` and the integration tests must not silently skip | T3 adds a guard that fails when `CI=true` and ffmpeg is absent |
| Node 20 leg | Vite 8 and Vitest 5 require newer Node minors than the matrix's floor implies | The first matrix run is the test; if a leg cannot work, the constraint is corrected deliberately rather than by dropping the leg |
| Lockfile churn across five tasks | `--frozen-lockfile` in CI; a stale lockfile fails for a reason unrelated to the change | Every task that touches dependencies stages `pnpm-lock.yaml` (the D-19 lesson) |
| The audit becomes a rewrite | It would consume the step's budget before any deliverable | Bounded by §4: a correct block is left untouched; defects are listed with evidence |
| Public but not yet protected | Minutes in which `main` accepts a direct push | One sitting, nothing pushed during the window, stated in §7 |
| Required status-check names | A context that matches no job blocks every pull request forever | Read the names from a real run before filling `protection.json` — the plan already says this |
| A bad version published | The version stays in the registry | Dry run before the tag; `deprecate` and `0.1.1` after |
| Copyright on the 32 clips | Accepted risk, not a solved problem | Documented in `NOTICE`, `docs/content-policy.md`, the spec §9; takedown route published |

## 10. What this design does not do

It does not change the product spec, the component, the clip corpus or the settled decisions
D1–D8. It does not rewrite the OSS plan: the audit corrects blocks, and the plan's own `Handoff`
contract stays in force. It does not decide anything reserved to the owner — the flip, the tag,
the npm login, the contact-sheet review — it only says when and how those decisions are taken.

## 11. Next step

1. The owner reviews this design.
2. `writing-plans` turns it, together with the audited plan, into the executable plan for step 2 —
   including the corrections of §5 and the wave schedule of §6.2.
3. Execution proceeds wave by wave, each wave starting with the owner naming the models.
