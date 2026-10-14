export interface NormalizedJiraIssue {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  status: string;
  blocked: boolean;
  assigneeId: string | null;
  sourceUrl: string;
  sourceUpdatedAt: string;
  rawFields: Record<string, unknown>;
}

interface JiraIssuePayload {
  id?: unknown;
  key?: unknown;
  fields?: Record<string, unknown>;
}

export function normalizeJiraIssue(payload: JiraIssuePayload, siteUrl: string): NormalizedJiraIssue {
  const fields = payload.fields ?? {};
  const key = String(payload.key ?? "");
  const issueType = fields.issuetype as { name?: unknown } | undefined;
  const status = fields.status as { name?: unknown } | undefined;
  const assignee = fields.assignee as { accountId?: unknown } | null | undefined;
  const updated = new Date(String(fields.updated ?? ""));
  if (!payload.id || !key || Number.isNaN(updated.valueOf())) throw new Error("Malformed Jira issue");
  const statusName = String(status?.name ?? "Unknown");
  return {
    id: String(payload.id),
    key,
    summary: String(fields.summary ?? "Untitled issue"),
    issueType: String(issueType?.name ?? "Unknown"),
    status: statusName,
    blocked: statusName.toUpperCase() === "BLOCKED",
    assigneeId: assignee?.accountId ? String(assignee.accountId) : null,
    sourceUrl: `${siteUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(key)}`,
    sourceUpdatedAt: updated.toISOString(),
    rawFields: fields,
  };
}
