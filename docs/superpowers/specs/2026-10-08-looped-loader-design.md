# Looped Loader — Design Spec

Status: awaiting owner review (stage 4 of 6 in the brainstorming path)
Date: 2026-10-08
Repo: https://github.com/TopClans/looped-loader (private, to be made public)
Author: session with the owner (TopClans)

## 1. Intent

A universal loader component that shows a short, perfectly looped, funny clip while
content loads — app boot, route change, server response, anything pending. Vue 3
first, other frameworks later, with the framework-independent part built once.

Success is: a consumer installs a small package, points it at a `baseUrl`, drops
`<LoopedLoader />` where a spinner would have been, and gets a playing clip with no
layout shift, no console errors, and a spinner-only fallback whenever video cannot
or should not play.

Explicitly **not** in this intent: a general-purpose media player, a GIF encoder, a
video hosting service, or an animation library.

## 2. Settled decisions

These came out of the brainstorming dialogue and are not reopened by the
implementation plan.

| # | Decision | Chosen |
|---|---|---|
| D1 | Asset delivery | Separate published assets package; the app decides where files are served. `baseUrl` is **required** — no magic CDN default |
| D2 | Clip selection | `seed` given → deterministic (same seed, same clip); no seed → random, never the same clip twice in a row |
| D3 | Video formats | H.264/MP4 only. WebM/VP9 dropped on the evidence in §5.5; the manifest keeps `sources[]` so later formats are a data change |
| D4 | Fallback | CSS spinner is the only fallback. No poster images |
| D5 | Distribution | Public npm + public GitHub repo, MIT for code |
| D6 | Universal core | Framework-free TS core + thin adapters (Vue now, React later). Not a Web Component |
| D7 | Package names | `@topclans/looped-loader-core`, `-vue`, `-assets` (scope ownership is a precondition, §10) |
| D8 | Weight budget | ≤ 250 KB per clip, enforced by adaptive CRF; whole corpus ≤ 5 MB |

## 3. Verified facts

Measured in this session, not assumed. Anything a plan depends on and that is NOT
in this list must be re-checked before it is relied upon.

**Corpus** (`gifs/`, 32 files, all `.mp4`, h264, **no audio track in any file**):

- 23.88 MB total; 30 distinct resolutions from 240×168 to 1080×1440.
- Frame rates 9.82–39.5 fps (14 distinct values), durations 0.45–12.15 s, 9–405 frames.
- Heaviest: `TGH-SlSNsq9B1KAxoZ9IGjAX7SUTVlTOBq3rg6BRrfI` 6.8 MB (1080×1080),
  `u3dob97sw2421` 6.0 MB (576×720), `gw2u04xr37r11` 3.2 MB (640×800).

**Toolchain on this machine:**

- ffmpeg/ffprobe present; encoders `libx264`, `libvpx-vp9`, `libaom-av1` all available.
- `node v22.22.0`, `pnpm 10.15.1`, `gh` authenticated as `TopClans` with `repo` scope.
- **Node can capture child-process stdout here** — verified with `spawnSync('ffprobe', …, {encoding:'utf8'})`,
  `status=0` and valid JSON. The transcode tool can therefore be a plain Node script.
  (The harness notes claim piped stdio fails in a `workspace-write` session; this
  session is `danger-full-access`, where it works. The tool writes ffprobe JSON
  through a temp file if piped stdio is unavailable, so it is not harness-specific.)

**npm:**

- `npm whoami` is empty — this machine is **not** logged in to npm.
- `looped-loader`, `@topclans/looped-loader` are unpublished (E404) and no npm
  secret exists in the vault (`secrets`, `infra` projects list no npm key).
- Whether the `@topclans` scope belongs to the owner's npm account could not be
  checked: npmjs.com returns 403 to non-browser clients.

**Browser support:** MDN's container matrix lists WebM with VP9 as supported by
Chrome, Edge, Firefox and Safari. The MP4 source stays as a second `<source>` anyway,
so an engine that rejects WebM silently takes H.264 — the fallback mechanism, not the
support table, is what makes this safe.

## 4. Architecture

### 4.1 Repository layout

