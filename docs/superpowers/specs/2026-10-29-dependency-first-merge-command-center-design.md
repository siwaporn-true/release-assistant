# Dependency-first Merge Command Center Design

## Intent

Extend Release Decision Assistant into a tool the development team can use during a real release. The feature reduces the manual work of moving between Jira and GitHub to determine which pull request can be merged next, especially when an application pull request depends on a pull request in another repository such as `tds_core_module`.

The product remains a decision assistant. It verifies evidence, calculates a safe merge order, explains blockers, and links the user to the correct GitHub pull request. It does not merge pull requests, create release branches, modify versions, or open release pull requests.

## Users and outcome

Developers preparing a release from a Jira Fix Version are the primary users. They need one screen that answers:

> Which pull request is safe to merge next, and what is preventing the other release pull requests from being merged?

A successful workflow lets a developer confirm QA completion, understand cross-repository dependencies, merge eligible pull requests in GitHub, and return to a refreshed queue until all release work is complete. The tool then provides the team's existing manual instructions for creating the release branch, updating application and dependency versions, and opening pull requests into `develop` and `main` for team review.

## Current workflow

1. Open the Jira Fix Version and review the stories in the release.
2. For every story, distinguish its FE subtasks from its QA subtasks and check the QA test cards.
3. Follow Jira development links to the related GitHub pull request.
4. Check whether each pull request is ready to merge.
5. Identify related pull requests in other repositories from pull request descriptions or Jira links.
6. Wait for upstream repository pull requests, such as a `tds_core_module` change, to merge before merging dependent application pull requests.
7. Repeat until every required pull request is merged.
8. Create a release branch from `develop`.
9. Update the application version and dependency versions.
10. Open the resulting pull requests into `develop` and `main` for team review.

The main pain is not the GitHub merge action itself. It is collecting evidence and determining a correct, safe order across Jira, QA cards, and multiple repositories.

## Goals

- Treat the Jira Fix Version as the release scope.
- Detect the QA cards that cover each release ticket and determine whether QA is complete.
- Resolve the pull requests related to each release ticket.
- Detect cross-repository pull request dependencies from pull request descriptions and Jira links.
- Build a dependency graph and produce a deterministic recommended merge order.
- Show the most important blocker and next action first.
- Link developers to GitHub for review and merge.
- Refresh the queue after external changes without silently hiding scope changes.
- Preserve controlled snapshots and audit evidence for release scope changes and the final readiness result.
- After all required pull requests merge, display the team's manual release-branch and version-update checklist.

## Non-goals

- Merging or approving GitHub pull requests.
- Bypassing GitHub branch protection or required reviews.
- Creating the release branch.
- Editing application or dependency versions.
- Opening pull requests into `develop` or `main`.
- Executing QA tests or managing detailed QA results.
- Deploying to Preprod or production.
- Guessing a dependency when evidence is ambiguous.

## Anti-goals

- Declaring a ticket ready when no matching QA evidence can be verified.
- Treating a Jira `DONE` story as proof that its QA cards passed.
- Showing a flat PR list that leaves dependency ordering to the developer.
- Recommending a dependent application PR before its upstream PR has merged.
- Copying GitHub's merge interface into the product.
- Changing release scope or merge order without showing what changed and why.

## Chosen approach

Use a **live command center with controlled snapshots**.

During release preparation the system reads current Jira and GitHub evidence and recalculates the dependency graph and merge queue on refresh. It stores a revision when the effective release scope changes and stores the final release snapshot using the repository's existing snapshot and audit concepts. A refresh must display additions, removals, and material relationship changes instead of accepting them silently.

The screen uses the selected **Dependency-first** layout. It emphasizes the next safe merge action and a globally ordered queue rather than grouping the primary workflow by repository.

## Approaches considered

### Live release command center

Always compute from the newest Jira and GitHub data. This gives the freshest result but provides weak traceability when scope changes during release preparation and is vulnerable to remote API failures changing the visible result.

