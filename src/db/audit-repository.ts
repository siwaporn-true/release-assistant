import { eq } from "drizzle-orm";
import type { AuditEvent, ExceptionRecord, ReleaseSnapshot } from "../domain/release/types";
import { auditEvents, exceptions, releaseSnapshots, releases } from "./schema";

export interface ActionRelease {
  id: string; ownerId: string; revision: number; status: "passed" | "needs_confirmation" | "blocked" | "checking" | "cannot_verify";
  assessment: { status: string; readyForQa: boolean; findings: Array<{ ruleId: string; status: string; subject?: string }>; gates: unknown; appliedExceptions: unknown[] };
  config: { jiraProjectKey: string; jiraFixVersionId: string; releaseBranch: string; githubOwner: string; githubRepo: string; workflowId: string };
  evidence: { jiraIssues?: Array<{ key: string }>; pullRequests?: Array<{ number: number }>; branchHead?: { sha: string }; workflow?: { runId: number; result: string; sha: string } };
}
export interface AuditRepository { getRelease(id: string): Promise<ActionRelease | null>; saveException(value: ExceptionRecord): Promise<void>; saveAudit(value: AuditEvent): Promise<void>; saveSnapshot(value: ReleaseSnapshot): Promise<void>; markChecking(id: string): Promise<void> }

export class MemoryAuditRepository implements AuditRepository {
  readonly events: AuditEvent[] = []; readonly exceptions: ExceptionRecord[] = []; readonly snapshots: ReleaseSnapshot[] = []; private readonly records = new Map<string, ActionRelease>();
  constructor(records: ActionRelease[] = []) { records.forEach((record) => this.records.set(record.id, structuredClone(record))); }
  async getRelease(id: string) { return structuredClone(this.records.get(id) ?? null); }
  async saveException(value: ExceptionRecord) { this.exceptions.push(structuredClone(value)); }
  async saveAudit(value: AuditEvent) { this.events.push(structuredClone(value)); }
  async saveSnapshot(value: ReleaseSnapshot) { this.snapshots.push(structuredClone(value)); }
  async markChecking(id: string) { const record = this.records.get(id); if (record) { record.status = "checking"; record.revision += 1; record.assessment.status = "checking"; record.assessment.readyForQa = false; } }
}

export class PostgresAuditRepository implements AuditRepository {
  async getRelease(id: string): Promise<ActionRelease | null> { const { db } = await import("./client"); const [row] = await db.select().from(releases).where(eq(releases.id, id)).limit(1); if (!row || !row.assessmentData) return null; const { PostgresReleaseRepository } = await import("./release-repository"); const stored = await new PostgresReleaseRepository().get(id); if (!stored?.assessment) return null; return { id: row.id, ownerId: row.ownerId, revision: row.revision, status: row.status, assessment: stored.assessment, config: stored.config, evidence: stored.evidence }; }
  async saveException(value: ExceptionRecord) { const { db } = await import("./client"); await db.insert(exceptions).values({ ...value, createdAt: new Date(value.createdAt) }); }
  async saveAudit(value: AuditEvent) { const { db } = await import("./client"); await db.insert(auditEvents).values({ ...value, createdAt: new Date(value.createdAt) }); }
  async saveSnapshot(value: ReleaseSnapshot) { const { db } = await import("./client"); await db.insert(releaseSnapshots).values({ ...value, handedOffAt: new Date(value.handedOffAt) }); }
  async markChecking(id: string) { const { db } = await import("./client"); const [row] = await db.select({ revision: releases.revision }).from(releases).where(eq(releases.id, id)).limit(1); await db.update(releases).set({ status: "checking", revision: (row?.revision ?? 0) + 1, updatedAt: new Date() }).where(eq(releases.id, id)); }
}