```
looped-loader/                       public, MIT (code only)
├─ package.json                      private workspace root
├─ pnpm-workspace.yaml
├─ packages/
│  ├─ core/     @topclans/looped-loader-core     framework-free TS
│  ├─ vue/      @topclans/looped-loader-vue      Vue 3 adapter
│  ├─ assets/   @topclans/looped-loader-assets   clips + manifest.json (published)
│  └─ demo/     private Vite playground (not published)
├─ tools/transcode/                  private workspace: gifs/ → packages/assets/
├─ gifs/                             raw sources — .gitignore, never committed
├─ .github/workflows/ci.yml
└─ docs/superpowers/specs/
```

`gifs/` is deliberately absent from git: 24 MB of inputs whose transcoded
derivatives are the actual deliverable. Reproducibility is preserved by
`tools/transcode` plus `sourceSha256` recorded per clip in the manifest, so anyone
holding the inputs can prove they transcoded the same thing. Acceptance criterion 4
asserts the directory never entered history.

### 4.2 Assets and delivery

`@topclans/looped-loader-assets` ships `clips/*.mp4`, `manifest.json` and
`checksums.json`. Published versions are immutable and the manifest is addressed per
version, so a CDN can cache forever.

The core knows nothing about npm or CDNs. It takes `baseUrl` plus a manifest, and
resolves a file as `baseUrl + '/' + source.src` (joining exactly one slash). Two
documented recipes:

```ts
// A. self-hosted: copy node_modules/@topclans/looped-loader-assets/clips into your static root
<LoopedLoader base-url="/looped-clips" />

// B. CDN: one line, opt-in, never the default
<LoopedLoader base-url="https://cdn.jsdelivr.net/npm/@topclans/looped-loader-assets@1.0.0/clips" />
```

The manifest is fetched from `${baseUrl}/manifest.json` by default, or passed
pre-loaded through the `manifest` prop when the app imports it from the assets
package (bundler-friendly, no extra request).

### 4.3 Manifest contract

The single interface between the pipeline and the component.

```jsonc
{
  "schemaVersion": 1,
  "generatedBy": "looped-loader-tools/0.1.0 ffmpeg 7.1",
  "corpus": { "clips": 32, "totalBytes": 4990976 },
  "clips": [
    {
      "id": "RHCE7A7FGXBw7fULXAxoNAZTxQA930eWVxi0EW4UODY",
      "sources": [
        { "src": "clips/RHCE7A7FGXBw7fULXAxoNAZTxQA930eWVxi0EW4UODY.mp4",
          "type": "video/mp4; codecs=avc1.4d401e" }
      ],
      "width": 480, "height": 360, "durationMs": 10800, "fps": 30,
      "bytes": { "mp4": 202752 },
      "sha256": { "mp4": "…" },
      "sourceSha256": "…",
      "encode": { "codec": "x264", "crf": 26, "longSide": 480, "fpsCap": 30, "note": "base" },
      "loopSeam": { "stepMean": 1.81, "stepP90": 2.33, "seam": 2.25 }
    }
  ]
}
```

The values above are the measured ones for that clip (198 KB at CRF 26, SSIM 0.99),
except the sha256 digests, which a human is not meant to read out of a spec.
`encode.note` is `base` for an untouched clip, `budget-adapted` when §5.2 changed the
settings, and `budget-exceeded` when even the adaptations did not reach the budget;
`loopSeam.flag` is present only as `"review"`.

Rules the component relies on: `id` is stable and URL-safe; `sources` is ordered by
preference and never empty; `width`/`height` are post-transcode even numbers used for
`aspect-ratio`; `durationMs` is a number; `flags`/`encode` are diagnostic and ignored
by the runtime. Unknown top-level fields are ignored, not rejected — that is how the
schema grows without a breaking change.

### 4.4 Core API

`createLoopedLoader(options)` returns a small object and owns all the logic:

```ts
type State = 'idle' | 'resolving' | 'loading' | 'playing' | 'error'

interface LoopedLoaderOptions {
  baseUrl: string
  manifest?: Manifest          // pre-loaded; otherwise fetched from manifestUrl
  manifestUrl?: string         // default `${baseUrl}/manifest.json`
  seed?: string | number       // deterministic pick
  clip?: string                // force one clip id
  clips?: string[]             // restrict the pool
  delayMs?: number             // default 120
  respectReducedMotion?: boolean // default true
  onState?: (s: State) => void
  onError?: (e: LoopedLoaderError) => void
  onSelect?: (clip: Clip) => void
}

interface LoopedLoader {
  state: State
  clip: Clip | null
  src: string | null
  readonly error: LoopedLoaderError | null
  select(): Clip | null        // deterministic with a seed, random otherwise
  attach(video: HTMLVideoElement): void
  detach(): void
  destroy(): void
}
```