### Snapshot-based checklist

Freeze the ticket and PR set when release preparation begins, then refresh only their states. This is easy to audit but makes legitimate mid-release scope and dependency changes cumbersome.

### Live command center with controlled snapshots — selected

Use live evidence for operational decisions while recording revisions for scope changes and the final state. This adds some persistence and comparison work, but it fits the product's existing evidence, release snapshot, and audit model and best matches how the team's releases change in practice.

## QA card discovery and gate

The relevant Jira hierarchy is:

```text
Epic
  -> Story
      -> FE subtask(s)
      -> QA subtask(s)
```

FE and QA work can therefore both be subtasks of the same Story. The system must identify QA cards by the agreed naming convention and must not treat every subtask as QA evidence.

For a release ticket with key `SUN-1234`, a QA card is a subtask under the applicable Story whose summary begins with:

```text
QA - [UAT] [SUN-1234]
```

Text following the key describes the test. Matching is based on the normalized ticket key in the bracketed segment, not only on arbitrary occurrence of the key elsewhere in the summary.

The QA result for a ticket is:

- `Passed`: at least one matching QA card is found and every matching QA card has Jira status `DONE`.
- `Blocked`: at least one matching QA card is found and one or more cards are not `DONE`.
- `Needs confirmation`: the ticket is expected to require QA but no matching card is found, the name cannot be parsed reliably, duplicate or conflicting associations exist, or the Jira relationship needed to establish the shared story context cannot be verified.
- `Cannot verify`: Jira is unavailable or required fields/permissions are missing.

The first implementation should compare status using Jira's stable status identifier or status category where configuration permits. The visible name `DONE` remains the team policy default and must be configurable rather than permanently hard-coded.

QA completion is a prerequisite for recommending a ticket's pull request for merge. It is not evidence that the pull request itself is ready.

## Pull request readiness

A pull request is eligible for the queue only when the existing code-readiness rules pass, including:

- the pull request is the confirmed match for its Jira ticket;
- it targets the expected branch;
- required review and GitHub checks pass;
- it has no merge conflict;
- its ticket's QA gate passes; and
- all required upstream pull request dependencies have merged.

An open GitHub pull request remains the source of truth for its own mergeability. The command center links to GitHub for the actual review and merge.

## Dependency discovery

The system builds cross-repository dependency candidates from two sources:

1. The structured dependency tables in the pull request description.
2. Jira development links or issue links that resolve the release ticket to related pull requests.

The supported pull request template groups dependency cards under these headings:

```text
## Component
## Core Module
## Common
```

Each section contains a Markdown table with `Card` and `Status` columns. A populated dependency row looks like:

```text
| [INNO-695](https://trueomx.atlassian.net/browse/INNO-695) | 📦 Ready To Test |
```

The parser extracts the Jira key and section. The user-entered `Status` text is display-only context and is never sufficient readiness evidence. The system resolves the Jira key through Jira development data to the actual dependency pull request, then verifies that pull request in GitHub.

Each dependency edge records its source evidence and confidence. An edge is confirmed automatically when it resolves unambiguously to an accessible pull request and the evidence establishes that the current PR waits for that PR. If both sources agree, the UI shows higher confidence but the merge-order semantics do not change.

The system must not infer direction solely because two pull requests are related. When direction cannot be established, several candidates match, references conflict, a referenced repository is inaccessible, or a cycle is detected, the affected items become `Needs confirmation` or `Cannot verify` and are excluded from recommended merge actions.

Confirmed manual resolution may select the correct dependency or mark a reference as non-blocking for the current release revision. The decision is audited and remains visible as an exception or confirmation, not rewritten as source evidence.

An upstream dependency such as `INNO-695` can be outside the selected Fix Version. It still appears in the merge plan as an upstream dependency item, but it does not require a release QA card to become eligible. Its readiness comes from resolving the Jira card to the intended GitHub pull request and verifying that pull request's target, review, checks, conflicts, and merge state.

