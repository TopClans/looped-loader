# Looped Loader

A loading state that people don't mind waiting through. A loader is the one
component every user sees before anything else on the page — a grey circle is
dead time. Looped Loader plays a short, perfectly-looping video clip instead,
so the wait becomes the best part of the load. It ships as a Vue 3 component
over a framework-free core, backed by a set of 32 pre-transcoded clips that
load in tens of kilobytes and never show a broken seam.

## Quick start

Both recipes assume an existing Vue 3 + Vite app. The packages are versioned in
lockstep; the examples pin `0.1.0`.

### Self-hosted (recommended)

Install the Vue adapter and the asset package, copy the assets into your app's
static directory, and point the loader at them:

```sh
pnpm add @topclans/looped-loader-vue @topclans/looped-loader-assets
```

The loader fetches `<base-url>/manifest.json` and plays the clips from
`<base-url>/clips/`, so the asset package's `manifest.json` **and** its
`clips/` directory must land together under one path your server serves as
`/looped-clips`. In a Vite app that is `public/looped-clips`:

```sh
# macOS / Linux
mkdir -p public/looped-clips
cp node_modules/@topclans/looped-loader-assets/manifest.json public/looped-clips/
cp -R node_modules/@topclans/looped-loader-assets/clips public/looped-clips/
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force public/looped-clips | Out-Null
Copy-Item node_modules/@topclans/looped-loader-assets/manifest.json public/looped-clips/
Copy-Item -Recurse node_modules/@topclans/looped-loader-assets/clips public/looped-clips/
```

Then:

```vue
<script setup>
import { LoopedLoader } from '@topclans/looped-loader-vue'
// In 0.1.0 the stylesheet is a separate import, not inlined in the JS.
import '@topclans/looped-loader-vue/style.css'
</script>

<template>
  <LoopedLoader base-url="/looped-clips" />
</template>
```

With no further configuration the loader waits 120 ms for the surrounding
content, picks a clip deterministically for the current URL, and swaps the
spinner for the playing video, fading it in over 150 ms. On a page that loads
faster than `delayMs`, the clip is never fetched at all.