State machine: `idle → resolving → loading → playing`, with `error` reachable from
`resolving` and `loading`. `playing` is entered on the DOM `playing` event, not on
`canplay` — the spinner must stay until a frame is genuinely on screen, which is how
the design avoids both a black rectangle and a poster image.

Selection details:

- Seeded pick is `mulberry32(xmur3(String(seed)))`, index = `floor(r * pool.length)`.
  Same seed and same pool always give the same clip; the pool order comes from the
  manifest, which is stable.
- Unseeded pick avoids the last 3 shown ids, held in a module-level ring buffer, so
  different loader instances on one page do not show the same clip back to back.
- **SSR safety:** without a `seed`, the pick is deferred until the client mounts.
  Picking randomly during SSR produces a hydration mismatch — the server and client
  would render different clips. With a seed, the pick is SSR-stable and safe.

### 4.5 Vue adapter

```vue
<LoopedLoader
  base-url="/looped-clips"
  seed="route:/orders"
  size="md"
  mode="inline"
  delay-ms="120"
  :clips="['u3dob97sw2421', 'TGH-SlSNsq9B1KAxoZ9IGjAX7SUTVlTOBq3rg6BRrfI']"
  label="Загрузка"
>
  <template #fallback><MySpinner /></template>
</LoopedLoader>
```

Props: `baseUrl` (required), `manifest`, `manifestUrl`, `seed`, `clip`, `clips`,
`delayMs` (default 120), `size` (`sm` 40px | `md` 96px | `lg` 200px | `full` 100% of
container), `mode` (`inline` | `overlay` — fixed, viewport-covering), `objectFit`
(`contain` | `cover`), `rounded`, `respectReducedMotion` (default true), `label`.
Slots: `#fallback`. Events: `select`, `ready`, `error`.

Also exported: `useLoopedLoader({ baseUrl, seed })` for consumers who want their own
markup, and

```ts
useSmoothPending(pending: Ref<boolean>, { delay = 120, minVisible = 300 }): Ref<boolean>
```

`useSmoothPending` exists because a loader **cannot** guarantee its own minimum
visible time: mounting and unmounting are the parent's decision. The composable
returns a ref that goes false→true only after `delay`, and once true stays true for at
least `minVisible`. Claiming `minVisibleMs` as a component prop would be a lie.

### 4.6 Behaviour

- `delayMs`: if the pending state resolves sooner than this, the clip is never
  fetched at all. On a fast load this saves a real ~100 KB, not just a flicker.
- Spinner is visible until `playing`; the video then fades in over 150 ms. No poster
  asset, per D4.
- `aspect-ratio` comes from the manifest's `width`/`height`, set on the container
  before any network activity → zero cumulative layout shift.
- `prefers-reduced-motion: reduce` (and `respectReducedMotion`): no `<video>` element
  is created and no clip is fetched; the spinner renders without rotation.
- Tab hidden (`visibilitychange`) or element out of the viewport (IntersectionObserver)
  → `pause()`; back → `play()`. A looping video in a background tab decodes forever
  for nothing.
- Unmount → `pause()`, remove `src`, call `load()`. Omitting this leaks decoders on
  iOS Safari, a well-known failure mode with repeated video elements.
- `play()` rejected (energy saver, autoplay policy) → spinner, one retry on the first
  user interaction (`pointerdown`, once), and `error('autoplay-blocked')`.

### 4.7 Accessibility

- Root: `role="status"`, `aria-live="polite"`, `aria-busy="true"` while pending.
- The `<video>` is media with no audio track and no informational content:
  `aria-hidden="true"`, `muted playsinline autoplay loop`.
- A visually hidden `label` (default "Загрузка") is rendered inside the live region,
  and is configurable — the package must not hardcode a language.
- The loader never takes focus and contains no focusable elements.
- Under reduced motion the spinner does not rotate; the label carries the meaning.

### 4.8 Theming

