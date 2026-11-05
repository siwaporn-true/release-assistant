# GitHub PR Check Evidence Design

## Intent

Prevent Release Assistant from reporting `checks_failed` when GitHub did not provide check evidence. A failed label must mean that at least one check actually failed.

## Scope

- Fetch check evidence for each matched pull request from its head commit SHA.
- Normalize aggregate check results as `passed`, `failed`, `pending`, or `unknown`.
- Treat `unknown` as unverifiable rather than failed in the release code gate.
- Add focused connector, normalization, and gate regression tests.

## Non-goals

- Change Jira, QA, dependency, workflow, or merge-commit rules.
- Add new UI workflows or exception mechanisms.
- Change how pull requests are matched to Jira tickets.

## Approaches considered

1. Map missing check data to `cannot_verify` without fetching more evidence. This removes the false failure but never discovers the real result.
2. Fetch checks for the PR head commit and preserve `unknown` when GitHub has no evidence. Selected because it reports real failures while avoiding false positives.

## Proposed behavior

- One or more failed/cancelled/timed-out checks: `failed` and gate finding `checks_failed`.
- Checks exist and all completed successfully: `passed`.
- Any check is queued or in progress and none failed: `pending` and a non-failure checking state.
- GitHub returns no check evidence or an indeterminate result: `unknown` and a `cannot_verify` finding.

The connector will use the PR `headSha` as the authoritative commit. Existing release rules remain unchanged after check evidence is resolved.

## Verification

- Regression test reproduces missing `checksConclusion` from the PR list response.
- Connector tests cover passed, failed, pending, and absent check evidence.
- Code-gate tests prove only an actual failed result produces `checks_failed`.
- Run the focused tests, then the full test suite and project type/lint checks available in package scripts.
