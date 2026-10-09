# Security policy

## Supported versions

The latest `0.x` release of each package gets fixes. Pre-1.0 this means the newest published
minor; older minors are not maintained. The three packages are versioned in lockstep, so "the
latest minor" is the same number for all of them.

## Reporting a vulnerability

**Report privately**: open a draft advisory at
<https://github.com/TopClans/looped-loader/security/advisories/new>. Do not open a public issue
for a suspected vulnerability — a public report is a disclosure with no fix behind it yet.

Please include the package and version, what an attacker gets, and the smallest reproduction
you have. If the issue is in a consumer's own integration rather than in these packages, say so
and the report will be redirected rather than closed without an answer.

## What this project can promise

This is a **single-maintainer project with no SLA**. Reports are read and answered on a best
-effort basis; there is no on-call rotation and no guaranteed response time. Saying so is more
honest than a policy that promises a window nobody staffs. A confirmed vulnerability gets a
patch release and a `CHANGELOG` entry; a fix that would take longer than it is worth gets
documented as a known limitation instead.

## In scope

- `@topclans/looped-loader-core` — manifest parsing, URL resolution, the clip pool, the media
  lifecycle and the six typed error codes.
- `@topclans/looped-loader-vue` — the component, composables and the stylesheet.
- `tools/transcode` and the release workflow — a supply-chain path, because the pipeline is what
  writes the published assets and the workflow is what publishes them.

## Out of scope

- **The clip corpus as content.** The 32 clips are third-party material redistributed without a
  licence audit; that risk is accepted, documented in [NOTICE](NOTICE), and a rights-holder
  takedown is handled through the route in the clip contribution policy
  ([story E4.3](docs/epic/stories/E4.3-clip-policy.md) until `docs/content-policy.md` exists).
  A report that the clips are third-party content is not a vulnerability report.
- Vulnerabilities in Vue, in a consumer's bundler, or in a consumer's own application.
- `packages/demo`, which is private, is not published, and is a verification surface rather
  than a deliverable.
- Reports produced by a scanner with no demonstrated impact.

## Supply chain

Releases are published from GitHub Actions through npm **trusted publishing** (OIDC), so no
long-lived npm token exists in this repository or its secrets. Published packages carry a
provenance attestation; `npm audit signatures` verifies it. If you find a way to publish a
package in this scope without that workflow, that is a security report and a serious one.
