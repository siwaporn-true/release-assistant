import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../src/auth/session";
import { listFixVersions } from "../../../../src/connectors/jira/client";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const projectKey = request.nextUrl.searchParams.get("projectKey");
  if (!projectKey) return NextResponse.json({ error: "projectKey is required" }, { status: 400 });
  return NextResponse.json({ fixVersions: await listFixVersions(user.id, projectKey) });
}