**Styling in 0.1.0.** The component's scoped stylesheet ships as
`dist/index.css` inside the package and is loaded through a **separate
import** — `import '@topclans/looped-loader-vue/style.css'` (exposed by the
package's `exports` map). It is not inlined into the JS bundle; without the
import the video plays but the spinner, the sizing and the visually hidden
label are missing.

### CDN

```vue
<script setup>
// Same separate stylesheet import as the self-hosted recipe.
import '@topclans/looped-loader-vue/style.css'
</script>

<template>
  <LoopedLoader base-url="https://cdn.jsdelivr.net/npm/@topclans/looped-loader-assets@0.1.0" />
</template>
```

The `base-url` is the package root on the CDN: the manifest sits at its top
level and the clips under `clips/`, exactly like the self-hosted layout. This
recipe hands your runtime traffic to a third party (jsDelivr) on every page
load, which is why self-hosting is the default.

> **Verified against `0.1.0` on 2026-10-09.** jsDelivr serves both the manifest and a real clip
> for the pinned version: `HEAD` on
> `https://cdn.jsdelivr.net/npm/@topclans/looped-loader-assets@0.1.0/manifest.json` and on
> `…/clips/0AMt9sYf-yB1Zu0Px8rtIMFvx3fzgltIaaQ5nIz0CA4.mp4` both answered `200`. Pin the exact
> version, as this recipe does — jsDelivr can serve a stale one briefly after a publish. The full
> output is in [`docs/verification/2026-10-09-release.md`](docs/verification/2026-10-09-release.md).

## Component reference

### Props

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `baseUrl` | `string` | *required* | Directory serving `manifest.json` and `clips/`. Trailing slashes are normalised. |
| `manifest` | `unknown` | — | Pass an already-parsed manifest to skip the network fetch entirely. |
| `manifestUrl` | `string` | — | Serve the manifest from a URL other than `` `${baseUrl}/manifest.json` ``. |
| `seed` | `string \| number` | — | Deterministic clip choice: the same seed picks the same clip on every visit. |
| `clip` | `string` | — | Play exactly this clip id. |
| `clips` | `string[]` | — | Narrow the pool to these ids; unknown ids are silently dropped. |
| `delayMs` | `number` | `120` | How long to wait before fetching anything. If the pending state resolves sooner, no clip is downloaded. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'full'` | `'md'` | Video width: 40 px, 96 px, 200 px, or 100 % of the container. |
| `mode` | `'inline' \| 'overlay'` | `'inline'` | `overlay` fixes the loader over the whole viewport (z-index `--ll-z`, dark backdrop). |
| `objectFit` | `'contain' \| 'cover'` | `'contain'` | The video's `object-fit`. |
| `rounded` | `boolean` | `true` | Rounded video corners (`--ll-radius`, 12 px). `rounded={false}` squares the corners. |
| `respectReducedMotion` | `boolean` | `true` | Honour `prefers-reduced-motion: reduce`: no `<video>` is created, no clip is fetched, and the spinner does not rotate. |
| `label` | `string` | `'Loading'` | Visually hidden text announced to screen readers. |

### Events

| Event | Payload | Fires when |
| --- | --- | --- |
| `select` | `Clip` | A clip has been chosen (before it loads). |
| `ready` | `Clip` | Playback has started. |
| `error` | `LoopedLoaderError` | A typed failure occurred; check `error.code` — one of `manifest-fetch`, `manifest-invalid`, `clip-fetch`, `decode`, `autoplay-blocked`, `no-clips`. |

The loader never throws into the host's render path: every failure arrives as
an `error` event, the spinner stays up, and something is always visible.

### Slot

- `#fallback` — rendered whenever the loader cannot play: in the `error` state
  or while reduced motion is honoured. Use it for your own spinner, a message,
  or nothing. The built-in spinner keeps rendering underneath it.

### Theming

All styling is plain scoped CSS driven by custom properties set on the
component (they cascade onto the root element):

| Custom property | Default | Controls |
| --- | --- | --- |
| `--ll-size` | per `size` (`40px` / `96px` / `200px` / `100%`) | Video width |
| `--ll-radius` | `12px` | Video corner radius (applies while `rounded` is on) |
| `--ll-bg` | `transparent` | Root background |
| `--ll-z` | `9999` | `overlay` mode z-index |
| `--ll-overlay-bg` | `rgb(0 0 0 / 0.72)` | `overlay` mode backdrop |
| `--ll-spinner-size` | `32px` | Spinner diameter |
| `--ll-spinner-width` | `3px` | Spinner stroke width |
| `--ll-spinner-color` | `currentColor` | Spinner accent (the rotating arc) |
| `--ll-spinner-track` | `rgb(127 127 127 / 0.25)` | Spinner track ring |
| `--ll-fade-ms` | `150ms` | How long the video takes to fade in once playback starts (disabled under reduced motion) |

```vue
<LoopedLoader
  base-url="/looped-clips"
  seed="route:/orders"
  size="lg"
  label="Загрузка"
  style="--ll-radius: 24px; --ll-spinner-color: rebeccapurple"
/>
```

A `class` or `style` you put on `<LoopedLoader>` lands on the root element, so
sizing and positioning stay yours.

## `useSmoothPending`

```ts
import { useSmoothPending } from '@topclans/looped-loader-vue'

const visible = useSmoothPending(pending, { delay: 120, minVisible: 300 })
// <LoopedLoader v-if="visible" base-url="/looped-clips" />
```

A loader cannot enforce its own minimum visible time: mounting and unmounting
are the parent's decisions. `useSmoothPending` returns the ref the parent
should render from — it flips `true` only after `delay`, and once `true` it
stays `true` for at least `minVisible`, so a 40 ms wait never flashes a loader
on the screen.

The package also exports `useLoopedLoader({ baseUrl, ... })` for consumers who
want the loader's state machine without its markup.

## Accessibility

- The root is a polite live region: `role="status"`, `aria-live="polite"`, and
  `aria-busy` reflects whether something is still loading.
- The video is decoration with no audio track and no informational content:
  `aria-hidden="true"`, `muted`, `playsinline`, `autoplay`, `loop`. The
  configurable label is the only text a screen reader hears, because the clip
  carries no information.
- The label is visually hidden (`clip-path`) but always rendered inside the
  live region — including under reduced motion, where the static spinner
  carries no meaning of its own.
- The loader never takes focus and contains no focusable elements.
- `prefers-reduced-motion: reduce` (honoured unless
  `respectReducedMotion: false`) means: no `<video>` element is created, no
  clip is fetched, and the spinner does not rotate.

## Localisation

The default label is the English `"Loading"`. The package does not assume a
language beyond that, and every consumer should pass their own:

```vue
<LoopedLoader base-url="/looped-clips" label="Загрузка" />
```

## Licensing

The code in this repository — core, Vue adapter, tooling — is MIT-licensed
(see `LICENSE`). The clip set is **not** covered by that grant: the videos were
collected from public posts and are redistributed without a licence audit.
Original authors and licences are unknown. The copyright risk is explicitly
accepted by the repository owner and recorded in `NOTICE`, together with the
takedown route: if you hold the rights to a clip, open an issue and it will be
removed from the published package and from the repository. The clips live in
their own package (`@topclans/looped-loader-assets`) so that dropping or
replacing them is a one-line change for consumers.

## The measured corpus

Numbers below come from the committed artefacts (`packages/assets/manifest.json`
and `packages/assets/qc-report.md`), not from this document's ambition.

- **32 clips**, **4 049 965 bytes** (≈ 3.86 MB) in total.
- The largest clip is `u3dob97sw2421` at **430 452 bytes** — the set's single
  `budget-exceeded` exception: after the whole encode ladder (CRF up to 30,
  long side down to 400) it is still over the 250 KB per-clip budget, and the
  reason is recorded in `packages/assets/qc-report.md`.
- The set is generated by `tools/transcode`, never hand-made: every clip was
  encoded from its source through one reproducible ffmpeg pipeline (H.264,
  faststart, no audio, no metadata) and gated by QC checks — frame count and
  duration within ±1 frame, loop-seam regression, structural similarity, and
  byte-exact size/sha256 against the manifest. The assets package verifies its
  own checksums on every build.
