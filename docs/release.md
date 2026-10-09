# Releasing

Three packages ship together at one version: `@topclans/looped-loader-core`,
`@topclans/looped-loader-vue` and `@topclans/looped-loader-assets`. `tools/transcode` and
`packages/demo` are private and never leave the repository.

A release is one tag push. `.github/workflows/release.yml` does the rest, and it publishes
through npm **trusted publishing** (OIDC): there is no `NPM_TOKEN` in this repository, in its
secrets, or anywhere in the project, and there must never be one.

## The flow

1. **Bump the version in lockstep** in `packages/core/package.json`,
   `packages/vue/package.json` and `packages/assets/package.json`. The three versions are
   always equal (D-13); changesets is machinery this project does not need while it has one
   maintainer.
2. **Write the `CHANGELOG.md` entry** under a new version heading, following
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
3. **Commit on `main`** — `chore(release): <version>` — and push. A tag pointing at a commit
   that is not on `main` is a release nobody can reproduce.
4. **Push the tag**: `git tag v0.1.1` then `git push origin v0.1.1`.
5. **Watch the workflow**: `gh run watch`.
6. **Verify from outside the repository**, in a scratch directory: install the published
   packages with `npm install`, and run `npm audit signatures` — it must report a verified
   attestation for each package. A green workflow is not evidence that the registry serves
   what you think it serves.

## Why there is no NPM_TOKEN

Trusted publishing replaces the long-lived token with an OIDC exchange: GitHub Actions mints a
short-lived identity token (`permissions.id-token: write`), npm verifies it against the
trusted-publisher configuration, and the publish is authorised for that one run. The token
cannot be extracted from the runner or reused. A repository secret would reintroduce exactly
the credential this project removed.

Provenance follows automatically. npm attaches an attestation when a publish comes through
trusted publishing **from a public repository**, for a **public package** — no `--provenance`
flag is needed, and `publishConfig.provenance` is deliberately left unset so OIDC decides.
Provenance is not generated for private repositories, even when the package itself is public,
which is why the repository was made public before the first release (D-12).

## The trusted publisher configuration

One configuration per package, from a session that can write `~/.npmrc`:

```powershell
npm trust github @topclans/looped-loader-core   --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust github @topclans/looped-loader-vue    --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust github @topclans/looped-loader-assets --file release.yml --repo TopClans/looped-loader --allow-publish
npm trust list @topclans/looped-loader-core
```

- The **workflow filename must match exactly**, including the `.yml` extension, and the
  repository and workflow fields are case-sensitive.
- `repository.url` in each published `package.json` must match the GitHub repository
  **case-sensitively**. A mismatch fails at publish time with `ENEEDAUTH`, which reads like an
  authentication problem and is not.
- **A new configuration must complete its first successful publish within 2 days**, or it
  expires and has to be deleted and recreated. Configure it when the release is imminent, not
  days ahead.
- To change one, delete and recreate it: `npm trust revoke <package> --id=<id>`, then
  `npm trust github …` again. An existing connection cannot be edited.
- npm does not verify the configuration when it is saved. A wrong field surfaces only on the
  first publish.

## The first publish is the exception, and it was measured

`npm trust` could not be attached to these packages before they exist, from this machine, on
2026-10-09 — after the owner had logged in:

```text
$ npm trust github @topclans/looped-loader-core --file release.yml --repo TopClans/looped-loader --allow-publish
Two-factor authentication is required for this operation
npm error 403 403 Forbidden - POST https://registry.npmjs.org/-/package/@topclans%2flooped-loader-core/trust

$ npm trust list @topclans/looped-loader-core
npm error 403 403 Forbidden - GET https://registry.npmjs.org/-/package/@topclans%2flooped-loader-core/trust
```

Nothing was configured — the second command is the proof. The `--dry-run` probe that preceded it
was green and is **not** evidence: it never reaches the registry, and npm does not validate a
configuration when it is saved. Two causes remain possible and cannot be separated without the
owner's one-time password: the `npm login` session carried no 2FA approval for this operation, or
npm refuses a trusted publisher on a package that does not exist yet (its documentation describes
configuring one from the package's *settings*).

- **If the owner's own attempt with 2FA succeeds**, tag and publish in the same sitting: the
  2-day window starts the moment the configuration exists.
- **If it fails with `403` again**, the package must exist first. Publish `0.1.0` with a
  short-lived token created for that one release (handed over through the vault, never as a
  command argument), revoke it, and configure trusted publishing for `0.1.1`. `0.1.0` would then
  carry **no attestation** — a release note, not a footnote.

## The dry run

```powershell
gh workflow run release.yml -f dry_run=true
gh run watch
```

The job installs, builds, type-checks, tests, checks every tarball (`LICENSE` present, and
`NOTICE` for the assets package; no `gifs/`, `src/`, `test/` or `.probe/`), uploads the tarball
inventory as an artifact, and prints what `pnpm -r publish` would upload. **Nothing in the
registry changes.** Run it after any edit to the workflow, and always before a tag: a version
spent on a broken release cannot be unpublished.

## Recovering a partially failed release

`pnpm -r publish` publishes in workspace order (core → vue → assets, because vue depends on
core) and skips any version already present in the registry. So if the job dies after core was
published, fix the cause and re-run the same tag's workflow: core is skipped and the remaining
packages go out. Do not bump the version to "retry" — that ships a version nobody needed.

## When a release is wrong

- **Never `npm unpublish`.** A version older than 72 hours cannot be unpublished at all, and a
  version that is gone breaks every lockfile that pinned it.
- **Deprecate it** and ship the fix as the next patch:
  `npm deprecate "@topclans/looped-loader-core@0.1.1" "Broken autoplay retry; use 0.1.2"`.
- If the wrong artefact was never installed by anyone, deprecation is still the route; the
  registry is append-only by design.
- A release that only needs different release notes is a GitHub Release edit, not a new
  version.

## SemVer policy

The three packages share one version. While the project is pre-1.0:

- **patch** — a bug fix, a documentation-only change, an internal refactor;
- **minor** — a new option, a new export, a new error code (the six error codes in the spec
  are a closed set, so a new one is a deliberate change);
- **major** — a breaking change to the public API surface, which `packages/*/test` pins
  (E3.4). Before 1.0 a breaking change ships as a minor, and the `CHANGELOG` entry says so in
  its first line.

`deprecate`, never `unpublish`, applies to individual package versions exactly as it does to a
whole release.

## Hardening after the first successful publish

For each package, on npmjs.com → package → Settings → Publishing access, select **"Require
two-factor authentication and disallow tokens"**. This restricts traditional token publishing
and leaves trusted publishing working, because trusted publishers authenticate with OIDC rather
than with a token.

## Staged publishing — the next step, not this one

`npm stage publish` uploads a version that a maintainer must then approve with 2FA before it
becomes installable. It is the strongest posture available, and with a single maintainer it
adds a manual step that protects against nobody. Adopt it when a second maintainer appears:
add `--allow-stage-publish` (and not `--allow-publish`) to the trusted publisher, and change
the workflow's publish step to `pnpm stage publish`.
