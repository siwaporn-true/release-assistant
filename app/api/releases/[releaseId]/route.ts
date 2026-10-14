import { NextResponse } from "next/server";
import { requireUser } from "../../../../src/auth/session";
import { getRelease } from "../../../../src/application/get-release";

export async function GET(_request: Request, context: { params: Promise<{ releaseId: string }> }) {
  const user = await requireUser();
  const { releaseId } = await context.params;
  return NextResponse.json(await getRelease(releaseId, user.id));
}
