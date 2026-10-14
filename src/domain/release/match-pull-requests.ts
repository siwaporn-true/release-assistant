import type { TicketClassification } from "./classify-ticket";

interface MatchIssue { key: string; classification: TicketClassification }
export interface MatchCandidate { number: number; title: string; sourceBranch: string; sourceUrl: string; linkedIssueKeys?: string[]; commitMessages?: string[] }
export type PullRequestMatchResult =
  | { status: "matched"; confidence: "high" | "medium" | "low"; pullRequestNumber: number; evidence: string }
  | { status: "ambiguous"; candidates: number[] }
  | { status: "missing" }
  | { status: "not_required" };

export function matchPullRequests(issue: MatchIssue, pullRequests: MatchCandidate[]): PullRequestMatchResult {
  if (issue.classification.kind === "reference_only") return { status: "not_required" };
  const escaped = issue.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const key = new RegExp(`(^|[^A-Z0-9])${escaped}([^0-9]|$)`, "i");
  const tiers = [
    { confidence: "high" as const, evidence: "title_or_branch", matches: pullRequests.filter((pr) => key.test(pr.title) || key.test(pr.sourceBranch)) },
    { confidence: "medium" as const, evidence: "jira_development_link", matches: pullRequests.filter((pr) => pr.linkedIssueKeys?.includes(issue.key)) },
    { confidence: "low" as const, evidence: "commit_message", matches: pullRequests.filter((pr) => pr.commitMessages?.some((message) => key.test(message))) },
  ];
  const tier = tiers.find((item) => item.matches.length > 0);
  if (!tier) return { status: "missing" };
  if (tier.matches.length > 1) return { status: "ambiguous", candidates: tier.matches.map((pr) => pr.number) };
  return { status: "matched", confidence: tier.confidence, pullRequestNumber: tier.matches[0]!.number, evidence: tier.evidence };
}
