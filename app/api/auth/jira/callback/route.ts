import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { encryptSecret } from "../../../../../src/auth/crypto";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!state || !code) return NextResponse.json({ error: "Invalid OAuth callback" }, { status: 400 });
  const { db } = await import("../../../../../src/db/client");
  const { oauthStates, providerConnections } = await import("../../../../../src/db/schema");
  const [record] = await db.select().from(oauthStates).where(and(
    eq(oauthStates.state, state),
    isNull(oauthStates.consumedAt),
    gt(oauthStates.expiresAt, new Date()),
  )).limit(1);
  if (!record) return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  await db.update(oauthStates).set({ consumedAt: new Date() }).where(eq(oauthStates.state, state));
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: process.env.JIRA_REDIRECT_URI,
    }),
  });
  if (!response.ok) return NextResponse.json({ error: "Jira connection failed" }, { status: 502 });
  const token = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const key = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!key) return NextResponse.json({ error: "Encryption is not configured" }, { status: 503 });
  await db.insert(providerConnections).values({
    id: crypto.randomUUID(),
    userId: record.userId,
    provider: "jira",
    encryptedAccessToken: encryptSecret(token.access_token, key),
    refreshToken: token.refresh_token ? encryptSecret(token.refresh_token, key) : null,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
  });
  return NextResponse.redirect(new URL("/setup", request.url));
}
