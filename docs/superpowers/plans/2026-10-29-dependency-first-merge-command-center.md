# Dependency-first Merge Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dependency-first release workspace that verifies Jira QA subtasks, resolves cross-repository dependencies from structured PR descriptions, pauses on unaccepted scope changes, and recommends the next safe PR to open in GitHub.

**Architecture:** Extend normalized Jira and GitHub evidence, then keep QA assessment, dependency parsing/resolution, graph validation, merge ordering, and revision diffs as pure domain modules. `refresh-release.ts` orchestrates connectors and persistence; React receives a prepared merge-plan view model and never computes readiness rules. Existing release gates, evidence, audit, snapshot, and manual PR selection remain authoritative patterns.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.9, Zod 4, Drizzle ORM/PostgreSQL, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-10-29-dependency-first-merge-command-center-design.md`

## Global Constraints

- Jira hierarchy is Epic → Story → FE/QA subtasks; only QA subtasks matching `QA - [UAT] [SUN-xxxx]` count as QA evidence.
- Passing QA status defaults to the visible Jira status `DONE`; prefix and status are configuration, not hard-coded policy.
- Dependency sections default to `Component`, `Core Module`, and `Common`.
- The dependency table's human-entered `Status` is display-only; readiness always comes from Jira/GitHub evidence.
- Upstream dependency cards outside the Fix Version appear in the merge plan and do not require release QA cards.
- Feature PRs may target an Epic branch; the Epic PR later targets `develop`, so target policy is per PR/repository.
- The product links to GitHub and never merges or approves a PR.
- A material scope/dependency revision pauses new recommendations until the release owner accepts the diff.
- Partial or stale remote evidence cannot produce a new ready-to-merge recommendation.
- Do not add a Markdown parser dependency; parse only the documented PR-template subset.

## Review Focus

- A Fix Version Story whose Jira API response omits its subtasks must produce `Cannot verify`, not an empty/passed QA result; covered in Task 1 connector tests and Task 2 QA tests.
- A dependency table row with escaped Markdown, a malformed link, or duplicate Jira card must never silently create two conflicting edges; covered in Task 3 parser tests.
- Two PRs referencing each other must produce a visible cycle blocker and no next merge action; covered in Task 5 graph tests.
- A connector failure after a previously accepted revision must retain timestamped evidence but pause recommendations; covered in Task 7 refresh tests.
- Concurrent attempts to accept an outdated revision must reject the stale acceptance instead of overwriting the current revision; covered in Task 6 repository/application tests.

---

## File structure

### New domain files

- `src/domain/release/qa-gate.ts` — QA-card identification and per-Story assessment.
- `src/domain/release/parse-dependency-tables.ts` — parser for the three supported PR-description sections.
- `src/domain/release/dependency-graph.ts` — edge validation, cycle detection, and stable topological ordering.
- `src/domain/release/build-merge-plan.ts` — combines QA, PR, and graph results into queue items and one next action.
- `src/domain/release/revision-diff.ts` — computes material scope/association changes.

### New application/API files

- `src/application/accept-release-revision.ts` — compare-and-accept operation with audit event.
- `app/api/releases/[releaseId]/revision/route.ts` — authenticated acceptance endpoint.

### New UI files

- `src/components/release/merge-readiness.tsx` — health counts and paused/ready summary.
- `src/components/release/merge-queue.tsx` — ordered ready/blocked items and GitHub links.
- `src/components/release/revision-diff.tsx` — blocking diff and acceptance control.
- `src/components/release/release-completion-checklist.tsx` — manual post-merge instructions.

### Existing files to extend

- Jira/GitHub contracts and clients, release types, refresh orchestration, repository/schema, release workspace, API route, CSS, fixtures, and focused tests listed below.

---

### Task 1: Load Jira hierarchy and GitHub PR bodies

**Files:**
- Modify: `src/connectors/jira/normalize.ts`
- Modify: `src/connectors/jira/client.ts`
- Modify: `src/connectors/github/contracts.ts`
- Modify: `src/connectors/github/normalize.ts`
- Modify: `src/connectors/github/client.ts`
- Test: `tests/connectors/jira.test.ts`
- Test: `tests/connectors/github.test.ts`

**Interfaces:**
- Produces: `NormalizedJiraIssue.parentKey: string | null`, `NormalizedJiraIssue.subtaskKeys: string[]`, `NormalizedJiraIssue.statusId: string | null`, `NormalizedJiraIssue.statusCategoryKey: string | null`.
- Produces: `PullRequestEvidence.body: string`, `PullRequestEvidence.repository: { owner: string; name: string }`.
- Produces: `JiraClient.loadFixVersionIssueTree(projectKey: string, fixVersionId: string): Promise<NormalizedJiraIssue[]>` which includes Fix Version issues and their direct subtasks.

- [ ] **Step 1: Add failing Jira normalization tests**

Assert that a Story payload with `subtasks`, a QA subtask with `parent`, and status metadata normalize to stable keys/IDs; assert missing relationship fields normalize to empty/null rather than throwing.

- [ ] **Step 2: Run the Jira connector tests and verify failure**

Run: `pnpm test -- tests/connectors/jira.test.ts`

Expected: FAIL because hierarchy/status properties and `loadFixVersionIssueTree` do not exist.

- [ ] **Step 3: Extend Jira normalization and tree loading**

Request `subtasks`, `parent`, `status.id`, and `status.statusCategory.key`. Load the Fix Version page first, then fetch direct subtasks by key in bounded batches; throw a connector error when a Story advertises subtasks but their details cannot be loaded.

- [ ] **Step 4: Add failing GitHub evidence tests**

Assert `normalizePullRequest` preserves a Markdown body containing `## Core Module` and attaches the source repository identity.

