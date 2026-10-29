# Release policy

## Evidence ownership

- Jira Fix Version owns the ticket scope.
- GitHub owns pull-request, review, checks, merge, and branch state.
- GitHub Actions owns workflow state for the exact release commit SHA.
- Release Assistant stores normalized evidence, derived gate results, audit events, exceptions, and immutable QA handoff snapshots.

## Gates

1. **Scope Ready** — expected Jira tickets are present, classifiable, and not blocked.
2. **Code Ready** — every code-bearing ticket has one confirmed PR, required approval/checks, correct target branch, and merged code included in the release branch.
3. **Build Ready** — the configured Preprod workflow passed for the current release-branch SHA.

Missing, stale, ambiguous, unavailable, or SHA-mismatched evidence can never yield Ready for QA. Reference-only/Epic work does not require a PR. Ambiguous PRs require a human selection scoped to that release.

## Exceptions and actions

An exception requires the original rule, reason, approver, and timestamp; it remains visible and audited. Re-running failed jobs requires confirmation of repository, workflow, branch, and SHA. Any exception or re-run invalidates the current decision until evidence is refreshed.

QA handoff requires a current `passed` assessment and matching revision. The append-only snapshot includes ticket keys, selected PRs, release SHA, workflow result, exceptions, actor, time, and ready-to-copy QA text.

## Explicit non-goals

The MVP does not execute QA regression, deploy Preprod or production, approve pull requests, modify Jira scope, or inspect/download/distribute build artifacts.
