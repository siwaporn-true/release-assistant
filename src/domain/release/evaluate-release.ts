import type { GateAssessment, ReleaseFinding } from "./scope-gate";
import type { AssessmentStatus } from "./types";

export interface ReleaseException {
  ruleId: string;
  subject?: string;
  reason: string;
  approverId: string;
}

export interface ReleaseAssessment {
  status: AssessmentStatus;
  readyForQa: boolean;
  gates: { scope: GateAssessment; code: GateAssessment; build: GateAssessment };
  findings: ReleaseFinding[];
  appliedExceptions: ReleaseException[];
}

const severity: Record<AssessmentStatus, number> = {
  passed: 0,
  needs_confirmation: 1,
  checking: 2,
  cannot_verify: 3,
  blocked: 4,
};

function exceptionMatches(finding: ReleaseFinding, exception: ReleaseException): boolean {
  return finding.ruleId === exception.ruleId &&
    (exception.subject === undefined || exception.subject === finding.subject);
}

export function evaluateRelease(input: {
  scope: GateAssessment;
  code: GateAssessment;
  build: GateAssessment;
  exceptions: ReleaseException[];
}): ReleaseAssessment {
  const allFindings = [...input.scope.findings, ...input.code.findings, ...input.build.findings];
  const appliedExceptions = input.exceptions.filter((exception) =>
    allFindings.some((finding) => exceptionMatches(finding, exception)),
  );
  const findings = allFindings.filter((finding) =>
    !appliedExceptions.some((exception) => exceptionMatches(finding, exception)),
  );
  const status = findings.reduce<AssessmentStatus>(
    (current, finding) => severity[finding.status] > severity[current] ? finding.status : current,
    "passed",
  );
  return {
    status,
    readyForQa: status === "passed",
    gates: { scope: input.scope, code: input.code, build: input.build },
    findings,
    appliedExceptions,
  };
}