- [ ] **Step 5: Extend GitHub contracts/client normalization**

Populate `body` and `{ owner, name }` for every PR returned by `listPullRequestEvidence`; preserve existing freshness behavior.

- [ ] **Step 6: Verify connector tests pass**

Run: `pnpm test -- tests/connectors/jira.test.ts tests/connectors/github.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/connectors/jira src/connectors/github tests/connectors
git commit -m "feat: load release hierarchy and PR descriptions"
```

### Task 2: Assess QA subtasks per Story

**Files:**
- Create: `src/domain/release/qa-gate.ts`
- Create: `tests/domain/qa-gate.test.ts`
- Modify: `src/domain/release/types.ts`

**Interfaces:**
- Consumes: `NormalizedJiraIssue` from Task 1.
- Produces: `QaPolicy { summaryPrefix: string; passingStatusName: string }`.
- Produces: `QaCardEvidence { key; storyKey; testedTicketKey; summary; status; sourceUrl }`.
- Produces: `TicketQaAssessment { ticketKey; status: AssessmentStatus; cards: QaCardEvidence[]; findings: ReleaseFinding[] }`.
- Produces: `evaluateQaForStories(input: { issues: NormalizedJiraIssue[]; storyKeys: string[]; policy: QaPolicy }): TicketQaAssessment[]`.

- [ ] **Step 1: Write failing QA parser and assessment tests**

Cover exact `QA - [UAT] [SUN-8420] description`, multiple all-`DONE` cards, one non-`DONE` card, FE subtask ignored, wrong ticket key, missing cards, missing advertised subtask details, and case/whitespace normalization.

- [ ] **Step 2: Verify the QA tests fail**

Run: `pnpm test -- tests/domain/qa-gate.test.ts`

Expected: FAIL because `evaluateQaForStories` is missing.

- [ ] **Step 3: Implement QA evaluation**

Return `passed` only when at least one matching QA subtask exists and all matching cards equal the configured passing status; use `blocked` for a found non-passing card, `needs_confirmation` for missing/malformed associations, and `cannot_verify` for incomplete Jira hierarchy evidence.

- [ ] **Step 4: Verify QA and type tests pass**

Run: `pnpm test -- tests/domain/qa-gate.test.ts tests/domain/types.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/release/qa-gate.ts src/domain/release/types.ts tests/domain/qa-gate.test.ts
git commit -m "feat: evaluate Jira QA subtasks"
```

### Task 3: Parse structured PR dependency tables

**Files:**
- Create: `src/domain/release/parse-dependency-tables.ts`
- Create: `tests/domain/parse-dependency-tables.test.ts`
- Add fixture: `tests/fixtures/github/pr-description-with-dependencies.md`

**Interfaces:**
- Produces: `DependencySection = "component" | "core_module" | "common"`.
- Produces: `DependencyReference { jiraKey: string; section: DependencySection; displayedStatus: string; sourceLine: number }`.
- Produces: `parseDependencyTables(body: string): { references: DependencyReference[]; warnings: string[] }`.

