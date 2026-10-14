import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSessionToken } from "../../../../../src/auth/session";
import { buildJiraAuthorizationUrl } from "../../../../../src/connectors/jira/oauth";

export async function GET() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  const userId = randomUUID();
  const state = randomUUID();
  const { db } = await import("../../../../../src/db/client");
  const { oauthStates } = await import("../../../../../src/db/schema");
  await db.insert(oauthStates).values({
    state,
    userId,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  (await cookies()).set("release_session", createSessionToken(userId, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return NextResponse.redirect(buildJiraAuthorizationUrl(state));
}
