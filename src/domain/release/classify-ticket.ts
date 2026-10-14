import type { NormalizedJiraIssue } from "../../connectors/jira/normalize";

export interface TicketPolicy {
  referenceIssueTypes: string[];
  codeIssueTypes: string[];
}

export interface TicketClassification {
  kind: "code_bearing" | "reference_only" | "needs_confirmation";
  blocked: boolean;
  reason?: "missing_assignee" | "unknown_issue_type";
}

export function classifyTicket(
  issue: NormalizedJiraIssue,
  policy: TicketPolicy,
): TicketClassification {
  if (!issue.assigneeId) return { kind: "needs_confirmation", blocked: issue.blocked, reason: "missing_assignee" };
  if (policy.referenceIssueTypes.includes(issue.issueType)) return { kind: "reference_only", blocked: issue.blocked };
  if (policy.codeIssueTypes.includes(issue.issueType)) return { kind: "code_bearing", blocked: issue.blocked };
  return { kind: "needs_confirmation", blocked: issue.blocked, reason: "unknown_issue_type" };
}
