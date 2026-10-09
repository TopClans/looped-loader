# Support

## Where to ask what

| You have | Go to |
|---|---|
| A question, an integration problem, a "how do I…" | [Discussions](https://github.com/TopClans/looped-loader/discussions) |
| A defect — something the loader does that it should not | [Issues](https://github.com/TopClans/looped-loader/issues/new/choose), using the bug report form |
| A feature proposal | Issues, using the feature request form |
| A security vulnerability | **Privately**: see [SECURITY.md](SECURITY.md). Never a public issue. |
| A clip you have the rights to contribute | See [CONTRIBUTING.md](CONTRIBUTING.md) and [NOTICE](NOTICE) |

Issues are for defects and proposals. A question opened as an issue gets moved or closed with a
pointer to Discussions, which is not a judgement on the question.

## Before you open a bug report

`packages/demo` is the reference integration: it runs the component against the real 32-clip
set, and its contact sheet shows every clip. If your case differs from the demo, that
difference is the first thing a maintainer will ask about. The bug report form asks for the
five facts that every real report about this component has needed: the browser and its version,
the package versions, how the assets are served, the shape of the `baseUrl` you pass, and the
console output including any `error` event payload and its `code`.

Two mistakes account for most reports:

- **The manifest and the clips are not in one directory.** The loader fetches
  `<baseUrl>/manifest.json` and the manifest's sources are `clips/<id>.mp4`, so `baseUrl` must
  be the parent of `clips/`, not `clips/` itself.
- **The stylesheet import is missing.** In `0.1.0` the CSS is a separate import
  (`@topclans/looped-loader-vue/style.css`), not inlined in the JS. Without it the video plays
  but the spinner, the sizing and the screen-reader label are absent.

## Out of scope

Taken from the product spec's own out-of-scope list, so nobody has to guess:

- a React (or other) adapter — the core is designed for one, but it is a follow-up package;
- WebM/VP9 or AV1 output — VP9 was measured and lost on this corpus;
- a Web Component build;
- audio, and captions or subtitles;
- `minVisibleMs` inside the component;
- a global one-video-at-a-time registry;
- changesets;
- any CDN or hosting operated by this project — the CDN recipe points at jsDelivr, which is a
  third party, and self-hosting is the recommended route.

## What to expect

This is a single-maintainer project with no SLA. Reports are read on a best-effort basis. A
confirmed defect gets a fix and a `CHANGELOG` entry; a proposal that does not fit gets an
explanation rather than silence.
