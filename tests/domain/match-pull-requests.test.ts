import { describe, expect, it } from "vitest";
import { matchPullRequests } from "../../src/domain/release/match-pull-requests";

const issue = { key: "SUN-101", classification: { kind: "code_bearing" as const, blocked: false } };
const pr = (number: number, title: string, branch = "feature") => ({ number, title, sourceBranch: branch, sourceUrl: `https://github/pull/${number}`, commitMessages: [] as string[], linkedIssueKeys: [] as string[] });

describe("pull request matching", () => {
  it("prefers a ticket key in title or branch", () => {
    expect(matchPullRequests(issue, [pr(1, "SUN-101 change")])).toMatchObject({ status: "matched", confidence: "high", pullRequestNumber: 1 });
  });
  it("uses Jira development links before commit messages", () => {
    const linked = { ...pr(2, "Change"), linkedIssueKeys: ["SUN-101"] };
    expect(matchPullRequests(issue, [linked])).toMatchObject({ status: "matched", confidence: "medium" });
    expect(matchPullRequests(issue, [{ ...pr(3, "Change"), commitMessages: ["fix SUN-101"] }])).toMatchObject({ confidence: "low" });
  });
  it("requires selection when equally plausible pull requests exist", () => {
    expect(matchPullRequests(issue, [pr(1, "SUN-101 A"), pr(2, "SUN-101 B")]).status).toBe("ambiguous");
  });
  it("distinguishes reference-only and missing code", () => {
    expect(matchPullRequests({ ...issue, classification: { kind: "reference_only", blocked: false } }, []).status).toBe("not_required");
    expect(matchPullRequests(issue, []).status).toBe("missing");
  });
});
