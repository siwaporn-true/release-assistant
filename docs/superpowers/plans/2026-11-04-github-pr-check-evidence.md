# GitHub PR Check Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report `checks_failed` only when GitHub provides evidence of an actual failed check, while fetching authoritative check results from each PR head commit.

**Architecture:** Enrich REST pull-request results with two commit-level sources: Check Runs and the combined legacy commit status. A focused aggregator maps those sources to the existing `passed | failed | pending | unknown` contract, and the code gate maps pending and unknown evidence to non-failure assessment states.

**Tech Stack:** TypeScript 5.9, GitHub REST API 2022-11-28, Vitest 3, pnpm

**Spec:** `docs/superpowers/specs/2026-11-04-github-pr-check-evidence-design.md`

## Global Constraints

- A failed label must mean that at least one check actually failed.
- Use the PR `headSha` as the authoritative commit.
- Preserve the existing `PullRequestEvidence.checks` union: `passed | failed | pending | unknown`.
- Do not change Jira, QA, dependency, workflow, PR matching, or merge-commit rules.
- Do not add dependencies or new UI workflows.

## Review Focus

- A commit with no Check Runs and no legacy statuses must remain `unknown`, not `passed` or `failed` (Task 1).
- A queued/in-progress check must remain `pending` even when all completed checks succeeded (Task 1).
- A failed check must take precedence over pending and successful checks (Task 1).
- GitHub non-blocking conclusions `neutral` and `skipped` must not create a false failure (Task 1).
- `unknown` and `pending` must stop gate evaluation before the later release-commit rule without being labelled `checks_failed` (Task 2).

---

### Task 1: Fetch and aggregate commit check evidence

**Files:**
- Modify: `src/connectors/github/normalize.ts`
- Modify: `src/connectors/github/client.ts`
- Test: `tests/connectors/github.test.ts`

**Interfaces:**
- Consumes: PR list items containing `head.sha`; GitHub responses from `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` and `GET /repos/{owner}/{repo}/commits/{sha}/status`.
- Produces: `normalizeChecks(input: { checkRuns: Array<{ status?: unknown; conclusion?: unknown }>; statuses: Array<{ state?: unknown }> }): PullRequestEvidence["checks"]`; `GitHubClient.listPullRequests(owner, repo)` returns PR evidence enriched with the aggregate value.

- [ ] **Step 1: Write failing normalization tests**

Add table-driven tests asserting:

```ts
expect(normalizeChecks({ checkRuns: [], statuses: [] })).toBe("unknown");
expect(normalizeChecks({ checkRuns: [{ status: "queued", conclusion: null }], statuses: [] })).toBe("pending");
expect(normalizeChecks({ checkRuns: [{ status: "completed", conclusion: "failure" }], statuses: [{ state: "pending" }] })).toBe("failed");
expect(normalizeChecks({ checkRuns: [{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "neutral" }, { status: "completed", conclusion: "skipped" }], statuses: [{ state: "success" }] })).toBe("passed");
```

- [ ] **Step 2: Run the normalization tests and verify RED**

Run: `pnpm test tests/connectors/github.test.ts`

Expected: FAIL because `normalizeChecks` is not exported.

- [ ] **Step 3: Implement `normalizeChecks`**

In `src/connectors/github/normalize.ts`, export the exact interface above. Give failure-like conclusions/states precedence, then pending, then success; return `unknown` when both sources contain no evidence. Treat `success`, `neutral`, and `skipped` completed Check Runs as non-failing success.

- [ ] **Step 4: Run the normalization tests and verify GREEN**

Run: `pnpm test tests/connectors/github.test.ts`

Expected: PASS.

- [ ] **Step 5: Write a failing connector enrichment test**

Change the existing pagination fixture so PR list responses do not invent `checksConclusion`. Add Check Runs and combined-status responses for each `head.sha`, assert the request URLs target those SHAs, and assert the merged PR is normalized with `checks: "passed"`. Add an empty-evidence case asserting `checks: "unknown"`.

- [ ] **Step 6: Run the connector test and verify RED**

Run: `pnpm test tests/connectors/github.test.ts`

Expected: FAIL because `listPullRequests` does not fetch commit check evidence.

- [ ] **Step 7: Enrich each pull request in `GitHubClient.listPullRequests`**

Add private methods that call the two commit endpoints, feed their arrays to `normalizeChecks`, and replace the PR's normalized `checks` value. Keep pagination behavior and existing typed provider errors unchanged.

- [ ] **Step 8: Run connector tests and inspect the focused diff**

Run: `pnpm test tests/connectors/github.test.ts`

Expected: PASS with no warnings.

Run: `git diff -- src/connectors/github/client.ts src/connectors/github/normalize.ts tests/connectors/github.test.ts`

Expected: only commit-check enrichment and its tests.

### Task 2: Represent pending and missing checks accurately in the code gate

**Files:**
- Modify: `src/domain/release/code-gate.ts`
- Test: `tests/domain/code-gate.test.ts`

**Interfaces:**
- Consumes: `GatePr.checks` values `passed | failed | pending | unknown` from Task 1.
- Produces: failed checks → `{ ruleId: "checks_failed", status: "blocked" }`; pending checks → `{ ruleId: "checks_pending", status: "checking" }`; unknown checks → `{ ruleId: "checks_unknown", status: "cannot_verify" }`.

- [ ] **Step 1: Write failing gate regression tests**

Add focused cases asserting:

```ts
expect(evaluateCodeGate(inputWithChecks("failed"))).toMatchObject({ status: "blocked", findings: [{ ruleId: "checks_failed", status: "blocked" }] });
expect(evaluateCodeGate(inputWithChecks("pending"))).toMatchObject({ status: "checking", findings: [{ ruleId: "checks_pending", status: "checking" }] });
expect(evaluateCodeGate(inputWithChecks("unknown"))).toMatchObject({ status: "cannot_verify", findings: [{ ruleId: "checks_unknown", status: "cannot_verify" }] });
```

Use a release commit list containing the PR merge commit in all three cases so only check handling determines the result.

- [ ] **Step 2: Run the gate tests and verify RED**

Run: `pnpm test tests/domain/code-gate.test.ts`

Expected: FAIL because pending and unknown currently produce blocked `checks_failed` findings.

- [ ] **Step 3: Implement explicit check-state findings**

In `evaluateCodeGate`, branch explicitly on `failed`, `pending`, and `unknown`. Compute the gate status from finding severity using the existing assessment vocabulary so `blocked` wins over `cannot_verify`, which wins over `checking`, while the all-passed path remains unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test tests/domain/code-gate.test.ts tests/connectors/github.test.ts`

Expected: PASS with no warnings.

- [ ] **Step 5: Run full project verification**

Run: `pnpm test`

Expected: all Vitest tests pass.

Run: `pnpm typecheck`

Expected: TypeScript exits successfully with no diagnostics.

Run: `pnpm lint`

Expected: lint passes; if the repository's Next.js version no longer supports `next lint`, record that tooling limitation without changing unrelated configuration.

- [ ] **Step 6: Review final scope**

Run: `git status --short` and `git diff --check`.

Expected: only the approved design, plan, connector, gate, and related test files are changed; no whitespace errors.