## Merge-order calculation

Represent release pull requests as a directed acyclic graph when valid, with an edge from a dependent pull request to the upstream pull request that must merge first.

The queue is produced by a stable topological sort:

1. Exclude items whose QA gate or PR readiness is not satisfied.
2. Place ready upstream dependencies before the pull requests they unlock.
3. Among independent ready items, use a deterministic tie-breaker such as repository priority, Jira rank, then PR number.
4. Keep blocked items visible immediately after the ready section with the exact dependency or gate preventing progress.
5. Recompute after refresh and explain any order change.

The top of the page shows one next action: the first ready upstream pull request that unlocks the queue. If no PR is ready, it shows the highest-priority unresolved QA, PR, dependency, permission, or connectivity blocker.

## Dependency-first command center

The release workspace gains a merge-readiness section with:

- Release identity: Jira project, Fix Version, target branch, refresh time, and revision.
- Merge health: counts for QA passed, QA pending, cross-repository blockers, ready PRs, and merged PRs.
- Next action: one evidence-backed action with a link to Jira or GitHub.
- Recommended merge queue: ticket, repository, PR, QA result, dependency state, PR state, and source link.
- Dependency detail: upstream chain and the evidence used for every edge.
- Scope-change notice: additions, removals, or changed PR/dependency associations since the previous revision.
- Completion checklist: manual instructions for creating the release branch, updating application/dependency versions, and opening PRs into `develop` and `main`.

The GitHub action is labeled `Open in GitHub`, not `Merge`, to avoid implying that the assistant performs the mutation.

## Live refresh and snapshots

Refresh reads Jira and GitHub independently. Partial failure must preserve the last verified evidence with timestamps while marking the affected rules `Cannot verify`; stale evidence cannot produce a new ready-to-merge recommendation.

A new controlled revision is stored when any of the following changes materially:

- ticket membership in the Jira Fix Version;
- QA-card association;
- selected ticket-to-PR match;
- confirmed dependency edge or direction;
- target release branch policy.

Ordinary state transitions such as a QA card becoming `DONE`, checks passing, or a PR merging update live evidence without creating a scope revision, while still producing ordinary audit events as appropriate.

When a material revision is detected, the command center pauses new merge recommendations and shows the diff. A user must explicitly accept the revision before the system publishes the recalculated next action. Acceptance records the actor, time, prior revision, new revision, and displayed diff.

The final snapshot records tickets, QA-card evidence, selected PRs, dependency edges, merge states, exceptions/confirmations, source timestamps, and the generated post-merge checklist.

## Domain and application changes

The existing `scope`, `code`, and `build` gates remain. This feature adds QA evidence to scope/code readiness and adds dependency ordering as a separate domain result rather than embedding graph logic in React components.

Suggested domain concepts:

- `QaCardEvidence` and `TicketQaAssessment`
- `PullRequestReference` and `DependencyEvidence`
- `PullRequestDependencyEdge`
- `MergeQueueItem` and `MergePlan`
- `ReleaseRevisionDiff`

Suggested domain services:

- QA card parser and assessor
- dependency-reference extractor and resolver
- dependency graph validator
- stable merge-plan generator
- release-revision diff calculator

The application refresh orchestration gathers raw Jira/GitHub evidence, invokes the domain services, persists normalized evidence and revisions, and returns a workspace view model. UI components render that view model and do not recreate business rules.

## Configuration and constraints

- Jira Fix Version remains the authoritative release scope.
- GitHub remains authoritative for pull requests, reviews, checks, mergeability, and merge state.
- Jira hierarchy defaults to Epic → Story → FE/QA subtasks. QA discovery is scoped to the Story's subtasks.
- QA card prefix defaults to `QA - [UAT]` and passing status defaults to `DONE`; both should be team configuration.
- Pull request dependency sections default to `Component`, `Core Module`, and `Common`.
- Text in the dependency table's `Status` column is never authoritative.
- The normal target is `develop`. Work grouped under an Epic first merges into that Epic's branch, and the Epic pull request later targets `develop`; expected-target resolution must therefore operate per PR/repository rather than using one global branch value.
- Repository access may differ across dependencies. Missing access results in `Cannot verify`.
- GitHub branch protection is never bypassed.
- No long-lived Jira or GitHub credentials are stored in the browser.
- All derived results include source URLs and observation timestamps.

