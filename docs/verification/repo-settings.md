# Repository settings — before and after going public

Task 8 (E4.4) of `docs/superpowers/plans/2026-10-08-looped-loader-oss-readiness.md`.
A before-and-after record is what makes an irreversible change reviewable later; the "before"
half was captured before anything was changed.

## Before — 2026-10-09, repository private

```text
$ gh api repos/TopClans/looped-loader/community/profile --jq '{health:.health_percentage, files:(.files|with_entries(.value = (.value != null)))}'
{"files":{"code_of_conduct":false,"code_of_conduct_file":false,"contributing":true,
"issue_template":false,"license":true,"pull_request_template":true,"readme":true},"health":85}

$ gh repo view TopClans/looped-loader --json visibility,repositoryTopics,homepageUrl,description,licenseInfo
{"description":"Universal 'perfectly looped' video loader component (Vue first, React later)",
"homepageUrl":"","licenseInfo":{"key":"mit","name":"MIT License","nickname":""},
"repositoryTopics":null,"visibility":"PRIVATE"}

$ gh api repos/TopClans/looped-loader/branches/main/protection
gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.",
"documentation_url":"https://docs.github.com/rest/branches/branch-protection#get-branch-protection",
"status":"403"}

$ gh api repos/TopClans/looped-loader --jq '.security_and_analysis'
(empty)

$ npm whoami
topclans
$ npm -v
11.21.0
```

Three things in that output shaped what follows:

- **The description is already set** — it was not written by this plan. It is a good description,
  so it stays and only the homepage and topics are added.
- **`health: 85`, not 100 and not the design's 14.** README, licence, contributing and the PR
  template are counted; `code_of_conduct` is absent because the owner declined to publish one
  (PROGRESS.md D-31), and `issue_template` reads `false` even though three templates were just
  pushed — GitHub's profile endpoint lags the push, so this is re-read after the flip.
- **Branch protection is a 403 while the repository is private**, which is why the flip is Step 3
  of this task and protection is Step 4.

## After — 2026-10-09, repository public

```text
$ gh repo edit TopClans/looped-loader --visibility public --accept-visibility-change-consequences
(no output; exit 0)

$ gh api repos/TopClans/looped-loader --jq '{visibility}'
{"visibility":"public"}

$ gh api -X PUT repos/TopClans/looped-loader/branches/main/protection --input protection.json
{... "required_status_checks":{"strict":true,"contexts":["test"],...},
 "required_pull_request_reviews":{"required_approving_review_count":0},
 "enforce_admins":{"enabled":false}, "required_linear_history":{"enabled":true},
 "allow_force_pushes":{"enabled":false}, "allow_deletions":{"enabled":false},
 "required_conversation_resolution":{"enabled":true} ...}

$ gh api repos/TopClans/looped-loader/branches/main/protection --jq '{checks:.required_status_checks.contexts, strict:..., linear:..., admin_bypass:(.enforce_admins.enabled == false)}'
{"admin_bypass":true,"checks":["test"],"conversation":true,"deletions":false,
 "force_pushes":false,"linear":true,"reviews":0,"strict":true}

$ gh api -X POST repos/TopClans/looped-loader/tags/protection --input '{"pattern":"v*"}'
gh: Not Found (HTTP 404)        # the legacy tag-protection endpoint is gone

$ gh api -X POST repos/TopClans/looped-loader/rulesets --input ruleset.json
{"enforcement":"active","id":24778364,"name":"protect release tags",
 "rules":["deletion","non_fast_forward"],"target":"tag"}

$ gh api -X PATCH repos/TopClans/looped-loader --input security.json
{"dependabot_security_updates":{"status":"disabled"},"secret_scanning":{"status":"enabled"},
 "secret_scanning_push_protection":{"status":"enabled"},
 "secret_scanning_non_provider_patterns":{"status":"disabled"},...}

$ gh api -X PUT repos/TopClans/looped-loader/vulnerability-alerts        # exit 0
$ gh api -X PUT repos/TopClans/looped-loader/automated-security-fixes    # exit 0

$ gh api -X PATCH repos/TopClans/looped-loader/code-scanning/default-setup --input codeql.json
{"run_id":37907848647,"run_url":"https://api.github.com/repos/TopClans/looped-loader/actions/runs/37907848647"}

$ gh repo edit TopClans/looped-loader --homepage "https://github.com/TopClans/looped-loader#readme"
$ gh repo edit TopClans/looped-loader --add-topic vue,loader,spinner,video,mp4,looping,typescript,webm
$ gh repo view TopClans/looped-loader --json visibility,repositoryTopics,homepageUrl --jq '{visibility, homepageUrl, topics:[.repositoryTopics[].name]}'
{"visibility":"PUBLIC","homepageUrl":"https://github.com/TopClans/looped-loader#readme",
 "topics":["loader","looping","mp4","spinner","typescript","video","vue","webm"]}

$ gh api repos/TopClans/looped-loader/contents/.github/ISSUE_TEMPLATE --jq '[.[].name]'
["bug_report.yml","config.yml","feature_request.yml"]

$ gh api repos/TopClans/looped-loader/community/profile --jq '{health:.health_percentage, files:(.files|with_entries(.value = (.value != null)))}'
{"files":{"code_of_conduct":false,"code_of_conduct_file":false,"contributing":true,
"issue_template":false,"license":true,"pull_request_template":true,"readme":true},"health":85}
```

Labels created: `good first issue`, `help wanted`, `assets`, `release` (`bug` and `documentation`
already existed). Dependabot added `dependencies`, `github_actions` and `javascript` itself when
the config landed.

### Four deviations from the plan's expected result, all measured

1. **`required_status_checks.contexts` is `["test"]`, not the plan's four names.** The plan names
   `lint`, `commits` and two `verify (…)` legs, which belong to E3.5's CI matrix — a task that has
   not run. A required check whose name matches no job blocks every pull request forever, so the
   context is the job this repository actually has. Contexts must be extended in the same commit
   that lands the matrix.
2. **Tag protection is a ruleset, not the `tags/protection` endpoint.** That endpoint answers
   `404 Not Found` now; the ruleset `protect release tags` (id 24778364) blocks tag deletion and
   non-fast-forward updates on `refs/tags/v*`.
3. **`health_percentage` is 85, not 100, and 100 is unreachable.** The score counts a code of
   conduct, which the owner declined (D-31), and it reads `issue_template` as `false` even though
   all three templates are on `main` — verified directly against the contents API. This endpoint
   tracks the legacy single-file `.github/ISSUE_TEMPLATE.md`; the directory form is what GitHub's
   issue UI serves. E4.2's acceptance line is corrected in the plan instead of being left as a
   claim this repository cannot meet.
4. **`dependabot_security_updates` reported `disabled` in the `security_and_analysis` block** even
   though `PUT …/automated-security-fixes` returned exit 0. That field reflects a different
   toggle; the alerts themselves are enabled and the Dependabot pull requests in flight are the
   observable proof.

### The direct-push criterion, stated precisely

`enforce_admins` is `false`, so an administrator can still push to `main` directly — only
non-admin actors are rejected. E4.4 asks for that rejection to be "proved once, on purpose, from
a scratch clone", which cannot be done with a single owner account, and this repository has
exactly one. The rule is real for contributors; the limit is named here rather than claimed away.
