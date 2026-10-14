import { getJiraAccess } from "./oauth";
import { normalizeJiraIssue, type NormalizedJiraIssue } from "./normalize";

export interface JiraProject { id: string; key: string; name: string }
export interface JiraFixVersion { id: string; name: string; released: boolean }
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class JiraRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Jira rate limit exceeded; retry after ${retryAfterSeconds} seconds`);
    this.name = "JiraRateLimitError";
  }
}

export class JiraClient {
  private readonly apiBase: string;
  constructor(
    private readonly accessToken: string,
    private readonly cloudId: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly siteUrl = "https://trueomx.atlassian.net",
  ) {
    this.apiBase = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3`;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetcher(`${this.apiBase}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.accessToken}`, accept: "application/json", "content-type": "application/json", ...init?.headers },
    });
    if (response.status === 429) throw new JiraRateLimitError(Number(response.headers.get("retry-after") ?? 60));
    if (!response.ok) throw new Error(`Jira request failed with ${response.status}`);
    return response.json();
  }

  async listProjects(): Promise<JiraProject[]> {
    const data = await this.request("/project/search") as { values?: Array<{ id: string; key: string; name: string }> };
    return data.values ?? [];
  }

  async listFixVersions(projectKey: string): Promise<JiraFixVersion[]> {
    const data = await this.request(`/project/${encodeURIComponent(projectKey)}/versions`) as Array<{ id: string; name: string; released?: boolean }>;
    return data.map((item) => ({ id: item.id, name: item.name, released: Boolean(item.released) }));
  }

  async loadFixVersionIssues(projectKey: string, fixVersionId: string): Promise<NormalizedJiraIssue[]> {
    const issues: NormalizedJiraIssue[] = [];
    let nextPageToken: string | undefined;
    do {
      const data = await this.request("/search/jql", {
        method: "POST",
        body: JSON.stringify({
          jql: `project = "${projectKey.replaceAll('"', '\\"')}" AND fixVersion = ${fixVersionId}`,
          fields: ["summary", "issuetype", "status", "assignee", "updated", "parent", "labels"],
          maxResults: 100,
          ...(nextPageToken ? { nextPageToken } : {}),
        }),
      }) as { issues?: Array<Parameters<typeof normalizeJiraIssue>[0]>; nextPageToken?: string; isLast?: boolean };
      issues.push(...(data.issues ?? []).map((issue) => normalizeJiraIssue(issue, this.siteUrl)));
      nextPageToken = data.isLast ? undefined : data.nextPageToken;
    } while (nextPageToken);
    return issues;
  }
}

async function clientFor(userId: string): Promise<JiraClient> {
  const access = await getJiraAccess(userId);
  if (!access.cloudId) throw new Error("Jira cloud is not configured");
  return new JiraClient(access.accessToken, access.cloudId);
}

export async function listProjects(userId: string) { return (await clientFor(userId)).listProjects(); }
export async function listFixVersions(userId: string, projectKey: string) { return (await clientFor(userId)).listFixVersions(projectKey); }
export async function loadFixVersionIssues(input: { userId: string; projectKey: string; fixVersionId: string }) {
  return (await clientFor(input.userId)).loadFixVersionIssues(input.projectKey, input.fixVersionId);
}
