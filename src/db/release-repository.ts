import { eq } from "drizzle-orm";

import { releases } from "./schema";
import type { ReleaseAssessment } from "../domain/release/evaluate-release";
import type { RecommendedAction } from "../domain/release/prioritize-actions";
import type { NormalizedJiraIssue } from "../connectors/jira/normalize";
import type { CommitEvidence, PullRequestEvidence, WorkflowEvidence } from "../connectors/github/contracts";
import type { ReleaseException } from "../domain/release/evaluate-release";

export interface ReleaseConfiguration {
  id: string;
  ownerId: string;
  jiraProjectKey: string;
  jiraFixVersionId: string;
  releaseBranch: string;
  githubOwner: string;
  githubRepo: string;
  workflowId: string;
}

export interface StoredRelease {
  config: ReleaseConfiguration;
  revision: number;
  lastRefreshedAt: string | null;
  assessment: ReleaseAssessment | null;
  actions: RecommendedAction[];
  evidence: {
    jiraIssues?: NormalizedJiraIssue[];
    pullRequests?: PullRequestEvidence[];
    branchHead?: CommitEvidence;
    workflow?: WorkflowEvidence;
    [key: string]: unknown;
  };
  connectorErrors: Record<string, string>;
  baselineKeys: string[];
  fingerprint: string | null;
  exceptions?: ReleaseException[];
}

export interface ReleaseRepository {
  get(releaseId: string): Promise<StoredRelease | null>;
  create(config: ReleaseConfiguration): Promise<StoredRelease>;
  saveRefresh(releaseId: string, next: Omit<StoredRelease, "config">): Promise<StoredRelease>;
}

function blank(config: ReleaseConfiguration): StoredRelease {
    return { config, revision: 0, lastRefreshedAt: null, assessment: null, actions: [], evidence: {}, connectorErrors: {}, baselineKeys: [], fingerprint: null, exceptions: [] };
}

export class MemoryReleaseRepository implements ReleaseRepository {
  private readonly records = new Map<string, StoredRelease>();
  constructor(configs: ReleaseConfiguration[] = []) {
    for (const config of configs) this.records.set(config.id, blank(config));
  }
  async get(releaseId: string) { return structuredClone(this.records.get(releaseId) ?? null); }
  getStored(releaseId: string) { return structuredClone(this.records.get(releaseId)); }
  async create(config: ReleaseConfiguration) {
    if (this.records.has(config.id)) throw new Error("Release already exists");
    const record = blank(config); this.records.set(config.id, record); return structuredClone(record);
  }
  async saveRefresh(releaseId: string, next: Omit<StoredRelease, "config">) {
    const current = this.records.get(releaseId); if (!current) throw new Error("Release not found");
    const record = { ...next, config: current.config }; this.records.set(releaseId, record); return structuredClone(record);
  }
}

export class PostgresReleaseRepository implements ReleaseRepository {
  async get(releaseId: string): Promise<StoredRelease | null> {
    const { db } = await import("./client");
    const { exceptions } = await import("./schema");
    const [row] = await db.select().from(releases).where(eq(releases.id, releaseId)).limit(1);
    if (!row) return null;
    return {
      config: { id: row.id, ownerId: row.ownerId, jiraProjectKey: row.jiraProjectKey, jiraFixVersionId: row.jiraFixVersionId, releaseBranch: row.releaseBranch, githubOwner: row.githubOwner, githubRepo: row.githubRepo, workflowId: row.workflowId },
      revision: row.revision,
      lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? null,
      assessment: row.assessmentData as ReleaseAssessment | null,
      actions: row.actionData as RecommendedAction[],
      evidence: await this.loadEvidence(releaseId),
      connectorErrors: row.connectorErrors as Record<string, string>,
      baselineKeys: row.baselineKeys as string[],
      fingerprint: row.evidenceFingerprint,
      exceptions: (await db.select().from(exceptions).where(eq(exceptions.releaseId, releaseId))).map((item) => ({ ruleId: item.ruleId, reason: item.reason, approverId: item.approverId })),
    };
  }
  private async loadEvidence(releaseId: string): Promise<StoredRelease["evidence"]> {
    const { db } = await import("./client");
    const { evidence } = await import("./schema");
    const rows = await db.select().from(evidence).where(eq(evidence.releaseId, releaseId));
    return Object.fromEntries(rows.map((row) => [row.providerId, row.normalizedData]));
  }
  async create(config: ReleaseConfiguration) {
    const { db } = await import("./client");
    await db.insert(releases).values({ ...config, revision: 0 });
    return blank(config);
  }
  async saveRefresh(releaseId: string, next: Omit<StoredRelease, "config">): Promise<StoredRelease> {
    const { db } = await import("./client");
    const { evidence } = await import("./schema");
    await db.transaction(async (tx) => {
      await tx.update(releases).set({ revision: next.revision, status: next.assessment?.status, baselineKeys: next.baselineKeys, assessmentData: next.assessment, actionData: next.actions, connectorErrors: next.connectorErrors, evidenceFingerprint: next.fingerprint, lastRefreshedAt: next.lastRefreshedAt ? new Date(next.lastRefreshedAt) : null, updatedAt: new Date() }).where(eq(releases.id, releaseId));
      await tx.delete(evidence).where(eq(evidence.releaseId, releaseId));
      const entries = Object.entries(next.evidence).filter((entry): entry is [string, NonNullable<unknown>] => entry[1] !== undefined);
      if (entries.length) await tx.insert(evidence).values(entries.map(([key, value]) => ({ id: crypto.randomUUID(), releaseId, provider: key === "jiraIssues" ? "jira" : key === "workflow" ? "github_actions" : "github", providerId: key, sourceUrl: extractSourceUrl(value), sourceUpdatedAt: extractUpdatedAt(value), observedAt: new Date(), normalizedData: value as object })));
    });
    const saved = await this.get(releaseId); if (!saved) throw new Error("Release not found after refresh"); return saved;
  }
}

function extractSourceUrl(value: unknown): string {
  if (Array.isArray(value)) return String((value[0] as { sourceUrl?: string } | undefined)?.sourceUrl ?? "https://invalid.local/missing");
  return String((value as { sourceUrl?: string })?.sourceUrl ?? "https://invalid.local/missing");
}
function extractUpdatedAt(value: unknown): Date {
  const source = Array.isArray(value) ? value[0] : value;
  const date = new Date(String((source as { sourceUpdatedAt?: string } | undefined)?.sourceUpdatedAt ?? 0));
  return Number.isNaN(date.valueOf()) ? new Date(0) : date;
}