- [ ] **Step 1: Write failing parser tests using the approved template**

Assert `INNO-695` is extracted from `## Core Module`, its `📦 Ready To Test` value is preserved only as `displayedStatus`, blank `| - | - |` rows are ignored, and escaped links parse correctly.

- [ ] **Step 2: Add ambiguity/failure tests**

Assert duplicate cards are deduplicated with a warning; conflicting sections, malformed links, and unsupported free-text references produce warnings and no silently trusted reference.

- [ ] **Step 3: Verify parser tests fail**

Run: `pnpm test -- tests/domain/parse-dependency-tables.test.ts`

Expected: FAIL because the parser is missing.

- [ ] **Step 4: Implement the documented Markdown subset parser**

Scan headings and table rows without adding a parser dependency. Normalize Jira keys to uppercase and never interpret `displayedStatus` as readiness.

- [ ] **Step 5: Verify parser tests pass**

Run: `pnpm test -- tests/domain/parse-dependency-tables.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/release/parse-dependency-tables.ts tests/domain/parse-dependency-tables.test.ts tests/fixtures/github/pr-description-with-dependencies.md
git commit -m "feat: parse PR dependency tables"
```

### Task 4: Resolve dependency cards to cross-repository pull requests

**Files:**
- Modify: `src/connectors/jira/client.ts`
- Modify: `src/connectors/github/client.ts`
- Modify: `src/connectors/github/contracts.ts`
- Create: `src/domain/release/resolve-dependencies.ts`
- Create: `tests/domain/resolve-dependencies.test.ts`
- Modify: `tests/connectors/jira.test.ts`
- Modify: `tests/connectors/github.test.ts`

**Interfaces:**
- Consumes: `DependencyReference[]` from Task 3.
- Produces: `JiraDevelopmentPullRequest { jiraKey; owner; repository; number; sourceUrl }`.
- Produces: `DependencyEvidence { dependent: PullRequestIdentity; upstream: PullRequestEvidence | null; reference: DependencyReference; status: "resolved" | "needs_confirmation" | "cannot_verify"; reason?: string }`.
- Produces: `resolveDependencies(input: { dependent: PullRequestEvidence; references: DependencyReference[]; developmentPullRequests: JiraDevelopmentPullRequest[]; pullRequestsByIdentity: Map<string, PullRequestEvidence> }): DependencyEvidence[]`.

- [ ] **Step 1: Write failing resolution tests**

Cover one `INNO-695` development link resolving to one `tds_core_module` PR, several candidate PRs, no development PR, inaccessible repository, and a user-entered `Done` status whose GitHub PR is still open.

- [ ] **Step 2: Verify resolution tests fail**

Run: `pnpm test -- tests/domain/resolve-dependencies.test.ts`

Expected: FAIL because resolver/contracts are missing.

- [ ] **Step 3: Add Jira development-link and cross-repository GitHub loaders**

Add `loadDevelopmentPullRequests(jiraKeys: string[])` and `loadPullRequestsByIdentity(identities: PullRequestIdentity[])`; batch requests, retain per-reference access failures, and do not collapse them into a global GitHub result.

- [ ] **Step 4: Implement pure dependency resolution**

Resolve only a unique Jira-key-to-PR identity. Multiple candidates become `needs_confirmation`; inaccessible evidence becomes `cannot_verify`.

- [ ] **Step 5: Verify domain and connector tests pass**

Run: `pnpm test -- tests/domain/resolve-dependencies.test.ts tests/connectors/jira.test.ts tests/connectors/github.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/connectors src/domain/release/resolve-dependencies.ts tests/domain/resolve-dependencies.test.ts tests/connectors
git commit -m "feat: resolve cross-repository dependency PRs"
```

### Task 5: Validate the dependency graph and build a stable merge plan

**Files:**
- Create: `src/domain/release/dependency-graph.ts`
- Create: `src/domain/release/build-merge-plan.ts`
- Create: `tests/domain/dependency-graph.test.ts`
- Create: `tests/domain/build-merge-plan.test.ts`

