import { NextResponse } from "next/server";
import { requireUser } from "../../../../src/auth/session";
import { listProjects } from "../../../../src/connectors/jira/client";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ projects: await listProjects(user.id) });
}
