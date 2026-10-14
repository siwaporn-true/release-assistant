import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "../../../../../src/auth/session";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const installationId = request.nextUrl.searchParams.get("installation_id");
  const accountLogin = request.nextUrl.searchParams.get("account_login") ?? "github-installation";
  if (!installationId || !/^\d+$/.test(installationId)) {
    return NextResponse.json({ error: "Invalid GitHub installation" }, { status: 400 });
  }
  const { db } = await import("../../../../../src/db/client");
  const { providerConnections } = await import("../../../../../src/db/schema");
  await db.insert(providerConnections).values({
    id: crypto.randomUUID(),
    userId: user.id,
    provider: "github",
    installationId,
    accountLogin,
  });
  return NextResponse.redirect(new URL("/setup", request.url));
}
