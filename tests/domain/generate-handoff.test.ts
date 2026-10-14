import { describe, expect, it } from "vitest";
import { generateHandoff } from "../../src/domain/release/generate-handoff";

describe("QA handoff", () => {
  it("contains the release evidence and no artifact field", () => {
    const text = generateHandoff({ projectKey: "SUN", fixVersionId: "21221", ticketKeys: ["SUN-1"], selectedPullRequests: [21], releaseBranch: "release/12.3.0", commitSha: "abc1234", workflow: { runId: 88, result: "passed" }, exceptions: [{ ruleId: "missing_review", reason: "Approved in CAB" }], actorId: "user-1", handedOffAt: "2026-10-14T06:00:00.000Z" });
    expect(text).toContain("SUN-1"); expect(text).toContain("#21"); expect(text).toContain("abc1234"); expect(text).toContain("Workflow #88: passed"); expect(text).toContain("Approved in CAB"); expect(text).not.toMatch(/artifact/i);
  });
});
