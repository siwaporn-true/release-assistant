import { NextResponse } from "next/server";
import { requireUser } from "../../../../../src/auth/session";
import { refreshRelease } from "../../../../../src/application/refresh-release";

export async function POST(_request: Request, context: { params: Promise<{ releaseId: string }> }) {
  const user = await requireUser();
  const { releaseId } = await context.params;
  return NextResponse.json(await refreshRelease(releaseId, user.id));
}