CSS custom properties on the root, no CSS framework: `--ll-size`, `--ll-radius`,
`--ll-bg`, `--ll-spinner-color`, `--ll-spinner-width`, `--ll-fade-ms`. A `class` on the
component lands on the root element. Styles are scoped inside the SFC and inlined in
the built bundle, so a consumer needs no CSS import.

### 4.9 Demo playground

`packages/demo` is a private Vite app with two jobs, and it is the verification vehicle
for acceptance criteria 5 and 6:

1. **Contact sheet** — a grid of all 32 clips, autoplaying, with the id, weight and
   `loopSeam` numbers under each. This is how the owner eyeballs the loop quality and
   the content, and how the browser verification is performed.
2. **Scenario board** — the same loader under the conditions that are hard to
   reproduce on demand: instant resolution (0 ms), 300 ms, 3 s, a failed manifest, a
   404 clip, autoplay blocked, and emulated reduced motion.

It is not published and carries no production code of its own: it imports the built
packages by workspace path, so a broken public API breaks the demo first.

### 4.10 Build and tooling

- pnpm workspaces; `core` and `tools`/`demo` in TS, the Vue package as SFCs.
- Vite library mode (`preserveModules`) for `core` and `vue`, declarations emitted
  with `vite-plugin-dts`, `vue-tsc` for type-checking.
- `sideEffects: false`, ESM only, `type: module`, `exports` map with types.
- `peerDependencies: vue ^3.4` for the Vue package; `core` has zero dependencies.
- Lockstep versioning across the three published packages for v1 (changesets noted as
  a later option, not built now).

## 5. Transcode pipeline

`tools/transcode` is a plain Node ESM script driving `ffmpeg`/`ffprobe` with
`spawnSync`. It is the only writer of `packages/assets`.

### 5.1 Encode ladder

| Setting | Value |
|---|---|
| Container / codec | MP4, H.264 `main` profile, `yuv420p` |
| CRF | 26 base, adapted per §5.2 |
| Preset | `slow` |
| Long side | 480, **never upscaling** (240×168 stays 240×168) |
| Dimensions | forced even |
| Frame rate | `min(source, 30)` — source rate preserved, never normalised upward |
| Audio | dropped (`-an`); no input has a track anyway |
| Metadata | stripped (`-map_metadata -1`) |
| Fast start | `-movflags +faststart` |

Measured on the whole corpus at CRF 26: **4.76 MB total, median 103 KB, largest
890 KB, mean SSIM 0.969, 18 seconds to encode all 32 clips.** Encoder time is not a
constraint at any CRF this design needs.

### 5.2 Size budget

A clip must be ≤ 250 KB. If it is not, CRF rises by 1 (up to 30); if it still does not
fit, the long side drops to 400. The values actually used land in the manifest under
`encode`, so every published file is traceable to its settings.

The budget is a target, not a hard gate, because a looping clip cannot be shortened
without breaking the loop and a hard gate would have to either fail the pipeline or
silently drop a clip. If 250 KB is still unreachable at CRF 30 with a 400px long side,
the clip is published with `encode.note: "budget-exceeded"` and an entry in
`qc-report.md`. The pipeline never loops, never fails on weight alone, and never
deletes content on its own.

Five clips are above 250 KB at CRF 26 and are the ones this rule touches:

| Clip | Box | CRF 26 | SSIM |
|---|---|---|---|
| `u3dob97sw2421` | 384×480@30, 12.2 s | 890 KB | 0.96 |
| `TGH-SlSNsq9B1KAxoZ9IGjAX7SUTVlTOBq3rg6BRrfI` | 480×480@10, 6.6 s | 385 KB | 0.97 |
| `azgfEFJhDSwy5D44YfXwmSM7ObncWSLua1xyVNtvQa4` | 480×280@25, 8.9 s | 345 KB | 0.96 |
| `gw2u04xr37r11` | 384×480@30, 7.6 s | 340 KB | 0.96 |
| `wsijo3cpfb831` | 460×460@24, 3.8 s | 304 KB | 0.95 |

`u3dob97sw2421` is expected to end at `budget-exceeded`: it is 12.2 s of 30 fps motion,
and its measured size does not fall below the budget even after both adaptations. That
prediction is testable and is checked, not assumed.

### 5.3 QC gate

The pipeline exits non-zero on violation instead of warning. Checks per clip:

