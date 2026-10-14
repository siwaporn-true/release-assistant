# Release Decision Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web application that evaluates Jira Fix Version scope against GitHub pull requests and GitHub Actions, then produces an evidence-backed QA handoff for Preprod regression.

**Architecture:** Use one Next.js TypeScript application for the UI and server-only API routes, with PostgreSQL persistence through Drizzle. Jira OAuth and a GitHub App feed normalized connector records into a pure rules engine; the UI reads derived release assessments and invokes only confirmed re-run and QA-handoff actions.

**Tech Stack:** Node.js 22, Next.js, React, TypeScript strict mode, PostgreSQL, Drizzle ORM, Zod, Vitest, Testing Library, MSW, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-release-decision-assistant-design.md`

## Global Constraints

- The final product state is `Ready for QA regression on Preprod`; QA execution and production release work are out of scope.
- Jira owns scope, GitHub owns code state, GitHub Actions owns build state, and this application owns only derived assessments, exceptions, audit records, and snapshots.
- Missing, stale, ambiguous, unavailable, or commit-mismatched evidence must never produce `Passed` or `Ready for QA`.
- Browser code must never receive long-lived Jira or GitHub credentials.
- Mutating actions require explicit confirmation and an audit event.
- The MVP must not inspect, download, distribute, or validate build artifacts.
- Preserve `release-assistant-demo/` as a reference; build the production application in new root-level application folders.

## File Structure

- `app/`: Next.js pages, layouts, release workspace, setup, and server API routes.
- `src/domain/`: Pure release types, ticket classification, matching, gate rules, prioritization, and handoff generation.
- `src/connectors/jira/`: Jira OAuth and issue normalization.
- `src/connectors/github/`: GitHub App authentication, pull-request normalization, workflow lookup, and confirmed re-run.
- `src/application/`: Release refresh, assessment orchestration, action confirmation, snapshot, and audit use cases.
- `src/db/`: Drizzle schema, migrations, and repositories.
- `src/components/`: Small UI components organized by release workspace responsibility.
- `tests/`: Domain, connector, application, UI, contract, and end-to-end tests with anonymized fixtures.

## Review Focus

- A successful workflow for an older commit must leave Build Ready blocked; Task 6 pins the SHA mismatch.
- An unavailable connector or partial refresh must preserve timestamped evidence but return `Cannot verify`; Tasks 4 and 7 pin this.
- Multiple plausible pull requests must require manual selection and never be silently resolved; Task 5 pins ambiguity.
- Epic/reference-only work must not be blocked for a missing pull request while code-bearing work is; Task 3 pins classification.
- Concurrent scope changes during handoff must invalidate confirmation and require a fresh assessment; Task 9 pins snapshot consistency.

---

### Task 1: Application Foundation and Persistent Release Model

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `src/db/client.ts`, `src/db/schema.ts`, `drizzle.config.ts`
- Create: `src/domain/release/types.ts`
- Create: `tests/db/schema.test.ts`, `tests/domain/types.test.ts`

**Interfaces:**
- Produces: `AssessmentStatus = "passed" | "needs_confirmation" | "blocked" | "checking" | "cannot_verify"`.
- Produces: `Release`, `ReleaseIssue`, `Evidence`, `ExceptionRecord`, `AuditEvent`, and `ReleaseSnapshot` types and matching persisted tables.
- Produces: `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:e2e` scripts.

- [ ] **Step 1: Write failing schema and type tests**

Assert that all five assessment statuses validate, persisted release records require Jira project/Fix Version and release branch, and snapshots require a commit SHA, actor, and handoff time.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/db/schema.test.ts tests/domain/types.test.ts`

Expected: FAIL because the schema and domain modules do not exist.

- [ ] **Step 3: Scaffold the Next.js application and implement the domain/database contracts**

Use strict TypeScript and Zod schemas at process boundaries. Store provider identifiers and normalized evidence separately so source records remain traceable.

- [ ] **Step 4: Generate the initial Drizzle migration and run verification**

Run: `pnpm db:generate && pnpm typecheck && pnpm vitest run tests/db/schema.test.ts tests/domain/types.test.ts`

