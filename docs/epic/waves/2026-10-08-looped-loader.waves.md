# Wave log — build plan `2026-10-08-looped-loader.md`

Format: [`../RUNBOOK.md`](../RUNBOOK.md) §3. One section per wave, newest last.
Model picks for this run: **workers `glm-5.3-flash`** (ccr), **reviewers `MiniMax-M3`** (ccr),
chosen by the owner on 2026-10-08 (Thursday, 19:11 Yekaterinburg — GLM off-peak, 0.4×).
Scope agreed with the owner: plan Tasks 1–11 plus Task 10 in the main session; Task 12
(publish) stays owner-gated and is not started.

## Wave 1 — story E1.1 — started 2026-10-08T14:15Z — base 365cbde — runner lead

- NOTE: Task 1 runs in the **main checkout** on `feat/looped-loader`, as the plan's `Start`
  section directs; it is the only task with no worktree of its own, because it creates the
  workspace every later worktree branches from.
- NOTE: report files live in `.waves/reports/<story>.md`, outside every worktree and never
  committed, so a writer's report cannot ride into its own commit.
