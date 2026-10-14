import { describe, expect, it } from "vitest";

import { classifyTicket } from "../../src/domain/release/classify-ticket";
import type { NormalizedJiraIssue } from "../../src/connectors/jira/normalize";

const base: NormalizedJiraIssue = {
  id: "1", key: "SUN-1", summary: "Work", issueType: "Story-TrueApp",
  status: "DONE", blocked: false, assigneeId: "dev-1",
  sourceUrl: "https://example.atlassian.net/browse/SUN-1",
  sourceUpdatedAt: "2026-10-12T11:00:00.000+07:00", rawFields: {},
};
const policy = { referenceIssueTypes: ["Epic", "Reference"], codeIssueTypes: ["Story-TrueApp", "Bug-TrueApp"] };

describe("ticket classification", () => {
  it("does not require a pull request for an Epic", () => {
    expect(classifyTicket({ ...base, issueType: "Epic" }, policy).kind).toBe("reference_only");
  });

  it.each(["Story-TrueApp", "Bug-TrueApp"])("classifies %s as code bearing", (issueType) => {
    expect(classifyTicket({ ...base, issueType }, policy).kind).toBe("code_bearing");
  });

  it("requires confirmation when the assignee is missing", () => {
    expect(classifyTicket({ ...base, assigneeId: null }, policy)).toMatchObject({
      kind: "needs_confirmation", reason: "missing_assignee",
    });
  });

  it("preserves explicit blocked status as a blocker", () => {
    expect(classifyTicket({ ...base, status: "BLOCKED", blocked: true }, policy).blocked).toBe(true);
  });
});
