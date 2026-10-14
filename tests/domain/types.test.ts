import { describe, expect, it } from "vitest";

import {
  assessmentStatusSchema,
  releaseInputSchema,
  releaseSnapshotInputSchema,
} from "../../src/domain/release/types";

describe("release domain contracts", () => {
  it.each([
    "passed",
    "needs_confirmation",
    "blocked",
    "checking",
    "cannot_verify",
  ])("accepts the assessment status %s", (status) => {
    expect(assessmentStatusSchema.parse(status)).toBe(status);
  });

  it("rejects a release without Jira scope or release branch", () => {
    expect(() =>
      releaseInputSchema.parse({
        jiraProjectKey: "",
        jiraFixVersionId: "",
        releaseBranch: "",
      }),
    ).toThrow();
  });

  it("requires immutable handoff identity fields", () => {
    expect(() =>
      releaseSnapshotInputSchema.parse({
        releaseId: "release-1",
        commitSha: "",
        actorId: "",
        handedOffAt: "",
      }),
    ).toThrow();
  });
});
