import type { EvidenceFreshness, PullRequestEvidence, WorkflowEvidence } from "./contracts";

function timestamp(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.valueOf())) throw new Error("Malformed GitHub timestamp");
  return date.toISOString();
}

function freshness(sourceUpdatedAt: string, observedAt: Date): EvidenceFreshness {
  return observedAt.valueOf() - new Date(sourceUpdatedAt).valueOf() > 24 * 60 * 60 * 1000 ? "stale" : "fresh";
}

export function normalizePullRequest(raw: Record<string, any>, observedAt: Date): PullRequestEvidence {
  if (raw.errors?.length) throw new Error("Partial GitHub evidence");
  const sourceUpdatedAt = timestamp(raw.updated_at);
  return {
    number: Number(raw.number), title: String(raw.title ?? ""), sourceUrl: String(raw.html_url ?? ""),
    sourceBranch: String(raw.head?.ref ?? ""), targetBranch: String(raw.base?.ref ?? ""),
    headSha: String(raw.head?.sha ?? ""), mergeCommitSha: raw.merge_commit_sha ? String(raw.merge_commit_sha) : null,
    merged: Boolean(raw.merged_at), mergeable: typeof raw.mergeable === "boolean" ? raw.mergeable : null,
    review: raw.reviewDecision === "APPROVED" ? "approved" : raw.reviewDecision === "CHANGES_REQUESTED" ? "changes_requested" : raw.reviewDecision ? "pending" : "unknown",
    checks: raw.checksConclusion === "success" ? "passed" : raw.checksConclusion === "failure" ? "failed" : raw.checksConclusion ? "pending" : "unknown",
    observedAt: observedAt.toISOString(), sourceUpdatedAt, freshness: freshness(sourceUpdatedAt, observedAt),
  };
}

export function normalizeWorkflow(raw: Record<string, any>, observedAt: Date): WorkflowEvidence {
  const sourceUpdatedAt = timestamp(raw.updated_at);
  const result = raw.status !== "completed" ? "checking" : raw.conclusion === "success" ? "passed" : raw.conclusion ? "failed" : "unknown";
  return {
    runId: Number(raw.id), buildNumber: Number(raw.run_number), sha: String(raw.head_sha),
    sourceUrl: String(raw.html_url), result,
    observedAt: observedAt.toISOString(), sourceUpdatedAt, freshness: freshness(sourceUpdatedAt, observedAt),
  };
}
