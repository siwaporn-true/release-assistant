import { z } from "zod";
import type { ReleaseAssessment } from "../domain/release/evaluate-release";
import type { AuditRepository } from "../db/audit-repository";
import { PostgresAuditRepository } from "../db/audit-repository";

const schema = z.object({ releaseId: z.string().min(1), expectedRevision: z.number().int().positive(), actorId: z.string().min(1), ruleId: z.string().min(1), reason: z.string().trim().min(1, "Exception reason is required"), approverId: z.string().trim().min(1), supportingUrl: z.string().url().optional() });
export type ExceptionInput = z.infer<typeof schema>;
export async function createExceptionWithDependencies(input: ExceptionInput, deps: { repository: AuditRepository; now?: () => Date }): Promise<ReleaseAssessment> {
  const value = schema.parse(input); const now = (deps.now ?? (() => new Date()))().toISOString(); const release = await deps.repository.getRelease(value.releaseId);
  if (!release || release.ownerId !== value.actorId) throw new Error("Release access denied"); if (release.revision !== value.expectedRevision) throw new Error("Release changed; refresh and confirm again"); if (!release.assessment.findings.some((finding) => finding.ruleId === value.ruleId)) throw new Error("Exception rule is not an active finding");
  await deps.repository.saveException({ id: crypto.randomUUID(), releaseId: value.releaseId, ruleId: value.ruleId, reason: value.reason, approverId: value.approverId, supportingUrl: value.supportingUrl, createdAt: now }); await deps.repository.markChecking(value.releaseId); await deps.repository.saveAudit({ id: crypto.randomUUID(), releaseId: value.releaseId, actorId: value.actorId, action: "create_exception", outcome: "succeeded", createdAt: now, details: { ruleId: value.ruleId, approverId: value.approverId } });
  return { ...release.assessment, status: "checking", readyForQa: false } as ReleaseAssessment;
}
export async function createException(input: ExceptionInput) { return createExceptionWithDependencies(input, { repository: new PostgresAuditRepository() }); }
