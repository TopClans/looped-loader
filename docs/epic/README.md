# Looped Loader — Epic Index

This is the navigation layer over the work: **what** has to be done, in what order, and
how we know each piece is finished. It does not restate the **how** — that lives in the
plans it links to.

Deliberate deviation from the shape used in `C:\dsh\lms`, and the reason: there, 82 step
files had to be written because the requirements existed only in a TZ. Here the spec and
the implementation plan already carry the requirements and the acceptance criteria for
the build work, so story files exist **only where requirements are genuinely new** (the
open-source and release workstreams). A story file that restates a plan task would drift
from it within two edits — which is the failure mode this whole layer is meant to prevent.

| Artifact | Answers | Path |
|---|---|---|
| Spec | why, what, which trade-offs were settled | [`../superpowers/specs/2026-10-08-looped-loader-design.md`](../superpowers/specs/2026-10-08-looped-loader-design.md) |
| Build plan | how, task by task, with code | [`../superpowers/plans/2026-10-08-looped-loader.md`](../superpowers/plans/2026-10-08-looped-loader.md) |
| OSS plan | how for the open-source and release workstreams | [`../superpowers/plans/2026-10-08-looped-loader-oss-readiness.md`](../superpowers/plans/2026-10-08-looped-loader-oss-readiness.md) |
| Navigation rule | how any session walks this epic | [`RUNBOOK.md`](RUNBOOK.md) |
| Status | what is done, what is next, what was decided | [`PROGRESS.md`](PROGRESS.md) |
| Story files | requirements for the work the spec does not cover | [`stories/`](stories/) |

## Source of truth

When two documents disagree, the higher one wins, and the lower one is corrected:

1. **Spec** — `docs/superpowers/specs/2026-10-08-looped-loader-design.md`. Settled
   decisions (D1–D8) and the accepted copyright risk are not reopened.
2. **Plans** — the two plan files. A plan that disagrees with the spec is a defect.
3. **Story files** — requirements for the new workstreams only.
4. **PROGRESS.md** — status, decisions taken after the spec, technical debt. Never a
   source of requirements.

## How to use this

- Every unit of work has an **id** (`E1.1`, `E4.2`, …), an **epic**, **dependencies**, a
  **source** (spec section or plan task, or a story file), and **acceptance criteria**.
- A story is ready when every id in its `Depends on` column is `done`.
- The status of every story lives in [`PROGRESS.md`](PROGRESS.md), nowhere else. A story
  file never carries a status; the tracker does.
- Do not start a story whose dependencies are not done. If a dependency is wrong, fix the
  table here and record it in the tracker's decision journal.

## Epic map

### E1 · Core and packaging

| Id | Story | Source | Depends on |
|---|---|---|---|
| E1.1 | Workspace skeleton, licences, CI, deterministic clip picker | plan T1 | — |
| E1.2 | Manifest validation, asset URL resolution, pool construction | plan T2 | E1.1 |
| E1.3 | Loader state machine and `<video>` lifecycle | plan T3 | E1.2 |
| E1.4 | Vue adapter: component, composables, theming, a11y | plan T7 | E1.3 |
| E1.5 | Vue behaviour tests: reduced-motion flip, autoplay rejection, SSR | plan T8 | E1.4 |
| E1.6 | Demo playground: contact sheet and scenario board | plan T9 | E1.5, E2.3 |

### E2 · Assets and pipeline

| Id | Story | Source | Depends on |
|---|---|---|---|
| E2.1 | Transcode ladder and the ffmpeg process layer | plan T4 | — |
| E2.2 | QC gate, manifest assembly, transcode CLI | plan T5 | E2.1 |
| E2.3 | Corpus transcode and the published assets package | plan T6 | E2.2 |
| E2.4 | Per-clip provenance in the manifest, enforced by the pipeline | [story](stories/E2.4-clip-provenance.md) | E2.2 |

### E3 · Quality evidence

| Id | Story | Source | Depends on |
|---|---|---|---|
| E3.1 | Browser verification with screenshots and measurements | plan T10 | E1.6, E2.3 |
| E3.2 | Documentation: README, hosting recipes, a11y, licensing boundary | plan T11 | E1.5, E2.3 |
| E3.3 | Accessibility audit with axe and `ACCESSIBILITY.md` | [story](stories/E3.3-accessibility-audit.md) | E1.6 |
| E3.4 | Public API surface lock and type-level tests | [story](stories/E3.4-api-surface.md) | E1.3, E1.4 |
| E3.5 | CI matrix (Linux + Windows, Node 20/22/24) and coverage thresholds | [story](stories/E3.5-ci-matrix.md) | E1.1 |

### E4 · Open-source readiness

| Id | Story | Source | Depends on |
|---|---|---|---|
| E4.1 | Repo hygiene: lint, format, commit style, package metadata | [story](stories/E4.1-repo-hygiene.md) | E1.1 |
| E4.2 | Community health files | [story](stories/E4.2-community-files.md) | E4.1 |
| E4.3 | Clip contribution policy and the content boundary | [story](stories/E4.3-clip-policy.md) | E2.4, E4.2 |
| E4.4 | Public repository settings, branch protection, security features | [story](stories/E4.4-repo-settings.md) | E4.2 |
| E4.5 | *(optional)* freely-licensed default clip set | [story](stories/E4.5-free-clip-set.md) | E2.4, E4.3 |

