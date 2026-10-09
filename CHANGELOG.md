# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The three
published packages are versioned in lockstep.

## [Unreleased]

## [0.1.0] - 2026-10-09

### Added

- **`@topclans/looped-loader-core`** — a zero-runtime-dependency core: manifest validation,
  deterministic clip selection with a module-level no-repeat memory, the `<video>` lifecycle,
  and six typed failure codes (`manifest-fetch`, `manifest-invalid`, `clip-fetch`, `decode`,
  `autoplay-blocked`, `no-clips`). Published as ESM with its own type declarations.
- **`@topclans/looped-loader-vue`** — a Vue 3 adapter over the core: a component that mirrors
  `state` and `clip`, composables for the pending delay, a CSS-spinner fallback, and a
  stylesheet exposed at `@topclans/looped-loader-vue/style.css`. `vue` is a peer dependency.
- **`@topclans/looped-loader-assets`** — 32 transcoded clips with `manifest.json` and
  `checksums.json`, produced by `tools/transcode` and gated on frame count, loop seam, SSIM
  and the per-clip weight budget. The set measures **3.86 MB** in total, as reported by
  `packages/assets/qc-report.md`.

### Notes

- The clip set is redistributed **without a licence audit**: copyright on the source clips is
  accepted risk, not a solved problem. The licensing boundary between the code (MIT) and the
  clips is stated in [NOTICE](NOTICE), and `docs/content-policy.md` carries the takedown route.
- `prefers-reduced-motion: reduce` is honoured unless `respectReducedMotion: false`: no
  `<video>` element is created, no clip is fetched, and the spinner does not rotate.
- `baseUrl` is required. There is no default CDN and no fallback host.
