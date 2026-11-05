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
    const finding: GateFinding | null =
      pr.targetBranch !== input.releaseBranch ? { ruleId: "wrong_target_branch", status: "blocked" } :
      !pr.merged ? { ruleId: "pull_request_open", status: "blocked" } :
      pr.mergeable === false ? { ruleId: "pull_request_conflicted", status: "blocked" } :
      pr.review !== "approved" ? { ruleId: "review_missing", status: "blocked" } :
      pr.checks === "failed" ? { ruleId: "checks_failed", status: "blocked" } :
      pr.checks === "pending" ? { ruleId: "checks_pending", status: "checking" } :
      pr.checks === "unknown" ? { ruleId: "checks_unknown", status: "cannot_verify" } :
      !pr.mergeCommitSha || !input.releaseCommitShas.includes(pr.mergeCommitSha) ? { ruleId: "change_not_in_release", status: "blocked" } : null;
    if (finding) findings.push({ ...finding, pullRequestNumber: pr.number });
  }
  const status = findings.some((item) => item.status === "blocked") ? "blocked" :
    findings.some((item) => item.status === "cannot_verify") ? "cannot_verify" :
    findings.some((item) => item.status === "checking") ? "checking" :
    findings.length ? "needs_confirmation" : "passed";
  return { status, findings };
}