**Interfaces:**
- Consumes: `TicketQaAssessment[]`, release PR matches, and `DependencyEvidence[]`.
- Produces: `PullRequestIdentity { owner; repository; number }`.
- Produces: `PullRequestDependencyEdge { dependent; upstream; jiraKey; section; evidenceUrl }`.
- Produces: `validateDependencyGraph(nodes, edges): { ordered: PullRequestIdentity[]; cycles: PullRequestIdentity[][] }`.
- Produces: `MergeQueueItem { identity; jiraKeys; qaStatus; prStatus; dependencyStatus; blockers; sourceUrl; position: number | null }`.
- Produces: `MergePlan { status: AssessmentStatus; paused: boolean; counts; ready: MergeQueueItem[]; blocked: MergeQueueItem[]; nextAction: RecommendedAction | null }`.
- Produces: `buildMergePlan(input: { qa; pullRequests; dependencies; expectedTargets; paused }): MergePlan`.

- [ ] **Step 1: Write failing graph tests**

Cover upstream-before-dependent order, independent deterministic tie-break by repository priority/Jira rank/PR number, already-merged upstream, closed-unmerged upstream, inaccessible node, duplicate edge, and a two-node cycle.

- [ ] **Step 2: Write failing merge-plan tests**

Assert QA-pending release PRs remain blocked, an outside-Fix-Version dependency needs no QA card, PR target/review/check/conflict rules are represented, and the first ready upstream PR becomes `Open in GitHub` next action.

- [ ] **Step 3: Verify graph/plan tests fail**

Run: `pnpm test -- tests/domain/dependency-graph.test.ts tests/domain/build-merge-plan.test.ts`

Expected: FAIL because graph and plan modules are missing.

- [ ] **Step 4: Implement graph validation and stable topological sort**

Keep the algorithm pure. Cycle members receive blockers and must not appear in `ready` or `nextAction`.

- [ ] **Step 5: Implement merge-plan construction**

Reuse existing code-gate semantics where possible; do not duplicate GitHub readiness rules in UI code. When `paused` is true, return no next action even if queue items otherwise pass.

- [ ] **Step 6: Verify tests pass**

Run: `pnpm test -- tests/domain/dependency-graph.test.ts tests/domain/build-merge-plan.test.ts tests/domain/code-gate.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/release/dependency-graph.ts src/domain/release/build-merge-plan.ts tests/domain/dependency-graph.test.ts tests/domain/build-merge-plan.test.ts
git commit -m "feat: build dependency-first merge plans"
```

### Task 6: Persist material revision diffs and explicit acceptance

**Files:**
- Create: `src/domain/release/revision-diff.ts`
- Create: `tests/domain/revision-diff.test.ts`
- Modify: `src/db/schema.ts`
- Add: `drizzle/<generated-migration>.sql` via `pnpm db:generate`
- Modify: `src/db/release-repository.ts`
- Create: `src/application/accept-release-revision.ts`
- Create: `app/api/releases/[releaseId]/revision/route.ts`
- Modify: `tests/db/schema.test.ts`
- Modify: `tests/application/release-actions.test.ts`
- Modify: `tests/api/releases.test.ts`

**Interfaces:**
- Produces: `ReleaseRevisionMaterial { ticketKeys; qaAssociations; prSelections; dependencyEdges; expectedTargets }`.
- Produces: `ReleaseRevisionDiff { fromRevision; toRevision; additions; removals; changes; material: boolean }`.
- Extends: `StoredRelease.pendingRevision: { revision: number; fingerprint: string; material: ReleaseRevisionMaterial; diff: ReleaseRevisionDiff } | null` and `acceptedRevision: number`.
- Extends: `ReleaseRepository.acceptRevision(releaseId: string, actorId: string, expectedRevision: number): Promise<StoredRelease>`.
- Produces: `acceptReleaseRevision(releaseId: string, actorId: string, expectedRevision: number): Promise<StoredRelease>`.

- [ ] **Step 1: Write failing revision-diff tests**

Assert ticket, QA association, PR selection, dependency edge, and expected-target changes are material; QA status/check/merge state transitions are not material.

- [ ] **Step 2: Write failing repository/application tests**

Assert a pending revision pauses recommendations, acceptance records actor/time/diff, and accepting a revision other than the current pending revision throws `Release revision changed; refresh and review again`.

- [ ] **Step 3: Verify focused tests fail**

Run: `pnpm test -- tests/domain/revision-diff.test.ts tests/db/schema.test.ts tests/application/release-actions.test.ts tests/api/releases.test.ts`

