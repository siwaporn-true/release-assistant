import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export interface AuthenticatedUser { id: string }

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ userId }), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string, secret: string): AuthenticatedUser {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Invalid session");
  const expected = sign(payload, secret);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid session");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string };
  if (!decoded.userId) throw new Error("Invalid session");
  return { id: decoded.userId };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const token = (await cookies()).get("release_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) throw new Error("Authentication required");
  return verifySessionToken(token, secret);
}
