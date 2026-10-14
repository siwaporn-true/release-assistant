import { requireUser } from "../../../../../src/auth/session";
import { rerunFailedJobs } from "../../../../../src/application/rerun-workflow";
export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }) { try { const user = await requireUser(); const { releaseId } = await context.params; const body = await request.json(); return Response.json(await rerunFailedJobs({ ...body, releaseId, actorId: user.id })); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to re-run workflow" }, { status: 400 }); } }
