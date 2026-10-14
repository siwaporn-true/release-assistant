import { createHash } from "node:crypto";

import type { CommitEvidence, PullRequestEvidence, WorkflowEvidence } from "../connectors/github/contracts";
import type { NormalizedJiraIssue } from "../connectors/jira/normalize";
import { classifyTicket } from "../domain/release/classify-ticket";
import { evaluateCodeGate } from "../domain/release/code-gate";
import { evaluateBuildGate } from "../domain/release/build-gate";
import { evaluateRelease, type ReleaseAssessment } from "../domain/release/evaluate-release";
import { matchPullRequests } from "../domain/release/match-pull-requests";
import { prioritizeActions } from "../domain/release/prioritize-actions";
import { evaluateScopeGate, type GateAssessment } from "../domain/release/scope-gate";
import { PostgresReleaseRepository, type ReleaseRepository } from "../db/release-repository";

export interface RefreshDependencies {
  repository: ReleaseRepository;
  now: () => Date;
  loadJiraIssues: (input: { userId: string; projectKey: string; fixVersionId: string }) => Promise<NormalizedJiraIssue[]>;
  loadPullRequests: (input: { userId: string; owner: string; repo: string; releaseBranch: string }) => Promise<PullRequestEvidence[]>;
  loadBranchHead: (input: { userId: string; owner: string; repo: string; releaseBranch: string }) => Promise<CommitEvidence>;
  loadWorkflow: (input: { userId: string; owner: string; repo: string; releaseBranch: string; sha: string; workflowId: string }) => Promise<WorkflowEvidence>;
}

const cannotVerify = (ruleId: string): GateAssessment => ({ status: "cannot_verify", findings: [{ ruleId, status: "cannot_verify" }] });

function stableFingerprint(value: unknown): string {
  const stripObserved = JSON.stringify(value, (key, item) => key === "observedAt" ? undefined : item);
  return createHash("sha256").update(stripObserved).digest("hex");
}

export async function refreshReleaseWithDependencies(releaseId: string, actorId: string, deps: RefreshDependencies): Promise<ReleaseAssessment> {
  const current = await deps.repository.get(releaseId);
  if (!current) throw new Error("Release not found");
  if (current.config.ownerId !== actorId) throw new Error("Release access denied");
  const common = { userId: actorId, owner: current.config.githubOwner, repo: current.config.githubRepo, releaseBranch: current.config.releaseBranch };
  const connectorErrors: Record<string, string> = {};
  let jiraIssues = current.evidence.jiraIssues;
  let pullRequests = current.evidence.pullRequests;
  let branchHead = current.evidence.branchHead;
  let workflow = current.evidence.workflow;

  try { jiraIssues = await deps.loadJiraIssues({ userId: actorId, projectKey: current.config.jiraProjectKey, fixVersionId: current.config.jiraFixVersionId }); }
  catch (error) { connectorErrors.jira = error instanceof Error ? error.message : "Jira unavailable"; }
  try { pullRequests = await deps.loadPullRequests(common); }
  catch (error) { connectorErrors.github = error instanceof Error ? error.message : "GitHub unavailable"; }
  try { branchHead = await deps.loadBranchHead(common); }
  catch (error) { connectorErrors.github = error instanceof Error ? error.message : "GitHub unavailable"; }
  if (branchHead) {
    try { workflow = await deps.loadWorkflow({ ...common, sha: branchHead.sha, workflowId: current.config.workflowId }); }
    catch (error) { connectorErrors.githubActions = error instanceof Error ? error.message : "GitHub Actions unavailable"; }
  }

  const classifications = (jiraIssues ?? []).map((issue) => ({ issue, classification: classifyTicket(issue, { referenceIssueTypes: ["Epic", "Reference"], codeIssueTypes: ["Story", "Story-TrueApp", "Bug", "Bug-TrueApp", "Task", "Sub-Task-TrueApp"] }) }));
  const baselineKeys = current.baselineKeys.length ? current.baselineKeys : classifications.map(({ issue }) => issue.key);
  const scope = connectorErrors.jira
    ? cannotVerify("jira_unavailable")
    : evaluateScopeGate({ issues: classifications.map(({ issue, classification }) => ({ key: issue.key, blocked: issue.blocked, classification: classification.kind })), baselineKeys, evidenceState: "current" });

  let code: GateAssessment;
  if (connectorErrors.github || !pullRequests || !branchHead) code = cannotVerify("github_unavailable");
  else {
    const matches = classifications.map(({ issue, classification }) => {
      const match = matchPullRequests({ key: issue.key, classification }, pullRequests!);
      if (match.status !== "matched") return match;
      const pullRequest = pullRequests!.find((candidate) => candidate.number === match.pullRequestNumber)!;
      return { status: "matched" as const, pullRequest };
    });
    const knownReleaseShas = [branchHead.sha, ...pullRequests.filter((pr) => pr.targetBranch === current.config.releaseBranch && pr.merged).flatMap((pr) => pr.mergeCommitSha ? [pr.mergeCommitSha] : [])];
    code = evaluateCodeGate({ releaseBranch: current.config.releaseBranch, releaseCommitShas: knownReleaseShas, matches });
  }
  const build = connectorErrors.githubActions || !branchHead ? cannotVerify("github_actions_unavailable") : evaluateBuildGate({ currentSha: branchHead.sha, workflow });
  const assessment = evaluateRelease({ scope, code, build, exceptions: [] });
  const evidence = { ...current.evidence, ...(jiraIssues ? { jiraIssues } : {}), ...(pullRequests ? { pullRequests } : {}), ...(branchHead ? { branchHead } : {}), ...(workflow ? { workflow } : {}) };
  const fingerprint = stableFingerprint({ evidence, connectorErrors, assessment });
  const revision = fingerprint === current.fingerprint ? current.revision : current.revision + 1;
  await deps.repository.saveRefresh(releaseId, { revision, lastRefreshedAt: deps.now().toISOString(), assessment, actions: prioritizeActions(assessment), evidence, connectorErrors, baselineKeys, fingerprint });
  return assessment;
}

export async function refreshRelease(releaseId: string, actorId: string): Promise<ReleaseAssessment> {
  const [{ loadFixVersionIssues }, github] = await Promise.all([import("../connectors/jira/client"), import("../connectors/github/client")]);
  return refreshReleaseWithDependencies(releaseId, actorId, {
    repository: new PostgresReleaseRepository(), now: () => new Date(),
    loadJiraIssues: loadFixVersionIssues,
    loadPullRequests: github.listPullRequestEvidence,
    loadBranchHead: github.getReleaseBranchHead,
    loadWorkflow: github.getWorkflowEvidence,
  });
}
