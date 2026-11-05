import { createSign } from "node:crypto";

import { getGitHubInstallation } from "./app-auth";
import type { CommitEvidence, GitHubReleaseInput, PullRequestEvidence, WorkflowEvidence } from "./contracts";
import { normalizeChecks, normalizePullRequest, normalizeWorkflow } from "./normalize";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class GitHubConnectorError extends Error {
  constructor(readonly kind: "unavailable" | "rate_limited" | "partial", message: string) {
    super(message); this.name = "GitHubConnectorError";
  }
}

export class GitHubClient {
  constructor(private readonly token: string, private readonly fetcher: Fetcher = fetch) {}

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetcher(url, { ...init, headers: { authorization: `Bearer ${this.token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...init.headers } });
    if (response.status === 429 || response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") throw new GitHubConnectorError("rate_limited", "GitHub rate limit exceeded");
    if (response.status >= 500) throw new GitHubConnectorError("unavailable", `GitHub unavailable (${response.status})`);
    if (!response.ok) throw new GitHubConnectorError("partial", `GitHub request failed (${response.status})`);
    return response;
  }

  async listPullRequests(owner: string, repo: string): Promise<PullRequestEvidence[]> {
    const result: PullRequestEvidence[] = [];
    let url: string | undefined = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`;
    while (url) {
      const response = await this.request(url);
      const observedAt = new Date();
      const raw = await response.json() as Array<Record<string, unknown>>;
      const pullRequests = raw.map((item) => normalizePullRequest(item, observedAt));
      for (let offset = 0; offset < pullRequests.length; offset += 10) {
        const batch = pullRequests.slice(offset, offset + 10);
        result.push(...await Promise.all(batch.map(async (pullRequest) => ({
          ...pullRequest,
          checks: await this.getCommitChecks(owner, repo, pullRequest.headSha),
        }))));
      }
      const match = response.headers.get("link")?.match(/<([^>]+)>; rel="next"/);
      url = match?.[1];
    }
    return result;
  }

  private async getCommitChecks(owner: string, repo: string, sha: string): Promise<PullRequestEvidence["checks"]> {
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`;
    const [checkRuns, statuses] = await Promise.all([
      this.getPaginatedItems<{ status?: unknown; conclusion?: unknown }>(`${commitUrl}/check-runs`, "check_runs"),
      this.getPaginatedItems<{ state?: unknown }>(`${commitUrl}/status`, "statuses"),
    ]);
    return normalizeChecks({ checkRuns, statuses });
  }

  private async getPaginatedItems<T>(initialUrl: string, key: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | undefined = initialUrl;
    while (url) {
      const response = await this.request(url);
      const raw = await response.json() as Record<string, unknown>;
      const page = raw[key];
      if (Array.isArray(page)) items.push(...page as T[]);
      const match = response.headers.get("link")?.match(/<([^>]+)>; rel="next"/);
      url = match?.[1];
    }
    return items;
  }

  async getBranchHead(owner: string, repo: string, branch: string): Promise<CommitEvidence> {
    const response = await this.request(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`);
    const raw = await response.json() as { sha: string; html_url: string; commit: { committer: { date: string } } };
    const observedAt = new Date();
    const sourceUpdatedAt = new Date(raw.commit.committer.date).toISOString();
    return { sha: raw.sha, sourceUrl: raw.html_url, observedAt: observedAt.toISOString(), sourceUpdatedAt, freshness: observedAt.valueOf() - new Date(sourceUpdatedAt).valueOf() > 86_400_000 ? "stale" : "fresh" };
  }

  async getWorkflow(owner: string, repo: string, workflowId: string, branch: string): Promise<WorkflowEvidence> {
    const response = await this.request(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?branch=${encodeURIComponent(branch)}&per_page=1`);
    const raw = await response.json() as { workflow_runs?: Array<Record<string, unknown>> };
    if (!raw.workflow_runs?.[0]) throw new GitHubConnectorError("partial", "No workflow evidence found");
    return normalizeWorkflow(raw.workflow_runs[0], new Date());
  }

  async rerunFailedJobs(owner: string, repo: string, runId: number): Promise<void> {
    await this.request(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`, { method: "POST" });
  }
}

function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replaceAll("\\n", "\n");
  if (!appId || !privateKey) throw new Error("GitHub App is not configured");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  return `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url")}`;
}

async function clientFor(userId: string): Promise<GitHubClient> {
  const installation = await getGitHubInstallation(userId);
  const response = await fetch(`https://api.github.com/app/installations/${installation.installationId}/access_tokens`, { method: "POST", headers: { authorization: `Bearer ${appJwt()}`, accept: "application/vnd.github+json" } });
  if (!response.ok) throw new GitHubConnectorError("unavailable", "Unable to create GitHub installation token");
  const { token } = await response.json() as { token: string };
  return new GitHubClient(token);
}

export async function listPullRequestEvidence(input: GitHubReleaseInput) { return (await clientFor(input.userId)).listPullRequests(input.owner, input.repo); }
export async function getReleaseBranchHead(input: GitHubReleaseInput) { return (await clientFor(input.userId)).getBranchHead(input.owner, input.repo, input.releaseBranch); }
export async function getWorkflowEvidence(input: GitHubReleaseInput & { sha: string; workflowId: string }) {
  return (await clientFor(input.userId)).getWorkflow(input.owner, input.repo, input.workflowId, input.releaseBranch);
}
export async function rerunFailedWorkflowJobs(input: { actorId: string; owner: string; repo: string; runId: number }) { return (await clientFor(input.actorId)).rerunFailedJobs(input.owner, input.repo, input.runId); }
