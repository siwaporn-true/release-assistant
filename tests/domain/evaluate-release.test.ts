import { describe, expect, it } from "vitest";

import { evaluateRelease } from "../../src/domain/release/evaluate-release";
import { prioritizeActions } from "../../src/domain/release/prioritize-actions";

const passed = { status: "passed" as const, findings: [] };

describe("overall release assessment", () => {
  it("uses deterministic severity ordering", () => {
    const assessment = evaluateRelease({
      scope: { status: "checking", findings: [{ ruleId: "scope_refreshing", status: "checking" }] },
      code: { status: "cannot_verify", findings: [{ ruleId: "github_unavailable", status: "cannot_verify" }] },
      build: { status: "blocked", findings: [{ ruleId: "workflow_failed", status: "blocked" }] },
      exceptions: [],
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.readyForQa).toBe(false);
  });

  it("keeps an applied exception visible while allowing readiness", () => {
    const assessment = evaluateRelease({
      scope: { status: "blocked", findings: [{ ruleId: "accepted_known_issue", status: "blocked", subject: "SUN-9" }] },
      code: passed,
      build: passed,
      exceptions: [{ ruleId: "accepted_known_issue", subject: "SUN-9", reason: "Accepted for regression", approverId: "lead-1" }],
    });

    expect(assessment).toMatchObject({ status: "passed", readyForQa: true });
    expect(assessment.appliedExceptions).toHaveLength(1);
  });

  it("orders blockers before confirmations and checking actions", () => {
    const assessment = evaluateRelease({
      scope: { status: "needs_confirmation", findings: [{ ruleId: "scope_added", status: "needs_confirmation", subject: "SUN-2" }] },
      code: { status: "blocked", findings: [{ ruleId: "missing_pull_request", status: "blocked", subject: "SUN-1" }] },
      build: { status: "checking", findings: [{ ruleId: "workflow_running", status: "checking" }] },
      exceptions: [],
    });

    expect(prioritizeActions(assessment).map((action) => action.ruleId)).toEqual([
      "missing_pull_request",
      "scope_added",
      "workflow_running",
    ]);
  });
});
