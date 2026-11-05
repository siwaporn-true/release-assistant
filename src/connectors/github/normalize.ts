import type { EvidenceFreshness, PullRequestEvidence, WorkflowEvidence } from "./contracts";

function timestamp(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.valueOf())) throw new Error("Malformed GitHub timestamp");
  return date.toISOString();
}

function freshness(sourceUpdatedAt: string, observedAt: Date): EvidenceFreshness {
  return observedAt.valueOf() - new Date(sourceUpdatedAt).valueOf() > 24 * 60 * 60 * 1000 ? "stale" : "fresh";
}

interface PullRequestPayload extends Record<string, unknown> {
  errors?: unknown[];
  head?: { ref?: unknown; sha?: unknown };
  base?: { ref?: unknown };
}

export function normalizeChecks(input: {
  checkRuns: Array<{ status?: unknown; conclusion?: unknown }>;
  statuses: Array<{ state?: unknown }>;
}): PullRequestEvidence["checks"] {
  const failedConclusions = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"]);
  const passedConclusions = new Set(["success", "neutral", "skipped"]);
  const conclusions = input.checkRuns.map((run) => run.conclusion == null ? null : String(run.conclusion));
  const states = input.statuses.map((status) => String(status.state ?? ""));

  if (conclusions.some((value) => value !== null && failedConclusions.has(value)) || states.some((value) => value === "failure" || value === "error")) return "failed";
  if (input.checkRuns.some((run) => String(run.status ?? "") !== "completed") || states.some((value) => value === "pending")) return "pending";
  if (!conclusions.length && !states.length) return "unknown";
  if (conclusions.some((value) => value === null || !passedConclusions.has(value)) || states.some((value) => value !== "success")) return "unknown";
  return "passed";
}

export function normalizePullRequest(raw: PullRequestPayload, observedAt: Date): PullRequestEvidence {
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

export function normalizeWorkflow(raw: Record<string, unknown>, observedAt: Date): WorkflowEvidence {
  const sourceUpdatedAt = timestamp(raw.updated_at);
  const result = raw.status !== "completed" ? "checking" : raw.conclusion === "success" ? "passed" : raw.conclusion ? "failed" : "unknown";
  return {
    runId: Number(raw.id), buildNumber: Number(raw.run_number), sha: String(raw.head_sha),
    sourceUrl: String(raw.html_url), result,
    observedAt: observedAt.toISOString(), sourceUpdatedAt, freshness: freshness(sourceUpdatedAt, observedAt),
  };
}
