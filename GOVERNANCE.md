# Governance

## Who decides

One maintainer, [@TopClans](https://github.com/TopClans), decides. That is the whole
governance model, stated plainly rather than dressed up: this project has no steering
committee, no voting, and no roadmap process.

Decisions that outlive the moment are written down rather than remembered. The
[decision journal](docs/epic/PROGRESS.md) records what was decided, why, and the date,
including the decisions that were later corrected — the journal is more useful with its
mistakes in it than without them.

## How a decision gets made

1. A question, a defect or a proposal arrives as an issue or a discussion.
2. If it changes published behaviour or a settled decision, the maintainer rules on it in the
   conversation and records the ruling in the decision journal and, where it is a user-visible
   effect, in `CHANGELOG.md`.
3. If a ruling contradicts something already written down, the older document is corrected in
   the same change. A specification that no longer matches the code is treated as a defect.

Because one person decides, "the maintainer is unavailable" is a real answer to a proposal.
It is recorded as such rather than left open.

## Adding a maintainer

There is no application process. A second maintainer is added when someone has a track record
in this repository — several merged changes, reviews that caught real problems, and a
demonstrated understanding of the clip-licensing boundary — and the current maintainer invites
them. The mechanics:

- GitHub: write access to the repository.
- npm: membership of the `@topclans` scope with 2FA enabled, so they can publish.
- Release route: with two maintainers, **staged publishing** becomes the default — a version is
  uploaded and must be approved with 2FA before it is installable. It is documented as the next
  step in [docs/release.md](docs/release.md).

## Bus factor

**One.** If the maintainer stops, nothing here is lost in a legal sense and something is lost
in practice:

- The code is MIT. Forks can continue it under their own name, and everything needed to build
  it — the pipeline, the plans, the specs — is in this repository.
- Published versions stay on npm forever; they cannot be withdrawn by anyone, including a
  successor.
- The `@topclans` npm scope cannot be handed over without the account's owner, so a fork
  publishes under a different scope. The package **names** would change; the code would not.
- The 32 clips carry the accepted copyright risk recorded in [NOTICE](NOTICE). A successor
  inherits that decision along with the repository, and the clip contribution policy documents
  the route a rights-holder takes.