1. Frame count and duration match the expected values after fps normalisation (±1 frame).
2. `loopSeam` recomputed on the output is not worse than the input by more than 10 %,
   **above an absolute noise floor of 2** on the 0–255 MAE scale. Below that floor the
   same regression is recorded as a `review` finding (`seam-regression-noise`) rather
   than failing the build: at that magnitude the ratio measures encoder noise, not a
   visible loop jump. Measured on the corpus, this rule was inverted — it failed six
   clips whose seam moved by 0.1–0.6 gray levels while the two clips with genuinely
   visible jumps (seam 27.09 and 22.77) only reached `review`. Ruled by the owner on
   2026-10-08; see `PROGRESS.md` D-21.
3. SSIM against a lossless `-qp 0` reference ≥ 0.93; the measured value is recorded.
4. Size is within the budget after adaptation.
5. On-disk size and sha256 match the manifest exactly.

Outputs: `qc-report.json` (machine) and `qc-report.md` (human) committed next to the
assets. A `--check` mode re-runs everything and asserts byte-identical results, which
is how idempotency is proven rather than asserted.

### 5.4 Loop-seam metric

For each clip: every frame is dumped as 32×32 grayscale; `stepMean` and `stepP90` are
the mean and 90th-percentile mean-absolute-error between adjacent frames; `seam` is the
MAE between the last and the first frame. A clip whose `seam` sits above its `stepP90`
has a visible jump at the loop point.

This is a heuristic, and it is reported as one: it flags, it never deletes. The
design-time probe put ~25 clips at or below their typical frame step and named four
(`2F4wy0zlipQSr9BMqGVE3nnK_OZfD1QKxjKCZeoq434`, `2p1qoycrgfm31`, `TGH-SlSN…`,
`u3dob97sw2421`) as clearly above it.

**Measured on the transcoded corpus (2026-10-08, `qc-report.md`):** the `loop-seam-review`
tier fired on **eight** clips — `0AMt9sYf…`, `2p1qoycrgfm31`, `TGH-SlSN…`, `azgfEFJh…`,
`d3whIZNc…`, `gw2u04xr37r11`, `tXHw0yKm…`, `u3dob97sw2421` — so the design-time list was
neither complete nor exact; `2F4wy0zl…` is not among them. The metric's own values are
what the manifest records, and the report is the authority, not this paragraph.

A naive proxy — comparing only `seam` against `stepMean` — was tried first and
rejected: on near-static clips a tiny absolute difference inflates the ratio, which is
why the comparison is against the 90th percentile and the absolute numbers are kept in
the manifest.

### 5.5 Why WebM/VP9 was dropped

Measured at the same box, SSIM against a lossless reference:

| Clip | x264 CRF 26 | VP9 CRF 40 |
|---|---|---|
| `gw2u04xr37r11` | 340 KB / 0.96 | 353 KB / 0.96 |
| `TGH-SlSN…` | 385 KB / 0.97 | 210 KB / 0.94 |
| `u3dob97sw2421` | 890 KB / 0.96 | 874 KB / 0.88 |

One tie, one loss, one win — and the win costs quality. The source clips are noisy
re-encodes of Reddit uploads, exactly the content where VP9's efficiency does not
materialise. The price would be real: roughly +5 MB in the published package and a
second QC pass. The manifest's `sources[]` array means adding WebM or AV1 later is a
data change with no component work, which is the whole reason dropping it now is safe.

## 6. Error handling

Typed error codes: `manifest-fetch`, `manifest-invalid`, `clip-fetch`, `decode`,
`autoplay-blocked`, `no-clips`.

- Manifest missing or unparseable → spinner, one `console.warn`, `error` event. If
  `clip` was passed explicitly, that clip is still attempted.
- A clip fails to load or decode → try another (up to 3 attempts, excluding ids that
  already failed), then spinner.
- Autoplay rejected → spinner, one interaction-triggered retry, `error` event.
- Offline → identical path to a fetch failure.
- No usable clips after filtering (`clips` prop, or all failed) → `no-clips`; the
  component renders the fallback slot and stays usable.

The loader never throws into the host application's render path, and never leaves an
empty box: something (video or spinner) is always visible.

## 7. Testing

- **core** (vitest, node): seeded selection is deterministic across 100 runs; unseeded
  selection never repeats the previous 3 within a session; manifest parsing and
  validation errors; path joining with and without a trailing slash; every state
  machine transition including failure paths; module imports without `window` (SSR).
