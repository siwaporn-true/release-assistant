import { describe, expect, it } from "vitest";

import { evaluateBuildGate } from "../../src/domain/release/build-gate";

const workflow = {
  runId: 88,
  buildNumber: 1842,
  sha: "abc1234",
  sourceUrl: "https://github/actions/88",
  result: "passed" as const,
  freshness: "fresh" as const,
  observedAt: "2026-10-14T10:00:00.000Z",
  sourceUpdatedAt: "2026-10-14T09:59:00.000Z",
};

describe("Build Ready gate", () => {
  it("shows checking while the latest workflow is running", () => {
    expect(evaluateBuildGate({ currentSha: "abc1234", workflow: { ...workflow, result: "checking" } }).status).toBe("checking");
  });

  it("blocks a successful workflow for an older commit", () => {
    expect(evaluateBuildGate({ currentSha: "new5678", workflow }).findings[0]?.ruleId).toBe("workflow_sha_mismatch");
  });

  it("blocks a failed workflow for the current commit", () => {
    expect(evaluateBuildGate({ currentSha: "abc1234", workflow: { ...workflow, result: "failed" } }).status).toBe("blocked");
  });

  it("passes only a fresh successful workflow for the current commit", () => {
    expect(evaluateBuildGate({ currentSha: "abc1234", workflow }).status).toBe("passed");
  });

  it.each([
    [undefined, "cannot_verify"],
    [{ ...workflow, freshness: "stale" as const }, "needs_confirmation"],
  ] as const)("does not pass missing or stale workflow evidence", (candidate, status) => {
    expect(evaluateBuildGate({ currentSha: "abc1234", workflow: candidate }).status).toBe(status);
  });
});
