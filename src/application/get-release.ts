import { PostgresReleaseRepository, type StoredRelease } from "../db/release-repository";

export interface ReleaseWorkspaceView {
  id: string;
  revision: number;
  lastRefreshedAt: string | null;
  config: Omit<StoredRelease["config"], "ownerId" | "id">;
  assessment: StoredRelease["assessment"];
  actions: StoredRelease["actions"];
  evidence: StoredRelease["evidence"];
  connectorErrors: Record<string, string>;
}
export function toPublicReleaseWorkspace(record: unknown): ReleaseWorkspaceView {
  const source = record as Partial<StoredRelease> & { id?: string; ownerId?: string; config?: Partial<StoredRelease["config"]> };
  const config: Partial<StoredRelease["config"]> = source.config ?? {};
  const evidence = source.evidence ?? {};
  return {
    id: source.config?.id ?? source.id ?? "",
    revision: source.revision ?? 0,
    lastRefreshedAt: source.lastRefreshedAt ?? null,
    config: {
      jiraProjectKey: config.jiraProjectKey ?? "",
      jiraFixVersionId: config.jiraFixVersionId ?? "",
      releaseBranch: config.releaseBranch ?? "",
      githubOwner: config.githubOwner ?? "",
      githubRepo: config.githubRepo ?? "",
      workflowId: config.workflowId ?? "",
    },
    assessment: source.assessment ?? null,
    actions: source.actions ?? [],
    evidence: {
      jiraIssues: evidence.jiraIssues,
      pullRequests: evidence.pullRequests,
      branchHead: evidence.branchHead,
      workflow: evidence.workflow,
    },
    connectorErrors: source.connectorErrors ?? {},
  };
}
export async function getRelease(releaseId: string, actorId: string): Promise<ReleaseWorkspaceView> {
  const record = await new PostgresReleaseRepository().get(releaseId);
  if (!record) throw new Error("Release not found");
  if (record.config.ownerId !== actorId) throw new Error("Release access denied");
  return toPublicReleaseWorkspace(record);
}
