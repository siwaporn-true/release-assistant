export type EvidenceFreshness = "fresh" | "stale";

export interface GitHubReleaseInput {
  userId: string;
  owner: string;
  repo: string;
  releaseBranch: string;
}

export interface PullRequestEvidence {
  number: number; title: string; sourceUrl: string; sourceBranch: string;
  targetBranch: string; headSha: string; mergeCommitSha: string | null;
  merged: boolean; mergeable: boolean | null;
  review: "approved" | "changes_requested" | "pending" | "unknown";
  checks: "passed" | "failed" | "pending" | "unknown";
  observedAt: string; sourceUpdatedAt: string; freshness: EvidenceFreshness;
}

export interface CommitEvidence {
  sha: string; sourceUrl: string; observedAt: string; sourceUpdatedAt: string;
  freshness: EvidenceFreshness;
}

export interface WorkflowEvidence {
  runId: number; buildNumber: number; sha: string; sourceUrl: string;
  result: "passed" | "failed" | "checking" | "unknown";
  observedAt: string; sourceUpdatedAt: string; freshness: EvidenceFreshness;
}
