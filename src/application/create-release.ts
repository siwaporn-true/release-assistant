import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PostgresReleaseRepository, type ReleaseConfiguration, type ReleaseRepository } from "../db/release-repository";
import { refreshRelease } from "./refresh-release";

const schema = z.object({
  jiraProjectKey: z.string().min(1), jiraFixVersionId: z.string().min(1), releaseBranch: z.string().min(1),
  githubOwner: z.string().min(1), githubRepo: z.string().min(1), workflowId: z.string().min(1),
});
export type CreateReleaseInput = z.infer<typeof schema>;
export function parseCreateReleaseRequest(value: unknown): CreateReleaseInput { return schema.parse(value); }

export async function createRelease(input: CreateReleaseInput, actorId: string, repository: ReleaseRepository = new PostgresReleaseRepository()) {
  const config: ReleaseConfiguration = { id: randomUUID(), ownerId: actorId, ...schema.parse(input) };
  await repository.create(config);
  if (repository instanceof PostgresReleaseRepository) return refreshRelease(config.id, actorId);
  return repository.get(config.id);
}