Expected: FAIL because revision persistence and endpoint are missing.

- [ ] **Step 4: Add schema and repository support**

Store accepted revision and pending revision data on the release; use a conditional update inside a transaction for compare-and-accept, and write an `accept_release_revision` audit event.

- [ ] **Step 5: Generate and inspect the migration**

Run: `pnpm db:generate`

Expected: one migration adding the accepted/pending revision columns without dropping existing release data.

- [ ] **Step 6: Implement application operation and authenticated route**

Accept `{ expectedRevision: number }`; enforce release ownership using the existing session pattern; return `409` for stale acceptance.

- [ ] **Step 7: Verify focused tests pass**

Run: `pnpm test -- tests/domain/revision-diff.test.ts tests/db/schema.test.ts tests/application/release-actions.test.ts tests/api/releases.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/release/revision-diff.ts src/db src/application/accept-release-revision.ts app/api/releases tests drizzle
git commit -m "feat: require release revision acceptance"
```

### Task 7: Orchestrate QA, dependencies, merge plans, and stale-evidence safety

**Files:**
- Modify: `src/application/refresh-release.ts`
- Modify: `src/db/release-repository.ts`
- Modify: `src/domain/release/prioritize-actions.ts`
- Modify: `tests/application/refresh-release.test.ts`
- Modify: `tests/domain/evaluate-release.test.ts`
- Add fixture: `tests/fixtures/scenarios/dependency-first.json`

**Interfaces:**
- Consumes: all Task 1–6 outputs.
- Extends: `StoredRelease.evidence` with `qaAssessments`, `dependencyReferences`, `dependencyEvidence`, and `mergePlan`.
- Extends: refresh result/view model with `mergePlan`, `pendingRevision`, `acceptedRevision`, and source timestamps.

- [ ] **Step 1: Write a failing end-to-end application test**

Model `SUN-7019` with QA subtask `DONE`, app PR #1842, `INNO-695` under `Core Module`, and an open upstream PR #621. Assert #621 is the next GitHub action and #1842 is blocked until #621 merges.

- [ ] **Step 2: Add refresh safety tests**

Assert a material dependency change creates a pending revision and removes next action; explicit acceptance restores it; GitHub/Jira partial failure retains old timestamped evidence but yields no new recommendation.

- [ ] **Step 3: Verify application tests fail**

Run: `pnpm test -- tests/application/refresh-release.test.ts`

Expected: FAIL because refresh does not build a merge plan.

- [ ] **Step 4: Integrate hierarchy, parser, resolver, graph, and revision diff**

Load remote evidence in bounded stages, compute pure results, create pending material revision when required, and persist one coherent refresh. Use the accepted material snapshot as the basis for whether recommendations may resume.

- [ ] **Step 5: Update action prioritization**

Place revision acceptance first, followed by unverifiable/QA/dependency blockers, then the merge plan's `Open in GitHub` action; preserve build/handoff actions after merge preparation.

- [ ] **Step 6: Verify application/domain regression tests pass**

Run: `pnpm test -- tests/application/refresh-release.test.ts tests/domain/evaluate-release.test.ts tests/domain/code-gate.test.ts tests/domain/build-gate.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/application/refresh-release.ts src/db/release-repository.ts src/domain/release/prioritize-actions.ts tests/application tests/domain tests/fixtures/scenarios/dependency-first.json
git commit -m "feat: orchestrate dependency-first release refresh"
```

### Task 8: Add the Dependency-first command center UI

**Files:**
- Create: `src/components/release/merge-readiness.tsx`
- Create: `src/components/release/merge-queue.tsx`
- Create: `src/components/release/revision-diff.tsx`
- Create: `src/components/release/release-completion-checklist.tsx`
- Modify: `src/components/release/release-workspace.tsx`
- Modify: `app/releases/[releaseId]/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/ui/release-workspace.test.tsx`
- Create: `tests/ui/merge-queue.test.tsx`

**Interfaces:**
- Consumes: `MergePlan`, `ReleaseRevisionDiff`, `acceptedRevision`, and refresh timestamps from Task 7.
- Produces: `MergeQueue({ plan }: { plan: MergePlan })` where every actionable link is a normal `<a href={sourceUrl}>Open in GitHub</a>`.
- Produces: `RevisionDiff({ diff, onAccept, accepting })` which blocks queue actions until accepted.

