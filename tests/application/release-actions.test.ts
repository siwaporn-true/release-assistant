import { describe, expect, it, vi } from "vitest";
import { createExceptionWithDependencies } from "../../src/application/create-exception";
import { createHandoffWithDependencies } from "../../src/application/create-handoff";
import { rerunWorkflowWithDependencies } from "../../src/application/rerun-workflow";
import { MemoryAuditRepository, type ActionRelease } from "../../src/db/audit-repository";

const release: ActionRelease = { id: "release-1", ownerId: "user-1", revision: 4, status: "blocked", assessment: { status: "blocked", readyForQa: false, findings: [{ ruleId: "workflow_failed", status: "blocked", subject: "abc1234" }], gates: {}, appliedExceptions: [] }, config: { jiraProjectKey: "SUN", jiraFixVersionId: "21221", releaseBranch: "release/12.3.0", githubOwner: "org", githubRepo: "app", workflowId: "preprod.yml" }, evidence: { jiraIssues: [{ key: "SUN-1" }], pullRequests: [{ number: 21 }], branchHead: { sha: "abc1234" }, workflow: { runId: 88, result: "failed", sha: "abc1234" } } };

describe("audited release actions", () => {
  it("requires complete exception approval and records the original rule", async () => {
    const repository = new MemoryAuditRepository([release]);
    await expect(createExceptionWithDependencies({ releaseId: "release-1", expectedRevision: 4, actorId: "user-1", ruleId: "workflow_failed", reason: "", approverId: "lead-1" }, { repository })).rejects.toThrow("reason");
    const result = await createExceptionWithDependencies({ releaseId: "release-1", expectedRevision: 4, actorId: "user-1", ruleId: "workflow_failed", reason: "Accepted for test", approverId: "lead-1" }, { repository, now: () => new Date("2026-10-14T06:00:00.000Z") });
    expect(result.status).toBe("checking"); expect(repository.exceptions[0]).toMatchObject({ ruleId: "workflow_failed", approverId: "lead-1" }); expect(repository.events[0].outcome).toBe("succeeded");
  });

  it("requires exact confirmation, failed run, permission, and audits failure", async () => {
    const repository = new MemoryAuditRepository([release]); const rerun = vi.fn().mockResolvedValue(undefined);
    await expect(rerunWorkflowWithDependencies({ releaseId: "release-1", expectedRevision: 4, actorId: "user-1", confirmation: { repository: "wrong/app", workflowId: "preprod.yml", branch: "release/12.3.0", sha: "abc1234" } }, { repository, rerunFailedJobs: rerun, canRerun: async () => true })).rejects.toThrow("confirmation");
    expect(repository.events.at(-1)?.outcome).toBe("failed");
    await expect(rerunWorkflowWithDependencies({ releaseId: "release-1", expectedRevision: 4, actorId: "user-1", confirmation: { repository: "org/app", workflowId: "preprod.yml", branch: "release/12.3.0", sha: "abc1234" } }, { repository, rerunFailedJobs: rerun, canRerun: async () => false })).rejects.toThrow("permission");
  });

  it("re-runs only failed jobs and records a successful audit event", async () => {
    const repository = new MemoryAuditRepository([release]); const rerun = vi.fn().mockResolvedValue(undefined);
    const event = await rerunWorkflowWithDependencies({ releaseId: "release-1", expectedRevision: 4, actorId: "user-1", confirmation: { repository: "org/app", workflowId: "preprod.yml", branch: "release/12.3.0", sha: "abc1234" } }, { repository, rerunFailedJobs: rerun, canRerun: async () => true });
    expect(rerun).toHaveBeenCalledWith(expect.objectContaining({ runId: 88 })); expect(event.outcome).toBe("succeeded");
  });

  it("rejects stale/non-ready handoffs and creates an immutable evidence snapshot", async () => {
    const ready = structuredClone(release); ready.status = "passed"; ready.assessment.status = "passed"; ready.assessment.readyForQa = true; ready.assessment.findings = []; ready.evidence.workflow!.result = "passed";
    const repository = new MemoryAuditRepository([ready]);
    await expect(createHandoffWithDependencies({ releaseId: "release-1", expectedRevision: 3, actorId: "user-1" }, { repository })).rejects.toThrow("changed");
    const snapshot = await createHandoffWithDependencies({ releaseId: "release-1", expectedRevision: 4, actorId: "user-1" }, { repository, now: () => new Date("2026-10-14T06:00:00.000Z") });
    expect(snapshot).toMatchObject({ revision: 4, commitSha: "abc1234", actorId: "user-1" }); expect(snapshot.snapshotData).toMatchObject({ ticketKeys: ["SUN-1"], selectedPullRequests: [21] }); expect(JSON.stringify(snapshot)).not.toMatch(/artifact/i);
  });
});
