# Release Decision Assistant Design

## Summary

Release Decision Assistant helps a development team decide whether a release build is ready to hand over to QA for regression testing on Preprod. It starts from a Jira Fix Version, verifies the related code and build evidence in GitHub and GitHub Actions, explains blockers, and produces a concise QA handoff.

The product does not replace Jira. Jira already exposes linked GitHub development data. The product adds value by evaluating relationships across systems: whether each in-scope ticket has the expected code evidence, whether that code reached the correct release branch, and whether the latest release commit passed the required build workflow.

The first version stops at `Ready for QA regression on Preprod`. It does not manage QA execution, production deployment, release tags, production smoke tests, or release closure.

## Users and Outcome

The primary users are developers preparing a release for QA.

The main question the product must answer is:

> Is this build ready to send to QA regression, and if not, what must the development team do next?

A successful workflow gives the team:

- One evidence-backed readiness result.
- A prioritized list of blockers and confirmations.
- Direct links to the source record in Jira or GitHub.
- A repeatable handoff summary for QA.
- An audit record of exceptions and the final handoff.

## Scope

### Included

- Select a Jira project and Fix Version as the release scope.
- Read Jira issue type, status, assignee, hierarchy, and blocker information.
- Match Jira tickets to GitHub pull requests.
- Verify pull request review, merge state, checks, conflicts, and target branch.
- Verify a configured GitHub Actions workflow for the release branch and commit.
- Evaluate four release gates.
- Explain blockers and recommend the next action.
- Allow explicitly justified exceptions.
- Record a release snapshot and create a QA handoff summary.
- Allow a confirmed re-run of failed GitHub Actions jobs when permissions permit.

### Excluded from the first version

- QA regression execution or QA result management.
- Production deployment or rollback execution.
- Tag creation and production release closure.
- Updating Jira tickets or GitHub pull requests.
- Downloading, distributing, or validating build artifacts.
- Jenkins integration. A future CI/CD connector may add Jenkins without changing the gate model.

## Product Approach

The product is a release command center rather than another issue list. The primary screen shows the current gate, the most important blocker, and one clear next action. Supporting evidence remains available without dominating the page.

The overall flow is:

```text
Select Jira Fix Version
  -> Verify release scope
  -> Verify pull requests and release branch
  -> Verify GitHub Actions build for the latest commit
  -> Resolve blockers or record justified exceptions
  -> Mark ready for QA
  -> Produce QA handoff and release snapshot
```

## Information Ownership

Each connected system remains authoritative for its own data:

- Jira owns release scope and ticket workflow status.
- GitHub owns pull requests, reviews, merge state, checks, branches, and commits.
- GitHub Actions owns workflow and job results.
- Release Decision Assistant owns derived readiness, exception records, audit events, and handoff snapshots.

The assistant must not present cached or partial information as current fact. Missing, stale, ambiguous, or unavailable evidence results in `Needs confirmation` or `Cannot verify`, never `Passed`.

## Release Workspace

### Release Header

Shows project, Fix Version, release owner, target date, release branch, current commit SHA, and last refresh time.

### Release Health

Answers the readiness question before showing details. Example:

> Not ready for QA — 4 blockers and 6 items need confirmation.

The summary must be derived from release rules, not a manually checked readiness box.

### Blockers and Next Action

Shows the highest-priority unresolved item first. Each item contains:

- The reason it blocks or needs confirmation.
- The affected ticket, pull request, workflow, or commit.
- The evidence used to reach the result.
- The responsible person when known.
- A direct source link.
- One applicable next action.

Suggested action order:

1. Resolve items that block the release.
2. Merge approved pull requests whose checks pass.
3. Investigate tickets with missing or ambiguous pull requests.
4. Re-run failed GitHub Actions jobs after confirmation.
5. Confirm legitimate exceptions.
6. Mark the release ready for QA.

### Gate Timeline

Shows four gates: `Scope Ready`, `Code Ready`, `Build Ready`, and `Ready for QA`. Completed gates are collapsed. The current gate and unresolved evidence are expanded.

### Evidence Table

Provides a cross-system view per ticket:

| Ticket | Jira | Pull request | Target branch | Review/checks | Build | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Example | Done | Merged | Correct | Passed | Passed | Ready |

This table distinguishes merely having development links from proving that the expected code is included in the release commit.

## Release Gates

Every rule produces one of these outcomes:

- `Passed`: Current evidence satisfies the rule.
- `Needs confirmation`: Evidence is missing, stale, or ambiguous and requires a person to decide.
- `Blocked`: Evidence violates a required rule.
- `Checking`: A required remote operation is still in progress.
- `Cannot verify`: A dependency or permission prevents verification.

A gate passes only when all required rules pass and all permitted exceptions are recorded.

### 1. Scope Ready

- Load all issues from the selected Jira Fix Version.
- Classify Epic and reference-only records separately from code-bearing work.
- Detect tickets whose status does not meet the configured release criteria.
- Block issues explicitly marked Blocked when their policy requires it.
- Highlight missing assignees as confirmation items rather than universal blockers.
- Record additions and removals after release preparation begins.
- Preserve the exact ticket set used in the final handoff snapshot.

