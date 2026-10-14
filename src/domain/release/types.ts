import { z } from "zod";

export const assessmentStatusSchema = z.enum([
  "passed",
  "needs_confirmation",
  "blocked",
  "checking",
  "cannot_verify",
]);

export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const releaseInputSchema = z.object({
  jiraProjectKey: z.string().trim().min(1),
  jiraFixVersionId: z.string().trim().min(1),
  releaseBranch: z.string().trim().min(1),
});

export const releaseSchema = releaseInputSchema.extend({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  status: assessmentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Release = z.infer<typeof releaseSchema>;

export const releaseIssueSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  jiraIssueId: z.string().min(1),
  jiraKey: z.string().min(1),
  classification: z.enum(["code_bearing", "reference_only", "needs_confirmation"]),
  sourceUpdatedAt: z.string().datetime(),
  normalizedData: z.record(z.string(), z.unknown()),
});

export type ReleaseIssue = z.infer<typeof releaseIssueSchema>;

export const evidenceSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  provider: z.enum(["jira", "github", "github_actions"]),
  providerId: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceUpdatedAt: z.string().datetime(),
  observedAt: z.string().datetime(),
  normalizedData: z.record(z.string(), z.unknown()),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const exceptionRecordSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  ruleId: z.string().min(1),
  reason: z.string().trim().min(1),
  approverId: z.string().min(1),
  createdAt: z.string().datetime(),
  supportingUrl: z.string().url().optional(),
});

export type ExceptionRecord = z.infer<typeof exceptionRecordSchema>;

export const auditEventSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  actorId: z.string().min(1),
  action: z.string().min(1),
  outcome: z.enum(["succeeded", "failed"]),
  createdAt: z.string().datetime(),
  details: z.record(z.string(), z.unknown()),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const releaseSnapshotInputSchema = z.object({
  releaseId: z.string().min(1),
  commitSha: z.string().trim().min(7),
  actorId: z.string().min(1),
  handedOffAt: z.string().datetime(),
});

export const releaseSnapshotSchema = releaseSnapshotInputSchema.extend({
  id: z.string().min(1),
  revision: z.number().int().positive(),
  snapshotData: z.record(z.string(), z.unknown()),
  handoffText: z.string().min(1),
});

export type ReleaseSnapshot = z.infer<typeof releaseSnapshotSchema>;