Expected: migration generation succeeds; typecheck and tests PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts vitest.config.ts playwright.config.ts .env.example app src/db src/domain/release/types.ts tests/db tests/domain drizzle.config.ts
git commit -m ":construction_worker: scaffold release assistant application"
```

### Task 2: Server-Side Authentication and Connection Setup

**Files:**
- Create: `src/auth/session.ts`, `src/auth/crypto.ts`
- Create: `src/connectors/jira/oauth.ts`, `src/connectors/github/app-auth.ts`
- Create: `app/api/auth/jira/start/route.ts`, `app/api/auth/jira/callback/route.ts`
- Create: `app/api/auth/github/callback/route.ts`, `app/setup/page.tsx`
- Create: `tests/auth/connections.test.ts`, `tests/ui/setup-page.test.tsx`
- Modify: `src/db/schema.ts`, `.env.example`

**Interfaces:**
- Consumes: persisted provider connection tables from Task 1.
- Produces: `requireUser(): Promise<AuthenticatedUser>`.
- Produces: `getJiraAccess(userId: string): Promise<JiraAccess>` and `getGitHubInstallation(userId: string): Promise<GitHubInstallation>`; credentials remain server-only.

- [ ] **Step 1: Write failing authentication boundary tests**

Assert OAuth state rejection, encrypted token persistence, GitHub installation ownership checks, and absence of access tokens in setup-page HTML and serialized props.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/auth/connections.test.ts tests/ui/setup-page.test.tsx`

Expected: FAIL because the auth modules and routes do not exist.

- [ ] **Step 3: Implement Jira OAuth, GitHub App installation lookup, encrypted storage, and setup status UI**

Use HTTP-only secure session cookies, one-time OAuth state, server-only environment secrets, and least-privilege scopes documented in `.env.example`.

- [ ] **Step 4: Run security and type verification**

Run: `pnpm typecheck && pnpm vitest run tests/auth/connections.test.ts tests/ui/setup-page.test.tsx`

Expected: PASS with no credential material in client output.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth app/setup src/auth src/connectors/jira/oauth.ts src/connectors/github/app-auth.ts src/db/schema.ts .env.example tests/auth tests/ui/setup-page.test.tsx
git commit -m ":closed_lock_with_key: add Jira and GitHub connection setup"
```

### Task 3: Jira Scope Connector and Ticket Classification

**Files:**
- Create: `src/connectors/jira/client.ts`, `src/connectors/jira/normalize.ts`
- Create: `src/domain/release/classify-ticket.ts`
- Create: `app/api/jira/projects/route.ts`, `app/api/jira/fix-versions/route.ts`
- Create: `tests/connectors/jira.test.ts`, `tests/domain/classify-ticket.test.ts`
- Create: `tests/fixtures/jira/fix-version-21221.anonymized.json`

**Interfaces:**
- Consumes: `getJiraAccess()` from Task 2.
- Produces: `listProjects(userId: string): Promise<JiraProject[]>`.
- Produces: `listFixVersions(userId: string, projectKey: string): Promise<JiraFixVersion[]>`.
- Produces: `loadFixVersionIssues(input: { userId: string; projectKey: string; fixVersionId: string }): Promise<NormalizedJiraIssue[]>`.
- Produces: `classifyTicket(issue: NormalizedJiraIssue, policy: TicketPolicy): TicketClassification` with `code_bearing | reference_only | needs_confirmation`.

- [ ] **Step 1: Write failing Jira normalization and classification tests**

Cover pagination, rate limits, Blocked status, Epic/reference-only records without PR requirements, code-bearing Story/Bug records, missing assignee as confirmation, and malformed/missing custom fields.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/connectors/jira.test.ts tests/domain/classify-ticket.test.ts`

Expected: FAIL because connector and classifier exports do not exist.

- [ ] **Step 3: Implement Jira reads, normalization, and configurable ticket policies**

Keep raw source URL/update time with normalized records. Do not parse Jira's presentation-only Development field as proof of GitHub state.

- [ ] **Step 4: Run connector and classifier verification**

Run: `pnpm vitest run tests/connectors/jira.test.ts tests/domain/classify-ticket.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/connectors/jira src/domain/release/classify-ticket.ts app/api/jira tests/connectors/jira.test.ts tests/domain/classify-ticket.test.ts tests/fixtures/jira
git commit -m ":sparkles: add Jira release scope classification"
```

### Task 4: GitHub Evidence Connector

