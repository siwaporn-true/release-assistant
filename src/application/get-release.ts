import { PostgresReleaseRepository, type StoredRelease } from "../db/release-repository";

export type ReleaseWorkspaceView = ReturnType<typeof toPublicReleaseWorkspace>;
export function toPublicReleaseWorkspace(record: any) {
  return {
    id: record.id ?? record.config?.id,
    revision: record.revision,
    lastRefreshedAt: record.lastRefreshedAt,
    config: record.config,
    assessment: record.assessment,
    actions: record.actions,
    evidence: {
      jiraIssues: record.evidence?.jiraIssues,
      pullRequests: record.evidence?.pullRequests,
      branchHead: record.evidence?.branchHead,
      workflow: record.evidence?.workflow,
    },
    connectorErrors: record.connectorErrors,
  };
}
export async function getRelease(releaseId: string, actorId: string): Promise<ReleaseWorkspaceView> {
  const record = await new PostgresReleaseRepository().get(releaseId);
  if (!record) throw new Error("Release not found");
  if (record.config.ownerId !== actorId) throw new Error("Release access denied");
  return toPublicReleaseWorkspace(record as StoredRelease);
}
