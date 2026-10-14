import { and, eq } from "drizzle-orm";

import { providerConnections } from "../../db/schema";

export interface GitHubInstallation {
  userId: string;
  installationId: number;
  accountLogin: string;
}

export function authorizeGitHubInstallation(
  userId: string,
  installation: GitHubInstallation,
): GitHubInstallation {
  if (installation.userId !== userId) throw new Error("GitHub installation is not owned by this user");
  return installation;
}

export async function getGitHubInstallation(userId: string): Promise<GitHubInstallation> {
  const { db } = await import("../../db/client");
  const [connection] = await db.select().from(providerConnections).where(
    and(eq(providerConnections.userId, userId), eq(providerConnections.provider, "github")),
  ).limit(1);
  if (!connection?.installationId || !connection.accountLogin) throw new Error("GitHub is not connected");
  return authorizeGitHubInstallation(userId, {
    userId,
    installationId: Number(connection.installationId),
    accountLogin: connection.accountLogin,
  });
}
