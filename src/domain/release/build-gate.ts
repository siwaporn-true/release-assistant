import type { WorkflowEvidence } from "../../connectors/github/contracts";
import type { GateAssessment } from "./scope-gate";

export interface BuildGateInput {
  currentSha: string;
  workflow?: WorkflowEvidence;
}

export function evaluateBuildGate(input: BuildGateInput): GateAssessment {
  const workflow = input.workflow;
  if (!workflow) {
    return {
      status: "cannot_verify",
      findings: [{ ruleId: "workflow_evidence_missing", status: "cannot_verify" }],
    };
  }
  if (workflow.freshness === "stale") {
    return {
      status: "needs_confirmation",
      findings: [{ ruleId: "workflow_evidence_stale", status: "needs_confirmation" }],
    };
  }
  if (workflow.sha !== input.currentSha) {
    return {
      status: "blocked",
      findings: [{ ruleId: "workflow_sha_mismatch", status: "blocked", subject: workflow.sha }],
    };
  }
  if (workflow.result === "checking") {
    return {
      status: "checking",
      findings: [{ ruleId: "workflow_running", status: "checking", subject: String(workflow.runId) }],
    };
  }
  if (workflow.result === "failed") {
    return {
      status: "blocked",
      findings: [{ ruleId: "workflow_failed", status: "blocked", subject: String(workflow.runId) }],
    };
  }
  if (workflow.result !== "passed") {
    return {
      status: "cannot_verify",
      findings: [{ ruleId: "workflow_result_unknown", status: "cannot_verify" }],
    };
  }
  return { status: "passed", findings: [] };
}