### E5 · Release

| Id | Story | Source | Depends on |
|---|---|---|---|
| E5.1 | Release automation: trusted publishing with provenance | [story](stories/E5.1-release-automation.md) | E3.5, E4.4 |
| E5.2 | First public release `0.1.0` | plan T12 (revised by E5.1) | E5.1, E4.4 |
| E5.3 | Post-release verification | [story](stories/E5.3-post-release.md) | E5.2 |

## Order and parallelism

Recommended order, and the only place a wrong order is expensive:

```
E1.1 ─┬─ E1.2 ── E1.3 ── E1.4 ── E1.5 ─┐
      │                                ├─ E1.6 ── E3.1 ─┐
E2.1 ── E2.2 ─┬─ E2.3 ────────────────┘                │
              └─ E2.4 ─┐                                │
E3.5 ── E4.1 ── E4.2 ─┼─ E4.3 ── E4.5 (optional)       │
                      ├─ E4.4 ── E5.1 ── E5.2 ── E5.3 ─┘
E3.4 ─────────────────┘
E3.2, E3.3 run any time after E1.5 / E1.6 respectively
```

Parallel-friendly pairs, each with its own worktree and no shared files:

- **E1.x (core)** and **E2.x (pipeline)** are independent after E1.1 creates the workspace.
- **E3.4** (API surface) and **E3.5** (CI matrix) touch different files.
- **E4.1/E4.2** (docs and config) are independent of **E3.3** (accessibility).

Strictly sequential: E2.2 → E2.4 → E4.3 (the provenance field must exist before the
policy can require it), and E4.4 → E5.1 → E5.2 (the repository must be public before a
release can carry provenance).

## Definition of done for a story

A story is `done` only when all of these hold:

1. Its acceptance criteria are met, each with the command output or artifact that shows
   it — not a summary of it.
2. `pnpm -r build`, `pnpm -r test`, `pnpm typecheck` and `pnpm lint` are green on the
   integration branch after the merge, not only in the writer's worktree.
3. Its reviewer (a different model family from the implementer) approved, or the story is
   one of the explicitly review-exempt documentation stories and the Lead reviewed it.
4. `PROGRESS.md` is updated: status, evidence link, and any decision taken while doing it.
5. Anything the story could not settle is written down as an open item in `PROGRESS.md`
   rather than left in someone's head.

## Definition of public-ready

The bar this epic is built against. Every line is a story above, or an acceptance
criterion inside one; a line with no owner is a gap.

**Code and packaging**

- [ ] MIT `LICENSE` at the repository root and inside every published tarball (E1.1, E5.2)
- [ ] `repository`, `homepage`, `bugs`, `keywords` in every published `package.json` (E4.1)
- [ ] Zero runtime dependencies in core; Vue declared as a peer (E1.1, E1.4)
- [ ] Bundle budget enforced by the build (E1.1)
- [ ] Public API locked by tests, so a breaking change cannot ship unnoticed (E3.4)
- [ ] ESM only, types emitted, `exports` map, `sideEffects: false` (E1.1, E1.4)

**Evidence**

- [ ] CI green on Linux and Windows across Node 20/22/24 (E3.5)
- [ ] Coverage threshold enforced (E3.5)
- [ ] Browser verification artifacts committed: screenshots plus the measured JSON (E3.1)
- [ ] Zero serious or critical axe violations (E3.3)
- [ ] The assets QC report committed next to the assets (E2.3)

**Legal and content**

- [ ] The licensing boundary documented: code MIT, clips not covered (E3.2, E4.3)
- [ ] Every clip carries provenance in the manifest (E2.4)
- [ ] Takedown route published in `NOTICE` (E1.1, E4.3)
- [ ] Contributing a clip requires a licence, enforced by the pipeline (E4.3)
- [ ] The accepted copyright risk recorded verbatim in the spec (done, §9)

**Community**

- [ ] README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT, GOVERNANCE, CHANGELOG (E4.2)
- [ ] Issue templates, PR template, Dependabot, CodeQL (E4.2, E4.4)
- [ ] GitHub community profile health = 100 % (E4.4, E5.3)
- [ ] Repository description, topics, homepage, social preview (E4.4)
- [ ] Branch protection on `main` with required status checks (E4.4)
- [ ] A public roadmap, taken from the spec's out-of-scope list (E3.2)

**Release**

- [ ] Trusted publishing configured; no long-lived npm token anywhere (E5.1)
- [ ] Published from GitHub Actions with provenance visible on npm (E5.1, E5.3)
- [ ] SemVer and deprecation policy documented (E3.2)
- [ ] Install from the registry verified outside the repository (E5.3)
- [ ] `npm audit signatures` verifies the attestations (E5.3)
