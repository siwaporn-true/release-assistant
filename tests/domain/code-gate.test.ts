import { describe, expect, it } from "vitest";
import { evaluateCodeGate } from "../../src/domain/release/code-gate";

const ready = { status: "matched" as const, pullRequest: { number: 1, targetBranch: "release/x", merged: true, mergeable: true, review: "approved" as const, checks: "passed" as const, mergeCommitSha: "abc1234" } };
const inputWithChecks = (checks: "failed" | "pending" | "unknown") => ({
  releaseBranch: "release/x",
  releaseCommitShas: ["abc1234"],
  matches: [{ ...ready, pullRequest: { ...ready.pullRequest, checks } }],
});

describe("Code Ready gate", () => {
  it.each([
    [{ ...ready, pullRequest: { ...ready.pullRequest, targetBranch: "develop" } }, "wrong_target_branch"],
    [{ ...ready, pullRequest: { ...ready.pullRequest, merged: false } }, "pull_request_open"],
    [{ ...ready, pullRequest: { ...ready.pullRequest, mergeable: false } }, "pull_request_conflicted"],
    [{ ...ready, pullRequest: { ...ready.pullRequest, review: "pending" as const } }, "review_missing"],
    [{ ...ready, pullRequest: { ...ready.pullRequest, checks: "failed" as const } }, "checks_failed"],
  ])("blocks invalid code evidence", (match, ruleId) => {
    expect(evaluateCodeGate({ releaseBranch: "release/x", releaseCommitShas: ["abc1234"], matches: [match] })).toMatchObject({ status: "blocked", findings: [{ ruleId }] });
  });
  it("blocks a merge commit absent from the release branch", () => {
    expect(evaluateCodeGate({ releaseBranch: "release/x", releaseCommitShas: [], matches: [ready] }).findings[0]?.ruleId).toBe("change_not_in_release");
  });
  it("blocks only checks that actually failed", () => {
    expect(evaluateCodeGate(inputWithChecks("failed"))).toMatchObject({ status: "blocked", findings: [{ ruleId: "checks_failed", status: "blocked" }] });
  });
  it("reports checks that are still pending", () => {
    expect(evaluateCodeGate(inputWithChecks("pending"))).toMatchObject({ status: "checking", findings: [{ ruleId: "checks_pending", status: "checking" }] });
  });
  it("reports missing check evidence as unverifiable", () => {
    expect(evaluateCodeGate(inputWithChecks("unknown"))).toMatchObject({ status: "cannot_verify", findings: [{ ruleId: "checks_unknown", status: "cannot_verify" }] });
  });
  it("passes valid merged evidence and permits explicit no-code-change", () => {
    expect(evaluateCodeGate({ releaseBranch: "release/x", releaseCommitShas: ["abc1234"], matches: [ready, { status: "not_required" }] }).status).toBe("passed");
  });
});
