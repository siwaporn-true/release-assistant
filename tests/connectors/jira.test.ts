import { describe, expect, it } from "vitest";

import { JiraClient, JiraRateLimitError } from "../../src/connectors/jira/client";
import { normalizeJiraIssue } from "../../src/connectors/jira/normalize";

describe("Jira connector", () => {
  it("loads every page of a Fix Version", async () => {
    const responses = [
      { issues: [{ id: "1", key: "SUN-1", fields: { summary: "One", issuetype: { name: "Story" }, status: { name: "DONE" }, updated: "2026-10-12T10:00:00Z" } }], nextPageToken: "page-2", isLast: false },
      { issues: [{ id: "2", key: "SUN-2", fields: { summary: "Two", issuetype: { name: "Bug" }, status: { name: "BLOCKED" }, updated: "2026-10-12T11:00:00Z" } }], isLast: true },
    ];
    const fetcher = async () => new Response(JSON.stringify(responses.shift()), { status: 200 });
    const client = new JiraClient("token", "cloud-1", fetcher);

    const issues = await client.loadFixVersionIssues("SUN", "21221");

    expect(issues.map((issue) => issue.key)).toEqual(["SUN-1", "SUN-2"]);
    expect(issues[1]?.blocked).toBe(true);
  });

  it("returns a typed error when Jira rate limits the request", async () => {
    const client = new JiraClient("token", "cloud-1", async () => new Response(null, {
      status: 429, headers: { "retry-after": "30" },
    }));

    await expect(client.loadFixVersionIssues("SUN", "21221")).rejects.toEqual(
      new JiraRateLimitError(30),
    );
  });

  it("keeps source identity while ignoring malformed custom fields", () => {
    const issue = normalizeJiraIssue({
      id: "1", key: "SUN-1",
      fields: { summary: "One", issuetype: { name: "Story" }, status: { name: "DONE" }, updated: "2026-10-12T10:00:00Z", customfield_10900: "not-json" },
    }, "https://example.atlassian.net");

    expect(issue).toMatchObject({
      key: "SUN-1", sourceUrl: "https://example.atlassian.net/browse/SUN-1",
      sourceUpdatedAt: "2026-10-12T10:00:00.000Z",
    });
    expect(issue.rawFields.customfield_10900).toBe("not-json");
  });
});