**Files:**
- Create: `src/connectors/github/client.ts`, `src/connectors/github/normalize.ts`
- Create: `src/connectors/github/contracts.ts`
- Create: `tests/connectors/github.test.ts`
- Create: `tests/fixtures/github/pull-requests.json`, `tests/fixtures/github/workflow-runs.json`

**Interfaces:**
- Consumes: `getGitHubInstallation()` from Task 2.
- Produces: `listPullRequestEvidence(input: GitHubReleaseInput): Promise<PullRequestEvidence[]>`.
- Produces: `getReleaseBranchHead(input: GitHubReleaseInput): Promise<CommitEvidence>`.
- Produces: `getWorkflowEvidence(input: GitHubReleaseInput & { sha: string; workflowId: string }): Promise<WorkflowEvidence>`.
- Produces normalized evidence with `sourceUrl`, `observedAt`, `sourceUpdatedAt`, and `freshness`.

- [ ] **Step 1: Write failing GitHub connector contract tests**

Cover pagination, review/check/merge normalization, unavailable API, partial GraphQL errors, rate limits, stale timestamps, queued workflows, failed jobs, and successful workflows for both current and older SHAs.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/connectors/github.test.ts`

Expected: FAIL because the GitHub connector does not exist.

- [ ] **Step 3: Implement GitHub App client and normalized evidence reads**

Keep provider failures as typed connector results so orchestration can produce `Cannot verify` instead of throwing away the last verified evidence.

- [ ] **Step 4: Run connector verification**

Run: `pnpm vitest run tests/connectors/github.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/connectors/github tests/connectors/github.test.ts tests/fixtures/github
git commit -m ":sparkles: add GitHub release evidence connector"
```

### Task 5: Ticket-to-Pull-Request Matching and Code Gate

**Files:**
- Create: `src/domain/release/match-pull-requests.ts`, `src/domain/release/code-gate.ts`
- Create: `src/application/save-pr-selection.ts`
- Create: `tests/domain/match-pull-requests.test.ts`, `tests/domain/code-gate.test.ts`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: `TicketClassification` from Task 3 and `PullRequestEvidence` from Task 4.
- Produces: `matchPullRequests(issue, pullRequests): PullRequestMatchResult` with `matched | ambiguous | missing | not_required` and confidence/evidence.
- Produces: `evaluateCodeGate(input: CodeGateInput): GateAssessment`.
- Produces: `savePullRequestSelection(input: ManualPrSelection): Promise<void>`.

- [ ] **Step 1: Write failing matching and Code Ready tests**

Assert confidence order: key in PR title/branch, Jira development link, then key in associated commit. Cover multiple candidates, missing PR, explicit no-code-change, wrong target branch, open/conflicted PR, missing review, failed checks, and merged changes absent from the release branch.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/domain/match-pull-requests.test.ts tests/domain/code-gate.test.ts`

Expected: FAIL because the matcher and gate do not exist.

- [ ] **Step 3: Implement deterministic matching, persisted manual selection, and Code Ready evaluation**

Never auto-select among equal plausible candidates. A manual selection applies only to its release and remains visible as an audit-relevant decision.

- [ ] **Step 4: Run matching verification**

Run: `pnpm vitest run tests/domain/match-pull-requests.test.ts tests/domain/code-gate.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/release/match-pull-requests.ts src/domain/release/code-gate.ts src/application/save-pr-selection.ts src/db/schema.ts tests/domain/match-pull-requests.test.ts tests/domain/code-gate.test.ts
git commit -m ":sparkles: evaluate ticket pull request readiness"
```

### Task 6: Scope, Build, and Overall Rules Engine

**Files:**
- Create: `src/domain/release/scope-gate.ts`, `src/domain/release/build-gate.ts`
- Create: `src/domain/release/evaluate-release.ts`, `src/domain/release/prioritize-actions.ts`
- Create: `tests/domain/scope-gate.test.ts`, `tests/domain/build-gate.test.ts`, `tests/domain/evaluate-release.test.ts`

**Interfaces:**
- Consumes: classifications and Code Ready results from Tasks 3 and 5 plus workflow/commit evidence from Task 4.
- Produces: `evaluateScopeGate(input: ScopeGateInput): GateAssessment`.
- Produces: `evaluateBuildGate(input: BuildGateInput): GateAssessment`.
- Produces: `evaluateRelease(input: ReleaseEvaluationInput): ReleaseAssessment`.
- Produces: `prioritizeActions(assessment: ReleaseAssessment): RecommendedAction[]`.

