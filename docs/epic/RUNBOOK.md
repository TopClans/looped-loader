# Looped Loader — Runbook (epic navigation rule)

How any session — human or agent — walks this epic. It is about **how** to work here; the
**what** is in [`README.md`](README.md), the requirements in the spec and the plans, and
the status in [`PROGRESS.md`](PROGRESS.md).

Read this file at the start of every session that touches this repository. It exists
because the failure it prevents is expensive and repeatable: a session that starts from
the code alone re-derives decisions that were already settled, or worse, settles them
differently.

## 1. Source of truth

Highest wins; a lower document that disagrees is corrected, never "worked around":

1. **Spec** — `docs/superpowers/specs/2026-10-08-looped-loader-design.md`. Decisions
   D1–D8 and the accepted copyright risk (§9) are closed.
2. **Plans** — `docs/superpowers/plans/2026-10-08-looped-loader.md` (build) and
   `…-oss-readiness.md` (open source and release). Each carries a `## Handoff` section:
   `Start`, `Decisions and rulings`, `Verified facts`, `Model classes`,
   `Ask the owner before`, `State at handoff`. Treat rulings as settled and verified facts
   as true; report a contradiction instead of re-deriving it.
3. **Story files** — `docs/epic/stories/`, requirements for the new workstreams only.
4. **`PROGRESS.md`** — status, decisions taken after the spec, technical debt. Never a
   source of requirements.

## 2. The cycle of one story

One unit of work is one story id (`E1.3`, `E4.2`). For every story:

1. **Read the story and its dependencies.** Open [`README.md`](README.md), find the id,
   and check in `PROGRESS.md` that everything under `Depends on` is `done`. If not, do
   those first — do not "start the easy part" of a blocked story.
2. **Read the plan task the story points at**, including its `## Handoff`. If the story
   has its own file under `stories/`, read that too.
3. **Close the open questions before writing code.** Anything marked "ask the owner" in
   the plan, or any ambiguity in the story, is resolved and written into the decision
   journal of `PROGRESS.md` first. A decision made mid-implementation and never recorded
   is a decision that will be re-litigated.
4. **Isolate.** Never work on `main`. Create the worktree named in the plan's `Start`
   section (`git worktree add .worktrees/<name> -b feat/<name> feat/looped-loader`).
   Remember that `gifs/` is untracked and therefore **absent** from a fresh worktree —
   any story that needs the source clips runs in the main checkout instead (this is E2.3
   and only E2.3).
5. **Implement through TDD.** Failing test first, then the minimal code that makes it
   pass, then the next test. The plans carry the test code; where a plan block and its
   note disagree, the note is the requirement and the test must pin it.
6. **Verify with real commands.** `pnpm -r build`, `pnpm -r test`, `pnpm typecheck`,
   `pnpm lint`. Read the output. A green claim without the output is not a verification.
7. **Review** — required for the stories the plan marks as review-worthy (E1.3, E2.2,
   E2.4, E4.3, E5.1), by a reviewer on a different model family than the implementer, in
   its own detached worktree. Never a reviewer inside a writer's worktree.
8. **Merge and re-verify.** Merge into `feat/looped-loader`, then run the full suite on
   the integration branch. A suite that is green only in the writer's worktree has not
   been verified.
9. **Update the tracker.** Set the story's status in `PROGRESS.md`, link the evidence
   (commit sha, artifact path, command output summary), and append any decision or debt.
   The story is not done until the tracker says so.

## 3. Order, parallelism, waves

- The dependency graph in [`README.md`](README.md) is the order. It is not advisory.
- Two writers never share a worktree and never write the same directory. Before
  dispatching a second writer, check that its write scope is disjoint from every running
  writer's.
- A **wave** is a set of stories dispatched together. Log every wave in
  `docs/epic/waves/<plan-name>.waves.md`, one section per wave, in this shape:

```markdown
## Wave 2 — stories E2.1, E3.4 — started <ISO timestamp> — base <sha> — runner <pid>

- NOTE: <anything the next session needs that is not visible in the diff>
- E2.1 — DONE — <sha> — <provider/model> — check green — review approve — 1 cycle — 25m
- E3.4 — BLOCKED — 1 cycle — 8m — <the concrete blocking condition, not a mood>
### Closed <ISO timestamp> — STATUS: BLOCKED at E3.4
```

The last line is mandatory and is what a later session reads first: `DONE` or `BLOCKED`,
and on what.

## 4. Model classes and dispatch

Classes, not model names — the owner names the models before each wave.

| Story group | Class | Why |
|---|---|---|
| E1.1–E1.3, E2.1–E2.4 | cheap worker | fully determined by the plan's code blocks; mechanically verifiable |
| E1.4, E1.5, E3.4 | mid-tier worker | Vue lifecycle and type-level assertions are where a cheap worker drifts |
| E3.1, E5.1–E5.3 | main session only | judgement, irreversible actions, evidence interpretation |
| E4.1–E4.3, E3.2, E3.5 | cheap worker | documents and configuration, reviewable by reading |
| Reviewers | a different family than the implementer | independence is the whole value |

