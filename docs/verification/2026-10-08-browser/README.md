# Browser verification — 2026-10-08

Story **E3.1** (plan Task 10), run in the main session against the demo dev server. The
browser was the user's signed-in Chromium driven through the Playwright MCP server;
reduced motion was produced with the server's real media emulation
(`browser_emulate_media({ reducedMotion: 'reduce' })`), **not** by stubbing
`window.matchMedia` — a stub would test the stub.

- **URL verified:** `http://127.0.0.1:5273/` — the exact URL the dev server printed, not a guessed one.
- **Revision verified:** `ce5261b`, the integration branch after the core fix below, with the demo served from the main checkout.
- **Date:** 2026-10-08.

## Result

### Contact sheet — acceptance criterion 5

```json
{ "total": 32, "withSource": 32, "playing": 32, "stalled": [], "states": { "playing": 32 }, "spinners": 0 }
```

- **Console errors: 0.**
- **Failed requests: 0.** All 83 resource entries were inspected; none carries a
  `responseStatus >= 400`. (The favicon 404 that appeared in the first run is gone — see
  deviation 3.)
- Screenshot: [`contact-sheet.png`](contact-sheet.png) — full page, all 32 clips.

### Main-thread cost — the plan's own addition

A cold reload with a `longtask` `PerformanceObserver` installed **before** the app boots,
collecting for 5 s while the 32 clips start:

```json
{ "longTaskCount": 0, "longestLongTask": 0 }
```

The budget is < 200 ms. Measured: no long task at all. Playback therefore does not argue
for deferring to `requestIdleCallback`, which was the question this measurement existed to
answer.

### Reduced motion — acceptance criterion 6

With `reducedMotion: 'reduce'` emulated and the page reloaded:

```json
{ "reducedMotionQuery": true, "loaderRoots": 32, "videos": 0, "spinners": 32, "states": { "idle": 32 }, "clipRequests": 0 }
```

No `<video>` element is created, **no clip is requested at all**, every loader stays `idle`,
all 32 spinners are present, and the console is clean. Screenshot:
[`scenarios.png`](scenarios.png) — the scenario board with the reduced-motion card, full page.

## Deviations found — three, all fixed, none absorbed

This is the part of Task 10 that mattered: each of these was invisible to every unit test
and to the plan's own design-time expectations.

### 1. The demo never served a manifest, and the server's 200 was HTML

First load: **0 of 32** clips playing, 32 loaders in `data-state="error"`, 32 spinners.
Measured cause:

```
GET /clips/manifest.json                      → 200, content-type: text/html, body "<!doctype html>…"
GET /clips/manifest.json (Accept: application/json) → 404
GET /clips/2p1qoycrgfm31.mp4                  → 200, video/mp4
```

`sync-clips.mjs` copied the assets package's `clips/` directory but never `manifest.json`,
so Vite's SPA fallback answered the missing path with `index.html` **at status 200**. The
loader's `response.ok` check passed, `response.json()` threw, and every instance landed in
`manifest-invalid`. A 200 that is HTML is worse than a 404. Evidence:
[`contact-sheet-before-fix.png`](contact-sheet-before-fix.png).

Fixed in `c9db3ce`: copy `manifest.json` and `clips/` into one directory, point `base-url`
at that directory (the manifest's `sources[].src` are `clips/<id>.mp4`, so the old
`base-url="/clips"` would have built `/clips/clips/<id>.mp4` even with the manifest
present), and stop the scenario cards from printing an error code the loader never
produces there.

### 2. Half the loaders died on a race in the core

With the layout fixed, 16 of 32 loaders still failed — and **non-deterministically** (12,
then 16, then 16 playing across three loads), with **no** `error` event on any `<video>`
element and a clean network log. Two control experiments attributed it:

| Experiment | Result |
|---|---|
| 32 plain `<video>` elements on the same 32 clips, no loader | **32/32 reached `readyState >= 2`** — the browser is not the limit |
| Every manifest response delayed to 250 ms (longer than the default `delayMs` of 120 ms) | **32/32 playing, exactly 32 manifest requests** |
| No interference | **64 manifest requests — two per loader** — and half the loaders in `error` |

`attach()` called `resolve()` immediately, bypassing `delayMs`; `start()`'s timer then
called it a second time. The second pass re-entered `selectNext()`, which opens by marking
the clip it just selected as failed — so a one-clip pool (the contact sheet passes
`clip="<id>"`) reported `no-clips` on a pool that never failed. Fixed in `dc96e60`, merged
`ce5261b`: the branch is gone, resolution is owned by `start()` alone, and four regression
tests pin it — including the exact browser shape, which fails on the old source with
`onError … [looped-loader:no-clips]`.

### 3. A favicon 404 counted as a failed request

Acceptance criterion 5 asks for zero failed requests, and the first run logged one:
`GET /favicon.ico → 404`. Fixed in `c9db3ce` with a data-URI icon link, so the request is
never made.

## What this run did not verify

- **The CDN recipe** — the packages are unpublished until E5.2. The README marks it unverified.
- **Hydration against the bundled artifact in a real browser.** The SSR side is pinned by
  `packages/vue/test/ssr.test.ts` and the client's first render was checked in source; no
  programmatic hydration diff of the built bundle was performed.
- **The user's OS-level reduced-motion setting.** Emulation was used, deliberately.
- **`npm publish --dry-run` and the assets tarball** — not browser concerns; E5.2.
