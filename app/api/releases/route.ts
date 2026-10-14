import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../src/auth/session";
import { createRelease, parseCreateReleaseRequest } from "../../../src/application/create-release";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const assessment = await createRelease(parseCreateReleaseRequest(await request.json()), user.id);
  return NextResponse.json(assessment, { status: 201 });
}