Before dispatching: ask the owner which models, once, with the cost implication. If GLM is
proposed, state the current rate window — weekday 11:00–15:00 Yekaterinburg is 3× dearer.

## 5. Tracker discipline

`PROGRESS.md` is the only status carrier. Rules:

- A story's status changes only in the tracker, never in a story file or a plan.
- Every status change carries **evidence**: a commit sha, an artifact path, or a command
  whose output was read.
- The decision journal records decisions **when they are taken**, with the reason. A
  decision without a reason is re-litigated within a month.
- The technical-debt registry takes anything discovered but not fixed, with the story
  that would own it. Debt with no owner is not debt, it is a rumour.

## 6. Reconciliation — plan against reality

The plans are the source of truth for development, so drift is corrected when it appears,
not at the next audit. Three levels:

1. **Micro — at every story close.** If the implementation deviated: (a) fix the plan
   task, (b) record the deviation in `PROGRESS.md` **with the list of downstream stories
   it affects**, (c) fix those stories' rows in the epic map immediately. A cross-cutting
   decision recorded without its blast radius is not recorded.
2. **Epic — before each epic starts.** One pass over the epic's stories against the
   tracker and the code. Every open item in `PROGRESS.md` marked "decide before E…" is
   decided at planning time, not mid-implementation.
3. **Full audit — on trigger, not on a calendar.** Triggers: a cross-cutting decision
   touching three or more epics; the debt registry passing ~10 items with no owner; a
   change to the manifest schema or the public API. Run it as a parallel audit per epic,
   then fix the plan files, then journal it.

## 7. Stop and ask

Do not push through a blocker. Stop and ask the owner when:

- a dependency or a story-level decision is missing;
- a plan task is ambiguous, or its code and its note disagree and the test cannot
  distinguish them;
- verification fails twice for the same reason;
- the work contradicts the spec;
- an action in the next section is about to be taken.

An honest "I do not understand why" is welcome. An invented cause is not.

## 8. Irreversible actions — owner approval required

Each of these is gated, and the gate is an explicit instruction in the current
conversation, not an inference from context:

| Action | Where | Why it is gated |
|---|---|---|
| Making the repository public | E4.4 | publishes 32 third-party clips irreversibly |
| Configuring trusted publishing | E5.1 | binds a workflow identity, needs npm credentials, and a new configuration **expires after 2 days** if the first publish does not succeed |
| `npm publish` / pushing a release tag | E5.2 | npm cannot unpublish a version older than 72 hours |
| Removing or replacing a clip | E2.3, E4.5 | content decision, not an engineering one |
| `git push` to any branch other than `feat/**` or `main` | anywhere | shared repository |

## 9. Harness facts that change how commands are written

Measured on this machine; do not re-derive them, and report a contradiction instead of
working around it quietly.

- **Shell is PowerShell.** `bash` does not start in a `workspace-write` session. Every
  command in the plans is `pwsh`-compatible for that reason.
- **Writes are confined to the workspace** in `workspace-write` mode. Worktrees live in
  `.worktrees/` **inside** the workspace; a sibling directory is denied and the denial
  looks like a tool failure.
- **`npm publish` cannot run from this machine** under `workspace-write`: it writes
  `~/.npmrc` and the npm cache, both outside the workspace. The same applies to
  `npm login` and `npm trust`. This is why E5.1 publishes from CI and why the trusted
  publisher is configured from a session that can reach those paths.
- **Local npm is 11.21.0** (upgraded during planning; `npm@latest` 12.2.0 refuses this machine
  because it wants node ≥ 22.22.2 and node is exactly 22.22.0). It is above the 11.5.1
  trusted-publishing floor and ships `npm trust`, so a trusted publisher can be configured
  from the CLI. It does **not** make local publishing equivalent to CI: trusted publishing
  and provenance both require a cloud runner with an OIDC provider, and self-hosted or local
  runs are unsupported.
- **Node can capture child-process stdout here** (`spawnSync` + `encoding: 'utf8'` works),
  which is what lets the transcode tool be a plain Node script.
- **Git over HTTPS needs the openssl backend** in `workspace-write` sessions:
  `git -c http.sslBackend=openssl …`.
- **Credential-shaped environment variables never reach a tool shell.** Any variable whose
  name contains `KEY`, `TOKEN` or `SECRET` is stripped. Secrets come from the vault
  (`sec run`), never from the environment and never as a command argument.
- **`git rebase` and `git pull --rebase` are forbidden** in this repository.
- **A failing test is not a flake** until it has been run on the commit before the change.