- [ ] **Step 1: Write failing merge-queue component tests**

Assert upstream PR appears before dependent PR, status text is accessible without color, blocker evidence is visible, and the action is `Open in GitHub` rather than `Merge`.

- [ ] **Step 2: Write failing workspace revision/completion tests**

Assert a pending diff disables/hides merge recommendations and exposes acceptance; all required PRs merged shows the manual checklist for release branch, version updates, and PRs to `develop`/`main`.

- [ ] **Step 3: Verify UI tests fail**

Run: `pnpm test -- tests/ui/merge-queue.test.tsx tests/ui/release-workspace.test.tsx`

Expected: FAIL because command-center components are missing.

- [ ] **Step 4: Implement the command-center components**

Use the approved Dependency-first hierarchy: merge health, one next action, ready queue, blocked queue with dependency evidence, then release phases. Keep existing gate timeline/evidence available as supporting detail.

- [ ] **Step 5: Wire refresh and revision acceptance**

Call `POST /api/releases/:releaseId/revision` with the displayed `expectedRevision`; refresh workspace data only after a successful acceptance.

- [ ] **Step 6: Verify UI tests and accessibility assertions pass**

Run: `pnpm test -- tests/ui/merge-queue.test.tsx tests/ui/release-workspace.test.tsx tests/ui/release-actions.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/release app/releases app/globals.css tests/ui
git commit -m "feat: add dependency-first merge command center"
```

### Task 9: Complete snapshots, fixtures, operations docs, and browser coverage

**Files:**
- Modify: `src/application/create-handoff.ts`
- Modify: `src/domain/release/generate-handoff.ts`
- Modify: `tests/domain/generate-handoff.test.ts`
- Modify: `tests/application/release-actions.test.ts`
- Create: `tests/e2e/dependency-first-merge.spec.ts`
- Modify: `docs/operations/release-policy.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: accepted revision material and merge plan from Task 7.
- Produces: final snapshot data containing ticket/QA associations, PR identities, dependency edges, accepted revision, confirmations/exceptions, source timestamps, and completion checklist.

- [ ] **Step 1: Write failing snapshot/handoff tests**

Assert the immutable snapshot contains QA cards, dependency edge `INNO-695 → app PR`, accepted revision, source timestamps, and manual post-merge checklist.

- [ ] **Step 2: Write the browser scenario**

Cover loading the Fix Version, seeing upstream `tds_core_module` first, opening its GitHub link, refreshing after external merge, accepting a material diff, and seeing the app PR become next.

- [ ] **Step 3: Verify focused tests fail**

Run: `pnpm test -- tests/domain/generate-handoff.test.ts tests/application/release-actions.test.ts`

Expected: FAIL because snapshot payload lacks merge-plan evidence.

- [ ] **Step 4: Extend final snapshot and handoff generation**

Persist the accepted revision's full dependency/QA evidence. Do not claim the assistant created branches or versions; render them as manual next steps.

- [ ] **Step 5: Document team policy and connector requirements**

Document QA naming/status, supported dependency-table sections, non-authoritative status cells, Epic-branch targeting, outside-scope dependencies, revision acceptance, and least-privilege Jira/GitHub fields.

- [ ] **Step 6: Run focused and full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Expected: all commands exit 0; the browser scenario shows no merge action inside Release Assistant.

- [ ] **Step 7: Commit**

```bash
git add src/application/create-handoff.ts src/domain/release/generate-handoff.ts tests docs README.md
git commit -m "test: verify dependency-first release workflow"
```

---

## Self-review result

- Spec coverage: QA hierarchy, PR-template dependencies, cross-repository resolution, graph ordering, outside-scope dependencies, per-PR target policy, explicit revision acceptance, stale evidence, UI, snapshots, and manual completion steps all map to Tasks 1–9.
- Step scan: each step produces one test, implementation, verification, migration, documentation, or commit outcome.
- Type consistency: Task 1 evidence feeds Tasks 2–4; Tasks 2 and 4 feed Task 5; Task 5 and Task 6 feed Task 7; Task 7 view models feed Tasks 8–9.
- Review focus: all five listed failure modes have explicit tests in their owning tasks.
- Proportion: implementation details are expressed as signatures and assertions; algorithm bodies remain with the implementer.