- [ ] **Step 1: Write failing rules-engine tests**

Cover Blocked Jira issues, scope additions/removals, stale and unavailable evidence, latest workflow running, old-SHA success, current-SHA job failure, all-current jobs passing, exception visibility, and blocker-first recommended-action ordering.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/domain/scope-gate.test.ts tests/domain/build-gate.test.ts tests/domain/evaluate-release.test.ts`

Expected: FAIL because the gate evaluators do not exist.

- [ ] **Step 3: Implement pure gate evaluators and overall readiness aggregation**

Use deterministic severity ordering `blocked`, `cannot_verify`, `checking`, `needs_confirmation`, `passed`. Ready for QA requires every mandatory rule to pass or have a visible valid exception.

- [ ] **Step 4: Run rules-engine verification**

Run: `pnpm vitest run tests/domain && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/release tests/domain
git commit -m ":sparkles: add release readiness rules engine"
```

### Task 7: Refresh Orchestration and Release API

**Files:**
- Create: `src/application/create-release.ts`, `src/application/refresh-release.ts`, `src/application/get-release.ts`
- Create: `src/db/release-repository.ts`
- Create: `app/api/releases/route.ts`, `app/api/releases/[releaseId]/route.ts`, `app/api/releases/[releaseId]/refresh/route.ts`
- Create: `tests/application/refresh-release.test.ts`, `tests/api/releases.test.ts`

**Interfaces:**
- Consumes: Jira/GitHub connectors and `evaluateRelease()` from Tasks 3, 4, and 6.
- Produces: `createRelease(input: CreateReleaseInput): Promise<ReleaseAssessment>`.
- Produces: `refreshRelease(releaseId: string, actorId: string): Promise<ReleaseAssessment>`.
- Produces: `getRelease(releaseId: string, actorId: string): Promise<ReleaseWorkspaceView>`.

- [ ] **Step 1: Write failing orchestration and API tests**

Assert full refresh, idempotency, connection authorization, last-good evidence retention, partial connector failure returning `Cannot verify`, explicit last-refresh times, and no secrets in JSON responses.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/application/refresh-release.test.ts tests/api/releases.test.ts`

Expected: FAIL because the orchestration and routes do not exist.

- [ ] **Step 3: Implement transactional refresh and release read APIs**

Persist one refresh revision, its source timestamps, normalized evidence, assessment, and prioritized actions atomically. Retain but clearly age the last verified evidence when one connector fails.

- [ ] **Step 4: Run application/API verification**

Run: `pnpm vitest run tests/application/refresh-release.test.ts tests/api/releases.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application src/db/release-repository.ts app/api/releases tests/application tests/api/releases.test.ts
git commit -m ":sparkles: orchestrate release evidence refresh"
```

### Task 8: Release Workspace UI

**Files:**
- Create: `app/releases/new/page.tsx`, `app/releases/[releaseId]/page.tsx`
- Create: `src/components/release/release-header.tsx`, `release-health.tsx`, `next-action.tsx`, `gate-timeline.tsx`, `evidence-table.tsx`, `status-badge.tsx`
- Create: `tests/ui/release-workspace.test.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `ReleaseWorkspaceView` and release API from Task 7.
- Produces: accessible setup, release selection, refresh, blocker-first workspace, gate detail, and source-link UI.

- [ ] **Step 1: Write failing UI behavior tests**

Assert Project/Fix Version selection, readiness answer first, current gate expanded, passed gates collapsed, highest-priority action visible, source links accessible, stale/cannot-verify labels, ambiguous PR selection, loading, empty, and error states.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/ui/release-workspace.test.tsx`

Expected: FAIL because the pages and components do not exist.

- [ ] **Step 3: Implement the responsive release workspace**

Use semantic controls, keyboard-visible focus, non-color status labels, and progressive disclosure. Keep the ticket evidence table secondary to Release Health and Next Action.

- [ ] **Step 4: Run UI and accessibility verification**

Run: `pnpm vitest run tests/ui/release-workspace.test.tsx && pnpm lint && pnpm typecheck`

Expected: PASS with no automated accessibility violations in the rendered states.

- [ ] **Step 5: Commit**

