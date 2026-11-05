import { describe, expect, it } from "vitest";

import { GitHubClient } from "../../src/connectors/github/client";
import { normalizeChecks, normalizePullRequest, normalizeWorkflow } from "../../src/connectors/github/normalize";

describe("GitHub evidence connector", () => {
  it.each([
    [{ checkRuns: [], statuses: [] }, "unknown"],
    [{ checkRuns: [{ status: "queued", conclusion: null }], statuses: [] }, "pending"],
    [{ checkRuns: [{ status: "completed", conclusion: "failure" }], statuses: [{ state: "pending" }] }, "failed"],
    [{ checkRuns: [{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "neutral" }, { status: "completed", conclusion: "skipped" }], statuses: [{ state: "success" }] }, "passed"],
  ])("normalizes commit checks as %s", (input, expected) => {
    expect(normalizeChecks(input)).toBe(expected);
  });

  it("paginates pull requests and normalizes code evidence", async () => {
    const requested: string[] = [];
    const client = new GitHubClient("token", async (input) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("page=2")) return new Response(JSON.stringify([{ number: 2, title: "SUN-2", html_url: "https://github/pull/2", state: "closed", merged_at: "2026-10-12T02:00:00Z", updated_at: "2026-10-12T02:00:00Z", head: { ref: "SUN-2", sha: "bbb2222" }, base: { ref: "release/x" }, merge_commit_sha: "ccc3333", reviewDecision: "APPROVED" }]));
      if (url.endsWith("/commits/aaa1111/check-runs")) return new Response(JSON.stringify({ check_runs: [] }));
      if (url.endsWith("/commits/aaa1111/status")) return new Response(JSON.stringify({ statuses: [] }));
      if (url.endsWith("/commits/bbb2222/check-runs")) return new Response(JSON.stringify({ check_runs: [{ status: "completed", conclusion: "success" }] }));
      if (url.endsWith("/commits/bbb2222/status")) return new Response(JSON.stringify({ statuses: [{ state: "success" }] }));
      return new Response(JSON.stringify([{ number: 1, title: "SUN-1", html_url: "https://github/pull/1", state: "open", updated_at: "2026-10-12T01:00:00Z", head: { ref: "SUN-1", sha: "aaa1111" }, base: { ref: "release/x" }, mergeable: false }]), { headers: { link: '<https://api.github.test/page=2>; rel="next"' } });
    });

    const result = await client.listPullRequests("org", "repo");

    expect(result).toHaveLength(2);
    expect(result[0]?.checks).toBe("unknown");
    expect(result[1]).toMatchObject({ merged: true, review: "approved", checks: "passed", mergeCommitSha: "ccc3333" });
    expect(requested).toEqual(expect.arrayContaining([
      "https://api.github.com/repos/org/repo/commits/aaa1111/check-runs",
      "https://api.github.com/repos/org/repo/commits/aaa1111/status",
      "https://api.github.com/repos/org/repo/commits/bbb2222/check-runs",
      "https://api.github.com/repos/org/repo/commits/bbb2222/status",
    ]));
  });

  it("includes a failed check run from a later page", async () => {
    const requested: string[] = [];
    const client = new GitHubClient("token", async (input) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("check-runs-page=2")) return new Response(JSON.stringify({ check_runs: [{ status: "completed", conclusion: "failure" }] }));
      if (url.includes("/check-runs")) return new Response(JSON.stringify({ check_runs: Array.from({ length: 30 }, () => ({ status: "completed", conclusion: "success" })) }), { headers: { link: '<https://api.github.test/check-runs-page=2>; rel="next"' } });
      if (url.includes("/status")) return new Response(JSON.stringify({ statuses: [] }));
      return new Response(JSON.stringify([{ number: 1, title: "SUN-1", html_url: "https://github/pull/1", updated_at: "2026-10-12T01:00:00Z", head: { ref: "SUN-1", sha: "aaa1111" }, base: { ref: "release/x" } }]));
    });

    const result = await client.listPullRequests("org", "repo");

    expect(result[0]?.checks).toBe("failed");
    expect(requested).toContain("https://api.github.test/check-runs-page=2");
  });

  it("bounds concurrent commit evidence requests", async () => {
    let activeRequests = 0;
    let peakRequests = 0;
    const pullRequests = Array.from({ length: 100 }, (_, index) => ({ number: index + 1, title: `SUN-${index + 1}`, html_url: `https://github/pull/${index + 1}`, updated_at: "2026-10-12T01:00:00Z", head: { ref: `SUN-${index + 1}`, sha: `sha${index + 1}` }, base: { ref: "release/x" } }));
    const client = new GitHubClient("token", async (input) => {
      const url = String(input);
      if (url.includes("/pulls?")) return new Response(JSON.stringify(pullRequests));
      activeRequests += 1;
      peakRequests = Math.max(peakRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeRequests -= 1;
      return new Response(JSON.stringify(url.includes("/check-runs") ? { check_runs: [] } : { statuses: [] }));
    });

    await client.listPullRequests("org", "repo");

    expect(peakRequests).toBeLessThanOrEqual(20);
  });

  it.each([[503, "unavailable"], [429, "rate_limited"]] as const)(
    "returns typed %s provider failure for HTTP %s",
    async (status, kind) => {
      const client = new GitHubClient("token", async () => new Response(null, { status }));
      await expect(client.listPullRequests("org", "repo")).rejects.toMatchObject({ kind });
    },
  );

  it("rejects partial GraphQL evidence", () => {
    expect(() => normalizePullRequest({ number: 1, errors: [{ message: "reviews unavailable" }] }, new Date())).toThrow("Partial GitHub evidence");
  });

  it("marks old source timestamps as stale", () => {
    const evidence = normalizePullRequest({ number: 1, title: "SUN-1", html_url: "https://github/pull/1", state: "open", updated_at: "2026-10-01T00:00:00Z", head: { ref: "SUN-1", sha: "aaa1111" }, base: { ref: "release/x" } }, new Date("2026-10-14T00:00:00Z"));
    expect(evidence.freshness).toBe("stale");
  });

  it.each([
    ["queued", null, "checking"], ["completed", "failure", "failed"], ["completed", "success", "passed"],
  ])("normalizes workflow %s/%s to %s", (status, conclusion, expected) => {
    const result = normalizeWorkflow({ id: 1, html_url: "https://github/actions/1", head_sha: "abc1234", status, conclusion, run_number: 9, updated_at: "2026-10-14T00:00:00Z" }, new Date("2026-10-14T00:01:00Z"));
    expect(result.result).toBe(expected);
  });

  it("keeps the workflow SHA so callers can reject an older success", () => {
    const result = normalizeWorkflow({ id: 1, html_url: "https://github/actions/1", head_sha: "old1234", status: "completed", conclusion: "success", run_number: 9, updated_at: "2026-10-14T00:00:00Z" }, new Date("2026-10-14T00:01:00Z"));
    expect(result.sha).toBe("old1234");
  });
});
