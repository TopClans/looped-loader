# Contributing

Thanks for looking. This is a small project with one maintainer, and the rules below exist
because each of them has already caught a real defect here.

## Prerequisites

| Tool   | Version                          | Why                                                                       |
| ------ | -------------------------------- | ------------------------------------------------------------------------- |
| Node   | `>=20.11` (measured: `v22.22.0`) | the packages declare that engine floor                                    |
| pnpm   | `10.15.1`                        | `packageManager` in the root manifest; CI pins it too                     |
| ffmpeg | `8.x`                            | only for `tools/transcode`; the tool shells out to `ffmpeg` and `ffprobe` |

`git config core.autocrlf` does not matter: `.gitattributes` pins text files to LF and media
files to binary, so a Windows checkout and a Linux checkout produce the same bytes.

## Getting started

```powershell
pnpm install
pnpm build          # writes scripts/sync-legal.mjs output into each package, then builds
pnpm typecheck      # AFTER build, never before — see below
pnpm test
```

**`pnpm build` before `pnpm typecheck`.** `packages/core` emits its declarations into
`packages/core/dist`, which is gitignored and therefore absent in a fresh clone;
`packages/vue` and `packages/demo` resolve `@topclans/looped-loader-core` through those
declarations. Type-checking first fails with `TS2307` and a cascade of `TS7006` that has
nothing to do with your change. CI runs the same order for the same reason.

## The layout

| Path              | What it is                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `packages/core`   | the zero-dependency core: manifest validation, clip selection, the `<video>` lifecycle        |
| `packages/vue`    | the Vue 3 adapter over the core                                                               |
| `packages/assets` | the 32 transcoded clips, `manifest.json`, `checksums.json` — **generated**, never hand-edited |
| `packages/demo`   | the playground and contact sheet; private, verified in a browser rather than by unit tests    |
| `tools/transcode` | the ffmpeg pipeline that produces `packages/assets`                                           |
| `docs/`           | the product spec, the plans, the epic and the verification records                            |

## Tests come first

Write the failing test before the implementation, run it, and read the failure. A test that
passes before the change is a finding about the test, not a formality — that has happened
here, and the fix was to the test.

- `packages/core` and `tools/transcode` run in the `node` environment; `packages/vue` runs in
  `jsdom`.
- `packages/assets` is verified by a script that reads the committed media and re-checks every
  size and `sha256` against the manifest, rather than by a fixture.
- jsdom does not implement media playback. A passing jsdom test is not evidence that a clip
  plays; the demo is what settles that, in a real browser.

## Commits and pull requests

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
(`fix(core): …`, `docs: …`, `test(vue): …`). Each commit contains only one task's files.

Before you open a pull request:

- [ ] `pnpm build && pnpm typecheck && pnpm test` is green, in that order, from a clean tree.
- [ ] Every new test was seen to fail for the right reason before it passed.
- [ ] `pnpm-lock.yaml` is staged if you touched a dependency — CI installs with
      `--frozen-lockfile`, and a stale lockfile fails for a reason that looks nothing like
      its cause.
- [ ] No secret appears in a command argument, in a file, or in the change description. This
      project publishes through npm trusted publishing and holds no npm token at all.
- [ ] A user-visible change has a `CHANGELOG.md` entry under `Unreleased`.
- [ ] Any number you quote (a size, a count, a timing) was read from a command's output, not
      remembered.

## Changing the clip corpus

`packages/assets` is written only by `tools/transcode`; a hand edit there is a defect, and
`--check` exists to catch it. Run the pipeline from the repository root, with the raw clips
outside version control:

```powershell
pnpm transcode --gifs gifs --out packages/assets
node tools/transcode/dist/index.js --check --gifs gifs --out packages/assets
```

A new clip must carry recorded provenance, and the pipeline refuses one that does not. The
contribution policy is `docs/content-policy.md` (see the story
[E4.3](docs/epic/stories/E4.3-clip-policy.md) while that document is being written). Read
[NOTICE](NOTICE) before you send a clip: the existing set is redistributed without a licence
audit, and that is an accepted risk this project documents rather than hides.

## What a reviewer looks for

- Tests that **can** fail — a deliberate break that leaves the suite green is a bug in the
  test.
- Evidence that was **read**, not paraphrased: the command, its output, and the commit it ran
  against.
- Claims about the browser demonstrated in a browser, not inferred from source.
- Changes that keep `@topclans/looped-loader-core` free of runtime dependencies and both
  packages inside their bundle budgets (`pnpm build` prints both).

## Releases

Releases are one `v*` tag push; the workflow publishes from GitHub Actions with npm trusted
publishing, and contributors never need npm credentials. The full procedure, including what to
do when a release is wrong, is [docs/release.md](docs/release.md).