Issue types do not share one universal code rule. Epic and reference-only records may contribute scope without requiring a pull request. Story, Bug, Task, and Sub-task policies are configurable for the team.

### 2. Code Ready

- Match ticket keys against pull request titles, branch names, and commits.
- Assign a match confidence and require confirmation for ambiguous matches.
- Detect multiple candidate pull requests and let the developer select the intended one.
- Distinguish `No code change` from `Missing pull request`.
- Verify the expected target branch.
- Verify required review and GitHub checks.
- Detect conflicts and open pull requests that must be merged.
- Prove that the expected changes are included in the release branch.

A Jira ticket being Done does not imply Code Ready. A linked pull request being present also does not prove that it was merged into the branch being released.

### 3. Build Ready

- Resolve the latest release-branch commit SHA.
- Find the configured GitHub Actions workflow run for that branch and SHA.
- Require all configured jobs to pass.
- Block when the successful workflow belongs to an older SHA.
- Show `Checking` when a newer applicable workflow is queued or running.
- Expose workflow run, build number, commit SHA, timestamps, failed job, and logs link.
- Offer `Re-run failed jobs` only after the developer confirms the action.

The first version does not inspect, download, or validate artifacts.

### 4. Ready for QA

This is a handoff gate, not a detailed QA workflow. It presents a final summary containing:

- Release version and build number.
- Release branch and commit SHA.
- The exact ticket scope.
- Known issues and approved exceptions.
- GitHub Actions workflow link.
- A release note intended for QA.

The `Mark ready for QA` action requires confirmation and records the acting user and time. Its resulting status is `Ready for QA regression on Preprod`.

## Ticket-to-Pull-Request Matching

Matching uses evidence in descending confidence:

1. Jira ticket key in a pull request title or source branch.
2. Jira development link that resolves to a GitHub pull request.
3. Ticket key in commits associated with a pull request.

The engine must not silently choose when multiple plausible pull requests exist. It shows the candidates and asks the developer to select the release-relevant pull request. Manual selections are recorded and reused for the current release snapshot.

## Exceptions

An exception supports legitimate cases such as documentation-only work or an intentionally accepted known issue. It requires:

- The rule being overridden.
- A reason.
- The approving user.
- A timestamp.
- Optional supporting link.

Exceptions remain visible in Release Health and the QA handoff. They do not rewrite source data or hide the original failed rule.

## Actions and Permissions

Read operations refresh automatically. Mutating operations require an explicit confirmation screen showing the repository, workflow, branch, commit, and expected effect.

The first version permits only these mutations:

- Re-run an eligible failed GitHub Actions job.
- Mark a release ready for QA in Release Decision Assistant.

The browser must not store long-lived Jira or GitHub tokens. Integration uses a backend with OAuth or a GitHub App and least-privilege permissions. All mutating attempts and their outcomes are written to an audit log.

## Failure Handling

- Jira or GitHub unavailable: mark affected rules `Cannot verify`.
- GitHub Actions queued or running: show `Checking` and refresh without declaring success.
- Several pull requests match: require manual selection.
- No pull request matches: require classification as `No code change` or resolution of `Missing pull request`.
- Build SHA differs from the current release SHA: block the build gate and show both values.
- Insufficient permission: explain the missing capability and provide the relevant source link.
- Partially refreshed data: retain the last verified result with its timestamp, but do not treat it as current.

## Release Snapshot

When the release is marked ready for QA, store an immutable snapshot containing:

- Jira project and Fix Version.
- Included ticket keys and relevant source fields.
- Selected pull requests and merge commits.
- Release branch and commit SHA.
- GitHub Actions workflow, jobs, results, build number, and timestamps.
- Exceptions, reasons, approvers, and timestamps.
- The generated QA handoff text.
- The acting user and handoff time.

The snapshot provides traceability even when Jira, GitHub, or branch state changes later.

## Testing Strategy

- Unit-test the rules engine for Passed, Needs confirmation, Blocked, Checking, and Cannot verify outcomes.
- Unit-test ticket classification and pull-request matching, including duplicates and missing keys.
- Test that the release branch, workflow run, and build all refer to the same commit SHA.
- Add contract and integration tests for Jira and GitHub APIs.
- Add UI tests covering Fix Version selection through QA handoff.
- Test read-only permissions separately from confirmed action permissions.
- Test service outages, stale responses, partial refreshes, rate limits, and revoked credentials.
- Keep representative anonymized fixtures for the cross-system cases observed in real release scopes.

## MVP Acceptance Criteria

The MVP is acceptable when a developer can:

1. Select a Jira Fix Version.
2. See every scoped ticket classified by release relevance.
3. See matched GitHub pull requests and resolve ambiguous or missing matches.
4. See whether required code is included in the configured release branch.
5. Verify that the configured GitHub Actions workflow passed for the latest release commit.
6. Understand every blocker or confirmation item from visible evidence.
7. Record justified exceptions with an audit trail.
8. Generate and confirm a QA handoff snapshot.

The product must never show `Ready for QA` when required evidence is stale, unavailable, attached to the wrong branch, or associated with a different commit SHA.
