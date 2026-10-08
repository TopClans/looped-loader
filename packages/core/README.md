# @topclans/looped-loader-core

The framework-free core of `looped-loader`: clip selection, manifest
validation, the `<video>` lifecycle and every failure path, in zero-dependency
TypeScript. **The Vue package is the intended front door** — most consumers
want [`@topclans/looped-loader-vue`](../vue/README.md) and the recipes in the
[root README](../../README.md). Use the core directly when you build another
framework adapter or your own markup.

## `createLoopedLoader(options)`

```ts
import { createLoopedLoader } from '@topclans/looped-loader-core'

const loader = createLoopedLoader({
  baseUrl: '/looped-clips',
  seed: 'route:/orders',
  delayMs: 120,
  onState: (state) => console.log(state),
})

loader.start()
loader.attach(document.querySelector('video'))
loader.observeRoot(container)
// later
loader.destroy()
```

Options: `baseUrl` (required), `manifest` or `manifestUrl`, `seed`, `clip`,
`clips`, `delayMs`, `respectReducedMotion`, and the callbacks `onState`,
`onError`, `onSelect`.

The returned handle exposes `state` (`idle` → `resolving` → `loading` →
`playing`, or `error`), `clip`, `src`, `error`, and the four methods above.
`attach()` is idempotent; `destroy()` pauses the video, drops its `src` and
releases the decoder.

**SSR rule: nothing happens before `start()`.** The constructor only records
options — no fetch, no timer, no element. A server render creates a loader and
never calls `start()`; the client starts it after mount. There is no `window`
check anywhere in the fetch path because none is needed.

## The manifest contract

A manifest is a JSON object:

```jsonc
{
  "schemaVersion": 1,
  "clips": [
    {
      "id": "u3dob97sw2421",
      "sources": [{ "src": "clips/u3dob97sw2421.mp4", "type": "video/mp4; codecs=avc1.4d401e" }],
      "width": 320,
      "height": 400,
      "durationMs": 12150,
      "fps": 30
    }
  ]
}
```

Required per clip: `id`, a non-empty `sources` array, `width`, `height`,
`durationMs`, `fps`. Optional fields (`bytes`, `sha256`, `sourceSha256`,
`encode`, `loopSeam`, `corpus`, `generatedBy`) are carried through untouched,
and **unknown fields are ignored**, not rejected — that is how the schema grows
without a breaking change. `clip` sources may use absolute `http(s)://` URLs,
which win over `baseUrl`.

The API surface: `parseManifest` (throws a coded error on invalid input),
`resolveSrc` (joins base and source with exactly one slash), `buildPool`
(narrows by `clip`/`clips`), plus the deterministic picker `pickClip` /
`seededIndex` with the no-repeat guarantee: an unseeded pick never repeats any
of the previous three clip ids.

## Error codes

Every failure is a `LoopedLoaderError` (check it with `isLoopedLoaderError`)
carrying exactly one of six codes:

| Code | Meaning |
| --- | --- |
| `manifest-fetch` | The manifest request failed, or `baseUrl` is missing/empty. |
| `manifest-invalid` | The manifest is not valid JSON or violates the contract. |
| `clip-fetch` | A clip failed to download (or its URL could not be resolved). |
| `decode` | The clip downloaded but the decoder rejected it (`MEDIA_ERR_DECODE`). |
| `autoplay-blocked` | The browser refused to start playback; the loader stays on the spinner and retries once on the first user interaction. |
| `no-clips` | Every clip in the pool has failed, or a filter left nothing. |

A failing clip is retried with a different one (up to 3 attempts, excluding
ids that already failed) before the loader settles into the `error` state —
except `autoplay-blocked`, which is reported but is not a failure: the spinner
is the correct rendering while the page waits for a gesture.
