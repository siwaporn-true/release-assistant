import { randomUUID } from "node:crypto";
import { pullRequestSelections } from "../db/schema";

export interface ManualPrSelection { releaseId: string; jiraIssueKey: string; pullRequestNumber: number; actorId: string }

export async function savePullRequestSelection(input: ManualPrSelection): Promise<void> {
  const { db } = await import("../db/client");
  await db.insert(pullRequestSelections).values({ id: randomUUID(), releaseId: input.releaseId, jiraIssueKey: input.jiraIssueKey, pullRequestNumber: input.pullRequestNumber, selectedBy: input.actorId });
}
