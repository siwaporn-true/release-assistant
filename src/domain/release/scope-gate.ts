import type { AssessmentStatus } from "./types";

export interface ReleaseFinding {
  ruleId: string;
  status: Exclude<AssessmentStatus, "passed">;
  subject?: string;
  message?: string;
}

export interface GateAssessment {
  status: AssessmentStatus;
  findings: ReleaseFinding[];
}

export interface ScopeGateInput {
  issues: Array<{
    key: string;
    blocked: boolean;
    classification: "code_bearing" | "reference_only" | "needs_confirmation";
  }>;
  baselineKeys: string[];
  evidenceState: "current" | "stale" | "unavailable";
}

export function evaluateScopeGate(input: ScopeGateInput): GateAssessment {
  if (input.evidenceState === "unavailable") {
    return {
      status: "cannot_verify",
      findings: [{ ruleId: "jira_unavailable", status: "cannot_verify" }],
    };
  }

  const findings: ReleaseFinding[] = [];
  if (input.evidenceState === "stale") {
    findings.push({ ruleId: "jira_evidence_stale", status: "needs_confirmation" });
  }

  const baseline = new Set(input.baselineKeys);
  const current = new Set(input.issues.map((issue) => issue.key));
  for (const key of current) {
    if (!baseline.has(key)) findings.push({ ruleId: "scope_added", status: "needs_confirmation", subject: key });
  }
  for (const key of baseline) {
    if (!current.has(key)) findings.push({ ruleId: "scope_removed", status: "needs_confirmation", subject: key });
  }
  for (const issue of input.issues) {
    if (issue.blocked) findings.push({ ruleId: "jira_issue_blocked", status: "blocked", subject: issue.key });
    if (issue.classification === "needs_confirmation") {
      findings.push({ ruleId: "ticket_classification_uncertain", status: "needs_confirmation", subject: issue.key });
    }
  }

  return {
    status: findings.some((finding) => finding.status === "blocked")
      ? "blocked"
      : findings.length
        ? "needs_confirmation"
        : "passed",
    findings,
  };
}
