import type { AssessmentStatus } from "./types";

interface GatePr { number: number; targetBranch: string; merged: boolean; mergeable: boolean | null; review: string; checks: string; mergeCommitSha: string | null }
type GateMatch =
  | { status: "matched"; pullRequest: GatePr }
  | { status: "ambiguous" }
  | { status: "missing" }
  | { status: "not_required" };
export interface GateFinding { ruleId: string; status: Exclude<AssessmentStatus, "passed">; pullRequestNumber?: number }
export interface GateAssessment { status: AssessmentStatus; findings: GateFinding[] }

export function evaluateCodeGate(input: { releaseBranch: string; releaseCommitShas: string[]; matches: GateMatch[] }): GateAssessment {
  const findings: GateFinding[] = [];
  for (const match of input.matches) {
    if (match.status === "not_required") continue;
    if (match.status === "missing") { findings.push({ ruleId: "missing_pull_request", status: "blocked" }); continue; }
    if (match.status === "ambiguous") { findings.push({ ruleId: "ambiguous_pull_request", status: "needs_confirmation" }); continue; }
    const pr = match.pullRequest;
    const finding =
      pr.targetBranch !== input.releaseBranch ? "wrong_target_branch" :
      !pr.merged ? "pull_request_open" :
      pr.mergeable === false ? "pull_request_conflicted" :
      pr.review !== "approved" ? "review_missing" :
      pr.checks !== "passed" ? "checks_failed" :
      !pr.mergeCommitSha || !input.releaseCommitShas.includes(pr.mergeCommitSha) ? "change_not_in_release" : null;
    if (finding) findings.push({ ruleId: finding, status: "blocked", pullRequestNumber: pr.number });
  }
  return { status: findings.some((item) => item.status === "blocked") ? "blocked" : findings.length ? "needs_confirmation" : "passed", findings };
}