- **vue** (vitest + `@vue/test-utils` + jsdom): spinner first, then a `<video>` with
  the resolved `src`; `clip` and `clips` props narrow the pool; nothing is fetched
  before `delayMs` elapses; reduced motion (mocked `matchMedia`) creates no `<video>`;
  unmount clears `src`; a11y attributes present; events emitted once each.
- **tools/transcode** (vitest): pure unit tests for target-box maths, CRF adaptation
  and manifest assembly; one integration test encoding a 0.5 s fixture and requiring a
  green QC, guarded by `describe.skipIf(!hasFfmpeg)`.
- **idempotency**: the `--check` mode is the test.
- **CI** (`.github/workflows/ci.yml`): install, type-check, build, unit and component
  tests, plus the ffmpeg-guarded integration test. CI cannot run the full corpus
  because `gifs/` is not in the repository — the full-corpus QC is a local,
  owner-visible step. Stating this beats pretending CI covers it.

## 8. Acceptance criteria

1. `pnpm -r build && pnpm -r test` green from a clean clone with ffmpeg in `PATH`.
2. Whole corpus transcoded, QC green, total ≤ 5 MB, no clip above 250 KB — or an
   exception recorded with its reason in `qc-report.md`.
3. A second `--check` run reports zero differences.
4. `git log --all -- gifs/` is empty: the raw inputs never entered history.
5. Demo page in a real browser: 32/32 clips play, zero console errors, zero failed
   requests — evidenced by a screenshot, not by reading source.
6. Reduced motion verified in a real browser with emulated `prefers-reduced-motion`:
   no video fetched, spinner present, no console errors.
7. The self-hosted asset recipe from the README is verified end to end; the CDN recipe
   is verified after the first publish.
8. `npm publish --dry-run` inspected for all three packages: no `gifs/`, no stray
   files, correct `files` field.
9. The owner has reviewed a contact sheet of all 32 clips before the repository is
   made public.

## 9. Risks

**Accepted risk — copyright, recorded verbatim.** All 32 clips were downloaded from
Reddit. The owner was told that transcoding does not change rights, that publishing
them in a public npm package is redistribution of third-party content, that npm cannot
unpublish a version after 72 hours, and that a public repository also exposes the
`TopClans` account. The owner answered: *"Всё равно публикуем всё как есть, риск мой"*
("publish everything as is anyway, the risk is mine"). This spec therefore records an
**accepted risk, not a solved problem**. No licence audit will be performed.

Cheap mitigations that are in scope because they cost almost nothing: a `NOTICE` file
naming Reddit as the source with a takedown contact; code MIT-licensed separately from
assets, so the clip set can be replaced or dropped without breaking consumers; the
assets isolated in their own package, so a pull of that package is a one-line change
for consumers.

**Other risks:**

- `u3dob97sw2421` is the weight outlier (12.2 s / 890 KB). The budget rule compresses
  it; if that pushes quality below the SSIM threshold, the owner is asked rather than
  silently shipping a blurred clip.
- The `@topclans` npm scope may not belong to the owner's npm account, which would
  break publishing under D7. It is a precondition, not an assumption (§10).
- The CDN recipe cannot be verified before the first publish and is documented as
  unverified until then.

## 10. Preconditions — ask the owner before

1. **npm authentication** — the machine is not logged in and no npm token is in the
   vault. Either the owner runs `npm login`, or drops an automation token into a file
   for `sec set`, after which publishing happens through `sec run`.
2. **`@topclans` scope ownership** — to be confirmed by the owner (or by `npm whoami`
   once authenticated). If it is not theirs, package names fall back to unscoped
   `looped-loader-core` / `-vue` / `-assets`; only `package.json` names change.
3. **Actual `npm publish`** — irreversible; executed only on explicit instruction.
4. **Flipping the repository to public** — only after §8.4 and §8.9 pass.
5. **Any clip removal or replacement** — the seam metric and the contact sheet inform
   the owner; the pipeline never deletes a clip on its own.

## 11. Out of scope

React adapter (a second adapter of the same core — the interface is designed for it,
but the package is a follow-up), WebM/AV1, a Web Component build, audio, captions,
`minVisibleMs` inside the component, a global one-video-at-a-time registry,
changesets, and any CDN or hosting run by this project.