```bash
git add app src/components/release tests/ui/release-workspace.test.tsx
git commit -m ":sparkles: add blocker-first release workspace"
```

### Task 9: Exceptions, Confirmed Workflow Re-run, and QA Handoff Snapshot

**Files:**
- Create: `src/application/create-exception.ts`, `src/application/rerun-workflow.ts`, `src/application/create-handoff.ts`
- Create: `src/domain/release/generate-handoff.ts`, `src/db/audit-repository.ts`
- Create: `app/api/releases/[releaseId]/exceptions/route.ts`, `app/api/releases/[releaseId]/rerun/route.ts`, `app/api/releases/[releaseId]/handoff/route.ts`
- Create: `src/components/release/exception-dialog.tsx`, `rerun-dialog.tsx`, `handoff-dialog.tsx`
- Create: `tests/application/release-actions.test.ts`, `tests/domain/generate-handoff.test.ts`, `tests/ui/release-actions.test.tsx`

**Interfaces:**
- Consumes: release revisions and assessments from Task 7.
- Produces: `createException(input: ExceptionInput): Promise<ReleaseAssessment>`.
- Produces: `rerunFailedJobs(input: ConfirmedRerunInput): Promise<AuditEvent>`.
- Produces: `createHandoff(input: { releaseId: string; expectedRevision: number; actorId: string }): Promise<ReleaseSnapshot>`.
- Produces: `generateHandoff(snapshotInput: HandoffInput): string`.

- [ ] **Step 1: Write failing action, concurrency, and handoff tests**

Require rule/reason/approver/time for exceptions; require repository/workflow/branch/SHA confirmation for re-run; reject non-failed runs and insufficient permissions; audit success and failure; reject handoff when assessment is not ready or `expectedRevision` is stale; verify the snapshot contains ticket keys, selected PRs, release SHA, workflow result, exceptions, actor, time, and QA text but no artifact field.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm vitest run tests/application/release-actions.test.ts tests/domain/generate-handoff.test.ts tests/ui/release-actions.test.tsx`

Expected: FAIL because action use cases and dialogs do not exist.

- [ ] **Step 3: Implement confirmed actions, audit writes, optimistic revision checks, immutable snapshot, and QA handoff text**

After any exception or workflow re-run, require refresh before handoff. Persist snapshots append-only and display exceptions without hiding the original rule outcome.

- [ ] **Step 4: Run action and handoff verification**

Run: `pnpm vitest run tests/application/release-actions.test.ts tests/domain/generate-handoff.test.ts tests/ui/release-actions.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application src/domain/release/generate-handoff.ts src/db/audit-repository.ts app/api/releases src/components/release tests/application/release-actions.test.ts tests/domain/generate-handoff.test.ts tests/ui/release-actions.test.tsx
git commit -m ":sparkles: add audited QA handoff actions"
```

### Task 10: End-to-End Release Flow and Operations Documentation

**Files:**
- Create: `tests/e2e/release-handoff.spec.ts`, `tests/e2e/connector-failure.spec.ts`
- Create: `tests/fixtures/scenarios/ready.json`, `blocked.json`, `ambiguous.json`, `unavailable.json`
- Create: `README.md`, `docs/operations/connections.md`, `docs/operations/release-policy.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: all previous application interfaces.
- Produces: verified user journey, CI checks, local setup, permission/scopes guide, and policy configuration guide.

- [ ] **Step 1: Write failing Playwright journeys**

Cover selecting a Fix Version, resolving an ambiguous PR, observing wrong-SHA build blocking, confirming a valid exception, refreshing to a current-SHA success, and creating a QA handoff. Cover Jira/GitHub outage rendering `Cannot verify` and preventing handoff.

- [ ] **Step 2: Run end-to-end tests and verify failure**

Run: `pnpm test:e2e`

Expected: FAIL until fixture routing and final integration behavior are complete.

- [ ] **Step 3: Complete fixture-backed E2E plumbing, CI workflow, and operations documentation**

Document exact Jira OAuth scopes, GitHub App permissions, webhook/callback URLs, database migration commands, release policy configuration, and the explicit non-goals from the spec.

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`

Expected: every command exits 0; all unit, integration, UI, and E2E tests pass; production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e tests/fixtures/scenarios README.md docs/operations .github/workflows/ci.yml
git commit -m ":white_check_mark: verify release handoff workflow"
```
