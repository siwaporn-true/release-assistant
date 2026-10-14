import { describe, expect, it } from "vitest";

import { GitHubClient } from "../../src/connectors/github/client";
import { normalizePullRequest, normalizeWorkflow } from "../../src/connectors/github/normalize";

describe("GitHub evidence connector", () => {
  it("paginates pull requests and normalizes code evidence", async () => {
    const pages = [
      new Response(JSON.stringify([{ number: 1, title: "SUN-1", html_url: "https://github/pull/1", state: "open", updated_at: "2026-10-12T01:00:00Z", head: { ref: "SUN-1", sha: "aaa1111" }, base: { ref: "release/x" }, mergeable: false }]), { headers: { link: '<https://api.github.test/page=2>; rel="next"' } }),
      new Response(JSON.stringify([{ number: 2, title: "SUN-2", html_url: "https://github/pull/2", state: "closed", merged_at: "2026-10-12T02:00:00Z", updated_at: "2026-10-12T02:00:00Z", head: { ref: "SUN-2", sha: "bbb2222" }, base: { ref: "release/x" }, merge_commit_sha: "ccc3333", reviewDecision: "APPROVED", checksConclusion: "success" }]))
    ];
    const client = new GitHubClient("token", async () => pages.shift()!);

    const result = await client.listPullRequests("org", "repo");

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ merged: true, review: "approved", checks: "passed", mergeCommitSha: "ccc3333" });
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
