import { describe, expect, it } from "vitest";

import { parseCreateReleaseRequest } from "../../src/application/create-release";
import { toPublicReleaseWorkspace } from "../../src/application/get-release";

describe("release API boundary", () => {
  it("validates required release configuration", () => {
    expect(() => parseCreateReleaseRequest({ jiraProjectKey: "SUN" })).toThrow();
  });

  it("does not serialize provider credentials", () => {
    const payload = toPublicReleaseWorkspace({
      id: "release-1", ownerId: "user-1", revision: 1,
      lastRefreshedAt: "2026-10-14T05:00:00.000Z",
      assessment: { status: "passed", readyForQa: true, findings: [], appliedExceptions: [], gates: {} },
      actions: [], evidence: { accessToken: "secret-token", pullRequests: [] },
      connectorErrors: {}, config: { jiraProjectKey: "SUN", jiraFixVersionId: "21221", releaseBranch: "release/x", githubOwner: "org", githubRepo: "app", workflowId: "preprod.yml" },
    });

    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(payload.lastRefreshedAt).toBe("2026-10-14T05:00:00.000Z");
  });
});
