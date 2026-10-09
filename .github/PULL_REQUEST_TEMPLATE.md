<!-- One change per pull request. Delete a section that does not apply. -->

## What this changes

<!-- The behaviour before and after, in two sentences. -->

## Why

<!-- The problem. If it closes an issue, name it: Closes #123 -->

## Checklist

- [ ] `pnpm build && pnpm typecheck && pnpm test` is green **in that order**, from a clean tree
      (`build` first: `packages/core/dist` is gitignored and `packages/vue` resolves the core
      through it, so type-checking first fails with `TS2307` and a `TS7006` cascade).
- [ ] Every new test was seen to fail for the right reason before it passed.
- [ ] `pnpm-lock.yaml` is staged if a dependency changed — CI installs with
      `--frozen-lockfile`.
- [ ] `CHANGELOG.md` has an `Unreleased` entry for a user-visible change.
- [ ] No secret is in a file, a command argument or this description. This project publishes
      through npm trusted publishing and holds no npm token.
- [ ] Any number quoted here (a size, a count, a timing) was read from a command's output.

## Evidence

<!-- The command you ran and what it printed. For anything about the browser: the demo page,
     the state you observed, and a screenshot. Source is not evidence for a browser claim. -->

## Anything a reviewer should be suspicious of

<!-- The part of this change you are least sure about. Saying it here is faster than having it
     found. -->
