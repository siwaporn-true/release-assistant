import { describe, expect, it } from "vitest";

import { evaluateScopeGate } from "../../src/domain/release/scope-gate";

describe("Scope Ready gate", () => {
  it("blocks an explicitly blocked Jira issue", () => {
    const result = evaluateScopeGate({
      issues: [{ key: "SUN-1", blocked: true, classification: "code_bearing" }],
      baselineKeys: ["SUN-1"],
      evidenceState: "current",
    });

    expect(result).toMatchObject({
      status: "blocked",
      findings: [{ ruleId: "jira_issue_blocked", subject: "SUN-1" }],
    });
  });

  it.each([
    [["SUN-1"], ["SUN-1", "SUN-2"], "scope_added"],
    [["SUN-1", "SUN-2"], ["SUN-1"], "scope_removed"],
  ])("requires confirmation when release scope changes", (baselineKeys, currentKeys, ruleId) => {
    const result = evaluateScopeGate({
      issues: currentKeys.map((key) => ({ key, blocked: false, classification: "code_bearing" as const })),
      baselineKeys,
      evidenceState: "current",
    });

    expect(result).toMatchObject({ status: "needs_confirmation" });
    expect(result.findings.some((finding) => finding.ruleId === ruleId)).toBe(true);
  });

  it.each([
    ["stale", "needs_confirmation"],
    ["unavailable", "cannot_verify"],
  ] as const)("does not pass %s Jira evidence", (evidenceState, status) => {
    expect(evaluateScopeGate({ issues: [], baselineKeys: [], evidenceState }).status).toBe(status);
  });
});
