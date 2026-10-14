import { describe, expect, it } from "vitest";

import {
  refreshReleaseWithDependencies,
  type RefreshDependencies,
} from "../../src/application/refresh-release";
import { MemoryReleaseRepository } from "../../src/db/release-repository";

const config = {
  id: "release-1",
  ownerId: "user-1",
  jiraProjectKey: "SUN",
  jiraFixVersionId: "21221",
  releaseBranch: "release/12.3.0",
  githubOwner: "org",
  githubRepo: "app",
  workflowId: "preprod.yml",
};

function dependencies(repository: MemoryReleaseRepository): RefreshDependencies {
  return {
    repository,
    now: () => new Date("2026-10-14T05:00:00.000Z"),
    loadJiraIssues: async () => [{
      id: "1", key: "SUN-1", summary: "Change", issueType: "Story-TrueApp",
      status: "DONE", blocked: false, assigneeId: "dev-1",
      sourceUrl: "https://jira/browse/SUN-1", sourceUpdatedAt: "2026-10-14T04:00:00.000Z", rawFields: {},
    }],
    loadPullRequests: async () => [{
      number: 1, title: "SUN-1 change", sourceUrl: "https://github/pull/1",
      sourceBranch: "SUN-1", targetBranch: "release/12.3.0", headSha: "head111",
      mergeCommitSha: "abc1234", merged: true, mergeable: true, review: "approved",
      checks: "passed", observedAt: "2026-10-14T05:00:00.000Z",
      sourceUpdatedAt: "2026-10-14T04:30:00.000Z", freshness: "fresh",
    }],
    loadBranchHead: async () => ({
      sha: "abc1234", sourceUrl: "https://github/commit/abc1234",
      observedAt: "2026-10-14T05:00:00.000Z", sourceUpdatedAt: "2026-10-14T04:59:00.000Z", freshness: "fresh",
    }),
    loadWorkflow: async () => ({
      runId: 88, buildNumber: 1842, sha: "abc1234", sourceUrl: "https://github/actions/88",
      result: "passed", observedAt: "2026-10-14T05:00:00.000Z",
      sourceUpdatedAt: "2026-10-14T04:59:00.000Z", freshness: "fresh",
    }),
  };
}

describe("release refresh", () => {
  it("persists one coherent release revision and a ready assessment", async () => {
    const repository = new MemoryReleaseRepository([config]);
    const result = await refreshReleaseWithDependencies("release-1", "user-1", dependencies(repository));

    expect(result).toMatchObject({ status: "passed", readyForQa: true });
    expect(repository.getStored("release-1")).toMatchObject({ revision: 1, lastRefreshedAt: "2026-10-14T05:00:00.000Z" });
  });

  it("is idempotent for an unchanged evidence fingerprint", async () => {
    const repository = new MemoryReleaseRepository([config]);
    const deps = dependencies(repository);
    await refreshReleaseWithDependencies("release-1", "user-1", deps);
    await refreshReleaseWithDependencies("release-1", "user-1", deps);

    expect(repository.getStored("release-1")?.revision).toBe(1);
  });

  it("rejects access by a different release owner", async () => {
    const repository = new MemoryReleaseRepository([config]);
    await expect(refreshReleaseWithDependencies("release-1", "user-2", dependencies(repository))).rejects.toThrow("Release access denied");
  });

  it("retains last-good evidence but cannot verify a partial connector failure", async () => {
    const repository = new MemoryReleaseRepository([config]);
    const deps = dependencies(repository);
    await refreshReleaseWithDependencies("release-1", "user-1", deps);
    deps.loadPullRequests = async () => { throw new Error("GitHub unavailable"); };

    const result = await refreshReleaseWithDependencies("release-1", "user-1", deps);

    expect(result.status).toBe("cannot_verify");
    expect(repository.getStored("release-1")?.evidence.pullRequests).toHaveLength(1);
    expect(repository.getStored("release-1")?.connectorErrors.github).toBe("GitHub unavailable");
  });
});