## Failure and ambiguity handling

- No QA card found: `Needs confirmation`.
- QA card not `DONE`: blocked from the ready merge queue.
- Malformed or mismatched QA-card key: `Needs confirmation`.
- Several plausible PRs for a ticket: require selection using the existing manual PR-selection behavior.
- Related PR found but dependency direction unknown: `Needs confirmation`.
- Dependency card is listed in the PR description but has no resolvable development PR in Jira/GitHub: `Needs confirmation`.
- Referenced dependency PR inaccessible: `Cannot verify`.
- Dependency cycle: block every PR in the cycle and show the cycle.
- Dependency PR closed without merge: block the dependent PR.
- Remote data stale or a connector partially fails: do not recommend a new merge action from stale evidence.
- Scope changes on refresh: show the revision diff before treating the new queue as accepted.

## Testing strategy

- Unit-test QA summary parsing, including spacing, casing, malformed brackets, wrong ticket keys, and multiple cards.
- Unit-test QA assessment for all `DONE`, mixed statuses, missing cards, duplicates, and unavailable Jira data.
- Unit-test PR-reference extraction from supported GitHub URL/reference forms without treating every related link as a directed dependency.
- Unit-test Markdown dependency-table parsing for `Component`, `Core Module`, and `Common`, including blank rows, malformed links, duplicate cards, and user-entered status values.
- Unit-test Story subtask classification so FE subtasks cannot satisfy or block the QA gate.
- Unit-test graph construction, inaccessible nodes, ambiguous direction, cycles, and already-merged dependencies.
- Unit-test stable topological ordering and deterministic tie-breaking.
- Unit-test scope revision diffs.
- Contract-test the Jira fields/links used for QA-card context and GitHub data used for dependency resolution.
- Add UI tests covering an upstream `tds_core_module` PR unlocking a dependent application PR.
- Add UI tests for the manual `Open in GitHub` workflow and refresh after external merge.
- Add UI tests for partial connector failures and visible stale timestamps.

## Acceptance criteria

The feature is acceptable when a developer can:

1. Open a release selected by Jira Fix Version.
2. See each release ticket's QA cards and whether all matching cards are `DONE`.
3. See the confirmed GitHub pull request for each code-bearing ticket.
4. See a cross-repository dependency from PR-description or Jira-link evidence.
5. See an upstream `tds_core_module` PR ordered before the dependent application PR.
6. Be prevented from receiving a ready recommendation when QA, PR readiness, or dependency evidence is unresolved.
7. Open the recommended PR in GitHub, merge it there, refresh, and see the dependent PR become eligible when all gates pass.
8. See and acknowledge material release-scope changes between controlled revisions.
9. After all required PRs merge, see the manual checklist for the release branch, version updates, and PRs into `develop` and `main`.
10. Review source links, timestamps, confirmations, exceptions, and the final release snapshot for auditability.

## Builder calls

- Keep the existing assessment status vocabulary and map the new QA/dependency findings into it.
- Keep graph calculation pure and independently testable.
- Make QA naming/status and merge-order tie-breakers configurable, with the team's described conventions as defaults.
- Treat dependency-table status as a human note; always verify readiness against resolved Jira/GitHub evidence.
- Model expected target branches per PR: feature work may target an Epic branch before the Epic pull request targets `develop`.
- Prefer explicit confirmation over heuristic automation whenever dependency direction is not proven.
- Reuse existing evidence, snapshot, audit, manual PR selection, and release-workspace patterns instead of introducing a parallel release model.
