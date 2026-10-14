import { and, eq, isNull } from "drizzle-orm";

import { decryptSecret } from "../../auth/crypto";
import { providerConnections } from "../../db/schema";

export interface JiraAccess { accessToken: string; cloudId?: string }
export interface OAuthStateRecord { userId: string; consumed: boolean }

export async function consumeOAuthState(
  state: string,
  store: Map<string, OAuthStateRecord>,
): Promise<{ userId: string }> {
  const record = store.get(state);
  if (!record || record.consumed) throw new Error("Invalid OAuth state");
  record.consumed = true;
  return { userId: record.userId };
}

export function buildJiraAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: process.env.JIRA_CLIENT_ID ?? "",
    scope: "read:jira-work offline_access",
    redirect_uri: process.env.JIRA_REDIRECT_URI ?? "",
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `https://auth.atlassian.com/authorize?${params}`;
}

export async function getJiraAccess(userId: string): Promise<JiraAccess> {
  const [{ db }] = await Promise.all([import("../../db/client")]);
  const [connection] = await db.select().from(providerConnections).where(
    and(
      eq(providerConnections.userId, userId),
      eq(providerConnections.provider, "jira"),
      isNull(providerConnections.installationId),
    ),
  ).limit(1);
  if (!connection?.encryptedAccessToken) throw new Error("Jira is not connected");
  const key = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!key) throw new Error("CONNECTION_ENCRYPTION_KEY is required");
  return {
    accessToken: decryptSecret(connection.encryptedAccessToken, key),
    cloudId: connection.accountLogin ?? undefined,
  };
}
